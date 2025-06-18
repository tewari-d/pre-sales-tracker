sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "com/nagarro/www/presalestracker/utils/FieldValidators",
  ],
  (Controller, Fragment, FieldValidators) => {
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

          oSmartTable.attachBeforeRebindTable(
            this._updateSegmentedCounts,
            this
          );
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
            opportunity = oEvent
              .getParameter("listItem")
              .getBindingContext()
              .getObject().Id;

          this.oRouter.navTo("Detail", {
            layout: oNextUIState.layout,
            id: opportunity,
          });
        },
        _updateSegmentedCounts: function () {
          const oSmartFilterBar = this.byId("presalesDBsmartFilterBar");
          const oModel = this.getOwnerComponent().getModel();
          const aAllFilters = oSmartFilterBar.getFilters();

          // Exclude "Status" filters
          const aBaseFilters = [];
          const flatten = function (oFilter) {
            if (oFilter instanceof sap.ui.model.Filter) {
              if (oFilter.aFilters) {
                oFilter.aFilters.forEach(flatten);
              } else if (oFilter.sPath !== "Status") {
                aBaseFilters.push(oFilter);
              }
            }
          };
          aAllFilters.forEach(flatten);

          const aStatuses = [
            { key: "WIP", label: "In Progress", id: "segWIP" },
            { key: "SUBMITTED", label: "Submitted", id: "segSUBMITTED" },
            { key: "HOLD", label: "On Hold", id: "segHOLD" },
          ];

          aStatuses.forEach((oStatus) => {
            const aFilters = aBaseFilters.slice();
            aFilters.push(new sap.ui.model.Filter("Status", "EQ", oStatus.key));

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
        onCreate: function () {
          var oView = this.getView();
          var oModel = oView.getModel();
          var oNewContext = oModel.createEntry("/ZCDS_PS_MASTER", {
            properties: {
              Status: "WIP",
              Currency: "EUR",
              ReceivedDate: new Date(),
            },
          });
          if (!this._oCreateOppDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.nagarro.www.presalestracker.view.fragments.CreateOpportunity",
              controller: this,
            }).then(
              function (oDialog) {
                this._oCreateOppDialog = oDialog;
                oView.addDependent(oDialog);
                oDialog.setBindingContext(oNewContext);
                oDialog.setModel(oModel);
                oDialog.open();

                let oProbabilityInput = this.getView().byId(
                  "idCreateProbability"
                );
                if (oProbabilityInput) {
                  FieldValidators.applyProbabilityValidation(oProbabilityInput);
                }
              }.bind(this)
            );
          } else {
            oDialog.setBindingContext(oNewContext);
            oDialog.setModel(oModel);
            this._oCreateOppDialog.open();
          }
        },
        onCancel: function () {
          this._oCreateOppDialog.destroy();
          delete this._oCreateOppDialog;
        },
        onAddPartner: function (oEvent) {
          debugger;
          //to add a new row
          var oContext = this.getView()
            .getModel()
            .createEntry("/zcds_ps_partner", {
              properties: {
                PartnerName: "",
                PartnerFunction: "",
                PartnerEmail: "",
              },
            });
          var oItem = new sap.m.ColumnListItem({
            cells: [
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "zcds_ps_partner",
                value: "{PartnerName}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "zcds_ps_partner",
                value: "{PartnerFunction}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "zcds_ps_partner",
                value: "{PartnerEmail}",
              }),
              new sap.m.Button({
                icon: "sap-icon://delete",
                type: "Reject",
                press: [this.removeItem, this],
              }),
            ],
          });
          oItem.setBindingContext(oContext);
          var oTable = oEvent.getSource().getParent().getParent();
          oTable.addItem(oItem);
        },
        removeItem: function (oEvent) {
          var oTable = oEvent.getSource().getParent().getParent();
          oTable.removeItem(oEvent.getSource().getParent());
        },
        onSaveNewOpportunity: function (oEvent) {
          var oDialog = oEvent.getSource().getEventingParent();

          //get payloads
          var oViewContents = oDialog.getContent();
          if (oViewContents.length !== 0) {
            var oRemarksForm = oViewContents[1];
            var oPartnersForm = oViewContents[2];

            //Read header fields
            var oPayload = oDialog.getBindingContext().getObject();

            //Read Remarks
            var enteredRemark = oRemarksForm.getContent()[0].getValue();
            if (enteredRemark !== "") {
              oPayload.toRemarks = [
                { RmText: oRemarksForm.getContent()[0].getValue() },
              ];
            }

            //Read Partners
            oPayload.toParters = this._getPartnersPayload(
              oPartnersForm.getContent()[0]
            );

            //Validate all inputs
            var aValidationErrors = this._validatePayload(oPayload);

            if (aValidationErrors.length == 0) {
              //POST
              var oModel = this.getView().getModel();
              this._oCreateOppDialog.setBusy(true);
              oModel.create("/ZCDS_PS_MASTER", oPayload, {
                success: function (oData, oResponse) {
                  sap.m.MessageToast.show(
                    "Opportunity " + Number(oData.Id) + " created successfully!"
                  );
                  this._oCreateOppDialog.setBusy(false);
                  oModel.resetChanges();
                  oModel.refresh();
                  this._updateSegmentedCounts();
                  this._oCreateOppDialog.destroy();
                  delete this._oCreateOppDialog;
                }.bind(this),
                error: function (oError) {
                  sap.m.MessageBox.error(
                    "Failed to create opportunity: " + oError.message
                  );
                  this._oCreateOppDialog.setBusy(false);
                  oModel.resetChanges();
                  oModel.refresh();
                  this._oCreateOppDialog.destroy();
                  delete this._oCreateOppDialog;
                }.bind(this),
              });
            } else {
              sap.m.MessageBox.error(
                new sap.m.Text({
                  text: "• " + aValidationErrors.join("\n• "),
                  wrapping: true,
                }),
                {
                  title: "Validation Error",
                  contentWidth: "400px",
                }
              );
              return;
            }
          }
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

        _getPartnersPayload: function (oTable) {
          var aItems = oTable.getItems();
          var aPartners = [];

          aItems.forEach(function (oItem) {
            var aCells = oItem.getCells();

            var sName = aCells[0].getValue();
            var sFunction = aCells[1].getValue();
            var sEmail = aCells[2].getValue();

            aPartners.push({
              PartnerName: sName,
              PartnerFunction: sFunction,
              PartnerEmail: sEmail,
            });
          });

          return aPartners;
        },

        _validatePayload(oPayload) {
          var aErrors = [];

          //Check mandatory fields in header
          var mMandatoryFields = {
            CustomerName: "Customer",
            LineOfBusiness: "Line of Business",
            Geography: "Geography",
            DealType: "Deal Type",
            Status: "Status",
            OppType: "Opportunity Type",
          };

          // Loop through and validate each field
          Object.keys(mMandatoryFields).forEach(function (sField) {
            if (!oPayload[sField]) {
              aErrors.push(mMandatoryFields[sField] + " is required.");
            }
          });

          var aPartners = oPayload.toParters || [];

          var bAllValid = true;
          var iOwnerCount = 0;
          aPartners.forEach(function (oPartner) {
            var sName = oPartner.PartnerName;
            var sFunc = oPartner.PartnerFunction;

            // Check if owner exists
            if (sFunc === "OWN") {
              iOwnerCount++;
            }

            // Check if both fields are filled
            if (
              !sName ||
              sName.trim() === "" ||
              !sFunc ||
              sFunc.trim() === ""
            ) {
              bAllValid = false;
            }
          });

          if (iOwnerCount === 0) {
            this._addOwnerInTable(); // Optional helper
            aErrors.push(
              "At least one partner with function 'OWN' (Owner) is required."
            );
          } else if (iOwnerCount > 1) {
            aErrors.push(
              "Only one partner with function 'OWN' (Owner) is allowed."
            );
          }

          if (!bAllValid) {
            aErrors.push(
              "All partners must have both name and function filled."
            );
          }

          return aErrors;
        },
        _addOwnerInTable: function () {
          debugger;
          var oContext = this.getView()
            .getModel()
            .createEntry("/zcds_ps_partner", {
              properties: {
                PartnerName: "",
                PartnerFunction: "OWN",
                PartnerEmail: "",
              },
            });
          var oItem = new sap.m.ColumnListItem({
            cells: [
              new sap.m.Input(),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "zcds_ps_partner",
                value: "{PartnerFunction}",
              }),
              new sap.m.Input(),
              new sap.m.Button({
                icon: "sap-icon://delete",
                type: "Reject",
                press: [this.removeItem, this],
              }),
            ],
          });
          oItem.setBindingContext(oContext);
          var oTable = Fragment.byId(
            this.getView().getId(),
            "createPartnerTable"
          );
          oTable.addItem(oItem);
        },
        onNavigateToCaseStudies: function () {
          const oCrossAppNav = sap.ushell?.Container?.getService(
            "CrossApplicationNavigation"
          );

          if (oCrossAppNav) {
            oCrossAppNav.toExternal({
              target: {
                semanticObject: "ZPS_CASESTUDIES",
                action: "manage",
              },
            });
          } else {
            MessageToast.show("Navigation service not available");
          }
        },
        onNavigateToNonOpp: function () {
          const oCrossAppNav = sap.ushell?.Container?.getService(
            "CrossApplicationNavigation"
          );

          if (oCrossAppNav) {
            oCrossAppNav.toExternal({
              target: {
                semanticObject: "ZPS_NONOPP",
                action: "manage",
              },
            });
          } else {
            MessageToast.show("Navigation service not available");
          }
        },
      }
    );
  }
);
