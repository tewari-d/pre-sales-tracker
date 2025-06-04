sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Master", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
        },
        onSelectionChange(oEvent) {
            let oNextUIState = this.getOwnerComponent().getHelper().getNextUIState(1),
                opportunity = oEvent.getSource().getSelectedContexts()[0].getObject().Id;

            this.oRouter.navTo("Detail", { layout: oNextUIState.layout, id: opportunity });
        }
    });
});