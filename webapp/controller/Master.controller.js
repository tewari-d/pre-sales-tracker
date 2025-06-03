sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Master", {
        onInit() {
        },
        onSelectionChange(oEvent) {
            sap.m.MessageToast.show("Hello");
        }
    });
});