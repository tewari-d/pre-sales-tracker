sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Master", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();


            // oModel.metadataLoaded().then(function () {
            this._updateSegmentedCounts();
            // }.bind(this)).catch(function () {
            //     console.error("Metadata failed to load");
            // });
        },
        onSelectionChange(oEvent) {
            let oNextUIState = this.getOwnerComponent().getHelper().getNextUIState(1),
                opportunity = oEvent.getSource().getSelectedContexts()[0].getObject().Id;

            this.oRouter.navTo("Detail", { layout: oNextUIState.layout, id: opportunity });
        },
        _updateSegmentedCounts: function () {
            const oModel = this.getOwnerComponent().getModel();

            const aStatuses = [
                { key: "NEW", label: "New", id: "segNEW" },
                { key: "WIP", label: "In Progress", id: "segWIP" },
                { key: "HOLD", label: "On Hold", id: "segHOLD" }
            ];

            aStatuses.forEach(oStatus => {
                oModel.read("/ZCDS_PS_MASTER", {
                    urlParameters: {
                        "$filter": `Status eq '${oStatus.key}'`,
                        "$inlinecount": "allpages",
                        "$top": "0"
                    },
                    success: function (oData) {
                        const count = oData?.__count ?? "0";
                        this.byId(oStatus.id)?.setText(`${oStatus.label} (${count})`);
                    }.bind(this),
                    error: function () {
                        this.byId(oStatus.id)?.setText(`${oStatus.label} (0)`);
                    }.bind(this)
                });
            });
        },

        onStatusSegmentChange: function (oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");

            if (!oSmartFilterBar) {
                console.error("SmartFilterBar not found");
                return;
            }

            // Step 1: Get existing filters
            const oData = oSmartFilterBar.getFilterData();

            // Step 2: Update only the Status field
            if (sKey === "ALL") {
                delete oData.Status;
            } else {
                oData.Status = {
                    value: null,
                    items: [
                        { key: sKey, text: sKey }
                    ]
                }
                // wrap in array in case it's a multi-value filter
            }

            // Step 3: Apply updated filter set
            oSmartFilterBar.setFilterData(oData, true);
            oSmartFilterBar.search();
        }


    });
});