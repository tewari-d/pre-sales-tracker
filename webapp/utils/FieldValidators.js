sap.ui.define([], function () {
    "use strict";
  
    return {
      missingOpportunityFields: function (payload) {
        const required = [
          { field: "CustomerName", label: "Customer" },
          { field: "OpportunityType", label: "Opportunity Type" },
          { field: "SapSystemCategory", label: "SAP System Category" },
          { field: "ReceivedDate", label: "Received Date" },
        ];
        if (["WIN", "COMPLETE", "LOSS"].includes(payload.Status)) {
          required.push({ field: "CloseDate", label: "Win/Loss Date" });
        }
        return required.filter(({ field }) => {
          const value = payload[field];
          return value === null || value === undefined ||
            (typeof value === "string" && !value.trim()) ||
            (Object.prototype.toString.call(value) === "[object Date]" && !Number.isFinite(value.getTime()));
        });
      },
      opportunitySizeError: function (status, value, currency) {
        if (!["SUBMITTED", "WIN", "COMPLETE"].includes(status)) return "";
        if (value === null || value === undefined || String(value).trim() === "") {
          return "Opp. Size is required and must be greater than zero.";
        }
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return "Opp. Size is required and must be greater than zero.";
        if (!currency) return "Currency is required when Opp. Size is mandatory.";
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
