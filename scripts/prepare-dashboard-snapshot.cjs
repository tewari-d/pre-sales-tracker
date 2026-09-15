// Converts authorized ARC-1 TABLE_QUERY extracts into local OData V2 fixtures.
// Raw extracts and generated data live only in the ignored .local-data directory.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../.local-data/ps4-500");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8").replace(/^\ufeff/, ""));
const schema = read("schema.json");
const countries = new Map(read("raw-countries.json").rows.filter(row => row.SPRAS === "E").map(row => [row.LAND1, row.LANDX50]));
const mappings = { master: "xNGRxCDS_PS_MASTER", partners: "xNGRxCDS_PS_PARTNER", remarks: "xNGRxCDS_PS_REMARKS" };
const output = path.join(root, "mockdata");
fs.mkdirSync(output, { recursive: true });
const totals = {};
for (const [source, entity] of Object.entries(mappings)) {
    const properties = schema.find(type => type.name === entity + "Type").properties;
    const rows = read("raw-" + source + ".json").rows.map(raw => {
        const row = {};
        for (const property of properties) {
            let value = raw[property.name.toUpperCase()];
            if (property.name === "Country_Text") { value = countries.get(raw.COUNTRY) || raw.COUNTRY; }
            if (value === undefined) { continue; }
            if (property.type === "Edm.DateTime") {
                if (!value || value === "00000000") { value = ""; }
                else {
                    if (!/^\d{8}$/.test(value)) { throw new Error("Unexpected SAP date format in " + property.name); }
                    const iso = value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8);
                    const stamp = Date.parse(iso + "T00:00:00Z");
                    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== iso) { throw new Error("Invalid SAP date"); }
                    value = "/Date(" + stamp + ")/";
                }
            } else if (property.type === "Edm.Boolean") { value = value === "X" || value === "true" || value === true; }
            else if (property.type === "Edm.Byte") { value = Number(value); }
            else if (property.type === "Edm.Time") {
                const time = String(value || "000000").padStart(6, "0");
                value = "PT" + time.slice(0, 2) + "H" + time.slice(2, 4) + "M" + time.slice(4, 6) + "S";
            }
            row[property.name] = value;
        }
        return row;
    });
    totals[source] = rows.length;
    fs.writeFileSync(path.join(output, entity + ".json"), JSON.stringify(rows, null, 2) + "\n");
    const dates = properties.filter(p => p.type === "Edm.DateTime").map(p => p.name);
    const hook = `// Local snapshot: preserve missing dates and reject edits.\nmodule.exports = {\n` +
        `  getInitialDataSet: () => require("./${entity}.json"),\n` +
        `  onAfterRead: data => {\n    (Array.isArray(data) ? data : [data]).forEach(row => {\n` +
        `      if (row && typeof row === "object") ${JSON.stringify(dates)}.forEach(key => { if (row[key] === "") row[key] = null; });\n` +
        `    });\n    return data;\n  },\n` +
        `  onBeforeUpdateEntry: () => { throw new Error("The client 500 preview is a read-only snapshot."); },\n` +
        `  removeEntry: () => { throw new Error("The client 500 preview is a read-only snapshot."); },\n` +
        `  onBeforeAddEntry: () => { throw new Error("The client 500 preview is a read-only snapshot."); }\n};\n`;
    fs.writeFileSync(path.join(output, entity + ".js"), hook);
}
fs.writeFileSync(path.join(root, "snapshot-info.json"), JSON.stringify({
    system: "PS4", client: "500", extractedAt: fs.statSync(path.join(root, "raw-master.json")).mtime.toISOString(), preparedAt: new Date().toISOString(),
    source: "ARC-1 ps4_500 TABLE_QUERY (CDS and DDIC table reads)", totals
}, null, 2) + "\n");
console.log(JSON.stringify({ generated: totals, englishCountryNames: countries.size, output }));
