# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SAPUI5 freestyle application deployed to an ABAP on-premise system (PS4). One repository contains **two independent UI5 components** that ship as a single BSP:

| Component | ID | Root | Purpose |
|---|---|---|---|
| Tracker | `com.ngr.www.presalestracker.ngrpresalestracker` | `webapp/` | Master/detail CRUD over presales opportunities (FlexibleColumnLayout, SmartTable/SmartFilterBar) |
| Dashboard | `com.ngr.presales.dashboard` | `webapp/dashboard/` | Read-only analytical dashboard (KPIs, sap.viz charts, CSV export) |

Plain JavaScript with `sap.ui.define` AMD modules — no TypeScript, no bundler, no ESLint config. Target runtime is UI5 1.136.20 (`ui5-local.yaml`), theme `sap_horizon`. Both components read the same OData V2 service `/sap/opu/odata/ngr/OD_PS_TRACKER_SRV/` (main entity set `xNGRxCDS_PS_MASTER`; also `xNGRxCDS_PS_PARTNER`, `xNGRxCDS_PS_REMARKS`, `ChangeLogs`, value-help sets).

`DASHBOARD.md` is the authoritative running record of dashboard behaviour, business definitions, versions and deployments — read it before changing dashboard logic, and append to it when you change behaviour. `TESTDATA-110.md` documents the synthetic client-110 dataset. `system-info.md` records the PS4 system facts.

## Commands

```sh
npm start                     # Tracker against live PS4 client 110 via proxy (FLP sandbox)
npm run start-mock            # Tracker with generated mock data
npm run start-local           # Tracker with the locally installed UI5 framework + mockserver
npm run start-dashboard       # Dashboard against live PS4 client 110
npm run start-dashboard-mock  # Dashboard with isolated fixtures (webapp/test/dashboard/data)
npm run start-dashboard-500   # Dashboard against the client-500 snapshot in .local-data, port 8085

npm run test-dashboard        # Node unit tests (the only headless test suite)
npm run int-test              # OPA5 integration journeys, opens a browser
npm run unit-test             # QUnit tracker tests, opens a browser

npm run build                 # ui5 build → dist/, then the dashboard → dist/dashboard
npm run deploy                # build + fiori deploy to /NGR/BSP_PS_TRACKER (transport in ui5-deploy.yaml)
npm run deploy-test           # same, --testMode true
npx @ui5/linter               # UI5 lint; not a devDependency, npx fetches it
```

Run a single Node test file: `node --test webapp/test/dashboard/analytics.test.cjs`. On Windows sandboxes that block test subprocesses, add `--test-isolation=none`.

Backend/proxy access requires SAP credentials; `fiori run` prompts for basic auth against `https://sapdev.nagarro.com:44300/`, client 110.

## UI5 configuration files

Each `ui5*.yaml` is a separate server/build profile selected by the npm scripts above: `ui5.yaml` (live proxy + build), `ui5-local.yaml` (local framework libs + mockserver), `ui5-mock.yaml` (mock), `ui5-dashboard.yaml` (dashboard **build** — repoints `webapp` to `webapp/dashboard` under its own namespace), `ui5-dashboard-mock.yaml` / `ui5-dashboard-500.yaml` (dashboard mock servers), `ui5-deploy.yaml` (ABAP deploy target, app `/NGR/BSP_PS_TRACKER`, package `/NGR/SAP_PRACTICE_PRE_SALES`, transport `PS4K902012`).

## Architecture notes

**Tracker routing.** `webapp/Component.js` exposes `getHelper()` returning a `FlexibleColumnLayoutSemanticHelper` for `idfcl`. `App.controller.js` derives the layout in `onBeforeRouteMatched` and deliberately re-invokes it from `onRouteMatched` — on a direct deep link the first `beforeRouteMatched` fires before targets attach, so the layout must be applied again after targets exist. Routes: `:layout:` (Master) and `Detail/{id}/{layout}`.

**Tracker controllers are large and stateful.** `Master.controller.js` (~1700 lines) holds opportunity creation, the Pipeline Report and Work Report dialogs (SmartTable column hiding, injected formatters, EUR conversion, Excel export). `Detail.controller.js` (~1050 lines) holds edit-mode toggling, partners, remarks and change logs. Fragments live in `webapp/view/fragments/`.

**Dashboard is layered deliberately.** `webapp/dashboard/model/` holds framework-free logic so it can be unit-tested in Node:
- `Analytics.js` — `DIMENSIONS`, size `BANDS`, `normalize`/`filter`/`group`/`trend`; owns all business definitions (active pipeline, won, win rate, overdue, EUR banding).
- `DataService.js` — paged `readAll` over `xNGRxCDS_PS_MASTER` that follows `__next`/`$skiptoken`, verifies `$inlinecount`, and **throws rather than showing partial totals**; plus `loadRates()` against `open.er-api.com` (rates are units per EUR, so EUR value = amount / rate).
- `ViewState.js` — filter/chart state defaults (current calendar quarter), quarter lists capped at the current quarter, `sanitize`, and module-memory `take`/`remember` for FLP return navigation. Deliberately does **not** use browser storage: a document reload resets to defaults.
- `Navigation.js` — builds tracker deep links (`Detail/{id}/MidColumnFullScreen`) for both standalone and FLP shell contexts.
- `ChartHover.js` — custom hover card replacing VizTooltip; `rowForPoint` decodes sap.viz's series-major, reverse-ordered point IDs for the stacked owner chart.

`Dashboard.controller.js` is the only layer that touches UI5 controls and charts.

**Keep model modules dependency-free.** The Node tests load them with `vm.runInNewContext` and a stub `sap.ui.define`, passing only `Date`, `URL`, `AbortController` and timers. Adding a real UI5 dependency to a `model/` module breaks the test harness.

**Dashboard standalone bootstrap.** `webapp/dashboard/bootstrap.js` chooses `/sap/public/bc/ui5_ui5/resources/sap-ui-core.js` when served under `/sap/`, otherwise the dev proxy's `../resources/`. Append `?sap-ui-xx-componentPreload=off` locally when preloads are stale.

## Deployment gotchas

- The nested dashboard must stay registered with the ABAP app index: tracker `manifest.json` needs `sap.app.embeds: ["dashboard"]` and the dashboard manifest needs `sap.app.embeddedBy: "../"`. Without them `/sap/bc/ui2/app_index/ui5_app_info?id=com.ngr.presales.dashboard` returns `error: true` and the launchpad serves a stale cached component.
- Bump `sap.app.applicationVersion.version` in `webapp/dashboard/manifest.json` on dashboard changes; verify after deploy via the app-index response **and** a normal launchpad reload, not only by reading repository files.
- FLP navigation uses semantic objects `Presales-analyze` (dashboard) and `ZPS_TRACKER-manage` (tracker). Local shell check: run `npm start`, open `/test/dashboard/flp.html?sap-client=110#Presales-analyze` (test-only, excluded from the build).
- Every build profile excludes `/test/**` and `/localService/**` from `dist/`.

## Data and secrets

`.local-data/` (gitignored) holds real extracted SAP data: the client-500 snapshot fixtures, seed journals and audit responses. Never move its contents into `webapp/` or commit them. Regenerate the 500 fixtures with `node scripts/prepare-dashboard-snapshot.cjs`; `node scripts/seed-dashboard-110.cjs <plan|pilot|load|verify|retire-old>` drives the synthetic client-110 dataset through the authenticated `localhost:8080` proxy only.

Client **110 is development**, client **500 is production**. Scripts and data work here target 110.
