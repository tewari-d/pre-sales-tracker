sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/core/Fragment"],
  (Controller, Fragment) => {
    "use strict";

    return Controller.extend(
      "com.nagarro.www.presalestracker.controller.Detail",
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
                path: "/ZCDS_PS_MASTER('" + this._id + "')",
                events: {
                    dataRequested: function () {
                        this.getView().setBusy(true);
                    }.bind(this),
                    dataReceived: function () {
                        this.getView().setBusy(false);
                    }.bind(this)
                }
            });
            var oView = this.getView();
            var oModel = oView.getModel();
            this.oDataModel = oModel;
            this.oDataModel.attachBatchRequestCompleted(this._onModelChange.bind(this));
        },
        _onModelChange: function () {
            if (this.getView().getBusy()) this.getView().setBusy(false);
        },
        onOverflowToolbarButtonFullScreenPress: function () {
          this.bFocusFullScreenButton = true;
          let sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/fullScreen"
          );
          this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._id });
        },
        onOverflowToolbarButtonExitFullScreenPress: function () {
          this.bFocusFullScreenButton = true;
          let sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/exitFullScreen"
          );
          this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._id });
        },
        onOverflowToolbarButtonClosePress: function () {
          let sNextLayout = this.oModel.getProperty(
            "/actionButtonsInfo/midColumn/closeColumn"
          );
          this.oRouter.navTo("Master", { layout: sNextLayout });
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

          const sPath = oContext.getPath(); // "/ZCDS_PS_MASTER('0003')"
          const oPayload = oModel.getObject(sPath); // Get full object from model

          oView.setBusy(true);

          if (oPayload.Status === "SUBMITTED") {
            if (
              oPayload.PracticeReviewwer === "" ||
              oPayload.PreSalesReviewwer === "" ||
              oPayload.ResourceFutureDemandUpdated === ""
            ) {
              sap.m.MessageBox.error(
                "All three fields are required:\n• Future Demand Updated\n• Pre Sales Reviewer\n• Practice Reviewer\n• Opportunity Value",
                {
                  onClose: function () {
                    // Focus the first empty field
                    if (oPayload.PracticeReviewwer === "") {
                      this.byId("_IDGenSmartField24").focus();
                    } else if (oPayload.PreSalesReviewwer === "") {
                      this.byId("_IDGenSmartField25").focus();
                    } else if (oPayload.ResourceFutureDemandUpdated === "") {
                      this.byId("_IDGenSmartField26").focus();
                    } else if (oPayload.OppTcv === "") {
                      this.byId("_IDGenSmartField9").focus();
                    }
                  }.bind(this),
                }
              );
              oView.setBusy(false);
              return;
            }
          }

          oModel.update(sPath, oPayload, {
            method: "PUT",
            success: () => {
              sap.m.MessageToast.show("Saved successfully.");
              oVM.setProperty("/editMode", false);
              oVM.setProperty("/showSave", false);
              oRemarksList.getBinding("items").refresh(); // Refresh remarks list
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
            this._pPartnerDialog = Fragment.load({
              id: oView.getId(),
              name: "com.nagarro.www.presalestracker.view.fragments.NewPartnerCreate",
              controller: this,
            }).then(function (oDialog) {
              oView.addDependent(oDialog);
              return oDialog;
            });
          }

          this._pPartnerDialog.then(function (oDialog) {
            oDialog.open();
          });
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

          Fragment.byId(oView.getId(), "partnerDialog").destroy();

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
            },
            error: function () {
              sap.m.MessageBox.error("Failed to add new partner.");
            },
          });
        },
        onCreatePartnerCancel: function () {
          Fragment.byId(this.getView().getId(), "partnerDialog").close();
        },
        onPartnerEdit: function (oEvent) {
          var oSource = oEvent.getSource(); // the button
          var oContext = oSource.getBindingContext(); // get the row context
          var oData = oContext.getObject(); // full partner data

          // Example: open a fragment dialog with partner data pre-filled for editing
          if (!this._oEditPartnerDialog) {
            Fragment.load({
              id: this.getView().getId(),
              name: "com.nagarro.www.presalestracker.view.fragments.PartnerEdit",
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

          sap.m.MessageBox.confirm(
            "Are you sure you want to delete this partner?",
            {
              title:
                "Delete Partner: " + sPartnerName + " (" + sPartnerFunc + ")",
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

              // Load and open dialog
              if (!this._pLogDialog) {
                Fragment.load({
                  name: "com.nagarro.www.presalestracker.view.fragments.ViewChangeLog",
                  controller: this,
                }).then(
                  function (oDialog) {
                    this._pLogDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._pLogDialog.setModel(oLogModel);
                    this._pLogDialog.open();
                  }.bind(this)
                );
              } else {
                this._pLogDialog.setModel(oLogModel);
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
      }
    );
  }
);
