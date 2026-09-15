# PS4 client 110 dashboard test data

Created on 14 September 2026 through the existing tracker OData API in **development client 110**. No production requests or writes were made. Records are synthetic scenarios using recognizable company names and realistic invented person-name combinations; they do not describe actual customer engagements. Names were checked against the locally saved client 500 snapshot to avoid reusing its customer/owner names.

- 420 opportunities, IDs **10020–10439** (SAP keys retain leading zeros).
- Received dates: **1 January 2025–14 September 2026**, 20 per month. Current quarter: **60**.
- 60 company names, 24 owners, 30 BUs, 16 countries, seven geographies, 14 currencies.
- All eight statuses: WIP 106, Submitted 76, Win 65, Win and Completed 39, Loss 39, Hold 35, Closed 29, No-Go 31.
- Coded proposals: Full-fledged proposal 243, Capability 163, Unassigned 14. Both proposal fields remain populated independently.
- 510 linked partners and 420 remarks. Partner email addresses are blank.
- Deliberate edge cases: 15 unassigned owners, 10 unassigned BUs, 11 missing currencies, zero/sub-EUR values and exact EUR band boundaries. JPY values use SAP's whole-yen precision.
- 97 overdue submissions at the seed date. All six value bands are represented. Dashboard currency conversion still uses its normal rate provider.

Every opportunity description and remark includes `SYNTHETIC-110-20260914`. The former 110 opportunities were marked deleted through the tracker API only after the new records passed verification. Their linked data was not manually deleted.

## Verification

All 420 records were read back and matched for received date, status, BU, geography, country, coded proposal, currency, currency-adjusted amount and owner partner. Verified 510 partner links, 420 marked remarks, no future received dates and exactly 420 nondeleted opportunities. The live launchpad shows 60 of 420 in Q3 2026, with all statuses represented and working monthly charts.

Live navigation verification opened Steelcase opportunity **10403** in the tracker's fullscreen detail with the correct received date, status, proposal types and synthetic description. Launchpad Back returned to the dashboard's current-quarter view and retained its scroll position.

## Local artifacts and reproducibility

Ignored directory `.local-data/seed-110/` contains:

- `before-xNGRxCDS_PS_MASTER.json`, `before-xNGRxCDS_PS_PARTNER.json`, `before-xNGRxCDS_PS_REMARKS.json`: original backups.
- `plan.json`: exact requested payloads, including linked partners and remarks.
- `created.json`, `retired.jsonl`: ID journals.
- `after-master.json`, `verification.json`: read-back results and distributions.
- `metadata.xml`, `domains.json`, `bu.json`: schema and value-help reference used for generation.

`scripts/seed-dashboard-110.cjs` is restricted to the existing authenticated localhost:8080 PS4 proxy and explicitly sets client 110. It supports `plan`, `pilot`, `load`, `verify`, and `retire-old`. Loading skips matching synthetic descriptions; deletion is restricted to the original backup IDs and stops if their tracked identity/status/update fields changed. The generator's dates are deliberately fixed to this seed run. Run `node scripts/seed-dashboard-110.cjs verify` for a fresh API check; later manual edits will correctly produce verification differences.

The existing local **client 500 snapshot preview is unchanged**. Use the live client 110 launchpad to test this dataset.
