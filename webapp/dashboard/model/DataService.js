sap.ui.define([], function () {
    "use strict";
    const SELECT = "Id,CustomerName,OppDesc,ReceivedDate,DueSubmissionDate,SubmissionDate,BUDetails,BUDetailsText,Country,Country_Text,Geography,GeographyText,Status,StatusText,Owner,ProposalTypeOp,ProposalTypeOpText,OppTcv,Currency,DeletionIndicator";

    async function readAll(model, progress, cancelled) {
        let rows = [], query = { "$select": SELECT, "$orderby": "Id asc", "$top": "500", "$skip": "0", "$inlinecount": "allpages" };
        const continuations = new Set();
        let expected;
        while (true) {
            if (cancelled && cancelled()) { throw new Error("Request cancelled"); }
            const page = await new Promise((resolve, reject) => model.read("/xNGRxCDS_PS_MASTER", {
                urlParameters: query, success: resolve,
                error: () => reject(new Error("The presales service could not be read. Check your SAP connection and authorization, then refresh."))
            }));
            if (!Array.isArray(page.results)) { throw new Error("Unexpected response from the presales service."); }
            if (page.__count !== undefined) {
                const count = Number(page.__count);
                if (!Number.isSafeInteger(count) || count < 0 || expected !== undefined && expected !== count) {
                    throw new Error("The opportunity count changed during loading. Refresh to obtain consistent totals.");
                }
                expected = count;
            }
            rows = rows.concat(page.results);
            progress(rows.length);
            if (page.__next) {
                const next = new URL(page.__next, "https://odata.invalid/");
                const token = next.searchParams.get("$skiptoken");
                const skip = next.searchParams.get("$skip");
                const signature = token !== null ? "token:" + token : "skip:" + skip;
                if ((!token && skip === null) || continuations.has(signature) || !page.results.length) {
                    throw new Error("The service returned an invalid continuation. Partial totals will not be displayed.");
                }
                continuations.add(signature);
                query = { "$select": SELECT, "$orderby": "Id asc", "$top": "500", "$inlinecount": "allpages" };
                query[token !== null ? "$skiptoken" : "$skip"] = token !== null ? token : skip;
            } else if (expected !== undefined ? rows.length < expected : page.results.length === 500) {
                if (!page.results.length) { throw new Error("The service stopped before all opportunities were loaded. Refresh to try again."); }
                query = { "$select": SELECT, "$orderby": "Id asc", "$top": "500", "$skip": String(rows.length), "$inlinecount": "allpages" };
            } else { break; }
        }
        if (expected !== undefined && rows.length !== expected) { throw new Error("The loaded opportunity count does not match the service total. Refresh to try again."); }
        return rows;
    }
    async function loadRates() {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 12000);
        try {
            // Same indicative rate provider used by the existing pipeline report.
            const response = await fetch("https://open.er-api.com/v6/latest/EUR", { signal: abort.signal, credentials: "omit" });
            if (!response.ok) { throw new Error("Rate service unavailable"); }
            const data = await response.json();
            if (data.result !== "success" || data.base_code !== "EUR" || !data.rates || data.rates.EUR !== 1 || !data.time_last_update_unix) {
                throw new Error("Invalid exchange-rate response");
            }
            const date = new Date(data.time_last_update_unix * 1000);
            if (!Number.isFinite(date.getTime())) { throw new Error("Invalid exchange-rate date"); }
            return { rates: data.rates, date: date.toISOString().slice(0, 10), stale: Date.now() - date.getTime() > 72 * 3600000, failed: false };
        } catch (error) {
            return { rates: { EUR: 1 }, date: "", stale: false, failed: true };
        } finally { clearTimeout(timeout); }
    }
    return { readAll, loadRates };
});
