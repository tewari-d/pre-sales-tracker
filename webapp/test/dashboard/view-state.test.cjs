const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
function load(name, dependencies = []) {
    let result;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../dashboard/model", name + ".js"), "utf8"), {
        Date, sap: { ui: { define: (_, factory) => { result = factory(...dependencies); } } }
    });
    return result;
}
const A = load("Analytics"), S = load("ViewState", [A]);
const plain = value => JSON.parse(JSON.stringify(value));
const today = new Date(2026, 8, 14);
test("multiple quarters form an exact union, including gaps and year boundaries", () => {
    const selection = S.selectPeriods(["2026-Q1", "2026-Q3", "all", "2027-Q1", "2026-Q3"], "2026-Q1", true, today);
    assert.deepEqual(plain(selection.periods), ["2026-Q3", "2026-Q1"]);
    assert.equal(selection.disjoint, true);
    const rows = A.normalize(["2026-01-01", "2026-03-31", "2026-04-01", "2026-07-01", "2026-09-30", "2026-10-01", ""].map((date, i) => ({Id:String(i), ReceivedDate:date})), {});
    const filtered = A.filter(rows, selection);
    assert.deepEqual(plain(filtered.map(r => r.Id)), ["0", "1", "3", "4"]);
    assert.deepEqual(plain(A.trend(filtered, "month", "count", selection).map(p => p.label)), ["2026-01", "2026-02", "2026-03", "2026-07", "2026-08", "2026-09"]);
    const halfYear = S.selectPeriods(["2025-Q4", "2026-Q1"], null, false, today);
    assert.equal(halfYear.from, "2025-10-01"); assert.equal(halfYear.to, "2026-03-31"); assert.equal(halfYear.disjoint, false);
    S.remember(["quarters"], {filters:selection,scrollTop:1234});
    const restored = S.take(["quarters"], today);
    assert.deepEqual(plain(restored.filters.periods), plain(selection.periods));
    assert.equal(restored.scrollTop, 1234);
});
test("special periods are exclusive and clearing the last quarter restores current quarter", () => {
    for (const key of ["all", "custom"]) {
        const special = S.selectPeriods(["2026-Q3", key], key, true, today);
        assert.deepEqual(plain(special.periods), [key]);
        assert.equal(special.period, key);
        assert.equal(special.disjoint, false);
    }
    assert.deepEqual(plain(S.selectPeriods([], null, false, today).periods), ["2026-Q3"]);
});
test("first visit defaults to the current calendar quarter, including year boundaries", () => {
    for (const [date, period, from, to] of [
        [today, "2026-Q3", "2026-07-01", "2026-09-30"],
        [new Date(2027, 0, 1), "2027-Q1", "2027-01-01", "2027-03-31"],
        [new Date(2026, 11, 31), "2026-Q4", "2026-10-01", "2026-12-31"]
    ]) {
        const state = S.defaults(date), filters = state.filters;
        assert.equal(state.interval, "month");
        assert.equal(filters.period, period); assert.equal(filters.from, from); assert.equal(filters.to, to);
    }
});
test("future data cannot introduce future quarters; a retained older quarter stays available", () => {
    const periods = S.quarters(["2025-01-01", "2030-01-01"], today, "2023-Q2");
    assert.equal(periods[0].key, "2026-Q3");
    assert.ok(periods.every(p => p.key <= "2026-Q3"));
    assert.ok(periods.some(p => p.key === "2023-Q2"));
});
test("opportunity return restores filters, chart choices, header and exact scroll once", () => {
    const state = S.defaults(today), scope = ["user", "110", "live"];
    Object.assign(state.filters, { period: "custom", periods: ["custom"], from: "2025-01-01", to: "2026-08-31", search: "Acme" });
    for (const key of Object.keys(A.DIMENSIONS)) { state.filters[key] = ["A", "B"]; }
    Object.assign(state, { metric: "eur", breakdown: "geography", interval: "quarter", sort: "CustomerName", scrollTop: 2486, headerExpanded: false });
    S.remember(scope, state);
    assert.deepEqual(plain(S.take(scope, today)), {...plain(state), returning:true});
    assert.deepEqual(plain(S.take(scope, today)), {...plain(S.defaults(today)), returning:false});
});
test("a document reload creates fresh module memory even if an opportunity return was pending", () => {
    const scope = ["user", "110", "live"];
    const state = S.defaults(today); state.filters.period = "all"; state.filters.owner = ["Alex"];
    S.remember(scope, state);
    const reloaded = load("ViewState", [A]);
    assert.equal(reloaded.take(scope, today).filters.period, "2026-Q3");
    assert.equal(reloaded.take(scope, today).interval, "month");
    assert.equal(reloaded.take(scope, today).returning, false);
    assert.equal(S.take(scope, today).filters.period, "all");
});
test("return state is isolated by user, client and source and cleared on failed navigation", () => {
    const scope = ["user", "110", "live"];
    S.remember(scope, S.defaults(today));
    for (const other of [["other", "110", "live"], ["user", "500", "live"], ["user", "110", "PS4-500"]]) {
        assert.equal(S.take(other, today).returning, false);
    }
    S.forget(scope);
    assert.equal(S.take(scope, today).returning, false);
    const state = S.sanitize({filters:{period:"2028-Q1",bu:"bad",owner:["A","A",null]},scrollTop:-30},today);
    assert.equal(state.filters.period,"2026-Q3");
    assert.deepEqual(plain(state.filters.bu),[]);
    assert.deepEqual(plain(state.filters.owner),["A"]);
    assert.equal(state.scrollTop,0);
});
test("all dates remains explicit; malformed custom dates are not restored", () => {
    assert.equal(S.sanitize({filters:{period:"all"}}, today).filters.from, "");
    assert.equal(S.sanitize({filters:{period:"custom",from:"2026-02-30",to:"2026-03-01"}}, today).filters.period, "2026-Q3");
});
test("the retired free-text proposal field is not a dimension and is ignored as a filter or breakdown", () => {
    assert.equal(A.DIMENSIONS.proposal, undefined);
    const rows = A.normalize([
        {Id:"1", ProposalTypeOp:"FULL", BUDetails:"A"},
        {Id:"2", ProposalTypeOp:"CAP", BUDetails:"A"}
    ], {});
    // A stale saved state may still carry the old key; it must neither filter nor be restored.
    assert.equal(A.filter(rows,{proposal:["Implementation"]}).length, 2);
    const state = S.sanitize({filters:{proposal:["Implementation"]}, breakdown:"proposal"}, today);
    assert.equal(state.filters.proposal, undefined);
    assert.equal(state.breakdown, "bu");
});
test("coded proposal help shows descriptions and the CSV export carries only the coded proposal type", () => {
    const rows = A.normalize([
        {Id:"1", ProposalTypeOp:"FULL", ProposalTypeOpText:"Full-fledged proposal"},
        {Id:"2", ProposalTypeOp:"CAP", ProposalTypeOpText:"Capability presentation"},
        {Id:"3", ProposalTypeOp:""}
    ], {});
    assert.deepEqual(plain(A.options(rows,"proposalCode").map(o=>o.text)), ["Capability presentation","Full-fledged proposal","Unassigned"]);
    assert.deepEqual(plain(A.filter(rows,{proposalCode:["FULL"]}).map(r=>r.Id)), ["1"]);
    const csv = A.csv(rows, "");
    assert.ok(csv.includes('"EUR band","Proposal type","Report context"'));
    assert.ok(!csv.includes("free text"));
    assert.ok(csv.includes('"Full-fledged proposal",""'));
});
test("default proposal filter is full-fledged plus unassigned; prune drops keys no loaded row carries", () => {
    assert.deepEqual(plain(S.defaults(today).filters.proposalCode), ["FULL", "__UNASSIGNED__"]);
    const rows = A.normalize([{Id:"1", ProposalTypeOp:"FULL"}, {Id:"2", ProposalTypeOp:"CAP"}], {});
    const options = {};
    Object.keys(A.DIMENSIONS).forEach(d => { options[d] = A.options(rows, d); });
    const pruned = S.prune(S.defaults(today).filters, options);
    assert.deepEqual(plain(pruned.proposalCode), ["FULL"]);
    assert.equal(pruned.period, S.defaults(today).filters.period);
    assert.equal(A.filter(rows, pruned).length, 0); // both rows are outside the default quarter
    assert.equal(A.filter(rows, Object.assign({}, pruned, { period: "all", periods: ["all"], from: "", to: "" })).length, 1);
    // Rows without a proposal type keep the unassigned default.
    const mixed = A.normalize([{Id:"1", ProposalTypeOp:"FULL"}, {Id:"2", ProposalTypeOp:""}], {});
    Object.keys(A.DIMENSIONS).forEach(d => { options[d] = A.options(mixed, d); });
    assert.deepEqual(plain(S.prune(S.defaults(today).filters, options).proposalCode), ["FULL", "__UNASSIGNED__"]);
    // Missing options never throw and leave dimension filters empty.
    assert.deepEqual(plain(S.prune(S.defaults(today).filters, {}).proposalCode), []);
    // Sanitize keeps an explicitly cleared proposal filter cleared.
    assert.deepEqual(plain(S.sanitize({filters:{proposalCode:[]}}, today).filters.proposalCode), []);
});
