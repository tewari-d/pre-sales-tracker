// Run with the Playwright browser tool's filename option against start-dashboard-mock on port 8083.
async (page) => {
    const results = [];
    const check = (condition, label) => { if (!condition) { throw new Error(label); } results.push(label); };
    const state = () => page.evaluate(async () => {
        const Component = await new Promise(resolve => sap.ui.require(["sap/ui/core/Component"], resolve));
        const controller = Component.getComponentById("dashboard-container-presales-dashboard").getRootControl().getController();
        const model = controller._viewModel;
        return { kpis: model.getProperty("/kpis"), filters: model.getProperty("/filters"), warning: model.getProperty("/warning"), error: model.getProperty("/error"), loaded: model.getProperty("/loaded") };
    });
    const settled = () => page.waitForFunction(() => {
        const Component = sap.ui.require("sap/ui/core/Component");
        const controller = Component && Component.getComponentById("dashboard-container-presales-dashboard")?.getRootControl()?.getController();
        return controller && !controller._viewModel.getProperty("/busy");
    });
    const reset = async () => {
        await page.getByRole("button", { name: "Reset filters", exact: true }).click();
        const expected = new Date().getFullYear() + "-Q" + (Math.floor(new Date().getMonth() / 3) + 1);
        check((await state()).filters.period === expected, "Reset restores current quarter");
        await page.getByRole("combobox", { name: "Received date period", exact: true }).click();
        await page.getByRole("option", { name: "All received dates", exact: true }).click();
    };
    const choose = async (name, option) => {
        const combo = page.getByRole("combobox", { name, exact: true });
        await combo.focus();
        await combo.press("F4");
        await page.locator('[role="dialog"]:visible').getByText(option, { exact: true }).click({ timeout: 5000 });
        await page.keyboard.press("Escape");
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route("https://open.er-api.com/v6/latest/EUR", route => route.fulfill({ json: {
        result: "success", base_code: "EUR", rates: { EUR: 1, USD: 1.2 }, time_last_update_unix: Math.floor(Date.now() / 1000)
    } }));
    await page.goto("http://localhost:8083/dashboard/index.html?sap-ui-xx-componentPreload=off");
    await page.getByRole("heading", { name: "Presales Dashboard", exact: true }).waitFor();
    await settled();
    await reset();
    check((await state()).kpis.total === 48, "48 fixture opportunities loaded");
    check((await state()).kpis.overdue === 7, "missing submission dates stay null; seven overdue submissions");
    for (const name of ["trend", "status", "breakdown", "band", "owner", "proposalCode"]) {
        await page.locator('[id$="' + name + 'Chart"] .v-datapoint').first().hover();
        await page.getByText("Share of filtered opportunities", { exact: true }).last().waitFor({ timeout: 5000 });
        results.push(name + " chart shows hover KPIs");
        await page.mouse.move(0, 0);
    }
    await page.locator('[id$="ownerChart"] .v-datapoint').first().click();
    await page.waitForFunction(() => document.querySelector(".dashboardContext").textContent.includes("Owner:"));
    check((await state()).filters.owner.length === 1, "owner distribution drilldown");
    await reset();
    await page.locator('[id$="periodFilter"]').click();
    await page.getByRole("option", { name: "Q3 2026", exact: true }).click();
    check((await state()).kpis.total === 12, "quarter filter");
    await reset();
    await choose("Business unit", "Consulting");
    check((await state()).kpis.total === 12, "business unit filter");
    await choose("Country / Region", "Germany");
    check((await state()).kpis.total === 4, "combined BU and country filter");
    await reset();
    await choose("Geography", "Asia Pacific");
    check((await state()).kpis.total === 16, "geography filter");
    await reset();
    await choose("Owner", "Alex Morgan");
    check((await state()).kpis.total === 10, "owner filter");
    await reset();
    await choose("Status", "Win");
    check((await state()).kpis.total === 7 && (await state()).kpis.winRate === 100, "status filter and win rate");
    await reset();
    await choose("Opportunity size · EUR", "€1M+");
    check((await state()).kpis.total === 6, "confirmed €1M+ band");
    await reset();
    const range = page.getByRole("textbox", { name: "Received date range", exact: true });
    await range.fill("2026-01-02 – 2026-01-02");
    await range.press("Enter");
    check((await state()).kpis.total === 1, "custom range includes both endpoints");
    await range.fill("invalid date");
    await range.press("Enter");
    check((await state()).kpis.total === 1, "invalid date retains last valid results");
    await reset();
    await page.locator('[id$="trendChart"] .v-datapoint').first().click();
    await page.waitForFunction(() => document.querySelector(".dashboardScope").textContent.includes("18 of 48"));
    check((await state()).kpis.total === 18, "clicking a chart filters the dashboard");
    await reset();
    await page.locator('[id$="metricSelect"]').click();
    await page.getByRole("option", { name: "Opportunity value (EUR)", exact: true }).click();
    check((await state()).kpis.value === 14718000, "EUR measure reconciles to fixture totals");
    const search = page.getByRole("searchbox", { name: "Search customer, opportunity, ID or owner", exact: true });
    await search.fill("no-matching-customer");
    check((await state()).kpis.total === 0, "empty filter result");
    check(await page.getByRole("button", { name: "Export CSV", exact: true }).isDisabled(), "export disabled for empty results");
    await reset();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV", exact: true }).click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    let csv = "";
    for await (const chunk of stream) { csv += chunk.toString("utf8"); }
    check(csv.split("\r\n").length === 49, "CSV exports all 48 rows, beyond the 25 visible rows");
    check(csv.includes("Indicative EUR conversion"), "CSV contains rate and filter context");
    await page.unroute("https://open.er-api.com/v6/latest/EUR");
    await page.route("https://open.er-api.com/v6/latest/EUR", route => route.abort());
    await page.getByRole("button", { name: "Refresh data", exact: true }).click();
    await settled();
    check((await state()).kpis.total === 48 && (await state()).kpis.unconverted === 6, "FX failure preserves counts and flags six foreign values");
    check((await state()).warning.includes("Exchange rates unavailable"), "FX failure is visible");
    await page.route("**/xNGRxCDS_PS_MASTER?**", route => route.fulfill({ status: 503, body: "Service unavailable" }));
    await page.getByRole("button", { name: "Refresh data", exact: true }).click();
    await settled();
    check(!(await state()).loaded && Boolean((await state()).error), "service failure hides stale totals");
    await page.unroute("**/xNGRxCDS_PS_MASTER?**");
    await page.unroute("https://open.er-api.com/v6/latest/EUR");
    await page.getByRole("button", { name: "Refresh data", exact: true }).click();
    await settled();
    check((await state()).loaded, "refresh recovers after failure");
    await page.setViewportSize({ width: 390, height: 844 });
    const width = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, content: document.querySelector(".dashboardBody").getBoundingClientRect().width }));
    check(width.body <= width.viewport + 1 && width.content <= width.viewport, "mobile layout fits without horizontal overflow");
    await page.setViewportSize({ width: 1440, height: 1000 });
    return results;
}
