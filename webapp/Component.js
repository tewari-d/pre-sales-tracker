sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "com/ngr/www/presalestracker/ngrpresalestracker/model/models",
     "sap/f/library",
    "sap/f/FlexibleColumnLayoutSemanticHelper"
], (UIComponent, JSONModel, models, library, FlexibleColumnLayoutSemanticHelper) => {
    "use strict";
    var LayoutType = library.LayoutType;
    return UIComponent.extend("com.ngr.www.presalestracker.ngrpresalestracker.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            let oModel = new JSONModel();
            this.setModel(oModel, 'comp');

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

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