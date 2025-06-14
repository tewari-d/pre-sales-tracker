sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment"
], (Controller, Fragment) => {
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
          /*opportunity = oEvent
            .getSource()
            .getSelectedContexts()[0]
            .getObject().Id;*/
          opportunity = oEvent.getParameter("listItem").getBindingContext().getObject().Id;  

        this.oRouter.navTo("Detail", {
          layout: oNextUIState.layout,
          id: opportunity,
        });
      },
      onItemPress: function(){
        sap.m.MessageToast.show("Item Pressed");
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

          if (diffDays < 0) return "Error";      // Overdue
          if (diffDays <= 3) return "Warning";   // Imminent
        }
        return "None";
      },
      onCreate: function () {
        var oView = this.getView();
        if (!this._oCreateOppDialog) {
          Fragment.load({
            id: oView.getId(),
            name: "com.nagarro.www.presalestracker.view.fragments.CreateOpportunity",
            controller: this
          }).then(function (oDialog) {
            this._oCreateOppDialog = oDialog;
            oView.addDependent(oDialog);
            oDialog.open();
          }.bind(this));
        } else {
          this._oCreateOppDialog.open();
        }
      },
      onCancel: function () {
        this._oCreateOppDialog.destroy();
        delete this._oCreateOppDialog;
      },
      onAddPartner: function (oEvent) {                               //to add a new row
        var oItem = new sap.m.ColumnListItem({
          cells: [
            new sap.m.Input(),
            new sap.ui.comp.smartfield.SmartField({ entitySet: 'zcds_ps_partner', value: "{PartnerFunction}" }),
            new sap.m.Input(),
            new sap.m.Button({
              icon: "sap-icon://delete",
              type: "Reject",
              press: [this.removeItem, this]
            })
          ]
        });
        var oTable = oEvent.getSource().getParent().getParent();
        oTable.addItem(oItem);
      },
      removeItem: function (oEvent) {
        var oTable = oEvent.getSource().getParent().getParent();
        oTable.removeItem(oEvent.getSource().getParent());
      },
      onSaveNewOpportunity: function (oEvent) {
        //get payloads
        var oViewContents = oEvent.getSource().getEventingParent().getContent();
        if (oViewContents.length !== 0) {
          var oSmartForm = oViewContents[0];
          var oRemarksForm = oViewContents[1];
          var oPartnersForm = oViewContents[2];

          //Read header fields
          var oPayload = this._getHeaderPayload(oSmartForm);

          //Read Remarks
          var enteredRemark = oRemarksForm.getContent()[0].getValue();
          if (enteredRemark !== "") {
            oPayload.toRemarks = [{ 'RmText': oRemarksForm.getContent()[0].getValue() }];
          }

          //Read Partners
          oPayload.toParters = this._getPartnersPayload(oPartnersForm.getContent()[0]);

          //Validate all inputs
          var aValidationErrors = this._validatePayload(oPayload);

          if (aValidationErrors.length == 0) {
            //POST
            var oModel = this.getView().getModel();
            this._oCreateOppDialog.setBusy(true);
            oModel.create("/ZCDS_PS_MASTER", oPayload, {
              success: function (oData, oResponse) {
                sap.m.MessageToast.show("Oppotunity " + oData.Id + " created successfully!");
                this._oCreateOppDialog.setBusy(false);
                oModel.refresh();
                this._oCreateOppDialog.destroy();
                delete this._oCreateOppDialog;
              }.bind(this),
              error: function (oError) {
                sap.m.MessageBox.error("Failed to create operation: " + oError.message);
                this._oCreateOppDialog.setBusy(false);
                oModel.refresh();
                this._oCreateOppDialog.destroy();
                delete this._oCreateOppDialog;
              }.bind(this)
            });
          }
        }
      },

      _getHeaderPayload: function (oSmartForm) {
        var aSmartFields = oSmartForm.getSmartFields();
        var oPayload = {};

        aSmartFields.forEach(function (oSmartField) {
          var oMeta = oSmartField.getDataProperty();

          if (!oMeta || !oMeta.property) {
            console.warn("No metadata for SmartField:", oSmartField);
            return;
          }

          var sPropertyName = oMeta.property.name;
          var sEdmType = oMeta.property.type;
          var oValue = oSmartField.getValue();
          var oInnerControl = oSmartField.getFirstInnerControl();

          // --- Handle DatePicker fields ---
          if (oInnerControl && oInnerControl.isA("sap.m.DatePicker")) {
            var oDate = oInnerControl.getDateValue();
            var oDateValue = oDate ? `/Date(${oDate.getTime()})/` : null;
            oPayload[sPropertyName] = oDateValue;
            return;
          }

          // --- Handle numeric types ---
          var aNumericTypes = [
            "Edm.Int16", "Edm.Int32", "Edm.Int64",
            "Edm.Decimal", "Edm.Double", "Edm.Single"
          ];

          if (aNumericTypes.includes(sEdmType)) {
            if (sEdmType === "Edm.Decimal" || sEdmType === "Edm.Double") {
              // Always return as string, even for 0
              if (oValue === null || oValue === "" || isNaN(oValue)) {
                oPayload[sPropertyName] = "0.00";
              } else {
                oPayload[sPropertyName] = parseFloat(oValue).toFixed(2); // As string
              }
            } else {
              // For integer types
              oPayload[sPropertyName] = (oValue === null || oValue === "" || isNaN(oValue))
                ? 0
                : Number(oValue);
            }
            return;
          }

          // --- All other types ---
          oPayload[sPropertyName] = oValue;
        });

        return oPayload;

      },

      _getPartnersPayload: function (oTable) {
        var aItems = oTable.getItems();
        var aPartners = [];

        aItems.forEach(function (oItem) {
          var aCells = oItem.getCells();

          var sName = aCells[0].getValue(); // First Input field
          var sFunction = aCells[1].getValue(); // SmartField
          var sEmail = aCells[2].getValue(); // Second Input field

          aPartners.push({
            PartnerName: sName,
            PartnerFunction: sFunction,
            PartnerEmail: sEmail
          });
        });

        return aPartners;
      },

      _validatePayload(oPayload) {
        return [];
      },

      checkCreateSmartform: function (oEvent) {

      }


    });
});
