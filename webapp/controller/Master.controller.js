sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "com/ngr/www/presalestracker/ngrpresalestracker/utils/FieldValidators",
    "sap/ui/export/Spreadsheet",
  ],
  (Controller, Fragment, FieldValidators, Spreadsheet) => {
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
                JSON.stringify(oInitialFilter.Status),
              );
            });
          }

          oSmartTable.attachBeforeRebindTable(
            this._updateSegmentedCounts,
            this,
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
                { key: "WIN", text: "WIN" },
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
              },
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
            { key: "WIN", label: "Win", id: "segWIN" },
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
                JSON.stringify(this._oInitialStatusFilter),
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
                  "idCreateProbability",
                );
                if (oProbabilityInput) {
                  FieldValidators.applyProbabilityValidation(oProbabilityInput);
                }
              }.bind(this),
            );
          } else {
            oDialog.setBindingContext(oNewContext);
            oDialog.setModel(oModel);
            this._oCreateOppDialog.open();
          }
        },
        onCancel: function () {
          var oModel = this.getView().getModel();

          var oPartnerTableItems = Fragment.byId(
            this.getView().getId(),
            "createPartnerTable",
          ).getItems();
          oPartnerTableItems.forEach(function (oItem) {
            oModel.resetChanges([oItem.getBindingContextPath()]);
          });
          oModel.resetChanges([
            this._oCreateOppDialog.getBindingContext().getPath(),
          ]);

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
                innerControlsCreated: this.onControlCreated,
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
              oPartnersForm.getContent()[0],
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
                    "Opportunity " +
                      Number(oData.Id) +
                      " created successfully!",
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
                    "Failed to create opportunity: " + oError.message,
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
                  wrapping: false,
                }),
                {
                  title: "Validation Error",
                  contentWidth: "400px",
                },
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
            SapSystem: "SAP System",
            BUDetails: "BU Details",
            Complexity: "Complexity",
            ProposalTypeOp: "Proposal Type",
            WinChance: "Win Chance",
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
                "If the status is SUBMITTED, the following fields are mandatory:",
              );
              aErrors.push(...submissionErrors);
            }
          }

          if (oPayload.Status === "WIN" || oPayload.Status === "LOSS") {
            if (!oPayload.CloseDate) {
              aErrors.push(
                `If the Opportunity is ${oPayload.Status}, please fill the Win/Loss Date.`,
              );
            }
          }

          if (oPayload.Status === "WIP") {
            // if (oPayload.PlannedSubmissionDate) {
            //   const oPlannedDate = new Date(oPayload.PlannedSubmissionDate);
            //   const oToday = new Date();
            //   oToday.setHours(0, 0, 0, 0);
            //   if (oPlannedDate < oToday) {
            //     aErrors.push("Planned Submission Date cannot be in the past.");
            //   }
            // }
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
                  `${mDateFieldsToCheck[sField]} cannot be before Received Date.`,
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
              "At least one partner with function 'OWN' (Owner) is required.",
            );
          } else if (iOwnerCount > 1) {
            aErrors.push(
              "Only one partner with function 'OWN' (Owner) is allowed.",
            );
          }

          if (!bAllValid) {
            aErrors.push(
              "All partners must have both name and function filled.",
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
                innerControlsCreated: this.onControlCreated,
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
            "createPartnerTable",
          );
          oTable.addItem(oItem);
        },
        onNavigateToCaseStudies: function () {
          const oCrossAppNav = sap.ushell?.Container?.getService(
            "CrossApplicationNavigation",
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
        onNavigateToFutDmd: function () {
          const oCrossAppNav = sap.ushell?.Container?.getService(
            "CrossApplicationNavigation",
          );

          if (oCrossAppNav) {
            oCrossAppNav.toExternal({
              target: {
                semanticObject: "ZRS_FUTURE_DEMANDS",
                action: "manage",
              },
            });
          } else {
            MessageToast.show("Navigation service not available");
          }
        },
        onNavigateToNonOpp: function () {
          const oCrossAppNav = sap.ushell?.Container?.getService(
            "CrossApplicationNavigation",
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
        onPipelineReport: function () {
          const oView = this.getView();

          if (!this.oPipelineDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.PipelineReport",
              controller: this,
            }).then(
              function (oDialog) {
                this.oPipelineDialog = oDialog;
                oView.addDependent(oDialog);
                this._initPipelineFilters();
                oDialog.open();
              }.bind(this),
            );
          } else {
            this._initPipelineFilters();
            this.oPipelineDialog.open();
          }
        },

        _initPipelineFilters: function () {
          const oDialog = this.oPipelineDialog;
          if (!oDialog) return;

          const oSmartFilterBar = oDialog.getContent()[0].getItems()[0];
          const oSmartTable = oDialog.getContent()[0].getItems()[1];

          // Wait for SmartFilterBar to be initialized
          if (!oSmartFilterBar.getInitialized?.()) {
            oSmartFilterBar.attachInitialized(() => {
              this._applyPipelineFilters(oSmartFilterBar, oSmartTable);
            });
          } else {
            this._applyPipelineFilters(oSmartFilterBar, oSmartTable);
          }
        },

        _applyPipelineFilters: function (oSmartFilterBar, oSmartTable) {
          // Set initial filter for Status = WIP or SUBMITTED
          oSmartFilterBar.setFilterData(
            {
              Status: {
                items: [
                  { key: "WIP", text: "WIP" },
                  { key: "SUBMITTED", text: "SUBMITTED" },
                ],
              },
            },
            true,
          );
          // Trigger search to load data with filters
          oSmartFilterBar.search();
        },

        onPipelineSearch: function (oEvent) {
          // SmartFilterBar search completed - hide unwanted columns & apply formatter
          const oDialog = this.oPipelineDialog;
          if (!oDialog) return;

          const oSmartTable = oDialog.getContent()[0].getItems()[1];
          // No filter or search here to avoid loop
          setTimeout(() => {
            this._hideUnwantedColumns(oSmartTable);
            this._applyOppTcvFormatter(oSmartTable); // Apply formatter AFTER data is loaded
            // Compute and display total in EUR after data rendered
            this._computePipelineTotal(oSmartTable);
          }, 300);
        },

        _loadAvailableCurrencies: function (fnCallback) {
          try {
            var oView = this.getView();
            var oMasterModel = oView.getModel("MasterData");

            if (!oMasterModel) {
              oMasterModel = new sap.ui.model.json.JSONModel({
                Currencies: [],
                RateMap: {},
              });
              oView.setModel(oMasterModel, "MasterData");
            }

            var sUrl = "https://open.er-api.com/v6/latest/EUR";

            fetch(sUrl)
              .then(function (response) {
                return response.json();
              })
              .then(function (data) {
                if (data && data.rates) {
                  var aKeys = Object.keys(data.rates).sort();
                  var aCurrencyList = aKeys.map(function (key) {
                    return { key: key, text: key };
                  });
                  oMasterModel.setProperty("/Currencies", aCurrencyList);
                  oMasterModel.setProperty("/RateMap", data.rates);
                }
                if (typeof fnCallback === "function") fnCallback();
              })
              .catch(function (err) {
                console.error("Failed to load exchange rates:", err);
                if (typeof fnCallback === "function") fnCallback();
              });
          } catch (e) {
            console.error("_loadAvailableCurrencies error:", e);
            if (typeof fnCallback === "function") fnCallback();
          }
        },

        _computePipelineTotal: function (oSmartTable) {
          try {
            const oDialog = this.oPipelineDialog;
            if (!oDialog || !oSmartTable) return;

            const oSmartFilterBar = oDialog.getContent()[0].getItems()[0];
            const oModel = this.getView().getModel();

            const aFilters =
              oSmartFilterBar && oSmartFilterBar.getFilters
                ? oSmartFilterBar.getFilters()
                : [];

            // Ensure we have live rates; if not, load them and retry after load
            const oMasterData = this.getView().getModel("MasterData");
            const mRates =
              (oMasterData && oMasterData.getProperty("/RateMap")) || {};

            const performRead = function () {
              oModel.read("/xNGRxCDS_PS_MASTER", {
                filters: aFilters,
                urlParameters: { $select: "OppTcv,Currency", $top: 100000 },
                success: function (oData) {
                  const aRows = oData.results || oData.value || [];

                  let fTotalEur = 0;

                  aRows.forEach((oRow) => {
                    const dOpp = parseFloat(oRow.OppTcv) || 0;
                    const sCurrency = oRow.Currency || "EUR";
                    const dRate =
                      (mRates && mRates[sCurrency]) ||
                      (sCurrency === "EUR" ? 1 : undefined);

                    if (dRate && dRate !== 0) {
                      // API rates are 1 EUR = X [currency], so convert by dividing
                      fTotalEur += dOpp / dRate;
                    } else if (sCurrency === "EUR") {
                      fTotalEur += dOpp;
                    } else {
                      // Fallback: treat as EUR if rate missing
                      fTotalEur += dOpp;
                    }
                  });

                  const sFormatted = fTotalEur.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });

                  this.byId("pipelineTotalEur")?.setText(
                    "Total (EUR): " + sFormatted + " EUR",
                  );
                }.bind(this),
                error: function (oError) {
                  console.error(
                    "Error fetching pipeline rows for total:",
                    oError,
                  );
                  this.byId("pipelineTotalEur")?.setText(
                    "Total (EUR): 0.00 EUR",
                  );
                }.bind(this),
              });
            }.bind(this);

            if (!oMasterData || Object.keys(mRates).length === 0) {
              // Lazy-load rates then run the read
              this._loadAvailableCurrencies(
                function () {
                  // refresh local reference
                  const oMD = this.getView().getModel("MasterData");
                  const newRates = (oMD && oMD.getProperty("/RateMap")) || {};
                  // assign to closure variable used by performRead
                  if (Object.keys(newRates).length > 0) {
                    for (var k in newRates) mRates[k] = newRates[k];
                  }
                  performRead();
                }.bind(this),
              );
            } else {
              performRead();
            }
          } catch (error) {
            console.error("Error computing pipeline total:", error);
            this.byId("pipelineTotalEur")?.setText("Total (EUR): 0.00 EUR");
          }
        },

        onPipelineTableInitialize: function (oEvent) {
          // SmartTable initialization complete - enable growing (infinite scroll)
          try {
            const oSmartTable = oEvent.getSource();
            const oInnerTable = oSmartTable.getTable && oSmartTable.getTable();
            if (!oInnerTable) return;

            // Enable growing with scroll-to-load for responsive table
            if (typeof oInnerTable.setGrowing === "function") {
              oInnerTable.setGrowing(true);
              oInnerTable.setGrowingScrollToLoad(true);
              // How many items to load per request
              if (typeof oInnerTable.setGrowingThreshold === "function") {
                oInnerTable.setGrowingThreshold(20);
              }
            }

            // Enable sticky column headers and toolbar if supported
            if (typeof oInnerTable.setSticky === "function") {
              try {
                oInnerTable.setSticky(["ColumnHeaders", "HeaderToolbar"]);
              } catch (e) {
                // some table instances expect an array or string; ignore failures
              }
            }
            // Re-apply formatter and total when table updates (e.g., growing loads more rows)
            if (typeof oInnerTable.attachUpdateFinished === "function") {
              oInnerTable.attachUpdateFinished(
                function () {
                  // small delay to ensure controls are rendered
                  setTimeout(() => {
                    try {
                      this._applyOppTcvFormatter(oSmartTable);
                      this._computePipelineTotal(oSmartTable);
                    } catch (e) {
                      console.error("Error in updateFinished handler:", e);
                    }
                  }, 50);
                }.bind(this),
              );
            }
          } catch (err) {
            console.error(
              "Error enabling growing/sticky on pipeline table:",
              err,
            );
          }
        },

        _hideUnwantedColumns: function (oSmartTable) {
          try {
            const oInnerTable = oSmartTable.getTable();
            if (!oInnerTable) return;

            const aColumns = oInnerTable.getColumns();

            // Map of header text to show (exact matches)
            const aRequiredHeaders = [
              "Customer",
              "Opp. Size",
              "Status",
              "Win Chance",
              "SAP Area of Solution / Requirement",
              "Country/Region Name",
            ];

            console.log("=== PIPELINE COLUMNS DEBUG ===");
            console.log("Total columns found:", aColumns.length);
            console.log("Required headers:", aRequiredHeaders);

            // Hide all columns except the 7 required ones
            aColumns.forEach((oColumn, iIndex) => {
              const sHeader = oColumn.getHeader?.()?.getText?.() || "";
              const bIsRequired = aRequiredHeaders.includes(sHeader);

              console.log(
                `Column ${iIndex}: Header="${sHeader}" -> ${bIsRequired ? "KEEP" : "HIDE"}`,
              );

              oColumn.setVisible(bIsRequired);
              // Set Opp. Size column width
              if (sHeader === "Opp. Size") {
                oColumn.setWidth("300px"); // Make column much wider
                if (oColumn.setMinWidth) {
                  oColumn.setMinWidth(120); // Ensure minimum width
                }
              }
            });
            console.log("=== END DEBUG ===");
          } catch (error) {
            console.error("Error hiding unwanted columns:", error);
          }
        },

        _configureTableColumns: function (oSmartTable) {
          // Column visibility is managed by _hideUnwantedColumns
        },

        _applyOppTcvFormatter: function (oSmartTable) {
          try {
            const oInnerTable = oSmartTable.getTable();
            if (!oInnerTable) return;

            // Get rows/items from the table
            const aRows = oInnerTable.getItems?.() || [];

            if (aRows.length === 0) {
              // Data may not be rendered yet, wait and retry
              setTimeout(() => this._applyOppTcvFormatter(oSmartTable), 500);
              return;
            }

            // Get column headers to find Opp. Size column index
            const aColumns = oInnerTable.getColumns();
            let iOppTcvColumnIndex = -1;

            aColumns.forEach((oCol, idx) => {
              const sHeader = oCol.getHeader?.()?.getText?.() || "";
              if (sHeader === "Opp. Size") {
                iOppTcvColumnIndex = idx;
              }
            });

            if (iOppTcvColumnIndex === -1) {
              return;
            }

            // Iterate through rows and bind formatter to Opp. Size cells
            aRows.forEach((oRow, rowIdx) => {
              const aCells = oRow.getCells?.() || [];
              if (aCells.length > iOppTcvColumnIndex) {
                const oCell = aCells[iOppTcvColumnIndex];

                // SmartTable wraps cells in HBox with 2 items
                // Item 1 = value display
                const aItems = oCell.getItems?.() || [];

                if (aItems.length >= 2) {
                  // Hide the original value (first item) and show only EUR value
                  const oOriginalValue = aItems[0];
                  const oValueCell = aItems[1];
                  if (oOriginalValue && oOriginalValue.setVisible) {
                    oOriginalValue.setVisible(false);
                  }
                  if (oValueCell && oValueCell.bindProperty) {
                    try {
                      oValueCell.unbindProperty("text");
                      oValueCell.bindProperty("text", {
                        parts: [{ path: "OppTcv" }, { path: "Currency" }],
                        formatter: this.formatOppTcvToEur.bind(this),
                      });
                      if (oValueCell.setMaxWidth) {
                        oValueCell.setMaxWidth("300px"); // Increase text width
                      }
                      if (oValueCell.setWrapping) {
                        oValueCell.setWrapping(false); // Prevent wrapping
                      }
                      if (oValueCell.setTextAlign) {
                        oValueCell.setTextAlign("Left"); // Align text left
                      }
                      if (oValueCell.setWidth) {
                        oValueCell.setWidth("300px"); // Set explicit width
                      }
                    } catch (e) {
                      // Silently handle binding errors
                    }
                  }
                }
              }
            });
          } catch (error) {
            console.error("Error applying OppTcv formatter:", error);
          }
        },

        formatOppTcvToEur: function (dOppTcv, sCurrency) {
          if (!dOppTcv && dOppTcv !== 0) return "0.00 EUR";
          if (!sCurrency) sCurrency = "EUR";

          try {
            var dOpp = parseFloat(dOppTcv) || 0;

            if (!sCurrency || sCurrency === "EUR") {
              return (
                dOpp.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) + " EUR"
              );
            }

            var oMasterData = this.getView().getModel("MasterData");
            var mRates =
              (oMasterData && oMasterData.getProperty("/RateMap")) || {};
            var dRate = mRates[sCurrency];

            if (!dRate) {
              // Trigger background load for future calls, but return fallback now
              this._loadAvailableCurrencies();
              return (
                dOpp.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) + " EUR"
              );
            }

            // API returns rates as 1 EUR = X [currency]
            var dEur = dRate && dRate !== 0 ? dOpp / dRate : dOpp;

            return (
              dEur.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) + " EUR"
            );
          } catch (e) {
            console.error("formatOppTcvToEur error:", e);
            return "0.00 EUR";
          }
        },

        onPipelineBeforeExport: function (oEvent) {
          // Optional: customize export behavior
          const oExportSettings = oEvent.getParameter("exportSettings");
          oExportSettings.fileName =
            "Pipeline_Report_" +
            new Date().toISOString().split("T")[0] +
            ".xlsx";
        },

        onExportPipelineToExcel: function () {
          try {
            const oDialog = this.oPipelineDialog;
            if (!oDialog) return;

            const oSmartFilterBar = oDialog.getContent()[0].getItems()[0];
            const oModel = this.getView().getModel();

            // Get filters from the dialog's SmartFilterBar (if available)
            const aFilters =
              oSmartFilterBar && oSmartFilterBar.getFilters
                ? oSmartFilterBar.getFilters()
                : [];

            // Read all matching rows from OData (use high $top to fetch all)
            oModel.read("/xNGRxCDS_PS_MASTER", {
              filters: aFilters,
              urlParameters: {
                $select: "Id,CustomerName,Status,WinChance,OppTcv,Currency",
                $top: 100000,
              },
              success: function (oData) {
                const aRows = oData.results || oData.value || [];
                const oMasterData = this.getView().getModel("MasterData");
                const mRates =
                  (oMasterData && oMasterData.getProperty("/RateMap")) || {};

                const aData = aRows.map(function (oRow) {
                  const dOpp = parseFloat(oRow.OppTcv) || 0;
                  const sCurrency = oRow.Currency || "EUR";
                  const dRate = mRates[sCurrency];
                  const dEur = dRate && dRate !== 0 ? dOpp / dRate : dOpp;

                  return {
                    Id: oRow.Id,
                    CustomerName: oRow.CustomerName,
                    Status: oRow.Status,
                    WinChance: oRow.WinChance,
                    OppSizeOriginal: parseFloat(dOpp.toFixed(2)),
                    OriginalCurrency: sCurrency,
                    OppSizeEUR: parseFloat(dEur.toFixed(2)),
                  };
                });

                const aColumns = [
                  { label: "ID", property: "Id" },
                  { label: "Customer", property: "CustomerName" },
                  { label: "Status", property: "Status" },
                  { label: "Win Chance", property: "WinChance" },
                  {
                    label: "Opp. Size (Original)",
                    property: "OppSizeOriginal",
                    type: "Number",
                    scale: 2,
                  },
                  { label: "Currency", property: "OriginalCurrency" },
                  {
                    label: "Opp. Size (EUR)",
                    property: "OppSizeEUR",
                    type: "Number",
                    scale: 2,
                  },
                ];

                // Build timestamped filename: DDMMMYYYY_HHMM (e.g. 22Feb2026_0002)
                var _now = new Date();
                var _pad = function (n) {
                  return n < 10 ? "0" + n : n;
                };
                var _months = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                var _dd = _pad(_now.getDate());
                var _mon = _months[_now.getMonth()];
                var _yyyy = _now.getFullYear();
                // Use 12-hour format with AM/PM
                var _hours24 = _now.getHours();
                var _hh12 = _hours24 % 12;
                if (_hh12 === 0) _hh12 = 12;
                var _hh = _pad(_hh12);
                var _mm = _pad(_now.getMinutes());
                var _ampm = _hours24 >= 12 ? "PM" : "AM";
                var sFileName =
                  "Pipeline_Report_" +
                  _dd +
                  _mon +
                  _yyyy +
                  "_" +
                  _hh +
                  _mm +
                  _ampm +
                  ".xlsx";

                const oSettings = {
                  workbook: {
                    columns: aColumns,
                    context: { title: "Pipeline Report" },
                  },
                  dataSource: aData,
                  fileName: sFileName,
                  worker: false,
                };

                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().finally(function () {
                  oSheet.destroy();
                });
              }.bind(this),
              error: function (oError) {
                console.error(
                  "Error reading pipeline rows for export:",
                  oError,
                );
                sap.m.MessageBox.error(
                  "Failed to fetch pipeline rows for export.",
                );
              }.bind(this),
            });
          } catch (e) {
            console.error("Export to Excel failed:", e);
            sap.m.MessageBox.error("Failed to export pipeline to Excel.");
          }
        },

        onClosePipelineDialog: function () {
          if (this.oPipelineDialog) {
            this.oPipelineDialog.close();
          }
        },

        // ─── Reports Menu ────────────────────────────────────────────────
        onReportMenuItemSelected: function (oEvent) {
          var sKey = oEvent.getParameter("item").getKey();
          if (sKey === "pipeline") {
            this.onPipelineReport();
          } else if (sKey === "work") {
            this.onWorkReport();
          }
        },

        // ─── Work Report ─────────────────────────────────────────────────
        onWorkReport: function () {
          const oView = this.getView();

          if (!this.oWorkDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.WorkReport",
              controller: this,
            }).then(
              function (oDialog) {
                this.oWorkDialog = oDialog;
                oView.addDependent(oDialog);
                this._initWorkFilters();
                oDialog.open();
              }.bind(this),
            );
          } else {
            this._initWorkFilters();
            this.oWorkDialog.open();
          }
        },

        _initWorkFilters: function () {
          const oDialog = this.oWorkDialog;
          if (!oDialog) return;

          const oSmartFilterBar = oDialog.getContent()[0].getItems()[0];
          const oSmartTable = oDialog.getContent()[0].getItems()[1];

          // Apply filters once when SmartFilterBar is initialized or when dialog opens.
          const applyOnce = () => {
            if (oDialog.__workFiltersApplied) return;
            try {
              // If ReceivedDate is not already set by the user/variant, set it to LASTWEEKS(4)
              var oFilterData = {};
              var oExisting = {};
              try {
                oExisting = oSmartFilterBar.getFilterData?.() || {};
              } catch (e) {
                oExisting = {};
              }

              var bHasReceived = false;
              try {
                bHasReceived = !!(
                  oExisting &&
                  (oExisting.ReceivedDate ||
                    (oExisting.ReceivedDate && oExisting.ReceivedDate.items))
                );
              } catch (e) {
                bHasReceived = false;
              }

              if (!bHasReceived) {
                oFilterData.ReceivedDate = {
                  // use conditionTypeInfo to match ControlConfiguration in fragment
                  conditionTypeInfo: {
                    name: "sap.ui.comp.config.condition.DateRangeType",
                    data: {
                      key: "LASTWEEKS",
                      operation: "LASTWEEKS",
                      value1: 4,
                    },
                  },
                };

                try {
                  oSmartFilterBar.setFilterData(oFilterData, true);
                  // Trigger search so SmartTable binds with the filter
                  oSmartFilterBar.search();
                } catch (e) {
                  // ignore failures
                }
              }
            } catch (e) {
              // ignore
            }
            oDialog.__workFiltersApplied = true;
          };

          if (!oSmartFilterBar.getInitialized?.()) {
            oSmartFilterBar.attachInitialized(applyOnce.bind(this));
          } else {
            applyOnce.call(this);
          }

          // Ensure filters are applied after the dialog is opened (cover timing edge-cases)
          if (!oDialog._applyWorkFiltersAfterOpenAttached) {
            oDialog.attachAfterOpen(
              function () {
                applyOnce.call(this);
              }.bind(this),
            );
            oDialog._applyWorkFiltersAfterOpenAttached = true;
          }
        },

        onWorkSearch: function (oEvent) {
          const oDialog = this.oWorkDialog;
          if (!oDialog) return;

          const oSmartTable = oDialog.getContent()[0].getItems()[1];
          setTimeout(() => {
            this._hideWorkReportColumns(oSmartTable);
            this._addLeadTimeColumn(oSmartTable);
          }, 300);
        },

        onWorkBeforeRebindTable: function (oEvent) {
          try {
            var oBindingParams = oEvent.getParameter("bindingParams");
            if (!oBindingParams) return;

            // Group by Owner and then sort by ReceivedDate (newest first)
            var oOwnerGroup = new sap.ui.model.Sorter("Owner", false, function (
              oContext,
            ) {
              var sOwner = oContext.getProperty("Owner") || "";
              return {
                key: sOwner,
                text: sOwner,
              };
            });

            var oDateSorter = new sap.ui.model.Sorter("ReceivedDate", true);

            oBindingParams.sorter = [oOwnerGroup, oDateSorter];

            // Mark the SmartTable so downstream logic can hide the Owner column
            try {
              var oSmartTable = oEvent.getSource();
              if (oSmartTable && typeof oSmartTable.data === "function") {
                oSmartTable.data("workGroupingEnabled", true);
              }
            } catch (e) {
              // ignore
            }
          } catch (e) {
            console.error("Error setting work table sorters/grouping:", e);
          }
        },

        _hideWorkReportColumns: function (oSmartTable) {
          try {
            const oInnerTable = oSmartTable.getTable();
            if (!oInnerTable) return;

            const aColumns = oInnerTable.getColumns();

            // If grouping by Owner was enabled via beforeRebindTable, hide the Owner column
            const bGrouping =
              typeof oSmartTable.data === "function" &&
              oSmartTable.data("workGroupingEnabled") === true;

            const aRequiredHeaders = [
              "Owner",
              "Customer",
              "Win Chance",
              "Status",
              "Proposal Type",
              "SAP Area of Solution / Requirement",
              "Lead Time (Days)",
            ];

            aColumns.forEach((oColumn) => {
              const sHeader = oColumn.getHeader?.()?.getText?.() || "";

              // Hide Owner column when grouped (group header already shows it)
              if (bGrouping && sHeader === "Owner") {
                oColumn.setVisible(false);
                return;
              }

              const bIsRequired = aRequiredHeaders.includes(sHeader);
              oColumn.setVisible(bIsRequired);
            });
          } catch (error) {
            console.error("Error hiding work report columns:", error);
          }
        },

        _addLeadTimeColumn: function (oSmartTable) {
          try {
            const oInnerTable = oSmartTable.getTable();
            if (!oInnerTable) return;

            // Add Lead Time column header if not already present
            const aColumns = oInnerTable.getColumns();
            const bExists = aColumns.some(
              (c) => c.getHeader?.()?.getText?.() === "Lead Time (Days)",
            );
            if (!bExists) {
              oInnerTable.addColumn(
                new sap.m.Column({
                  header: new sap.m.Text({ text: "Lead Time (Days)" }),
                }),
              );
              // Ensure the newly added column is visible
              const aColsAfterAdd = oInnerTable.getColumns();
              const oLeadCol = aColsAfterAdd.find(
                (c) => c.getHeader?.()?.getText?.() === "Lead Time (Days)",
              );
              if (oLeadCol && typeof oLeadCol.setVisible === "function") {
                oLeadCol.setVisible(true);
              }
            }

            // Compute and set Lead Time cell for each rendered row
            const aItems = oInnerTable.getItems?.() || [];
            const iColCount = oInnerTable.getColumns().length;

            aItems.forEach((oItem) => {
              // Skip group header rows (they render differently)
              try {
                var sMeta = oItem.getMetadata?.().getName?.();
                if (sMeta === "sap.m.GroupHeaderListItem") return;
              } catch (e) {
                // ignore
              }

              const aCells = oItem.getCells?.() || [];
              // Only add cell if not yet added (cell count < column count)
              if (aCells.length < iColCount) {
                const oCtx = oItem.getBindingContext();
                let sText = "N/A";
                if (oCtx) {
                  const oData = oCtx.getObject();
                  const oSubDate = oData.SubmissionDate
                    ? new Date(oData.SubmissionDate)
                    : null;
                  const oRecDate = oData.ReceivedDate
                    ? new Date(oData.ReceivedDate)
                    : null;
                  if (
                    oSubDate &&
                    oRecDate &&
                    !isNaN(oSubDate) &&
                    !isNaN(oRecDate)
                  ) {
                    const iDays = Math.round(
                      (oSubDate - oRecDate) / (1000 * 60 * 60 * 24),
                    );
                    sText = iDays >= 0 ? iDays + " days" : "-";
                  }
                }
                oItem.addCell(new sap.m.Text({ text: sText }));
              }
            });
          } catch (error) {
            console.error("Error adding Lead Time column:", error);
          }
        },

        onWorkTableInitialize: function (oEvent) {
          try {
            const oSmartTable = oEvent.getSource();
            const oInnerTable = oSmartTable.getTable?.();
            if (!oInnerTable) return;

            if (typeof oInnerTable.setGrowing === "function") {
              oInnerTable.setGrowing(true);
              oInnerTable.setGrowingScrollToLoad(true);
              if (typeof oInnerTable.setGrowingThreshold === "function") {
                oInnerTable.setGrowingThreshold(20);
              }
            }

            if (typeof oInnerTable.setSticky === "function") {
              try {
                oInnerTable.setSticky(["ColumnHeaders", "HeaderToolbar"]);
              } catch (e) {
                // ignore
              }
            }

            if (typeof oInnerTable.attachUpdateFinished === "function") {
              oInnerTable.attachUpdateFinished(
                function () {
                  setTimeout(() => {
                    try {
                      this._hideWorkReportColumns(oSmartTable);
                      this._addLeadTimeColumn(oSmartTable);
                    } catch (e) {
                      console.error(
                        "Error in work report updateFinished handler:",
                        e,
                      );
                    }
                  }, 50);
                }.bind(this),
              );
            }
          } catch (err) {
            console.error("Error initializing work report table:", err);
          }
        },

        onExportWorkToExcel: function () {
          try {
            const oDialog = this.oWorkDialog;
            if (!oDialog) return;

            const oSmartFilterBar = oDialog.getContent()[0].getItems()[0];
            const oModel = this.getView().getModel();

            const aFilters =
              oSmartFilterBar && oSmartFilterBar.getFilters
                ? oSmartFilterBar.getFilters()
                : [];

            oModel.read("/xNGRxCDS_PS_MASTER", {
              filters: aFilters,
              urlParameters: {
                $select:
                  "Owner,CustomerName,WinChance,Status,ProposalTypeOp,SolutionArea,SubmissionDate,ReceivedDate",
                $top: 100000,
              },
              success: function (oData) {
                const aRows = oData.results || oData.value || [];

                const aExportData = aRows.map(function (oRow) {
                  const oSubDate = oRow.SubmissionDate
                    ? new Date(oRow.SubmissionDate)
                    : null;
                  const oRecDate = oRow.ReceivedDate
                    ? new Date(oRow.ReceivedDate)
                    : null;
                  let iLeadTime = null;
                  if (
                    oSubDate &&
                    oRecDate &&
                    !isNaN(oSubDate) &&
                    !isNaN(oRecDate)
                  ) {
                    iLeadTime = Math.round(
                      (oSubDate - oRecDate) / (1000 * 60 * 60 * 24),
                    );
                  }
                  return {
                    Owner: oRow.Owner || "",
                    CustomerName: oRow.CustomerName || "",
                    WinChance: oRow.WinChance || "",
                    Status: oRow.Status || "",
                    ProposalTypeOp: oRow.ProposalTypeOp || "",
                    SolutionArea: oRow.SolutionArea || "",
                    LeadTimeDays: iLeadTime !== null ? iLeadTime : "",
                  };
                });

                const aColumns = [
                  { label: "Owner", property: "Owner" },
                  { label: "Customer", property: "CustomerName" },
                  { label: "Winning Chance", property: "WinChance" },
                  { label: "Status", property: "Status" },
                  { label: "Proposal Type", property: "ProposalTypeOp" },
                  {
                    label: "SAP Area of Solution / Requirement",
                    property: "SolutionArea",
                  },
                  {
                    label: "Lead Time (Days)",
                    property: "LeadTimeDays",
                    type: "Number",
                  },
                ];

                // Build timestamped filename
                var _now = new Date();
                var _pad = (n) => (n < 10 ? "0" + n : n);
                var _months = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                var _dd = _pad(_now.getDate());
                var _mon = _months[_now.getMonth()];
                var _yyyy = _now.getFullYear();
                var _hours24 = _now.getHours();
                var _hh12 = _hours24 % 12 || 12;
                var _hh = _pad(_hh12);
                var _mm = _pad(_now.getMinutes());
                var _ampm = _hours24 >= 12 ? "PM" : "AM";
                var sFileName =
                  "Work_Report_" +
                  _dd +
                  _mon +
                  _yyyy +
                  "_" +
                  _hh +
                  _mm +
                  _ampm +
                  ".xlsx";

                const oSettings = {
                  workbook: {
                    columns: aColumns,
                    context: { title: "Work Report" },
                  },
                  dataSource: aExportData,
                  fileName: sFileName,
                  worker: false,
                };

                const oSheet = new Spreadsheet(oSettings);
                oSheet.build().finally(function () {
                  oSheet.destroy();
                });
              }.bind(this),
              error: function (oError) {
                console.error(
                  "Error reading work report rows for export:",
                  oError,
                );
                sap.m.MessageBox.error(
                  "Failed to fetch work report rows for export.",
                );
              }.bind(this),
            });
          } catch (e) {
            console.error("Work report export failed:", e);
            sap.m.MessageBox.error("Failed to export work report to Excel.");
          }
        },

        onCloseWorkDialog: function () {
          if (this.oWorkDialog) {
            this.oWorkDialog.close();
          }
        },

        onControlCreated: function (oEvent) {
          if (
            oEvent.getParameters()[0] instanceof sap.m.Input &&
            oEvent.getParameters()[0].getShowValueHelp()
          ) {
            // set ValueHelpOnly for Inputs with ValueHelp
            oEvent.getParameters()[0].setValueHelpOnly(true);
          }
        },
        onStatusControlCreated: function (oEvent) {
          oEvent.getParameters()[0].setEditable(false);
        },
      },
    );
  },
);
