// Run with the Playwright browser tool's filename option against start-dashboard-500.
async (page) => {
    const results = [];
    const assertDetail = async (detail, id, label) => {
        await detail.waitForFunction(expectedId => {
            const Component = window.sap?.ui.require("sap/ui/core/Component");
            const component = Component && Object.values(Component.registry.all()).find(item => item.getHelper);
            const fcl = component?.getRootControl()?.byId("idfcl");
            const view = fcl?.getCurrentMidColumnPage();
            const context = view?.getBindingContext();
            const element = view?.getDomRef();
            const bounds = element?.getBoundingClientRect();
            return fcl?.getLayout() === "MidColumnFullScreen" &&
                context?.getProperty("Id") === expectedId &&
                bounds?.width > 0 && bounds?.height > 0 &&
                bounds.left < window.innerWidth && bounds.right > 0 &&
                getComputedStyle(element).visibility !== "hidden" &&
                element.innerText.includes("ID: " + Number(expectedId));
        }, id, { timeout: 30000 });
        results.push(label);
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:8085/dashboard/index.html?snapshot=PS4-500&sap-client=500&sap-ui-xx-componentPreload=off");
    await page.getByRole("combobox", { name: "Received date period", exact: true }).click();
    await page.getByRole("option", { name: "All received dates", exact: true }).click();
    const rows = page.locator('[id$="opportunities"] .sapMLIBTypeNavigation');
    await rows.first().waitFor();
    for (const index of [0, 1]) {
        const row = rows.nth(index);
        const id = await row.evaluate(async element => {
            const Element = await new Promise(resolve => sap.ui.require(["sap/ui/core/Element"], resolve));
            return Element.getElementById(element.id).getBindingContext("dashboard").getProperty("Id");
        });
        const opened = page.context().waitForEvent("page");
        await row.click();
        const detail = await opened;
        try {
            await assertDetail(detail, id, "Row " + (index + 1) + " opens its visible detail on a fresh tracker load");
            await detail.reload();
            await assertDetail(detail, id, "Reload preserves the selected visible detail");
            await detail.setViewportSize({ width: 390, height: 844 });
            await assertDetail(detail, id, "Selected detail is visible on a phone viewport");
        } finally {
            await detail.close();
        }
    }
    const tracker = await page.context().newPage();
    try {
        await tracker.setViewportSize({ width: 1440, height: 1000 });
        await tracker.goto("http://localhost:8085/index.html?sap-client=500&snapshot=PS4-500");
        const assertList = async () => tracker.waitForFunction(() => {
            const Component = window.sap?.ui.require("sap/ui/core/Component");
            const component = Component && Object.values(Component.registry.all()).find(item => item.getHelper);
            const fcl = component?.getRootControl()?.byId("idfcl");
            const controller = component?.getRootControl()?.getController();
            const midBounds = fcl?.getCurrentMidColumnPage()?.getDomRef()?.getBoundingClientRect();
            return controller?.currentRouteName === "Master" &&
                fcl?.getLayout() === "OneColumn" &&
                fcl.getCurrentBeginColumnPage()?.getDomRef()?.getBoundingClientRect().width > 0 &&
                (!midBounds || midBounds.width === 0);
        });
        await assertList();
        results.push("Completed initial desktop route shows only the opportunity list");
        await tracker.reload();
        await assertList();
        results.push("Reloading the list keeps the empty detail panel hidden");
        await tracker.evaluate(async () => {
            const Component = await new Promise(resolve => sap.ui.require(["sap/ui/core/Component"], resolve));
            const component = Object.values(Component.registry.all()).find(item => item.getHelper);
            component.getRouter().navTo("Detail", { id: "0000001350", layout: "MidColumnFullScreen" });
        });
        await assertDetail(tracker, "0000001350", "Navigating from the list still shows the selected detail");
        // Returning to a list route must hide even a previously populated detail.
        await tracker.evaluate(async () => {
            const Component = await new Promise(resolve => sap.ui.require(["sap/ui/core/Component"], resolve));
            const component = Object.values(Component.registry.all()).find(item => item.getHelper);
            component.getRouter().navTo("Master", { layout: "MidColumnFullScreen" });
        });
        await tracker.waitForFunction(() => window.location.hash.includes("MidColumnFullScreen"));
        await assertList();
        results.push("A list route without an opportunity cannot expose the detail panel");
    } finally {
        await tracker.close();
    }
    return results;
}
