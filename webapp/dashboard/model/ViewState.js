sap.ui.define(["com/ngr/presales/dashboard/model/Analytics"], function (Analytics) {
    "use strict";
    // Module memory survives FLP app navigation, but never a document reload.
    const returns = new Map();
    function defaults(now = new Date()) {
        const year = now.getFullYear(), quarter = Math.floor(now.getMonth() / 3) + 1;
        const filters = Object.assign({ period: `${year}-Q${quarter}`, periods: [`${year}-Q${quarter}`], disjoint: false, search: "" }, Analytics.quarterRange(year, quarter));
        Object.keys(Analytics.DIMENSIONS).forEach(key => { filters[key] = []; });
        return { filters, metric: "count", breakdown: "bu", interval: "month", sort: "eur", scrollTop: 0, headerExpanded: true };
    }
    function quarters(receivedDates, now = new Date(), selected = "") {
        const year = now.getFullYear(), quarter = Math.floor(now.getMonth() / 3) + 1;
        const years = receivedDates.concat(selected).map(date => Number(date.slice(0, 4))).filter(y => y > 0 && y <= year);
        const minimum = Math.max(year - 100, Math.min(year - 1, ...years));
        const result = [];
        for (let y = year; y >= minimum; y--) {
            for (let q = y === year ? quarter : 4; q >= 1; q--) {
                result.push({ key: `${y}-Q${q}`, text: `Q${q} ${y}` });
            }
        }
        return result;
    }
    function selectPeriods(keys, changedKey, selected, now = new Date()) {
        if (selected && ["all", "custom"].includes(changedKey)) {
            return { period: changedKey, periods: [changedKey], from: "", to: "", disjoint: false };
        }
        const current = defaults(now).filters.period;
        const periods = [...new Set(keys.filter(key => /^\d{4}-Q[1-4]$/.test(key) && key >= "1900-Q1" && key <= current))].sort().reverse();
        if (!periods.length) { periods.push(current); }
        const range = key => Analytics.quarterRange(Number(key.slice(0, 4)), Number(key.slice(-1)));
        const ordinal = key => Number(key.slice(0, 4)) * 4 + Number(key.slice(-1));
        return {
            period: periods.length === 1 ? periods[0] : "quarters", periods,
            from: range(periods[periods.length - 1]).from, to: range(periods[0]).to,
            disjoint: ordinal(periods[0]) - ordinal(periods[periods.length - 1]) + 1 !== periods.length
        };
    }
    function sanitize(value, now = new Date()) {
        const state = defaults(now);
        if (!value || typeof value !== "object") { return state; }
        const filters = value.filters || {};
        Object.keys(Analytics.DIMENSIONS).forEach(key => {
            if (Array.isArray(filters[key])) { state.filters[key] = [...new Set(filters[key].filter(v => typeof v === "string"))]; }
        });
        if (typeof filters.search === "string") { state.filters.search = filters.search; }
        const match = /^(\d{4})-Q([1-4])$/.exec(filters.period);
        if (filters.period === "all") {
            Object.assign(state.filters, selectPeriods([], "all", true, now));
        } else if (filters.period === "quarters" && Array.isArray(filters.periods)) {
            Object.assign(state.filters, selectPeriods(filters.periods, null, false, now));
        } else if (match && filters.period <= state.filters.period) {
            Object.assign(state.filters, selectPeriods([filters.period], null, false, now));
        } else if (filters.period === "custom" && [filters.from, filters.to].every(date =>
            typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) && filters.from <= filters.to) {
            Object.assign(state.filters, { period: "custom", periods: ["custom"], disjoint: false, from: filters.from, to: filters.to });
        }
        const allowed = { metric: ["count", "eur"], breakdown: Object.keys(Analytics.DIMENSIONS), interval: ["quarter", "month"], sort: ["eur", "received", "CustomerName"] };
        Object.keys(allowed).forEach(key => { if (allowed[key].includes(value[key])) { state[key] = value[key]; } });
        state.scrollTop = Number.isFinite(value.scrollTop) ? Math.max(0, value.scrollTop) : 0;
        state.headerExpanded = value.headerExpanded !== false;
        return state;
    }
    function take(scope, now) {
        const key = JSON.stringify(scope), value = returns.get(key);
        returns.delete(key);
        return Object.assign(sanitize(value, now), { returning: !!value });
    }
    function remember(scope, value) { returns.set(JSON.stringify(scope), sanitize(value)); }
    function forget(scope) { returns.delete(JSON.stringify(scope)); }
    return { defaults, quarters, selectPeriods, sanitize, take, remember, forget };
});
