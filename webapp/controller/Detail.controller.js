sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Detail", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel('comp');

            this.oRouter.getRoute("Detail").attachPatternMatched(this._onOppMatched, this);
            const oExitButton = this.getView().byId("idExitFullScreenOverflowToolbarButton"),
                oEnterButton = this.getView().byId("idEnterFullScreenOverflowToolbarButton");
            [oExitButton, oEnterButton].forEach(function (oButton) {
                oButton.addEventDelegate({
                    onAfterRendering: function () {
                        if (this.bFocusFullScreenButton) {
                            this.bFocusFullScreenButton = false;
                            oButton.focus();
                        }
                    }.bind(this)
                });
            }, this);
        },
        toggleAreaPriority(oEvent) {
            debugger;
        },
        _onOppMatched: function (oEvent) {
            this._id = oEvent.getParameter("arguments").id || this._id || "0";
            this.getView().bindElement({
                path: "/ZCDS_PS_MASTER('" + this._id + "')"
            });
        },
        onOverflowToolbarButtonFullScreenPress: function () {
            this.bFocusFullScreenButton = true;
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
            this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._service });
        },
        onOverflowToolbarButtonExitFullScreenPress: function () {
            this.bFocusFullScreenButton = true;
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
            this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._service });
        },
        onOverflowToolbarButtonClosePress: function () {
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
            this.oRouter.navTo("Master", { layout: sNextLayout });
        }
    });
});