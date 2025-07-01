sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "com/ngr/www/presalestracker/ngrpresalestracker/utils/FieldValidators",
  ],
  (Controller, Fragment, FieldValidators) => {
    "use strict";

    return Controller.extend(
      "com.ngr.www.presalestracker.ngrpresalestracker.controller.Detail",
      {
        onInit() {
          this.oRouter = this.getOwnerComponent().getRouter();
          this.oModel = this.getOwnerComponent().getModel("comp");

          this.oRouter
            .getRoute("Detail")
            .attachPatternMatched(this._onOppMatched, this);
          const oExitButton = this.getView().byId(
              "idExitFullScreenOverflowToolbarButton"
            ),
            oEnterButton = this.getView().byId(
              "idEnterFullScreenOverflowToolbarButton"
            );
          [oExitButton, oEnterButton].forEach(function (oButton) {
            oButton.addEventDelegate({
              onAfterRendering: function () {
                if (this.bFocusFullScreenButton) {
                  this.bFocusFullScreenButton = false;
                  oButton.focus();
                }
              }.bind(this),
            });
          }, this);

          var oEditModel = new sap.ui.model.json.JSONModel({
            editMode: false,
            showSave: false,
          });
          this.getView().setModel(oEditModel, "viewEditableModel");

          const oProbField = this.getView().byId("idEditProbability");
          if (oProbField) {
            FieldValidators.applyProbabilityValidation(oProbField);
          }
        },
        onUpdateNewRemarks: function (oEvent) {
          var oView = this.getView();
          var oFeedInput = oView.byId("_IDGenFeedInput1");
          var sText = oEvent.getParameter("value").trim();

          if (!sText) {
            MessageToast.show("Please enter a remark.");
            return;
          }

          var oModel = oView.getModel();
          var oContext = oFeedInput.getBindingContext();
          var sPath = oContext.getPath() + "/toRemarks"; // deep insert path

          var oNewEntry = {
            Id: oContext.getObject().Id,
            RmText: sText,
          };

          oModel.create(sPath, oNewEntry, {
            success: function () {
              sap.m.MessageToast.show("Remark added successfully.");
              oFeedInput.setValue("");
            },
            error: function () {
              sap.m.MessageBox.error("Failed to add remark.");
            },
          });
        },
        _checkExistingEdits() {
          var oViewModel = this.getView().getModel("viewEditableModel");
          var oModel = this.getView().getModel();
          if (oModel.hasPendingChanges()) {
            // Ask confirmation
            sap.m.MessageBox.confirm(
              "You have unsaved changes. Are you sure you want to discard them?",
              {
                title: "Discard Changes?",
                actions: [
                  sap.m.MessageBox.Action.OK,
                  sap.m.MessageBox.Action.CANCEL,
                ],
                emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                onClose: function (sAction) {
                  if (sAction === sap.m.MessageBox.Action.OK) {
                    oModel.resetChanges(); // discard changes
                    oModel.checkUpdate(true); // refresh bindings
                    oViewModel.setProperty("/editMode", false); // switch to display
                    oViewModel.setProperty("/showSave", false); // hide save
                    sap.m.MessageToast.show("Changes discarded");
                    return false;
                  } else {
                    return true;
                  }
                },
              }
            );
          } else {
            // No changes, just switch off
            oViewModel.setProperty("/editMode", false);
            return false;
          }
        },
        _onOppMatched: function (oEvent) {
          if (this.sameViewInFullScreen) {
            this.sameViewInFullScreen = false;
            return;
          }
          var oViewModel = this.getView().getModel("viewEditableModel");
          var oModel = this.getView().getModel();
          var oView = this.getView();
          oModel.resetChanges();
          oModel.checkUpdate(true);
          oViewModel.setProperty("/editMode", false);
          oViewModel.setProperty("/showSave", false);
          this._id = oEvent.getParameter("arguments").id || this._id || "0";
          this.getView().byId("_IDGenFeedInput1").setValue("");
          this.getView().bindElement({
            path: "/xNGRxCDS_PS_MASTER('" + this._id + "')",
            events: {
              dataRequested: function () {
                this.getView().setBusy(true);
              }.bind(this),
              dataReceived: function () {
                this.getView().setBusy(false);

                const oView = this.getView();
                const oCtx = oView.getElementBinding().getBoundContext();

                if (oCtx) {
                  const oData = oCtx.getObject();
                  this._oInitialSubmissionDate = oData.SubmissionDate;
                  this._oInitialStatus = oData.Status;

                  const oSmartField = oView.byId("_IDGenSmartField20");
                  if (!oSmartField) return;

                  oSmartField.attachInnerControlsCreated(() => {
                    const aInnerControls = oSmartField.getInnerControls();
                    if (aInnerControls && aInnerControls.length > 0) {
                      const oControl = aInnerControls[0];
                      if (typeof oControl.attachChange === "function") {
                        oControl.attachChange(this._onStatusChange.bind(this));
                      }
                    }
                  });
                }
              }.bind(this),
            },
          });
          var oView = this.getView();
          oView.getElementBinding().refresh(true);
          var oModel = oView.getModel();
          this.oDataModel = oModel;
          this.oDataModel.attachBatchRequestCompleted(
            this._onModelChange.bind(this)
          );
        },
        _onModelChange: function () {
          if (this.getView().getBusy()) this.getView().setBusy(false);
        },
        onOverflowToolbarButtonFullScreenPress: function () {
          this.sameViewInFullScreen = true;
          this.bFocusFullScreenButton = true;
          let sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/fullScreen"
          );
          this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._id });
        },
        onOverflowToolbarButtonExitFullScreenPress: function () {
          this.sameViewInFullScreen = true;
          this.bFocusFullScreenButton = true;
          let sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/exitFullScreen"
          );
          this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._id });
        },
        onOverflowToolbarButtonClosePress: function () {
          const sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/closeColumn"
          );

          if (this.isEditingActive()) {
            sap.m.MessageBox.confirm(
              "You have unsaved changes or remarks. Do you want to discard them and close?",
              {
                title: "Discard Changes?",
                actions: [
                  sap.m.MessageBox.Action.OK,
                  sap.m.MessageBox.Action.CANCEL,
                ],
                emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                onClose: function (sAction) {
                  if (sAction === sap.m.MessageBox.Action.OK) {
                    this.cancelEditing();
                    this._id = null;
                    this.oRouter.navTo("Master", { layout: sNextLayout });
                  }
                }.bind(this),
              }
            );
          } else {
            this._id = null;
            this.oRouter.navTo("Master", { layout: sNextLayout });
          }
        },
        onNewRemarkLiveChange: function (oEvent) {
          var sNewText = oEvent.getParameter("value");
          this.getView()
            .getModel("viewEditableModel")
            .setProperty("/newRemarkText", sNewText);
        },
        onFieldGroupChange: function (oEvent) {
          this.oDataModel.checkUpdate(true);
          this._onModelChange();
        },
        onEditModeToggle: function () {
          var oViewModel = this.getView().getModel("viewEditableModel");
          var oModel = this.getView().getModel();

          var bCurrentState = oViewModel.getProperty("/editMode"); // true = Edit, false = Display
          var bNewState = !bCurrentState;

          // Going to Edit mode: always allow
          if (bNewState) {
            oViewModel.setProperty("/editMode", true);
            oViewModel.setProperty("/showSave", true);
            return;
          }

          // Going to Display mode: check for unsaved changes
          if (oModel.hasPendingChanges()) {
            // Ask confirmation
            sap.m.MessageBox.confirm(
              "You have unsaved changes. Are you sure you want to discard them?",
              {
                title: "Discard Changes?",
                actions: [
                  sap.m.MessageBox.Action.OK,
                  sap.m.MessageBox.Action.CANCEL,
                ],
                emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                onClose: function (sAction) {
                  if (sAction === sap.m.MessageBox.Action.OK) {
                    oModel.resetChanges(); // discard changes
                    oModel.checkUpdate(true); // refresh bindings
                    oViewModel.setProperty("/editMode", false); // switch to display
                    oViewModel.setProperty("/showSave", false); // hide save
                    sap.m.MessageToast.show("Changes discarded");
                  }
                },
              }
            );
          } else {
            // No changes, just switch off
            oViewModel.setProperty("/editMode", false);
            oViewModel.setProperty("/showSave", false);
          }
        },
        onSave: function () {
          const oView = this.getView();
          const oModel = oView.getModel();
          const oVM = oView.getModel("viewEditableModel");
          const oContext = oView.getElementBinding().getBoundContext();
          const oRemarksList = oView.byId("_IDGenList1");
          if (!oContext) {
            sap.m.MessageBox.error("No bound context found.");
            return;
          }

          const sPath = oContext.getPath(); // "/xNGRxCDS_PS_MASTER('0003')"
          const oPayload = oModel.getObject(sPath); // Get full object from model

          oView.setBusy(true);

          if (oPayload.Status === "COMPLETE") {
            if (
              !oPayload.DeliveryHandover ||
              oPayload.DeliveryHandover === ""
            ) {
              sap.m.MessageBox.error(
                `Opportunity can not be completed without handling over to the Delivery Teams.`,
                {
                  onClose: function () {
                    this.byId("_IDGenSmartField60").focus();
                  }.bind(this),
                }
              );
              oView.setBusy(false);
              return;
            }
          }
          if (oPayload.Status === "WIN") {
            if (!oPayload.CommModel || oPayload.CommModel === "") {
              sap.m.MessageBox.error(
                `Please specify Commercial Model of the Opportunity.`,
                {
                  onClose: function () {
                    this.byId("_IDGenSmartField10").focus();
                  }.bind(this),
                }
              );
              oView.setBusy(false);
              return;
            }
          }

          if (oPayload.Status === "SUBMITTED") {
            const aMissingFields = [];
            let sFirstMissingFieldId = "";

            if (!oPayload.SubmissionDate) {
              aMissingFields.push("• Submission Date");
              sFirstMissingFieldId =
                sFirstMissingFieldId || "_IDGenSmartField8";
            }

            if (!oPayload.PreSalesReviewwer) {
              aMissingFields.push("• Pre Sales Reviewer");
              sFirstMissingFieldId =
                sFirstMissingFieldId || "_IDGenSmartField25";
            }

            if (!oPayload.PracticeReviewwer) {
              aMissingFields.push("• Practice Reviewer");
              sFirstMissingFieldId =
                sFirstMissingFieldId || "_IDGenSmartField24";
            }

            if (!oPayload.OppTcv || Number(oPayload.OppTcv) === 0) {
              aMissingFields.push("• Opportunity Value");
              sFirstMissingFieldId =
                sFirstMissingFieldId || "_IDGenSmartField9";
            }

            if (aMissingFields.length > 0) {
              sap.m.MessageBox.error(
                "Please fill the following required field(s):\n" +
                  aMissingFields.join("\n"),
                {
                  onClose: function () {
                    if (sFirstMissingFieldId) {
                      this.byId(sFirstMissingFieldId).focus();
                    }
                  }.bind(this),
                }
              );
              oView.setBusy(false);
              return;
            }
          }

          if (oPayload.Status === "WIP") {
            if (
              oPayload.PlannedSubmissionDate ||
              oPayload.PlannedSubmissionDate === null
            ) {
              const oPlannedDate = new Date(oPayload.PlannedSubmissionDate);
              const oToday = new Date();

              oToday.setHours(0, 0, 0, 0);

              if (oPlannedDate < oToday) {
                sap.m.MessageBox.error(
                  `Planned Submission Date cannot be in the past.`,
                  {
                    onClose: function () {
                      this.byId("_IDGenSmartField18").focus();
                    }.bind(this),
                  }
                );
                oView.setBusy(false);
                return;
              }
            }
            /*if (oPayload.DueSubmissionDate || oPayload.DueSubmissionDate === null) {
                const oDueDate = new Date(oPayload.DueSubmissionDate);
                const oToday = new Date();
  
                oToday.setHours(0, 0, 0, 0);
  
                if (oDueDate < oToday) {
                  sap.m.MessageBox.error(
                    `Due Submission Date cannot be in the past.`,
                    {
                      onClose: function () {
                        this.byId("_IDGenSmartField57").focus();
                      }.bind(this),
                    }
                  );
                  oView.setBusy(false);
                  return;
                }
              }*/
          }

          if (oPayload.ReceivedDate && oPayload.PlannedSubmissionDate) {
            const oReceived = new Date(oPayload.ReceivedDate);
            const oPlanned = new Date(oPayload.PlannedSubmissionDate);

            oReceived.setHours(0, 0, 0, 0);
            oPlanned.setHours(0, 0, 0, 0);

            if (oReceived > oPlanned) {
              sap.m.MessageBox.error(
                "Received Date must be on or before Planned Submission Date."
              );
              oView.setBusy(false);
              return;
            }
          }

          if (oPayload.ReceivedDate && oPayload.DueSubmissionDate) {
            const oReceived = new Date(oPayload.ReceivedDate);
            const oDue = new Date(oPayload.DueSubmissionDate);

            oReceived.setHours(0, 0, 0, 0);
            oDue.setHours(0, 0, 0, 0);

            if (oReceived > oDue) {
              sap.m.MessageBox.error(
                "Received Date must be on or before Due Submission Date."
              );
              oView.setBusy(false);
              return;
            }
          }

          if (oPayload.Status === "WIN" || oPayload.Status === "LOSS") {
            if (!oPayload.CloseDate) {
              sap.m.MessageBox.error(
                `If the Opportunity is ${oPayload.Status}, please fill the Win/Loss Date.`,
                {
                  onClose: function () {
                    // Focus the first empty field
                    this.byId("_IDGenSmartField11").focus();
                  }.bind(this),
                }
              );
              oView.setBusy(false);
              return;
            }
          }

          if (oPayload.Status === "LOSS" && !oPayload.Reason) {
            sap.m.MessageBox.error(
              `If the Opportunity is ${oPayload.Status}, please fill the Loss Reason.`,
              {
                onClose: function () {
                  this.byId("_IDGenSmartField56").focus();
                }.bind(this),
              }
            );
            oView.setBusy(false);
            return;
          }

          if (oPayload.toParters) {
            delete oPayload.toParters;
          }
          if (oPayload.toRemarks) {
            delete oPayload.toRemarks;
          }
          const oListPage = this.getView()
            .getParent()
            .getParent()
            .getCurrentBeginColumnPage();

          oModel.update(sPath, oPayload, {
            method: "PUT",
            success: () => {
              sap.m.MessageToast.show("Saved successfully.");
              oVM.setProperty("/editMode", false);
              oVM.setProperty("/showSave", false);
              oRemarksList.getBinding("items").refresh(); // Refresh remarks list

              oListPage.getModel().refresh();
              oListPage.getController()._updateSegmentedCounts();
            },
            error: (oError) => {
              sap.m.MessageBox.error("Save failed.");
              console.error(oError);
              oView.setBusy(false);
            },
            complete: () => {
              oView.setBusy(false);
            },
          });
        },
        onCreatePartner: function (oEvent) {
          var oView = this.getView();

          if (!this._pPartnerDialog) {
            Fragment.load({
              id: oView.getId(),
              name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.NewPartnerCreate",
              controller: this,
            }).then(
              function (oDialog) {
                this._pPartnerDialog = oDialog;
                oView.addDependent(oDialog);
                oDialog.open();
                return oDialog;
              }.bind(this)
            );
          } else {
            this._pPartnerDialog.open();
          }
        },
        onCreatePartnerConfirm: function () {
          var oView = this.getView();
          var sName = Fragment.byId(
            oView.getId(),
            "partnerNameSmartField"
          ).getValue();
          var sPartnerFunction = Fragment.byId(
            oView.getId(),
            "partnerFunctionSmartField"
          ).getValue();
          var sEmail = Fragment.byId(
            oView.getId(),
            "partnerEmailSmartField"
          ).getValue();

          if (!sName) {
            sap.m.MessageToast.show("Please enter Name");
            return;
          }

          if (!sPartnerFunction) {
            sap.m.MessageToast.show("Please enter Partner Function");
            return;
          }

          // Basic email format check using regex
          var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (sEmail !== "" && !emailRegex.test(sEmail)) {
            sap.m.MessageToast.show("Please enter a valid Email address");
            return;
          }

          // Call create logic here
          var oModel = oView.getModel();
          var oContext = Fragment.byId(
            oView.getId(),
            "partnerDialog"
          ).getBindingContext();
          var sPath = oContext.getPath() + "/toParters";

          var oNewEntry = {
            Id: oContext.getObject().Id,
            PartnerName: sName,
            PartnerFunction: sPartnerFunction,
            PartnerEmail: sEmail,
          };

          oModel.create(sPath, oNewEntry, {
            success: function () {
              sap.m.MessageToast.show("Partner added successfully.");
              oModel.resetChanges();
              Fragment.byId(oView.getId(), "partnerDialog").close();
            }.bind(this),
            error: function (oError) {
              var sErrorMessage = "An unknown error occurred.";

              try {
                // Try parsing the error response
                var oResponse = oError.responseText
                  ? JSON.parse(oError.responseText)
                  : null;
                if (
                  oResponse &&
                  oResponse.error &&
                  oResponse.error.message &&
                  oResponse.error.message.value
                ) {
                  sErrorMessage = oResponse.error.message.value;
                } else if (oError.message) {
                  sErrorMessage = oError.message;
                }
              } catch (e) {
                // Fallback to generic error or the raw response text
                sErrorMessage =
                  oError.responseText ||
                  "Failed to parse backend error response.";
              }

              sap.m.MessageBox.error(sErrorMessage);

              oModel.resetChanges();
              Fragment.byId(oView.getId(), "partnerDialog").close();
            }.bind(this),
          });
        },
        onCreatePartnerCancel: function () {
          Fragment.byId(this.getView().getId(), "partnerDialog").close();
          this.getView().getModel().resetChanges();
        },
        onPartnerEdit: function (oEvent) {
          var oSource = oEvent.getSource(); // the button
          var oContext = oSource.getBindingContext(); // get the row context
          var oData = oContext.getObject(); // full partner data

          // Example: open a fragment dialog with partner data pre-filled for editing
          if (!this._oEditPartnerDialog) {
            Fragment.load({
              id: this.getView().getId(),
              name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.PartnerEdit",
              controller: this,
            }).then(
              function (oDialog) {
                this._oEditPartnerDialog = oDialog;
                this.getView().addDependent(oDialog);
                this._bindEditDialog(oContext);
                oDialog.open();
              }.bind(this)
            );
          } else {
            this._bindEditDialog(oContext);
            this._oEditPartnerDialog.open();
          }
        },

        _bindEditDialog: function (oContext) {
          this._oEditPartnerDialog.setBindingContext(oContext);
          this._oEditPartnerDialog.setModel(this.getView().getModel());
        },

        onPartnerDelete: function (oEvent) {
          var oSource = oEvent.getSource();
          var oContext = oSource.getBindingContext();
          var oModel = this.getView().getModel();
          var oData = oContext.getObject();

          var sPartnerName = oData.PartnerName || "Unknown";
          var sPartnerFunc = oData.PartnerFunction || "Unknown";

          if (sPartnerFunc === "OWN") {
            sap.m.MessageBox.error(
              "Owner of the opportunity cannot be deleted."
            );
            return;
          }

          sap.m.MessageBox.confirm(
            "Are you sure you want to delete this partner?",
            {
              title: sPartnerName + " (" + sPartnerFunc + ")",
              actions: [
                sap.m.MessageBox.Action.YES,
                sap.m.MessageBox.Action.NO,
              ],
              onClose: function (oAction) {
                if (oAction === sap.m.MessageBox.Action.YES) {
                  oModel.remove(oContext.getPath(), {
                    success: function () {
                      sap.m.MessageToast.show("Partner deleted successfully.");
                    },
                    error: function (oError) {
                      sap.m.MessageBox.error("Error while deleting partner.");
                    },
                  });
                }
              },
            }
          );
        },
        onSaveEditedPartner: function () {
          var oModel = this.getView().getModel();

          if (oModel.hasPendingChanges()) {
            oModel.submitChanges({
              success: function () {
                sap.m.MessageToast.show("Partner updated successfully.");
              },
              error: function () {
                sap.m.MessageBox.error("Update failed.");
              },
            });
          }

          if (this._oEditPartnerDialog) {
            this._oEditPartnerDialog.close();
          }
        },

        onCancelEdit: function () {
          var oModel = this.getView().getModel();

          if (oModel.hasPendingChanges()) {
            oModel.resetChanges(); // discard unsaved changes
          }

          if (this._oEditPartnerDialog) {
            this._oEditPartnerDialog.close();
          }
        },
        onShowChangeLogs: function (oEvent) {
          const oView = this.getView();
          const oModel = oView.getModel();
          const oContext = oEvent.getSource().getBindingContext();
          const sObjectClass = oEvent.getSource().data("objectClass");
          const sObjectId = oContext.getProperty("Id"); // or any key field

          // Call Function Import
          oModel.callFunction("/GetChangeLogs", {
            method: "GET",
            urlParameters: {
              ObjectClass: sObjectClass,
              ObjectId: sObjectId,
            },
            success: function (oData) {
              const aLogs = oData.results || [];
              const oLogModel = new sap.ui.model.json.JSONModel(aLogs);

              const bindTable = function () {
                const oLogTable = Fragment.byId(oView.getId(), "logTable");
                oLogTable.setModel(oLogModel);
                oLogTable.bindItems({
                  path: "/",
                  template: new sap.m.ColumnListItem({
                    cells: [new sap.m.Text({ text: "{CDText}" })],
                  }),
                });
              };

              // Load and open dialog
              if (!this._pLogDialog) {
                Fragment.load({
                  id: this.getView().getId(),
                  name: "com.ngr.www.presalestracker.ngrpresalestracker.view.fragments.ViewChangeLog",
                  controller: this,
                }).then(
                  function (oDialog) {
                    this._pLogDialog = oDialog;
                    oView.addDependent(oDialog);
                    bindTable();
                    this._pLogDialog.open();
                  }.bind(this)
                );
              } else {
                bindTable();
                this._pLogDialog.open();
              }
            }.bind(this),
            error: function (oError) {
              sap.m.MessageBox.error("Failed to load change logs.");
            },
          });
        },
        onCloseLogDialog: function () {
          if (this._pLogDialog) {
            this._pLogDialog.close();
          }
        },
        onOpenReviewerDialog: function () {
          const oView = this.getView();
          const oContext = oView.getBindingContext(); // or specific context path

          if (!this._pReviewerDialog) {
            Fragment.load({
              name: "your.namespace.view.fragments.ReviewerDialog",
              controller: this,
            }).then(
              function (oDialog) {
                this._pReviewerDialog = oDialog;
                oView.addDependent(oDialog);

                // Bind dialog to context
                this._pReviewerDialog.setBindingContext(oContext);
                this._pReviewerDialog.setModel(oView.getModel());

                this._pReviewerDialog.open();
              }.bind(this)
            );
          } else {
            this._pReviewerDialog.setBindingContext(oContext);
            this._pReviewerDialog.open();
          }
        },
        formatId: function (sId) {
          // Remove leading zeros
          return sId ? sId.replace(/^0+/, "") : "";
        },
        isEditingActive: function () {
          const oVM = this.getView().getModel("viewEditableModel");
          const oModel = this.getView().getModel();
          const bEditMode = oVM.getProperty("/editMode");

          const oFeedInput = this.getView().byId("_IDGenFeedInput1");
          const sNewRemark = oFeedInput?.getValue()?.trim();
          const bHasPendingChanges = oModel.hasPendingChanges();

          return (sNewRemark && sNewRemark.length > 0) || bHasPendingChanges;
        },

        cancelEditing: function () {
          const oModel = this.getView().getModel();
          const oVM = this.getView().getModel("viewEditableModel");

          if (oModel.hasPendingChanges()) {
            oModel.resetChanges();
            oModel.checkUpdate(true);
          }

          // Reset edit mode
          oVM.setProperty("/editMode", false);
          oVM.setProperty("/showSave", false);

          // Clear new remark text
          const oFeedInput = this.getView().byId("_IDGenFeedInput1");
          if (oFeedInput) {
            oFeedInput.setValue("");
          }

          if (this._bSubmissionDateCleared && this._oInitialSubmissionDate) {
            const oContext = this.getView()
              .getElementBinding()
              .getBoundContext();
            if (oContext) {
              const sPath = oContext.getPath();
              oModel.setProperty(
                sPath + "/SubmissionDate",
                this._oInitialSubmissionDate
              );
              this._bSubmissionDateCleared = false;
            }
          }
        },
        shortenUrl: function (sUrl) {
          if (!sUrl) return "";
          return "Click here for Opportunity Documents";
        },
        onDeleteOpportunity: function (oEvent) {

          var oSource = oEvent.getSource();
          var oContext = oSource.getBindingContext();
          var oModel = this.getView().getModel();
          var oData = oContext.getObject();

          var sOpportunityId = Number(oData.Id) || "Unknown";

          sap.m.MessageBox.confirm(
            "Are you sure you want to mark this opportunity as deleted?",
            {
              title: "Delete Confirmation "+sOpportunityId,
              actions: [
                sap.m.MessageBox.Action.YES,
                sap.m.MessageBox.Action.NO,
              ],
              onClose: function (oAction) {
                if (oAction === sap.m.MessageBox.Action.YES) {
                  oModel.remove(oContext.getPath(), {
                    success: function () {
                      sap.m.MessageToast.show("Opportunity marked deleted.");
                      this.onOverflowToolbarButtonClosePress();
                    }.bind(this),
                    error: function (oError) {
                      sap.m.MessageBox.error("Error while deleting partner.");
                    },
                  });
                }
              }.bind(this),
            }
          );
        },
        _onStatusChange: function (oEvent) {
          const sNewStatus =
            oEvent.getSource().getSelectedKey?.() ||
            oEvent.getSource().getValue?.();
          const oView = this.getView();
          const oContext = oView.getElementBinding().getBoundContext();

          if (!oContext || !sNewStatus) return;

          const sPath = oContext.getPath();
          const oModel = oContext.getModel();

          if (
            this._oInitialStatus !== "SUBMITTED" &&
            sNewStatus === "SUBMITTED" &&
            this._oInitialSubmissionDate
          ) {
            oModel.setProperty(sPath + "/SubmissionDate", null);
            this._bSubmissionDateCleared = true;
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
      }
    );
  }
);
