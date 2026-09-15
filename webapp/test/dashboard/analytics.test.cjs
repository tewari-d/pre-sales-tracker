const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function load(name, globals = {}) {
    let module;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../dashboard/model/", name + ".js"), "utf8"), {
        sap: { ui: { define: (deps, factory) => { module = factory(); } } },
        Date, URL, AbortController, setTimeout, clearTimeout, ...globals
    });
    return module;
}
const A = load("Analytics");
test("size bands ascend from below EUR1, including unavailable EUR values", () => {
    const keys = ["below", "small", "medium", "large", "major", "strategic"];
    assert.deepEqual(Array.from(A.options([], "band"), b => b.key), keys);
    const rows = A.normalize([1000000, 75000, 50000, 25000, 1, 0].map((amount, i) => ({Id:String(i), OppTcv:amount, Currency:"EUR"})).concat({Id:"missing", OppTcv:100, Currency:"XYZ"}), {});
    assert.deepEqual(Array.from(A.group(rows, "band", "count"), b => b.key), keys);
    assert.equal(rows[6].band, "below");
    assert.equal(rows[6].eur, null);
});
const plain = value => JSON.parse(JSON.stringify(value));
const row = (id, overrides = {}) => ({ Id: id, OppTcv: "10000", Currency: "EUR", Status: "WIP", ReceivedDate: "2026-07-01T00:00:00", ...overrides });

test("size boundaries are exclusive at the upper end, including the confirmed €1M band", () => {
    const values = [0, 1, 24999.99, 25000, 49999.99, 50000, 75000, 999999.99, 1000000];
    const normalized = A.normalize(values.map((value, i) => row(String(i), { OppTcv: String(value) })), {});
    assert.deepEqual(plain(normalized.map(r => r.band)), ["below", "small", "small", "medium", "medium", "large", "major", "major", "strategic"]);
});

test("convert foreign values by dividing units per EUR; missing currency or rate is not EUR", () => {
    const rows = A.normalize([
        row("1", { Currency: "USD", OppTcv: "120000" }), row("2", { Currency: "GBP" }),
        row("3", { Currency: "" }), row("4", { OppTcv: "" }), row("5", { OppTcv: "invalid" }), row("6", { OppTcv: "0" })
    ], { USD: 1.2, GBP: 0 });
    assert.deepEqual(plain(rows.map(r => r.eur)), [100000, null, null, null, null, 0]);
    assert.equal(rows[1].band, "below");
});

test("exclude both deleted flags and DELE status", () => {
    const rows = A.normalize([row("1", { DeletionIndicator: true }), row("2", { DeletionIndicator: "X" }), row("3", { Status: "DELE" }), row("4")], {});
    assert.deepEqual(plain(rows.map(r => r.Id)), ["4"]);
});

test("duplicate or missing IDs fail instead of silently inflating totals", () => {
    assert.throws(() => A.normalize([row("1"), row("1")], {}), /duplicate/);
    assert.throws(() => A.normalize([row("")], {}), /missing/);
});

test("date range includes both endpoints and excludes missing received dates", () => {
    const rows = A.normalize([row("1"), row("2", { ReceivedDate: "2026-09-30T00:00:00" }), row("3", { ReceivedDate: "2026-10-01" }), row("4", { ReceivedDate: null })], {});
    assert.deepEqual(plain(A.filter(rows, { from: "2026-07-01", to: "2026-09-30" }).map(r => r.Id)), ["1", "2"]);
    assert.equal(A.filter(rows, {}).length, 4);
});

test("OData UTC dates and local date picker calendar dates keep their intended day", () => {
    assert.equal(A.dateKey(new Date("2026-09-30T00:00:00Z")), "2026-09-30");
    assert.equal(A.dateKey("/Date(1790726400000)/"), "2026-09-30");
    assert.equal(A.dateKey(new Date(2026, 8, 30), true), "2026-09-30");
    assert.equal(A.dateKey("invalid"), "");
});

test("calendar quarters include leap day and year rollover", () => {
    assert.deepEqual(plain(A.quarterRange(2024, 1)), { from: "2024-01-01", to: "2024-03-31" });
    assert.deepEqual(plain(A.quarterRange(2026, 4)), { from: "2026-10-01", to: "2026-12-31" });
});

test("multi-select OR within a dimension, AND across dimensions, with search and unassigned", () => {
    const rows = A.normalize([
        row("1", { BUDetails: "A", Country: "DE", Owner: "", CustomerName: "North Star" }),
        row("2", { BUDetails: "B", Country: "DE", Owner: "Alex" }),
        row("3", { BUDetails: "A", Country: "IN", Owner: "" })
    ], {});
    assert.equal(A.filter(rows, { bu: ["A", "B"], country: ["DE"] }).length, 2);
    assert.deepEqual(plain(A.filter(rows, { bu: ["A", "B"], country: ["DE"], owner: ["__UNASSIGNED__"], search: "STAR" }).map(r => r.Id)), ["1"]);
});

test("verified statuses define pipeline, won, win-rate denominator and overdue correctly", () => {
    const rows = A.normalize(["WIP", "SUBMITTED", "HOLD", "WIN", "COMPLETE", "LOSS", "CLSD", "NOGO"].map((status, i) => row(String(i), { Status: status, DueSubmissionDate: "2026-08-01" })), {});
    const kpi = A.summarize(rows, "2026-09-10");
    assert.equal(kpi.active, 3);
    assert.equal(kpi.pipeline, 30000);
    assert.equal(kpi.wonValue, 20000);
    assert.equal(kpi.winRate, 200 / 3);
    assert.equal(kpi.overdue, 1);
    assert.equal(kpi.total, 8);
});

test("submitted WIP and due today are not overdue; average excludes unavailable EUR", () => {
    const rows = A.normalize([
        row("1", { DueSubmissionDate: "2026-09-10" }),
        row("2", { DueSubmissionDate: "2026-08-01", SubmissionDate: "2026-08-01", Currency: "XXX" })
    ], {});
    const kpi = A.summarize(rows, "2026-09-10");
    assert.equal(kpi.overdue, 0);
    assert.equal(kpi.average, 10000);
    assert.equal(kpi.unconverted, 1);
    assert.equal(kpi.winRate, 0);
});

test("empty results have zero counts and undefined rates/averages", () => {
    const kpi = A.summarize([], "2026-09-10");
    assert.equal(kpi.total, 0);
    assert.equal(kpi.average, null);
    assert.equal(kpi.winRate, 0);
    assert.equal(A.group([], "bu", "count").length, 0);
});

test("group count and EUR reconcile to the filtered summary", () => {
    const rows = A.normalize([row("1", { BUDetails: "A" }), row("2", { BUDetails: "A", Currency: "XXX" }), row("3", { BUDetails: "B" })], {});
    const groups = A.group(rows, "bu", "eur");
    assert.equal(groups.reduce((sum, g) => sum + g.count, 0), 3);
    assert.equal(groups.reduce((sum, g) => sum + g.value, 0), A.summarize(rows, "2026-09-10").value);
});

test("trend fills missing months, uses received date and excludes undated records", () => {
    const rows = A.normalize([row("1", { ReceivedDate: "2026-01-15" }), row("2", { ReceivedDate: "2026-03-15" }), row("3", { ReceivedDate: null })], {});
    assert.deepEqual(plain(A.trend(rows, "month", "count", {})), [{ label: "2026-01", value: 1 }, { label: "2026-02", value: 0 }, { label: "2026-03", value: 1 }]);
    assert.equal(A.trend(rows, "quarter", "eur", {})[0].value, 20000);
});

test("CSV protects formulas, quotes multiline fields, retains IDs, includes report context and blank unavailable EUR", () => {
    const rows = A.normalize([row("0001", { CustomerName: '=HYPERLINK("bad")', OppDesc: "Line one\nLine two", Currency: "XXX" })], {});
    const csv = A.csv(rows, "Q3 · rates unavailable");
    assert.ok(csv.startsWith("\ufeff"));
    assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
    assert.ok(csv.includes('"Line one\nLine two"'));
    assert.ok(csv.includes('"0001"'));
    assert.ok(csv.includes('"","Below \u20ac1"'));
    assert.ok(csv.includes("Q3 · rates unavailable"));
});

function mockModel(pages) {
    const calls = [];
    return { calls, read: (entity, options) => { calls.push({ entity, query: options.urlParameters }); const page = pages.shift(); if (page instanceof Error) { options.error(page); } else { options.success(page); } } };
}
const D = load("DataService");
const N = load("Navigation");

test("owner distribution includes unassigned and respects filtered records", () => {
    const rows = A.normalize([
        row("1", { Owner: "Alex", Status: "WIN" }), row("2", { Owner: "Alex", DueSubmissionDate: "2026-01-01" }),
        row("3", { Owner: "", Currency: "XXX" }), row("4", { Owner: "Jamie" })
    ], {});
    const groups = A.chartMetrics(rows, A.group(rows, "owner", "count"), "owner", "quarter", "2026-09-10");
    const alex = groups.find(g => g.key === "Alex");
    assert.equal(alex.count, 2);
    assert.equal(alex.metrics.pipeline, 10000);
    assert.equal(alex.metrics.wonValue, 10000);
    assert.equal(alex.metrics.overdue, 1);
    assert.equal(alex.metrics.winRate, 100);
    assert.equal(alex.share, 50);
    assert.equal(groups.find(g => g.key === "__UNASSIGNED__").metrics.unconverted, 1);
    const filtered = A.filter(rows, { status: ["WIN"] });
    assert.equal(A.chartMetrics(filtered, A.group(filtered, "owner", "count"), "owner", "quarter", "2026-09-10")[0].share, 100);
});

test("trend hover metrics are scoped to the hovered received-date period", () => {
    const rows = A.normalize([row("1", { Status: "WIN", ReceivedDate: "2026-01-01" }), row("2", { ReceivedDate: "2026-04-01" })], {});
    const groups = A.chartMetrics(rows, A.trend(rows, "quarter", "count", {}), "trend", "quarter", "2026-09-10");
    assert.equal(groups[0].metrics.total, 1);
    assert.equal(groups[0].metrics.wonValue, 10000);
    assert.equal(groups[1].metrics.wonValue, 0);
    assert.equal(groups[1].share, 50);
});

test("duplicate chart descriptions remain separately selectable", () => {
    const rows = A.normalize([row("1", { BUDetails: "A", BUDetailsText: "Same" }), row("2", { BUDetails: "B", BUDetailsText: "Same" })], {});
    assert.deepEqual(plain(A.group(rows, "bu", "count").map(g => g.label)), ["Same (A)", "Same (B)"]);
});

test("detail navigation targets the sibling tracker route and preserves client/language", () => {
    const url = new URL(N.trackerUrl("https://app.example/dashboard/index.html?sap-client=110&sap-language=EN&snapshot=PS4-500", "https://app.example/dashboard/index.html", "0000001001"));
    assert.equal(url.pathname, "/index.html");
    assert.equal(url.hash, "#Detail/0000001001/MidColumnFullScreen");
    assert.equal(url.searchParams.get("sap-client"), "110");
    assert.equal(url.searchParams.get("snapshot"), "PS4-500");
});

test("launchpad detail intent carries the selected opportunity and expanded layout", () => {
    assert.deepEqual(plain(N.trackerTarget("0000001001")), {
        target: { semanticObject: "ZPS_TRACKER", action: "manage" },
        appSpecificRoute: "Detail/0000001001/MidColumnFullScreen"
    });
});

test("detail navigation retains the originating Fiori launchpad intent", () => {
    const origin = "https://app.example/sap/bc/ui2/flp#Tracker-display&/Detail/old/OneColumn";
    const current = "https://app.example/sap/bc/ui5_ui5/ngr/tracker/dashboard/index.html?tracker-url=" + encodeURIComponent(origin);
    const url = new URL(N.trackerUrl(current, current.split("?")[0], "0000001001"));
    assert.equal(url.pathname, "/sap/bc/ui2/flp");
    assert.equal(url.hash, "#Tracker-display&/Detail/0000001001/MidColumnFullScreen");
});

test("untrusted return URLs cannot redirect opportunity details to another origin", () => {
    const current = "https://app.example/dashboard/index.html?tracker-url=" + encodeURIComponent("https://other.example/app#malicious");
    assert.equal(new URL(N.trackerUrl(current, "https://app.example/dashboard/index.html", "1001")).origin, "https://app.example");
});

test("load all pages using the service continuation token and original projection", async () => {
    const model = mockModel([{ results: [row("1")], __count: "2", __next: "https://sap.example/service/xNGRxCDS_PS_MASTER?$skiptoken=abc%2B123" }, { results: [row("2")], __count: "2" }]);
    const result = await D.readAll(model, () => {});
    assert.equal(result.length, 2);
    assert.equal(model.calls[1].query.$skiptoken, "abc+123");
    assert.equal(model.calls[1].query.$select, model.calls[0].query.$select);
    assert.equal(model.calls[1].entity, "/xNGRxCDS_PS_MASTER");
});

test("inline count drives paging even when a service returns fewer than 500 rows", async () => {
    const model = mockModel([{ results: [row("1")], __count: "2" }, { results: [row("2")], __count: "2" }]);
    assert.equal((await D.readAll(model, () => {})).length, 2);
    assert.equal(model.calls[1].query.$skip, "1");
});

test("without count or next, a full 500-row page requires a follow-up", async () => {
    const model = mockModel([{ results: Array.from({ length: 500 }, (_, i) => row(String(i))) }, { results: [row("500")] }]);
    assert.equal((await D.readAll(model, () => {})).length, 501);
});

test("never publish partial results after a failed or empty continuation", async () => {
    await assert.rejects(D.readAll(mockModel([{ results: [row("1")], __count: "2" }, new Error("offline")]), () => {}), /could not be read/);
    await assert.rejects(D.readAll(mockModel([{ results: [row("1")], __count: "2" }, { results: [], __count: "2" }]), () => {}), /stopped/);
});

test("repeating continuations and changing counts fail clearly", async () => {
    const page = { results: [row("1")], __next: "xNGRxCDS_PS_MASTER?$skip=1" };
    await assert.rejects(D.readAll(mockModel([page, page]), () => {}), /invalid continuation/);
    await assert.rejects(D.readAll(mockModel([{ results: [row("1")], __count: "2" }, { results: [row("2")], __count: "3" }]), () => {}), /count changed/);
});

test("currency service failure safely leaves only EUR rate available", async () => {
    const data = load("DataService", { fetch: async () => { throw new Error("offline"); } });
    assert.deepEqual(plain(await data.loadRates()), { rates: { EUR: 1 }, date: "", stale: false, failed: true });
});

test("validate exchange-rate base and report rate date", async () => {
    const payload = { result: "success", base_code: "EUR", rates: { EUR: 1, USD: 1.2 }, time_last_update_unix: Date.now() / 1000 };
    const data = load("DataService", { fetch: async () => ({ ok: true, json: async () => payload }) });
    assert.equal((await data.loadRates()).failed, false);
    payload.base_code = "USD";
    assert.equal((await data.loadRates()).failed, true);
});


test("Below EUR 1 merges unavailable values without inventing amounts or inflating averages", () => {
    const rows = A.normalize([row("1", {OppTcv:"0.5"}),row("2", {Currency:"XXX"}),row("3")], {});
    const selected = A.filter(rows, {band:["below"]});
    assert.equal(selected.length,2);
    assert.equal(selected[1].eur,null);
    assert.equal(A.summarize(selected,"2026-09-14").average,0.5);
    assert.equal(A.summarize(selected,"2026-09-14").unconverted,1);
    assert.equal(A.options(rows,"band").some(o=>o.key==="unknown"),false);
});

test("proposal-coded chart counts reconcile and exposes hover KPIs, including unassigned", () => {
    const rows = A.normalize([row("1", {ProposalTypeOp:"FULL",ProposalTypeOpText:"Full proposal"}),row("2"),row("3", {ProposalTypeOp:"FULL",ProposalTypeOpText:"Full proposal"})], {});
    const groups = A.group(rows,"proposalCode","count");
    const metrics = A.chartMetrics(rows,groups,"proposalCode","quarter","2026-09-14");
    assert.equal(groups.reduce((n,g)=>n+g.count,0),3);
    assert.equal(metrics.find(g=>g.key==="FULL").metrics.total,2);
    assert.equal(metrics.find(g=>g.key==="FULL").metrics.winRate,0);
});

test("owner stacks reconcile totals and preserve proposal keys, zero cells and segment KPIs", () => {
    const rows = A.normalize([
        row("1",{Owner:"Avery",ProposalTypeOp:"FULL",ProposalTypeOpText:"Full proposal",Status:"WIN",OppTcv:"300"}),
        row("2",{Owner:"Avery",ProposalTypeOp:"CAP",ProposalTypeOpText:"Capability",Status:"LOSS",OppTcv:"100"}),
        row("3",{Owner:"Avery",ProposalTypeOp:"CAP",ProposalTypeOpText:"Capability",Currency:"XXX"}),
        row("4",{Owner:"Blair",ProposalTypeOp:"FULL",ProposalTypeOpText:"Full proposal",OppTcv:"200"}),
        row("5",{Owner:"",ProposalTypeOp:"",OppTcv:"0"})
    ],{});
    const stacks=A.ownerProposalStacks(rows,"count","2026-09-14");
    assert.equal(stacks.length,9);
    assert.equal(stacks.reduce((n,s)=>n+s.value,0),5);
    const cap=stacks.find(s=>s.key==="Avery"&&s.proposalKey==="CAP");
    assert.equal(cap.value,2); assert.equal(cap.metrics.value,100);assert.equal(cap.metrics.unconverted,1);
    assert.equal(cap.metrics.winRate,0);assert.equal(cap.ownerMetrics.total,3);assert.equal(cap.ownerMetrics.value,400);
    assert.equal(stacks.find(s=>s.key==="Blair"&&s.proposalKey==="CAP").value,0);
    assert.equal(stacks.find(s=>s.key==="__UNASSIGNED__"&&s.proposalKey==="__UNASSIGNED__").value,1);
    const eur=A.ownerProposalStacks(rows,"eur","2026-09-14");
    assert.equal(eur.reduce((n,s)=>n+s.value,0),600);
    const selected=A.filter(rows,{owner:[cap.key],proposalCode:[cap.proposalKey]});
    assert.equal(selected.length,2);
    assert.equal(A.ownerProposalStacks(selected,"count","2026-09-14")[0].value,2);
    assert.equal(A.ownerProposalStacks([],"count","2026-09-14").length,0);
});

test("stacked hover IDs resolve reversed color series to the correct owner/proposal cell", () => {
    const H=load("ChartHover");
    const rows=["A","B"].flatMap(owner=>["FULL","CAP","EMPTY"].map(proposalKey=>({owner,proposalKey})));
    assert.deepEqual(H.rowForPoint(rows,0,true),{owner:"A",proposalKey:"EMPTY"});
    assert.deepEqual(H.rowForPoint(rows,1,true),{owner:"B",proposalKey:"EMPTY"});
    assert.deepEqual(H.rowForPoint(rows,2,true),{owner:"A",proposalKey:"CAP"});
    assert.deepEqual(H.rowForPoint(rows,5,true),{owner:"B",proposalKey:"FULL"});
    assert.equal(H.rowForPoint(rows,6,true),undefined);
    assert.equal(H.rowForPoint([],0,true),undefined);
    assert.equal(H.rowForPoint(rows,1,false),rows[1]);
    const single=[{owner:"A",proposalKey:"CAP"},{owner:"B",proposalKey:"CAP"}];
    assert.equal(H.rowForPoint(single,1,true),single[1]);
});
