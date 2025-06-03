sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Detail", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel();

            this.oRouter.getRoute("Detail").attachPatternMatched(this._onOppMatched, this);
        },
        toggleAreaPriority(oEvent) {
            debugger;
        },
        _onOppMatched: function (oEvent) {
            this._id = oEvent.getParameter("arguments").id || this._id || "0";
            this.getView().bindElement({
                path: "/ZCDS_PS_MASTER('" + this._id + "')"
            });
        }
    });
});