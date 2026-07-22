# V1-SYNC-007H Visibility and Bootstrap Boundary

## Visibility

Phase B uses one RTDB `update()` below `accounts/{accountId}`. Readers cannot
observe an executed Return without its deterministic movements, accepted
receipt, and committed marker as a result of this publication operation.

Phase A allocation commit may be visible before Phase B. This is deliberate
durable recovery evidence, not commercial execution visibility.

## Existing Data

- Existing Invoices and Returns scanned: `0`
- Historical records enqueued or uploaded: `0`
- Existing IDs or numbers rewritten: `0`
- Migration/backfill: `NONE`
- Local storage deleted: `NO`
- Startup Firebase reads/writes/listeners added: `0 / 0 / 0`

No callable or operational handler invokes this foundation. Default browser
`SyncMode` remains `disabled`.

## Remaining Gates

Full multi-device cutover remains blocked until separate approved missions add:

- canonical human document-number allocation;
- trusted InvoiceReturn execution handler integration;
- trusted-only commercial StockMovement Rules;
- migration, count/ID/hash and derived-balance verification;
- explicit owner-approved cutover.

Firebase Auth UID remains membership identity only and is never used as the
logical account ID.
