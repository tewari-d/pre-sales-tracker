sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Detail", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel('comp');

            this.oRouter.getRoute("Detail").attachPatternMatched(this._onOppMatched, this);
            const oExitButton = this.getView().byId("idExitFullScreenOverflowToolbarButton"),
                oEnterButton = this.getView().byId("idEnterFullScreenOverflowToolbarButton");
            [oExitButton, oEnterButton].forEach(function (oButton) {
                oButton.addEventDelegate({
                    onAfterRendering: function () {
                        if (this.bFocusFullScreenButton) {
                            this.bFocusFullScreenButton = false;
                            oButton.focus();
                        }
                    }.bind(this)
                });
            }, this);

            var oEditModel = new sap.ui.model.json.JSONModel({
                editMode: false,
                showSave: false
            });
            this.getView().setModel(oEditModel, "viewEditableModel");

        },
        onUpdateNewRemarks(oEvent) {
            sap.m.MessageToast.show("Remarks will be updated");
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
                        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                        emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                        onClose: function (sAction) {
                            if (sAction === sap.m.MessageBox.Action.OK) {
                                oModel.resetChanges();                           // discard changes
                                oModel.checkUpdate(true);                        // refresh bindings
                                oViewModel.setProperty("/editMode", false);     // switch to display
                                oViewModel.setProperty("/showSave", false);     // hide save
                                sap.m.MessageToast.show("Changes discarded");
                                return false;
                            } else {
                                return true;
                            }
                        }
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
            oModel.resetChanges();                           // discard changes
            oModel.checkUpdate(true);                        // refresh bindings
            oViewModel.setProperty("/editMode", false);     // switch to display
            oViewModel.setProperty("/showSave", false);     // hide save
            this._id = oEvent.getParameter("arguments").id || this._id || "0";
            oView.setBusy(true); // start busy indicator
            this.getView().bindElement({
                path: "/ZCDS_PS_MASTER('" + this._id + "')",
                events: {
                    dataRequested: function () {
                        oView.setBusy(true); // start busy indicator
                    },
                    dataReceived: function () {
                        oView.setBusy(false); // stop busy when data is loaded
                    }
                }
            });

            var oView = this.getView();
            var oModel = oView.getModel();
            this.oDataModel = oModel;
            this.oDataModel.setDefaultBindingMode('TwoWay');
            this.oDataModel.attachBatchRequestCompleted(this._onModelChange.bind(this));
        },
        _onModelChange: function () {
            if(this.getView().getBusy()) this.getView().setBusy(false);
            var oViewModel = this.getView().getModel("viewEditableModel");
            var bHasPendingChanges = this.oDataModel.hasPendingChanges();
            oViewModel.setProperty("/showSave", bHasPendingChanges);
        },
        onOverflowToolbarButtonFullScreenPress: function () {
            this.bFocusFullScreenButton = true;
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
            this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._service });
        },
        onOverflowToolbarButtonExitFullScreenPress: function () {
            this.bFocusFullScreenButton = true;
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
            this.oRouter.navTo("Detail", { layout: sNextLayout, id: this._service });
        },
        onOverflowToolbarButtonClosePress: function () {
            let sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
            this.oRouter.navTo("Master", { layout: sNextLayout });

        },
        onNewRemarkLiveChange: function (oEvent) {
            var sNewText = oEvent.getParameter("value");
            this.getView().getModel("viewEditableModel").setProperty("/newRemarkText", sNewText);
        },
        handleFullScreen: function () {
            this.bFocusFullScreenButton = true;
            var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
            this.oRouter.navTo("detail", { layout: sNextLayout, product: this._product });
        },
        handleExitFullScreen: function () {
            this.bFocusFullScreenButton = true;
            var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
            this.oRouter.navTo("detail", { layout: sNextLayout, product: this._product });
        },
        handleClose: function () {
            var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
            this.oRouter.navTo("list", { layout: sNextLayout });
        },
        onFieldGroupChange: function () {
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
                return;
            }

            // Going to Display mode: check for unsaved changes
            if (oModel.hasPendingChanges()) {
                // Ask confirmation
                sap.m.MessageBox.confirm(
                    "You have unsaved changes. Are you sure you want to discard them?",
                    {
                        title: "Discard Changes?",
                        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                        emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                        onClose: function (sAction) {
                            if (sAction === sap.m.MessageBox.Action.OK) {
                                oModel.resetChanges();                           // discard changes
                                oModel.checkUpdate(true);                        // refresh bindings
                                oViewModel.setProperty("/editMode", false);     // switch to display
                                oViewModel.setProperty("/showSave", false);     // hide save
                                sap.m.MessageToast.show("Changes discarded");
                            }
                        }
                    }
                );
            } else {
                // No changes, just switch off
                oViewModel.setProperty("/editMode", false);
            }
        },
        onSave: function () {
            debugger;
            var aChanges = this.oDataModel.getPendingChanges();
            this.oDataModel.submitChanges();
        },
        onCreatePartner: function(oEvent) {
            debugger;
            var oView = this.getView();
        
            if (!this._oPartnerDialog) {
                this._oPartnerDialog = new sap.m.Dialog({
                    title: "Create Partner",
                    content: [
                        new sap.m.Label({ text: "Name", labelFor: "partnerNameInput" }),
                        new sap.m.Input("partnerNameInput", {
                            width: "100%"
                        }),
        
                        new sap.m.Label({ text: "Partner Function", labelFor: "partnerFunctionSmartField" }),
                        new sap.ui.comp.smartfield.SmartField("partnerFunctionSmartField", {
                            value: {
                                entitySet: 'zcds_ps_partner',
                                path: "PartnerFunction",
                                type: "sap.ui.model.type.String"
                            },
                            width: "100%"
                        }),
        
                        new sap.m.Label({ text: "Email", labelFor: "partnerEmailInput" }),
                        new sap.m.Input("partnerEmailInput", {
                            type: "Email",
                            width: "100%",
                            placeholder: "example@example.com"
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Create",
                        type: "Emphasized",
                        press: function () {
                            var sName = sap.ui.getCore().byId("partnerNameInput").getValue();
                            var sPartnerFunction = sap.ui.getCore().byId("partnerFunctionSmartField").getValue();
                            var sEmail = sap.ui.getCore().byId("partnerEmailInput").getValue();
        
                            // Validate inputs here as needed
        
                            // Example: simple non-empty validation
                            if (!sName) {
                                sap.m.MessageToast.show("Please enter Name");
                                return;
                            }
        
                            if (!sPartnerFunction) {
                                sap.m.MessageToast.show("Please enter Partner Function");
                                return;
                            }
        
                            // Close dialog before creating (or after successful create)
                            this._oPartnerDialog.close();
        
                            // Implement your partner creation logic here, e.g., OData create
                            // Example:
                            /*
                            var oModel = oView.getModel();
                            oModel.create("/Partners", {
                                Name: sName,
                                PartnerFunction: sPartnerFunction,
                                Email: sEmail
                            }, {
                                success: function() {
                                    sap.m.MessageToast.show("Partner created successfully");
                                },
                                error: function() {
                                    sap.m.MessageToast.show("Failed to create partner");
                                }
                            });
                            */
                        }.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            this._oPartnerDialog.close();
                        }.bind(this)
                    }),
                    contentWidth: "400px"
                });
        
                oView.addDependent(this._oPartnerDialog);
            }
            
            this._oPartnerDialog.open();
        }        

    });
});