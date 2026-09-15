sap.ui.define([], function () {
    "use strict";
    function trackerUrl(location, componentUrl, id) {
        const current = new URL(location);
        let target = new URL("../index.html", componentUrl);
        const returnUrl = current.searchParams.get("tracker-url");
        if (returnUrl) {
            try {
                const candidate = new URL(returnUrl, current);
                if (candidate.origin === current.origin && /^https?:$/.test(candidate.protocol)) { target = candidate; }
            } catch (error) { /* Ignore an invalid return URL and use the sibling tracker. */ }
        }
        ["sap-client", "sap-language", "sap-ui-theme", "snapshot"].forEach(function (key) {
            if (current.searchParams.has(key)) { target.searchParams.set(key, current.searchParams.get(key)); }
        });
        const route = "Detail/" + encodeURIComponent(id) + "/MidColumnFullScreen";
        const shell = target.hash && !target.pathname.toLowerCase().endsWith("/index.html");
        target.hash = shell ? target.hash.split("&/")[0] + "&/" + route : route;
        return target.href;
    }
    function trackerTarget(id) {
        return {
            target: { semanticObject: "ZPS_TRACKER", action: "manage" },
            appSpecificRoute: "Detail/" + encodeURIComponent(id) + "/MidColumnFullScreen"
        };
    }
    return { trackerUrl, trackerTarget };
});
