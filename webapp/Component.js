sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "com/nagarro/www/presalestracker/model/models",
    "sap/f/library",
    "sap/f/FlexibleColumnLayoutSemanticHelper"
], (UIComponent, JSONModel, models, library, FlexibleColumnLayoutSemanticHelper) => {
    "use strict";
    var LayoutType = library.LayoutType;
    return UIComponent.extend("com.nagarro.www.presalestracker.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            let oModel = new JSONModel();
            this.setModel(oModel, 'comp');

            // enable routing
            this.getRouter().initialize();
        },
        getHelper: function () {
            var oFCL = this.getRootControl().byId("idfcl"),
                oParams = new URLSearchParams(window.location.search),
                oSettings = {
                    defaultTwoColumnLayoutType: LayoutType.TwoColumnsMidExpanded,
                    defaultThreeColumnLayoutType: LayoutType.ThreeColumnsMidExpanded,
                    initialColumnsCount: 2,
                    maxColumnsCount: oParams.get("max")
                };

            return FlexibleColumnLayoutSemanticHelper.getInstanceFor(oFCL, oSettings);
        }
    });
});