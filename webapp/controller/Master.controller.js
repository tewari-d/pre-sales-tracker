sap.ui.define(["sap/ui/core/mvc/Controller"], (Controller) => {
  "use strict";

  return Controller.extend(
    "com.nagarro.www.presalestracker.controller.Master",
    {
      onInit() {
        this.oRouter = this.getOwnerComponent().getRouter();
        const oSmartTable = this.byId("presalesDBSmartTable");
        const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");

        this._oInitialStatusFilter = null;

        if (oSmartFilterBar) {
          // Wait for metadata to be loaded
          oSmartFilterBar.attachInitialized(() => {
            this._setDefaultFilters();

            // Save the initial Status filter separately
            const oInitialFilter = oSmartFilterBar.getFilterData();
            this._oInitialStatusFilter = JSON.parse(
              JSON.stringify(oInitialFilter.Status)
            );
          });
        }

        oSmartTable.attachBeforeRebindTable(this._updateSegmentedCounts, this);
      },
      _setDefaultFilters: function () {
        var oSmartFilterBar = this.byId("presalesDBsmartFilterBar");

        const oFilterData = {
          Status: {
            items: [
              { key: "WIP", text: "WIP" },
              { key: "SUBMITTED", text: "SUBMITTED" },
              { key: "HOLD", text: "HOLD" },
            ],
          },
        };
        oSmartFilterBar.setFilterData(oFilterData);
      },
      onSelectionChange(oEvent) {
        let oNextUIState = this.getOwnerComponent()
            .getHelper()
            .getNextUIState(1),
          opportunity = oEvent
            .getSource()
            .getSelectedContexts()[0]
            .getObject().Id;

        this.oRouter.navTo("Detail", {
          layout: oNextUIState.layout,
          id: opportunity,
        });
      },
      _updateSegmentedCounts: function () {
        const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");
        const oModel = this.getOwnerComponent().getModel();
        const aBaseFilters = oSmartFilterBar.getFilters(); // All current filters

        const aStatuses = [
          { key: "WIP", label: "In Progress", id: "segWIP" },
          { key: "SUBMITTED", label: "Submitted", id: "segSUBMITTED" },
          { key: "HOLD", label: "On Hold", id: "segHOLD" },
        ];

        aStatuses.forEach((oStatus) => {
          // Clone base filters and add status-specific filter
          const aFilters = aBaseFilters.slice(); // copy filters
          aFilters.push(
            new sap.ui.model.Filter(
              "Status",
              sap.ui.model.FilterOperator.EQ,
              oStatus.key
            )
          );

          oModel.read("/ZCDS_PS_MASTER/$count", {
            filters: aFilters,
            success: function (iCount) {
              this.byId(oStatus.id)?.setText(`${oStatus.label} (${iCount})`);
            }.bind(this),
            error: function () {
              this.byId(oStatus.id)?.setText(`${oStatus.label} (0)`);
            }.bind(this),
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
        const oCurrentFilters = oSmartFilterBar.getFilterData();

        // Step 2: Update only the Status field
        if (sKey === "DEFAULT") {
          if (this._oInitialStatusFilter) {
            oCurrentFilters.Status = JSON.parse(
              JSON.stringify(this._oInitialStatusFilter)
            );
          } else {
            delete oCurrentFilters.Status;
          }
        } else {
          oCurrentFilters.Status = {
            value: null,
            items: [{ key: sKey, text: sKey }],
          };
        }

        // Step 3: Apply updated filter set
        oSmartFilterBar.setFilterData(oCurrentFilters, true);
        oSmartFilterBar.search();
      },
      formatRowHighlight: function (sStatus, sPlanned, sSubmitted) {
        if (sStatus === "WIP" && !sSubmitted && sPlanned) {
          const plannedDate = new Date(sPlanned);
          const today = new Date();
          const diffDays = (plannedDate - today) / (1000 * 60 * 60 * 24);

          if (diffDays < 0) return "Error"; // Overdue
          if (diffDays <= 3) return "Warning"; // Imminent
        }
        return "None";
      },
    }
  );
});
