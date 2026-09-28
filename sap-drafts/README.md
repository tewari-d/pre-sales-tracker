# SAP backend change applied in client 110 (28 September 2026)

These files record the source applied to PS4 with workbench transport `PS4K902086` (task `PS4K902087`). The objects are active, and the tracker/dashboard bundle was deployed to client 110. No existing `/NGR/T_MASTER` field was deleted; its field count increased from 46 to 48. No opportunity rows in clients 110 or 500 were backfilled or corrected.

ABAP Dictionary, CDS, domain and class definitions are workbench objects shared across clients of PS4. The app deployment and OData verification used client 110; client 500 data was not changed.

## Dictionary objects to create

| Object | Type | Definition |
| --- | --- | --- |
| `/NGR/DO_PS_OPP_CATEGORY` | Domain | CHAR 10, fixed values in the order below |
| `/NGR/DE_PS_OPP_CATEGORY` | Data element | Domain `/NGR/DO_PS_OPP_CATEGORY`, label `Opportunity Type`, change document flag like the other master fields |
| `/NGR/DO_PS_SAP_SYS_CAT` | Domain | CHAR 10, fixed values in the order below |
| `/NGR/DE_PS_SAP_SYS_CAT` | Data element | Domain `/NGR/DO_PS_SAP_SYS_CAT`, label `SAP System Category`, change document flag |

| Opportunity Type code | Description |
| --- | --- |
| `AMS` | AMS |
| `PUB_IMPL` | Public Cloud Implementation |
| `PVT_IMPL` | Private Cloud Implementation |
| `ROLLOUT` | Rollout |
| `UPGRADE` | Upgrade |
| `OTHER` | Others |

| SAP System Category code | Description |
| --- | --- |
| `ECC` | ECC |
| `S4_ONPREM` | S/4HANA On Premise |
| `S4_PRIVATE` | S/4HANA Private Cloud |
| `S4_PUBLIC` | S/4HANA Public Cloud |
| `OTHER` | Others |

Use the same English descriptions in the domain fixed-value texts. The existing `/NGR/DO_PS_GEOGRAPHY` codes already match the seven desired regions; change their descriptions to `MENA`, `APAC`, `Europe`, `UK`, `North America`, `Australia & NZ`, and `Africa` in that order. The domain text change does not change the geographical assignment of any existing row.

## Activation and verification

1. The four Dictionary objects above were created and activated.
2. [`t_master.tabl`](t_master.tabl) was activated with nullable `opp_category` and `sap_system_category` columns. Existing `sap_system`, `opp_type`, and dormant `opportunity_type` remain.
3. [`cds_ps_master.ddls`](cds_ps_master.ddls) and [`mext_ps_master.ddlx`](mext_ps_master.ddlx) were activated. The service properties are `OpportunityType`, `OpportunityTypeText`, `SapSystemCategory`, and `SapSystemCategoryText`.
4. The two `/NGR/CL_OD_PS_TRACKER_DPC_EXT` methods were updated using [`create_deep_entity.abap`](create_deep_entity.abap) and [`update_entity.abap`](update_entity.abap), syntax checked and activated. They persist both coded fields, enforce the size/date rules and preserve `CloseDate` for `COMPLETE`.
5. Client 110 `OD_PS_TRACKER_SRV/$metadata` returned HTTP 200 with both new coded properties. The tracker/dashboard bundle was uploaded successfully to `/NGR/BSP_PS_TRACKER` in client 110 using `PS4K902086`; the deployed controller contains the intake bar label change.
6. The client 500 mapping workbook remains a proposal for separate review. No category backfill or geography correction was run.

Follow-up verification found that the Geography domain texts had only been saved as inactive entries. `/NGR/DO_PS_GEOGRAPHY` was activated, and [`cds_ps_domain_values.ddls`](cds_ps_domain_values.ddls) was updated and activated to label its code as Key and its text as Description. The client-110 OData value help now returns all seven requested texts, including `AUS` as `Australia & NZ`; its metadata labels are Key and Description in the correct columns. Both changes are in `PS4K902086`.

The CDS and DPC_EXT syntax checks passed after Dictionary activation. CDS activation reported existing association-cardinality warnings and the two analogous warnings for the new text associations. SAPUI5 upload reported an application-index warning about the embedded dashboard descriptor ID, while completing successfully.
