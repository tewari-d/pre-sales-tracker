# Presales dashboard

The dashboard is a separate SAPUI5/Fiori component (`com.ngr.presales.dashboard`) in `webapp/dashboard`. It reads the existing OData V2 service in PS4 client 110. Tracker changes are limited to the **Presales Dashboard** button, its navigation handler, shell library dependency, and a direct-link layout fix: the route layout is applied after targets load so a newly opened tracker displays the selected detail. SAP changes comprise the UI5 bundle deployment and launchpad mapping documented below; business data and the OData service were not modified.

## Run

```sh
npm run start-dashboard       # Existing PS4 connection and SAP authorization
npm run start-dashboard-mock  # 48 fictional opportunities, isolated from existing mock data
npm run start-dashboard-500   # Actual PS4 client 500 table snapshot, local port 8085
npm run test-dashboard        # Calculation, paging, conversion, hover and navigation tests
npm run build                # Builds tracker and independent dashboard into dist/
```

In the SAP launchpad, the tracker button navigates to `#Presales-analyze` in the same shell. Selecting an opportunity uses `#ZPS_TRACKER-manage&/Detail/{Id}/MidColumnFullScreen` in that shell. The standalone preview entry remains `/dashboard/index.html`; outside the launchpad, the button and detail rows retain their separate-tab behavior and preserve the tracker return URL and SAP client/language/theme parameters.

Local development without generated preloads can use `?sap-ui-xx-componentPreload=off`. In Windows sandboxes that restrict Node test subprocesses, run `node --test --test-isolation=none webapp/test/dashboard/analytics.test.cjs` instead.

## Explore and present

- Received-date filter defaults to the current calendar quarter on first visit and Reset. Quarter choices stop at the current quarter; all dates and inclusive custom ranges remain available.
- Opening an opportunity remembers filters, search, chart settings, filter-header state and exact page scroll in module memory. Returning inside the same launchpad document consumes that saved state. Initial loads and whole-page reloads always use the current quarter, expanded filters and scroll position zero; browser storage is not used.
- Multi-select business unit, country/region, geography, status, owner, EUR size band and proposal type. Proposal type defaults to Full-fledged proposal plus Unassigned (Unassigned drops out automatically once no opportunity lacks a proposal type). Every dropdown has a searchable value list and a Select All checkbox; toggling it off clears selections (an empty selection means no restriction). Selections within one field are OR conditions; different fields are combined with AND.
- Four visible KPI cards: opportunity count/total value, active pipeline, won value and count-based win rate (average size and overdue submissions remain computed but their cards are commented out). EUR amounts are written with a space after the symbol (`€ 5.8M`).
- Intake trend by quarter/month; status mix; portfolio distribution by BU/geography/country; size distribution; a full-width owner-distribution chart whose axis label shows each owner's total count, EUR value and win rate, with bars split by coded proposal type (including unassigned).
- All five charts switch between opportunity count and EUR value. Click a segment to filter the entire dashboard. Hover shows count, EUR value, active pipeline, won value, win rate, overdue submissions, share of the filtered view and unavailable EUR values for that segment.
- Detail table with customer/description search, sorting, original currency/value, converted EUR value and navigation to the tracker detail page.
- CSV export includes **all filtered rows**, irrespective of table paging, plus active filters, refresh time, exchange-rate date and any data-quality caveats. Spreadsheet formulas in user-entered text are escaped.
- Print summary includes the current filter context and charts. The detail table is excluded from printing; use CSV for full details.

## Definitions

| Measure | Definition |
|---|---|
| Active pipeline | Sum of EUR sizes for `WIP`, `SUBMITTED`, `HOLD` |
| Won value | Sum of EUR sizes for `WIN`, `COMPLETE` |
| Win rate | Count of `WIN` + `COMPLETE`, divided by the count of **all** non-deleted opportunities in scope, whatever their status; an empty scope displays 0% (changed in 1.0.12, previously divided by won + `LOSS` only) |
| Average size | Sum of converted EUR values divided by the number of records with a usable EUR value |
| Overdue submissions | `WIP`, no submission date, due-submission date before today |
| Owner | Existing service `Owner`, derived by the CDS view from partner function `OWN` |
| Country/region | Existing `Country` and `Country_Text` fields; not a new geographic taxonomy |

Deleted flags and `DELE` status are excluded throughout. Undated opportunities remain in all-dates totals but cannot appear in date-restricted results or date trends. All reporting periods refer to **Received Date**, including won/lost summaries; these are received-date cohorts, not bookings by closing date.

Size bands (since 1.0.12) are `[€1, €50K)`, `[€50K, €100K)`, `[€100K, €500K)`, `[€500K, €1M)` and `€1M+`. The size chart always draws all six bands, including empty ones. Lower bounds are included and upper bounds excluded, so boundaries never overlap. Below €1 and unavailable EUR values share the first category for counts; unavailable values stay excluded from monetary totals.

## EUR conversion

`OppTcv` is stored in `Currency`; the existing service does not provide a converted EUR field. The dashboard uses the same indicative provider as the existing pipeline report: `https://open.er-api.com/v6/latest/EUR`. Rates are currency units per EUR, so **EUR value = original value / rate**. Native EUR amounts use rate 1.

The conversion is used consistently in cards, charts, size bands, hover details, the table and exports. The rate date and provider attribution are displayed. The original amount/currency remains visible in the table. These are current indicative rates, including when filtering older opportunities; they are not historical SAP accounting conversions.

If the rate service fails, native EUR remains usable. Foreign values without a valid rate are explicitly unavailable and excluded from EUR measures; opportunity counts still include those records. Blank currencies and invalid amounts are never assumed to be EUR. Rates older than 72 hours produce a warning. No opportunity data is sent to the rate provider.

## Packaging and SAP launchpad

### Client 500 snapshot preview

The requested actual-data preview uses an authorized ARC-1 table/CDS extraction from **PS4 client 500**. It contains 358 opportunity headers, 884 partners and 2,271 remarks; the dashboard excludes three deleted opportunities. Country descriptions are resolved from English `T005T` entries. SAP dates are converted to UTC OData date literals and initial dates remain null.

Raw extracts and generated fixtures are in `.local-data/ps4-500/`, which is excluded from Git and sits outside the application build resources. `snapshot-info.json` records the extraction timestamp. Run `node scripts/prepare-dashboard-snapshot.cjs` to regenerate fixtures from the saved extracts, then `npm run start-dashboard-500`. A fresh SAP extraction is required to update the underlying records; **Refresh reloads the saved snapshot**. The preview is clearly labeled, and the source label is included in CSV exports.

This preview has no live SAP backend configured. Detail navigation opens the existing tracker using the same local snapshot, including partners and remarks. Snapshot writes are rejected. It therefore works without OData API access to client 500. Currency conversion still uses the displayed dated exchange-rate provider; missing or invalid source currencies remain flagged.

### Build output

`ui5-dashboard.yaml` builds the dashboard under its own module namespace. The main build adds its output, including its own `Component-preload.js`, to `dist/dashboard`. Existing tracker build output remains at `dist/`. Dashboard fixtures and tests are excluded from production output.

The navigation button works with the dashboard packaged below the tracker BSP. The dashboard standalone bootstrap uses the local resources proxy during development and `/sap/public/bc/ui5_ui5/resources/sap-ui-core.js` on ABAP.

PS4 client 110 has a SAPUI5 Fiori App target mapping in the existing `ZNAG_SAP_PRC` catalog: semantic object `Presales`, action `analyze`, title `Presales Dashboard`, component ID `com.ngr.presales.dashboard`, URL `/sap/bc/ui5_ui5/ngr/bsp_ps_tracker/dashboard`. Desktop, tablet and phone are enabled; additional parameters are allowed. Mapping instance ID: `1ZHH6UF6T47TEWFR3CVNTA9QJ`. It uses the same catalog as the existing `ZPS_TRACKER-manage` target. No additional tile or role assignment was created.

The navigation changes were deployed to `/NGR/BSP_PS_TRACKER` in PS4 client 110 on 2026-09-10 using Workbench request `PS4K902012`. The launchpad mapping is recorded in new Customizing request `PS4K902016`, task `PS4K902017` (system-default target `PS4.100`). The requests remain modifiable; no release or import was performed. Other clients require the mapping to be transported or configured there as well.

## Validation

- 28 Node tests cover exact EUR band boundaries, foreign conversion, unavailable amounts, dates, combined filters, status definitions, hover metrics, owner distribution, CSV escaping, paging, partial-read failures and standalone/launchpad detail links.
- `webapp/test/dashboard/browser-smoke.js` is a Playwright-tool script. Run the mock server on port 8083, then pass the script to the browser tool's `filename` argument. It checks all filters, chart/owner drilldown, all chart hover KPIs, full CSV download, empty states, FX/service failures, recovery and mobile width.
- Live read verified against PS4 client 110: all 110 non-deleted opportunities loaded, all eight currencies converted using the dated provider rates.
- Deployed shell flow verified in Chrome: initial tracker list → Presales Dashboard (110 opportunities) → Deloitte, opportunity `0000000034`, with the SAP shell visible throughout.
- `webapp/test/dashboard/navigation-smoke.js` verifies two PS4 500 snapshot rows open the correct visible tracker detail, including fresh loads, reloads and phone viewports; a tracker URL without a detail route still opens the list. Run using the Playwright browser tool's filename option with `start-dashboard-500` running. The existing tracker button was also checked.
- New dashboard UI5 lint passes; production build passes. Existing tracker locale warnings are outside this change.

The current implementation loads the complete authorized collection before calculating totals. It follows OData paging, requests a stable ID sort/count and rejects partial or inconsistent results. This fits the current data volume; if the collection grows substantially, move aggregation/filtering into a dedicated backend analytical service rather than adding arbitrary frontend truncation.

## Proposal-field verification ? 2026-09-14

PS4 client **110 is development**; client **500 is production**. Read-only ADT table preview of `/NGR/T_MASTER`, across clients, returned:

| Client | Total table rows | `PROPOSAL_TYPE` populated | `PROPOSAL_TYPE_OP` populated |
|---|---:|---:|---:|
| 110 (development) | 110 | 0 | 3 |
| 500 (production) | 359 | 110 | 2 |

These counts cover the table, including records outside the dashboard's active opportunity collection. One production row has both fields filled. Neither column is unused. The user confirmed **keep both fields for now**. No table, CDS, tracker field or production data was changed. Dashboard filters are labelled **Proposal type (free text)** and **Proposal type (coded)**; coded values display `ProposalTypeOpText`. Both are included in CSV exports. Value lists come from all authorized loaded opportunities, independently of current dashboard filters.

Raw audit responses are retained only in ignored `.local-data/proposal-field-audit.xml` and `.local-data/proposal-populated-coded.xml`. The client 500 API proxy had no saved credentials; the verified production counts came from authorized cross-client table reads through development ADT, not from that API or the September 10 snapshot.

For a local shell navigation check while `npm start` is running, open `/test/dashboard/flp.html?sap-client=110#Presales-analyze`. This test-only sandbox defines both dashboard and tracker intents and is excluded from deployment. The September 14 changes pass 35 Node regression tests and `npm run build`; earlier validation notes above describe the September 10 baseline.

Browser verification on September 14: current quarter defaults to Q3 2026; the period menu ends at Q3 2026; BU Select All toggles 0/6 to 6/6 and back; BET-C survives reload; coded proposal value help shows the description; the local launchpad dashboard ? Adobe detail ? tracker Dashboard button journey retains All received dates, Full-fledged proposal and the EUR measure, with 3 matching opportunities. The September 14 bundles were subsequently deployed successfully, as recorded below.

## Deployment ? 2026-09-14

At the user's request, `npm run deploy -- --yes` rebuilt and successfully uploaded the tracker and dashboard to `/NGR/BSP_PS_TRACKER` via PS4 client 110, using transport `PS4K902012`. SAP confirmed upload, registration and application-index update. Post-deployment HTTP reads verified the new ViewState module, controller integration, all eight select-all controls and both proposal filters in the served repository. No transport release/import or table changes were performed.

## Launchpad cache registration correction ? 2026-09-14

The initial deployment updated repository files, but the root descriptor did not declare its nested dashboard descriptor. `/sap/bc/ui2/app_index/ui5_app_info?id=com.ngr.presales.dashboard` returned `error: true` with empty component/descriptor URLs. The live launchpad reused an old component cache token and showed the earlier dashboard; direct HTTP reads alone did not reveal the user's cached runtime.

Corrected `sap.app.embeds: ["dashboard"]` in the tracker manifest and `sap.app.embeddedBy: "../"` in the dashboard manifest, and advanced the dashboard version to 1.0.1. Redeployed using PS4K902012. SAP now registers both descriptors and the dashboard app-index response returns `error: false` and valid component/descriptor URLs. A normal reload of the affected SAP launchpad tab displays Q3 2026 and both proposal-type filters. No browser cache deletion or special preview parameters were needed.

SAP emitted a non-blocking naming-convention warning because the independent dashboard ID is not a child of the tracker namespace. Its existing ID and launchpad mapping were retained; successful app-index resolution and live rendering were verified. Future deployment verification must check the app-index result and normal launchpad rendering, in addition to repository files.

Reference: [SAP descriptor documentation ? embeds and embeddedBy](https://ui5.sap.com/1.38.65/docs/guide/be0cf40f61184b358b5faedaec98b2da.html).

Live PS4 client 110 verification after the registration correction: the affected user tab reloads normally into Q3 2026; future quarter options are absent; BU Select All toggles 0/6 ? 6/6 ? 0/6; selecting BET-C gives two opportunities; Deloitte opens at ID 34; launchpad Back restores All received dates and BET-C with the same two rows. Reset returns to Q3 2026. The current tracker source has its Dashboard button commented out, so this deployed round trip used launchpad Back and preserved that user edit.

## Owner chart: whole-stack and series selection (1.0.10)

Until 1.0.9 the Owner chart used sap.viz selectability mode `SINGLE`, which silently ignores clicks on category-axis labels and legend entries, and the select handler always applied both the Owner and the Proposal Type filter from the first selected cell. Once a segment had been chosen there was no chart interaction that returned to the owner's full stack; the proposal filter had to be cleared in the filter bar.

The Owner chart now uses selectability mode `EXCLUSIVE` (the other charts stay `SINGLE`). A click on a segment still filters owner and proposal type. A click on an **owner name** (category-axis label) filters the owner only and clears the proposal filter, so the whole stack comes back; a click on a **legend entry** filters that proposal type across all owners and clears the owner filter. The toast names the applied scope (`Jamie Chen`, `Jamie Chen · Capability`, `Capability`). The chart subtitle explains the three gestures.

Implementation: sap.viz's `selectData` payload lists the selected cells (an axis-label click yields every series of the owner including zero cells, a legend click every owner of the series) but not what was clicked, so `_trackOwnerClickOrigin` records the origin from a capture-phase `pointerdown` on the chart DOM before sap.viz's own handlers run, and `_ownerSelectionScope` maps origin + cells to the owner/proposal filter arrays. Hover, palette and point-ID mapping are unchanged; `model/` modules are untouched and the 43 Node tests still pass.

Verified on the mock server with Playwright (single-series fixtures and injected FULL/CAP/unassigned rows): segment → owner+proposal; owner name on a chart already narrowed to one segment → owner only with all series restored; legend → proposal only; hover cards on all six charts; other chart drilldowns unaffected. Not yet deployed.

Also in 1.0.10:

- **Owner chart palette.** Segments now use the theme-independent SAP chart parameters instead of the Horizon-only `sapChart_OrderedColor_*` tokens: Full-fledged → `sapUiChartPaletteQualitativeHue1`, Capability → `sapUiChartPaletteQualitativeHue2`, further codes → Hue3 onwards, and Unassigned → `sapUiChartPaletteSemanticNeutral` (per SAP Fiori palette guidance a "not assigned" bucket is not a category and takes the neutral grey rather than a qualitative hue). Resolved values: Horizon light `#168eff / #c87b00 / #758ca4`, Horizon dark `#3278be / #f2a634 / #6f89a1`; both renderings checked. The other charts keep their fixed palette.
- **Period list shows five rows.** The received-date period MultiComboBox popover is capped at five entries and scrolls the rest. `sap.m.Popover` writes an inline `max-height` on `-popup-cont`, so the CSS cap in `dashboard.css` needs `!important` (10.4375rem compact, 12.625rem cozy = 5 × row height + container chrome). Verified exactly five fully visible rows and a scrollable container in both densities.

Note: version 1.0.9 (period multi-select of quarters, ascending EUR size bands, single chart scrollbar) was left in the working tree by the previous session with its verification unfinished and undeployed; those changes are included in this build.

## Owner/proposal stacks and Fiori palette (1.0.8)

Owner distribution is a stacked horizontal bar chart with total labels and coded proposal segments. Zero cells keep series ordering consistent; unknown owners/proposal types remain explicit. It supports count and EUR measures and sorts owners by the selected total. Selecting a segment applies both Owner and Proposal Type filters. Hover identifies the exact segment, retains its KPIs, and adds the owner's total count/EUR value within the filtered view. Value labels allow pointer events through to their underlying segments.

The Owner chart uses `sapChart_OrderedColor_1`, `_2`, and `_3` for FULL, CAP, and unassigned respectively, following SAP's [qualitative chart palette guidance](https://experience.sap.com/fiori-design-web/color-palettes/) and [token definitions](https://experience.sap.com/fiori-design-web/values-and-names/). It uses theme parameters instead of fixed hex values, retains the same token for a proposal type after filtering, and reapplies the palette when the Fiori theme changes. Light and dark Horizon renderings were checked.

40 regression tests pass, covering count/EUR reconciliation, missing values, zero cells, segment filtering and stacked point-ID mapping. Browser checks on client 110 data confirmed Maya Chen's 6 = 4 Capability + 2 Full-fledged proposals, combined filtering to those four Capability rows, and EUR-mode hover/filtering for Nisha Kulkarni's unassigned proposal. The custom hover resolves SAP Viz's series-major, reversed color-series point IDs for this one-measure stacked chart; other charts retain their existing row mapping.

Deployed to PS4 client 110 using PS4K902012. Verified the actual launchpad's stacked chart, Horizon token colors, Maya Chen's Capability hover (4 opportunities within an owner total of 6), and combined owner/proposal drilldown. The Capability series retains the same color when it becomes the sole series.

## Standard table toolbar (1.0.7)

Moved the opportunity controls into the responsive table's native `headerToolbar` aggregation, removed custom toolbar padding and the intervening hint row, and combined the title and count into one accessible table heading. The native compact header measures 44px and spans exactly the table width, matching the supplied SAP reference. Search and sorting remain right-aligned in the OverflowToolbar. Snapshot verification also confirmed the KPI jump still leaves a 12px gap above the table.

## Tooltip height and app title (1.0.6)

The standalone stylesheet applied `height: 100%` to `body > div`, stretching the body-level tooltip to viewport height. Height is now scoped to the dashboard component wrapper and container, with an explicit content-sized tooltip. Snapshot verification measured 172px instead of 945px, retaining all eight metrics and normal page scrolling.

The user's `SAP Presales Dashboard` title is present in the standalone HTML, resource-bundle app title and heading; the manifest title and inbound resolve that bundle key. Updated the local FLP preview title and the commented tracker navigation label as well. Deployed to PS4 client 110 on PS4K902012. The real launchpad shell and browser tab both display the new title without changing the existing target mapping.

## Full-width dashboard (1.0.5)

Removed the 1600px content cap. KPI cards, chart grids and the opportunity table use the full available DynamicPage content width, retaining its standard responsive page margins. Snapshot browser verification at a 1920px viewport shows all three sections aligned at 1809px wide with no horizontal page overflow.

## Dashboard filter refinement (1.0.4)

The filter bar has a plain Clear action below the fields on the right, retaining the existing behavior of clearing selections and restoring the current quarter. The duplicate report-context line below the scope/timestamp toolbar is removed; export context remains available. Initial loads now use monthly intake bars, while a selected quarterly view is preserved on opportunity return. All 38 regression tests pass. Verified with the client 500 snapshot (Q3: July 15, August 17, September 10; 42 opportunities) and deployed to PS4 client 110 using PS4K902012. The served manifest reports 1.0.4.

## Dashboard layout refinement (1.0.3)

Owner and coded proposal charts share the responsive two-column grid used above. Hover cards have tighter spacing and shorter labels while retaining all eight metrics and exact monetary values. Header expand/collapse uses the native DynamicPage chevron. Opportunity IDs lose leading zeros for display only; navigation retains the original key. The KPI jump accounts for the fixed title/filter header and leaves a 12px gap before the table toolbar, with filters expanded or collapsed.

Deployed to PS4 client 110 using PS4K902012. All 38 regression tests pass. The served manifest reports 1.0.3. Actual launchpad checks confirmed matching chart top coordinates in separate columns, unpadded IDs, native header controls, and a 12.28px table gap in both header states. The compact hover retains eight metrics in a 288px-wide card.

## Dashboard interaction update (1.0.2)

- Quarter dropdown shows five compact rows and scrolls; filters use 11rem widths, with a 16rem date range.
- Native Fiori header expansion/collapse is enabled, alongside Show/Hide filters.
- The Opportunities KPI is mouse- and keyboard-operable and scrolls to the table.
- A coded proposal-type distribution chart follows Owner distribution and supports hover KPIs and chart filtering.
- Unavailable EUR values are grouped under Below EUR 1 for filtering/chart counts, while remaining null and excluded from monetary totals and averages. Win rate with no closed outcomes is 0%.
- Chart hover cards replace VizTooltip's built-in five-second dismissal. Cards stay visible until leaving the point, focusing another point, scrolling or pressing Escape. They use the single-measure chart's bound row index and textContent for safe text rendering.
- Opportunity navigation uses the existing MidColumnFullScreen tracker layout. No tracker logic changes were necessary.

Verification: 38 calculation/state/navigation tests pass. Local Fiori browser checks confirmed a 160px quarter list with 32px rows and scrolling, header toggling, KPI-to-table scrolling, hover visibility beyond ten seconds and dismissal on pointer exit. A direct pointer click opened Deloitte ID 34 fullscreen; launchpad Back restored exactly 1869.333374px with the same filters and collapsed header. A whole-page reload returned to Q3 2026, expanded header and scroll zero. User edits to labels, hidden actions/KPIs and the non-growing opportunity table were preserved.

Deployment of 1.0.2: `npm run deploy -- --yes` succeeded on PS4 client 110 using PS4K902012. The application index remains valid and the served manifest reports 1.0.2. Verified directly in the actual SAP launchpad: coded proposal chart (107 unassigned, 3 FULL), persistent hover KPIs, chart drilldown to FULL with three opportunities, KPI jump to table, Adobe ID 1 in fullscreen, and launchpad Back retaining the filter and exact scroll position 1693.333374px (zero difference). Whole-page reload resets to current quarter Q3 2026, clears the proposal selection and returns to scroll zero.

## Free-text proposal type retired (1.0.11) — 2026-09-15

The team now uses only the coded **Proposal type** (`ProposalTypeOp`, domain `/NGR/DO_PS_PROPOSAL_TYPE_OP`). The free-text `ProposalType` field is no longer exposed anywhere; the table column `/NGR/T_MASTER-PROPOSAL_TYPE` and its data are untouched (client 110: 530 rows, 420 populated, unchanged before and after).

Backend, **client 110 only**, transport `PS4K902026` (workbench request created for this change; the BSP request `PS4K902012` is unchanged):

| Object | Change |
|---|---|
| DDLS `/NGR/CDS_PS_MASTER` | Removed `PreSalesMaster.proposal_type as ProposalType`. The OData service `OD_PS_TRACKER_SRV` is a SADL reference-data-source exposure (`DEFINE_RDS_4` / `GET_MODEL_EXPOSURE`) with no per-field list and the MPC entity structure `include type /NGR/CDS_PS_MASTER`, so the `ProposalType` property leaves `$metadata` without a SEGW regeneration. |
| CLAS `/NGR/CL_OD_PS_TRACKER_DPC_EXT` | Removed the `proposal_type = proposaltype` mapping in `create_deep_entity` and the `ls_db_after-proposal_type = ls_payload-proposaltype` assignment in `xngrxcds_ps_mast_update_entity`. Because `ls_db_after = ls_db_before`, edits to existing opportunities keep their stored free-text value. |
| DDLS `/NGR/I_MASTER_CUBE`, `/NGR/C_MASTER_ALP`, DDLX `/NGR/C_MASTER_ALP` | Removed `ProposalType` from the analytics cube, its ALP projection and the ALP line item annotation (package `/NGR/PRE_SALES_DEMO`). `/NGR/C_MASTER_CUBE` never exposed it. `/NGR/MEXT_PS_MASTER` had no annotation for it. |

All objects activated; a post-change scan of `DDDDLSRC` finds no `/NGR/` CDS source referencing `proposal_type` / `ProposalType`. The "Cardinality 1 of Association … does not match" messages on activation are pre-existing warnings. Nothing was read from or written to client 500.

Frontend (not yet deployed):
- Tracker: removed the `{ProposalType}` SmartField from `Detail.view.xml` and `CreateOpportunity.fragment.xml`; the coded field's SmartFields are unchanged. Pipeline/Work reports already used only `ProposalTypeOp`.
- Dashboard: dropped `ProposalType` from the `DataService` `$select`, removed the `proposal` dimension from `Analytics.DIMENSIONS` (so `ViewState` no longer accepts it as a filter or breakdown), removed the already-commented free-text filter from the view and its i18n key, and the CSV export now has a single **Proposal type** column (coded text). Dashboard version 1.0.11.
- Local mock `metadata.xml` no longer declares `ProposalType`. 43 Node tests pass; `npm run build` succeeds.

Deployment note: deploy the frontend (`npm run deploy`) before or together with the next launchpad use — the served 1.0.10 bundle still requests `ProposalType` in its `$select`, which the live 110 service now rejects.

## Win-rate formula, owner totals, chart layout and Opportunity Type (1.0.12) — 2026-09-15

Dashboard:
- **Win rate** is now `(WIN + COMPLETE) / all opportunities` in the filtered view, irrespective of status (deleted rows are excluded before this, as everywhere). Previously the denominator was won + `LOSS`. Applies to the KPI card, every chart hover card and the per-owner figure. Node tests updated (25% for the eight-status fixture; 45 tests pass).
- The **Opportunities by proposal type** chart is removed (view, controller, i18n). The `proposalCode` filter and dimension stay, and the owner chart still splits by coded proposal type.
- The **Owner distribution** card is full width (`chartGridFull`) and split: the stacked bar chart on the left (owner names on the axis, sap.viz's own segment and total labels) and a stats table on the right (`/charts/ownerTable`: Opps · Value (EUR) · Win rate — the owner name is only on the chart axis; one row per owner in the chart's order, built by `_ownerTable`). A table row press filters to that owner. Chart and table behave as one object: chart and table sit in one 24rem `ScrollContainer` (`ownerScroll`), so the card keeps its height and both scroll together; the chart height grows with the owner count (`max(22rem, owners × 2.75rem + 6rem)`) so sap.viz never scrolls on its own, and after every chart render / table render `_alignOwnerTable` measures the bar centres (`.v-datapoint` rects), sets the row height to the bar pitch (`--ownerPitch`) and offsets either the chart host or the table so each row sits exactly on its bar (verified ≤1px difference over 17 owners while scrolled, at 1440/1700px, after resize and with one owner; the pitch is kept sub-pixel so long lists do not drift). Hovering a bar highlights its row (`ownerRowActive`). Under 1100px the table wraps below the chart and the alignment offsets are cleared. Only bars and rows scroll: the sap.viz legend is hidden and replaced by a sticky HTML legend strip (`/charts/ownerSeries`, colours from `_ownerPalette`; a legend entry press filters that proposal type), the table uses `sticky="ColumnHeaders"`, and `_stickOwnerAxis` clones the chart's value axis and title (`.v-m-valueAxis`, `.v-m-valueAxisTitle`, positioned with `getCTM()`, computed styles inlined) into a sticky bottom strip whose negative top margin makes it coincide with the real axis at the end of the scroll. Two approaches were tried and dropped first: stats in the category-axis label (unreadable), then rewriting sap.viz's stack-total labels in the DOM (sap.viz calls `plotArea.dataLabel.renderer` for totals but ignores its result; labels clip at the plot edge and needed `plotArea.primaryScale.maxValue` headroom). The hover card's owner-total line still shows count · EUR · win rate.
- The `FUNNEL` proposal type (new domain value, below) is ordered `FULL`, `CAP`, `FUNNEL`, unassigned in the owner stacks and takes `sapUiChartPaletteQualitativeHue3`.
- **Status mix** donut: legend moved to the right and `general.layout.padding` reduced to 8, which enlarges the pie inside the unchanged 19rem card (measured 190px vs 145px diameter on the mock at 1440px width).
- `formatEur` and hover amounts write `€ ` with a space (`€ 5.8M`, `€ 3,735,000.00`).
- **Size bands** re-cut to Below €1 · €1–50K · €50–100K · €100–500K · €500K–1M · €1M+ (was 25K/50K/75K/1M steps). Filter keys `below/small/medium/large/major/strategic` are reused. `group()` seeds every band with zero so the size chart never omits an empty band.
- **Default proposal filter**: first visit and Clear select `FULL` (Full-fledged proposal) plus `__UNASSIGNED__` (`ViewState.defaults`). After loading, `ViewState.prune` removes any filter key that no loaded opportunity carries, so once every opportunity has a proposal type the default silently becomes Full-fledged only — no error, no stray token. A remembered state with an explicitly cleared proposal filter stays cleared.
- Status donut and intake trend charts are 24rem tall (was 19rem) and the donut's outer padding is 0, so the pie is markedly larger; the size-band chart stays 19rem.
- Version 1.0.12. Verified on the mock server with Playwright: KPI texts, removed chart, axis labels in count and EUR mode, segment click (owner + proposal), owner-name click (owner only), hover card. `npm run build` succeeds. Not yet deployed.

Tracker and backend (**client 110 only**, transport `PS4K902026`, the request that already locks the CDS view and DPC_EXT):

| Object | Change |
|---|---|
| DOMA `/NGR/DO_PS_OPPORTUNITY_TYPE` (new) | CHAR 5, fixed values `RFP` = RFP / Full Proposal, `RFI` = RFI, `CAP` = Capability / Rate Enquiry |
| DTEL `/NGR/DE_PS_OPPORTUNITY_TYPE` (new) | Label "Opportunity Type", change-document flag set like the other master fields |
| TABL `/NGR/T_MASTER` | Column `opportunity_type` appended at the end (no conversion; 530 rows unchanged, all blank) |
| DDLS `/NGR/CDS_PS_MASTER` | New association `_OpportunityTypeText`, fields `OpportunityType` (`@ObjectModel.mandatory: true`, text association, `#TEXT_ONLY`) and `OpportunityTypeText`; `Country` now `@ObjectModel.mandatory: true`. The existing `OppType` remains "Opportunity Source" — the two are different fields. |
| DDLX `/NGR/MEXT_PS_MASTER` | Domain value help for `OpportunityType` |
| DOMA `/NGR/DO_PS_PROPOSAL_TYPE_OP` | Added fixed value `FUNNEL` = Funnel (FULL/CAP unchanged) |
| CLAS `/NGR/CL_OD_PS_TRACKER_DPC_EXT` | `opportunity_type = opportunitytype` mapping in `create_deep_entity`; `ls_db_after-opportunity_type = ls_payload-opportunitytype` in `xngrxcds_ps_mast_update_entity` |

All objects activated; the CDS view reads back the new columns. Because the service is a SADL reference-data-source exposure, `$metadata` gains `OpportunityType`/`OpportunityTypeText` with `Common.FieldControl Mandatory` and the value list without SEGW regeneration; run `/IWFND/CACHE_CLEANUP` and `/IWBEP/CACHE_CLEANUP` on 110 if the launchpad still serves the old metadata. Existing opportunities have a blank Opportunity Type, so the first edit of each record must set it before Save.

Tracker frontend (not yet deployed): `OpportunityType` SmartField after Status in `CreateOpportunity.fragment.xml` (`idCreateOpportunityType`) and `Detail.view.xml` (`idEditOpportunityType`); create validation (`_validatePayload`) adds Country / Region and Opportunity Type (and relabels `OppType` as Opportunity Source); Detail `onSave` blocks on missing Opportunity Type or Country with focus on the field. Local mock `metadata.xml` and `NGR_OD_PS_TRACKER_ANNO_MDL.xml` declare the new properties, value list, mandatory annotations (including Country) and text arrangement.
