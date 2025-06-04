sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.nagarro.www.presalestracker.controller.Detail", {
        onInit() {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel();
            this.oRouter.getRoute("Detail").attachPatternMatched(this._onOppMatched, this);

            var oEditModel = new sap.ui.model.json.JSONModel({
                editMode: false,
                remarksText: "",
                showTable: false
            });
            this.getView().setModel(oEditModel, "viewEditableModel");
        },
        toggleAreaPriority(oEvent) {
            debugger;
        },
        _onOppMatched: function (oEvent) {
            this._id = oEvent.getParameter("arguments").id || this._id || "0";
            this.getView().bindElement({
                path: "/ZCDS_PS_MASTER('" + this._id + "')"
            });

            debugger;
            var oView = this.getView();
            var oModel = oView.getModel();
            var oContext = oView.getElementBinding(); 
            var sPath = oContext.getPath() + "/toRemarks";

            // Date and time formatter
    var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

            // Read remarks data
            oModel.read(sPath, {
                success: function (oData) {
                    var aLines = oData.results.map(function (oItem) {
                        return oItem.RmText;
                    });
                    var sCombinedText = aLines.join("\n");

                    // Update the TextArea via viewModel
                    oView.getModel("viewEditableModel").setProperty("/remarksText", sCombinedText);
                },
                error: function (err) {
                    console.error("Failed to load remarks", err);
                }
            });
        },
        onToggleRemarksView: function (oEvent) {
            var bShowTable = oEvent.getParameter("selected");
            this.getView().getModel("viewEditableModel").setProperty("/showTable", bShowTable);
        },
        onNewRemarkLiveChange: function (oEvent) {
            var sNewText = oEvent.getParameter("value");
            this.getView().getModel("viewEditableModel").setProperty("/newRemarkText", sNewText);
        },
		handleFullScreen: function () {
			this.bFocusFullScreenButton = true;
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/fullScreen");
			this.oRouter.navTo("detail", {layout: sNextLayout, product: this._product});
		},
		handleExitFullScreen: function () {
			this.bFocusFullScreenButton = true;
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/exitFullScreen");
			this.oRouter.navTo("detail", {layout: sNextLayout, product: this._product});
		},
		handleClose: function () {
			var sNextLayout = this.oModel.getProperty("/actionButtonsInfo/midColumn/closeColumn");
			this.oRouter.navTo("list", {layout: sNextLayout});
		}
        
    });
});