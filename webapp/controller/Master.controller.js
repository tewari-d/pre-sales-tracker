sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "com/ngr/www/presalestracker/ngrpresalestracker/utils/FieldValidators",
  ],
  (Controller, Fragment, FieldValidators) => {
    "use strict";

    return Controller.extend(
      "com.ngr.www.presalestracker.ngrpresalestracker.controller.Master",
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
        onSelectionChange: function (oEvent) {
          const oSelectedItem = oEvent.getParameter("listItem");
          const sNextId = oSelectedItem.getBindingContext().getObject().Id;
          const oNextUIState = this.getOwnerComponent()
            .getHelper()
            .getNextUIState(1);

          const oDetailPage = this.getView()
            .getParent()
            .getParent()
            .getCurrentMidColumnPage();
          const oDetailController = oDetailPage?.getController();

          const sCurrentId = oDetailController?._id;

          if (sNextId === sCurrentId) {
            return;
          }

          if (oDetailController?.isEditingActive()) {
            sap.m.MessageBox.confirm(
              "You have unsaved changes. Do you want to discard them?",
              {
                actions: [
                  sap.m.MessageBox.Action.YES,
                  sap.m.MessageBox.Action.NO,
                ],
                onClose: function (oAction) {
                  if (oAction === sap.m.MessageBox.Action.YES) {
                    oDetailController.cancelEditing?.();
                    this._navigateToDetail(sNextId, oNextUIState.layout);
                  }
                }.bind(this),
              }
            );
          } else {
            this._navigateToDetail(sNextId, oNextUIState.layout);
          }
        },

        _navigateToDetail: function (sId, sLayout) {
          this.oRouter.navTo("Detail", {
            layout: sLayout,
            id: sId,
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

            oModel.read("/xNGRxCDS_PS_MASTER/$count", {
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
        formatRowHighlight: function (sStatus, sPlanned, sDue) {
          if (sStatus !== "WIP") {
            return "None";
          }

          let plannedDate = sPlanned ? new Date(sPlanned) : null;
          let dueDate = sDue ? new Date(sDue) : null;

          // Handle invalid date strings
          if (plannedDate && isNaN(plannedDate)) plannedDate = null;
          if (dueDate && isNaN(dueDate)) dueDate = null;

          // Determine the earliest valid date
          let minDate = null;
          if (plannedDate && dueDate) {
            minDate = plannedDate < dueDate ? plannedDate : dueDate;
          } else {
            minDate = plannedDate || dueDate;
          }

          if (!minDate) return "None";

          const today = new Date();
          // Clear time for accurate day difference
          today.setHours(0, 0, 0, 0);
          minDate.setHours(0, 0, 0, 0);

          const diffDays = (minDate - today) / (1000 * 60 * 60 * 24);

          if (diffDays < 0) return "Error";
          if (diffDays <= 1) return "Information";

          return "None";
        },

        onCreate: function () {
          var oView = this.getView();
          var oModel = oView.getModel();
          var oNewContext = oModel.createEntry("/xNGRxCDS_PS_MASTER", {
            properties: {
              Status: "WIP",
              Currency: "EUR",
              ReceivedDate: new Date(),
            },
          });
          if (!this._oCreateOppDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.CreateOpportunity",
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
          //to add a new row
          var oContext = this.getView()
            .getModel()
            .createEntry("/xNGRxCDS_PS_PARTNER", {
              properties: {
                PartnerName: "",
                PartnerFunction: "",
                PartnerEmail: "",
              },
            });
          var oItem = new sap.m.ColumnListItem({
            cells: [
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
                value: "{PartnerName}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
                value: "{PartnerFunction}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
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
              oModel.create("/xNGRxCDS_PS_MASTER", oPayload, {
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
            const value = oPayload[sField];
            if (!value || value.trim() === "") {
              aErrors.push(mMandatoryFields[sField] + " is required.");
            }
          });

          if (oPayload.Status === "SUBMITTED") {
            const submissionErrors = [];
            if (!oPayload.SubmissionDate || oPayload.SubmissionDate === null) {
              submissionErrors.push("Submission Date");
            }

            if (!oPayload.PreSalesReviewwer) {
              submissionErrors.push("Pre Sales Reviewer");
            }

            if (!oPayload.PracticeReviewwer) {
              submissionErrors.push("Practice Reviewer");
            }

            if (!oPayload.OppTcv || Number(oPayload.OppTcv) === 0) {
              submissionErrors.push("Opportunity Value");
            }
            if (submissionErrors.length > 0) {
              aErrors.push(
                "If the status is SUBMITTED, the following fields are mandatory:"
              );
              aErrors.push(...submissionErrors);
            }
          }

          if (oPayload.Status === "WIN" || oPayload.Status === "LOSS") {
            if (!oPayload.CloseDate) {
              aErrors.push(
                `If the Opportunity is ${oPayload.Status}, please fill the Win/Loss Date.`
              );
            }
          }

          if (oPayload.Status === "WIP") {
            if (oPayload.PlannedSubmissionDate) {
              const oPlannedDate = new Date(oPayload.PlannedSubmissionDate);
              const oToday = new Date();

              oToday.setHours(0, 0, 0, 0);

              if (oPlannedDate < oToday) {
                aErrors.push("Planned Submission Date cannot be in the past.");
              }
            }
          }

          const mDateFieldsToCheck = {
            PlannedSubmissionDate: "Planned Submission Date",
            DueSubmissionDate: "Due Submission Date",
            SubmissionDate: "Submission Date",
            CloseDate: "WIN/ LOSS Date",
          };
          function normalizeDateOnly(dateStr) {
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            return d;
          }
          const receivedDate = normalizeDateOnly(oPayload.ReceivedDate);

          Object.keys(mDateFieldsToCheck).forEach(function (sField) {
            const fieldDateStr = oPayload[sField];

            if (fieldDateStr) {
              const fieldDate = normalizeDateOnly(fieldDateStr);

              if (fieldDate < receivedDate) {
                aErrors.push(
                  `${mDateFieldsToCheck[sField]} cannot be before Received Date.`
                );
              }
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
          var oContext = this.getView()
            .getModel()
            .createEntry("/xNGRxCDS_PS_PARTNER", {
              properties: {
                PartnerName: "",
                PartnerFunction: "OWN",
                PartnerEmail: "",
              },
            });
          var oItem = new sap.m.ColumnListItem({
            cells: [
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
                value: "{PartnerName}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
                value: "{PartnerFunction}",
              }),
              new sap.ui.comp.smartfield.SmartField({
                entitySet: "xNGRxCDS_PS_PARTNER",
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
