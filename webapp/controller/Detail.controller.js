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
        _onOppMatched: function (oEvent) {
            this._id = oEvent.getParameter("arguments").id || this._id || "0";
            this.getView().bindElement({
                path: "/ZCDS_PS_MASTER('" + this._id + "')"
            });

            var oView = this.getView();
            var oModel = oView.getModel();
            this.oDataModel = oModel;
            this.oDataModel.setDefaultBindingMode('TwoWay');
            this.oDataModel.attachBatchRequestCompleted(this._onModelChange.bind(this));
        },
        _onModelChange: function () {
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
        onStateChange: function (oEvent) {
            var bNewState = oEvent.getParameter("state"); // true = Edit, false = Display
            var oViewModel = this.getView().getModel("viewEditableModel");
            var oModel = this.getView().getModel();

            // Going to Edit mode: always allow
            if (bNewState) {
                oViewModel.setProperty("/editMode", true);
                return;
            }

            // Going to Display mode: check for unsaved changes
            if (oModel.hasPendingChanges()) {
                // Reset the switch back to ON temporarily
                oViewModel.setProperty("/editMode", true);

                // Ask confirmation
                sap.m.MessageBox.confirm(
                    "You have unsaved changes. Are you sure you want to discard them?",
                    {
                        title: "Discard Changes?",
                        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                        emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                        onClose: function (sAction) {
                            if (sAction === sap.m.MessageBox.Action.OK) {
                                // Reset the model, discard changes
                                oModel.resetChanges();                           // discard all changes
                                oModel.checkUpdate(true);                        // ensure bindings are refreshed
                                oViewModel.setProperty("/editMode", false);      // switch to display mode
                                oViewModel.setProperty("/showSave", false);      // hide save button
                                MessageToast.show("Changes discarded");
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
        }

    });
});