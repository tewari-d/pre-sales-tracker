// Keep missing dates as OData nulls after the mock server's V2 date preprocessing.
module.exports = {
    getInitialDataSet: function () {
        return require("./xNGRxCDS_PS_MASTER.json");
    },
    onAfterRead: function (data) {
        const rows = Array.isArray(data) ? data : [data];
        rows.forEach(function (row) {
            if (!row || typeof row !== "object") { return; }
            ["ReceivedDate", "DueSubmissionDate", "SubmissionDate"].forEach(function (field) {
                if (row[field] === "") { row[field] = null; }
            });
        });
        return data;
    }
};
