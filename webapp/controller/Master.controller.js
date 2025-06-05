sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Master", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
            const oSmartTable = this.byId("presalesDBSmartTable");
            const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");

            if (oSmartFilterBar) {
                // Wait for metadata to be loaded
                oSmartFilterBar.attachInitialized(this._setDefaultFilters, this);
            }

            oSmartTable.attachBeforeRebindTable(this._updateSegmentedCounts, this);
        },
        _setDefaultFilters: function () {
            var oSmartFilterBar = this.byId("presalesDBsmartFilterBar");

            const oFilterData = {
                Status: {
                    items: [
                        { key: "WIP", text: "WIP" },
                        { key: "SUBMITTED", text: "SUBMITTED" }
                    ]
                }
            };
            oSmartFilterBar.setFilterData(oFilterData);
        },
        onSelectionChange(oEvent) {
            let oNextUIState = this.getOwnerComponent().getHelper().getNextUIState(1),
                opportunity = oEvent.getSource().getSelectedContexts()[0].getObject().Id;

            this.oRouter.navTo("Detail", { layout: oNextUIState.layout, id: opportunity });
        },
        _updateSegmentedCounts: function () {
            const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");
            const oModel = this.getOwnerComponent().getModel();
            const aBaseFilters = oSmartFilterBar.getFilters(); // All current filters

            const aStatuses = [
                { key: "WIP", label: "In Progress", id: "segWIP" },
                { key: "SUBMITTED", label: "Submitted", id: "segSUBMITTED" }
            ];

            aStatuses.forEach(oStatus => {
                // Clone base filters and add status-specific filter
                const aFilters = aBaseFilters.slice(); // copy filters
                aFilters.push(new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, oStatus.key));

                oModel.read("/ZCDS_PS_MASTER/$count", {
                    filters: aFilters,
                    success: function (iCount) {
                        this.byId(oStatus.id)?.setText(`${oStatus.label} (${iCount})`);
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
        },
        formatRowHighlight: function (sStatus, sPlanned, sSubmitted) {
            if (sStatus === "WIP" && !sSubmitted && sPlanned) {
                const plannedDate = new Date(sPlanned);
                const today = new Date();
                const diffDays = (plannedDate - today) / (1000 * 60 * 60 * 24);

                if (diffDays < 0) return "Error";      // Overdue
                if (diffDays <= 3) return "Warning";   // Imminent
            }
            return "None";
        }



    });
});