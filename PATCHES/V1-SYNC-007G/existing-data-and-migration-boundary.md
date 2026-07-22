# V1-SYNC-007G Existing Data and Migration Boundary

No runtime startup hook, repository scan, historical reservation builder, or
backfill was added.

| Boundary | Result |
| --- | --- |
| Existing Invoices scanned/uploaded | `0` |
| Existing InvoiceReturns scanned/uploaded | `0` |
| Existing StockMovements scanned/uploaded | `0` |
| Existing allocation roots scanned | `0` |
| Historical reservations generated | `0` |
| IDs rewritten | `0` |
| Document numbers rewritten/allocated | `0` |
| Migration/backfill | `NONE` |
| Operational live RTDB writes/listeners | `0 / 0` |

Only synthetic local/unit and RTDB Emulator records were used. Existing user
records were not uploaded or changed. Default browser `SyncMode` remains
`disabled`.
