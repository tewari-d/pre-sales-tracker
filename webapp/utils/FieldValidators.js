sap.ui.define([], function () {
    "use strict";
  
    return {
      opportunitySizeError: function (status, value, currency) {
        const required = ["SUBMITTED", "WIN", "COMPLETE"].includes(status);
        if (value === null || value === undefined || String(value).trim() === "") {
          return required ? "Opp. Size is required and must be greater than zero." : "";
        }
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return "Opp. Size is required and must be greater than zero.";
        if (!currency && required) return "Currency is required when Opp. Size is mandatory.";
        if (["USD", "EUR"].includes(String(currency).trim().toUpperCase()) && amount <= 1) {
          return "Opp. Size must be greater than 1 USD or 1 EUR.";
        }
        return "";
      },
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
