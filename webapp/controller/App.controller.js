sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/f/library"
], (BaseController, library) => {
  "use strict";

  return BaseController.extend("com.ngr.www.presalestracker.ngrpresalestracker.controller.App", {
    onInit() {
      this.oRouter = this.getOwnerComponent().getRouter();
      this.oRouter.attachRouteMatched(this.onRouteMatched, this);
      this.oRouter.attachBeforeRouteMatched(this.onBeforeRouteMatched, this);
    },
    onBeforeRouteMatched: function (oEvent) {
      var oModel = this.getOwnerComponent().getModel("comp");

      var oArguments = oEvent.getParameters().arguments;
      // A list route has no selected opportunity. The helper is configured with
      // initialColumnsCount: 2, so its default would expose an empty detail pane.
      var sLayout = oArguments.id
        ? oArguments.layout || library.LayoutType.TwoColumnsMidExpanded
        : library.LayoutType.OneColumn;

      // Update the layout of the FlexibleColumnLayout
      if (sLayout) {
        oModel.setProperty("/layout", sLayout);
      }
    },
    onRouteMatched: function (oEvent) {
      var sRouteName = oEvent.getParameter("name"),
        oArguments = oEvent.getParameter("arguments");

      // On a direct link, the initial beforeRouteMatched can fire before this
      // view attaches its listeners. Apply the route layout once targets exist,
      // before the helper reads the FCL's default OneColumn state.
      this.onBeforeRouteMatched(oEvent);
      this._updateUIElements();

      // Save the current route name
      this.currentRouteName = sRouteName;
      this.currentActivity = oArguments.id;
    },
    _updateUIElements: function () {
      var oModel = this.getOwnerComponent().getModel("comp");
      var oUIState = this.getOwnerComponent().getHelper().getCurrentUIState();
      oModel.setData(oUIState);
    },
    handleBackButtonPressed: function () {
      window.history.go(-1);
    },

    onExit: function () {
      this.oRouter.detachRouteMatched(this.onRouteMatched, this);
      this.oRouter.detachBeforeRouteMatched(this.onBeforeRouteMatched, this);
    },
    onFCLStateCHange(oEvent) { },
  });
});
