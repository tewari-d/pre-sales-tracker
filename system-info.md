# System Info: PS4

_Generated: 2026-09-10_ · _Source: ARC-1 ps4_110_

## Identity

| Field | Value |
|---|---|
| SID | PS4 (connector identity) |
| System type | onprem |
| Release | 816 |
| Kernel | Not returned by discovery |
| Client | 110 (connector and application configuration) |
| Language | Not returned by discovery |
| User | ASHUTOSH |

## Core Components

| Component | Release | Description |
|---|---|---|
| SAP_BASIS | 816 | SAP Basis Component |
| SAP_UI | 816 | User Interface Technology |
| SAP_ABA | 816 | Cross-Application Component |
| SAP_GWFND | 816 | SAP Gateway Foundation |

## Feature Availability

| Feature | Available | Mode | Note |
|---|---|---|---|
| RAP / CDS | Yes | auto | Development available |
| abapGit | No | auto | Endpoint 404 |
| HANA | Yes | auto | Inferred from installed components |
| AMDP | Yes | auto | Debugging available |
| UI5 | Yes | auto | Fiori BSP available |
| UI5 Repository | Yes | auto | ABAP repository deploy available |
| Transports | Yes | auto | CTS available |
| FLP | Yes | auto | PAGE_BUILDER_CUST available |

## Lint Configuration

- **Preset**: onprem
- **ABAP dialect**: system 816; local syntax parser v758
- **Enabled rules**: 166
- **Disabled rules**: 25

## RAP Constraints Snapshot

- **RAP endpoint status**: available; existing DDLS reads verified.
- **Recommended build mode**: two-pass if creating draft RAP artifacts; not needed for this UI-only dashboard.
- **TABL admin type guidance**: verify types per object; syuname/timestampl are conservative on-prem defaults.
- **Known projection BDEF caveat**: verify headers against this release, do not infer from older 7.5x systems.
- **Known DDLX scope caveat**: verify annotation scope before creating artifacts.
- **Lint coverage hint**: ABAP and DDLS; backend syntax checks still required for RAP artifacts.
- **RAP helper path**: preflight/scaffold helpers have not been probed; no RAP creation is needed here.

## Coding Guidance

- Target UI5 1.136.20, matching ui5-local.yaml. Backend changes so far: 2026-09-15 removal of the free-text `ProposalType` from `/NGR/CDS_PS_MASTER`, `/NGR/I_MASTER_CUBE`, `/NGR/C_MASTER_ALP` (+DDLX) and `/NGR/CL_OD_PS_TRACKER_DPC_EXT`, client 110, transport PS4K902026 (see DASHBOARD.md).
- Existing OData V2 service: `/sap/opu/odata/ngr/OD_PS_TRACKER_SRV/`, entity set `xNGRxCDS_PS_MASTER`.
- CDS `/NGR/CDS_PS_MASTER` exposes `OppTcv` in `Currency`, with no EUR-converted field.
- `Owner` comes from partner function `OWN`; `Country_Text` is the country/region description.
- Won statuses: `WIN`, `COMPLETE`. Lost: `LOSS`. Other terminal statuses: `CLSD`, `NOGO`, `DELE`.
- Transports and RAP are available, but the dashboard only reads the existing service.
