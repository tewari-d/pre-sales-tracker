/* Standalone entry point: local UI5 proxy in development, SAP public runtime on ABAP. */
(function () {
    "use strict";
    const bootstrap = document.createElement("script");
    bootstrap.id = "sap-ui-bootstrap";
    bootstrap.src = window.location.pathname.toLowerCase().startsWith("/sap/") ?
        "/sap/public/bc/ui5_ui5/resources/sap-ui-core.js" : "../resources/sap-ui-core.js";
    bootstrap.setAttribute("data-sap-ui-theme", "sap_horizon");
    bootstrap.setAttribute("data-sap-ui-async", "true");
    bootstrap.setAttribute("data-sap-ui-compat-version", "edge");
    bootstrap.setAttribute("data-sap-ui-frame-options", "trusted");
    bootstrap.setAttribute("data-sap-ui-resource-roots", JSON.stringify({ "com.ngr.presales.dashboard": "./" }));
    bootstrap.setAttribute("data-sap-ui-on-init", "module:sap/ui/core/ComponentSupport");
    document.head.appendChild(bootstrap);
}());
