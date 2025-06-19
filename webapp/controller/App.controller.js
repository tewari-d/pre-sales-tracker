sap.ui.define(["sap/ui/core/mvc/Controller"], (BaseController) => {
  "use strict";

  return BaseController.extend(
    "com.nagarro.www.presalestracker.controller.App",
    {
      onInit() {
        this.oRouter = this.getOwnerComponent().getRouter();
        this.oRouter.attachRouteMatched(this.onRouteMatched, this);
        this.oRouter.attachBeforeRouteMatched(this.onBeforeRouteMatched, this);
      },
      onBeforeRouteMatched: function (oEvent) {
        var oModel = this.getOwnerComponent().getModel("comp");

        var sLayout = oEvent.getParameters().arguments.layout;

        // If there is no layout parameter, query for the default level 0 layout (normally OneColumn)
        if (!sLayout) {
          var oNextUIState = this.getOwnerComponent()
            .getHelper()
            .getNextUIState(0);
          sLayout = oNextUIState.layout;
        }

        // Update the layout of the FlexibleColumnLayout
        if (sLayout) {
          oModel.setProperty("/layout", sLayout);
        }
      },
      onRouteMatched: function (oEvent) {
        var sRouteName = oEvent.getParameter("name"),
          oArguments = oEvent.getParameter("arguments");

        this.currentOpportunity = oArguments.id;

        this._updateUIElements();

        this.currentRouteName = sRouteName;
      },
      _updateUIElements: function () {
        const oComponent = this.getOwnerComponent();
        const oModel = oComponent.getModel("comp");
        const oHelper = oComponent.getHelper();

        const oUIState = oHelper.getCurrentUIState();

        if (this.currentOpportunity) {
          oUIState.layout = sap.f.LayoutType.TwoColumnsMidExpanded;
        }

        oModel.setData(oUIState);
      },
      handleBackButtonPressed: function () {
        window.history.go(-1);
      },

      onExit: function () {
        this.oRouter.detachRouteMatched(this.onRouteMatched, this);
        this.oRouter.detachBeforeRouteMatched(this.onBeforeRouteMatched, this);
      },
      onFCLStateCHange(oEvent) {},
    }
  );
});
