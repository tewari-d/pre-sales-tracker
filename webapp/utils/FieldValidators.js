sap.ui.define([], function () {
    "use strict";
  
    return {
      applyProbabilityValidation: function (oSmartField) {
        if (!oSmartField) return;
  
        oSmartField.attachInnerControlsCreated(() => {
          const oInput = oSmartField.getInnerControls()?.[0];
          if (oInput && oInput.isA("sap.m.Input")) {
            oInput.setType("Number");
            oInput.attachChange((oEvent) => {
              let val = Number(oEvent.getParameter("value"));
              if (isNaN(val)) {
                oInput.setValue("");
                oInput.setValueState("Error");
                oInput.setValueStateText("Please enter a valid number.");
              } else {
                if (val < 0) val = 0;
                if (val > 100) val = 100;
                oInput.setValue(val);
                oInput.setValueState("None");
              }
            });
          }
        });
      },
    };
  });