# V1-SYNC-007C Runtime Validation

## Environment

- Repository: ABONIBAL-ERP
- Branch: `v1/sync-007c-invoice-repository-firebase-sync-integration`
- Base tag: `v1-sync-007b-sales-commercial-durable-group-integration`
- Firebase target: `abonibal-erp-test` only
- Default SyncMode: `disabled`
- Runtime date: 2026-07-21

## Validation Results

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm run build` | PASS |
| Invoice sync smoke | PASS 14/14 |
| Invoice rules smoke | PASS 21/21 |
| Master-data rules regression | PASS 36/36 |
| StockMovement rules regression | PASS 17/17 |
| Draft CAS | PASS |
| Draft tombstone | PASS |
| Missing-cloud-baseline protection | PASS |
| Issued/cancelled immutability | PASS |
| Cache-only pull | PASS |
| Issue/cancellation capability transition | PASS |
| InvoiceReturn group remains blocked | PASS |
| Group ordering | PASS |
| Issue partial-ack recovery | PASS |
| Cancellation partial-ack recovery | PASS |
| Business command replay | 0 |
| Invoice pull-created StockMovements | 0 |
| Commercial movement leak | 0 |
| Existing Invoice auto-upload | 0 |
| Migration/backfill | NONE |
| Operational live RTDB record writes | 0 |
| Production touched | NO |

## Regression Suites

- V1-SYNC-004: PASS 18/18
- V1-SYNC-004A: PASS 26/26
- V1-SYNC-005: PASS 31/31
- V1-SYNC-006B: PASS 14/14
- V1-SYNC-006D: PASS 24/24
- V1-SYNC-006E: PASS 39/39
- V1-SYNC-006: PASS 41/41
- V1-SYNC-007A: PASS 6/6
- V1-SYNC-007B: PASS 31/31 under the approved 007C Invoice capability transition

## Runtime HTTP Evidence

- Vite preview process started from the production build.
- Listening port: 4197.
- Root HTTP: 200.
- `/invoices` deep-route HTTP: 200.
- Preview process closed cleanly.

Authenticated browser automation was unavailable, so authenticated Console Errors and Page Exceptions were not measured. This is recorded as a tool limitation; no metrics were invented.

The build completed with the existing bundle-size warning for the main JavaScript chunk. It is non-blocking and unrelated to this mission.

## Unresolved Boundaries

- Cloud atomic visibility: NOT GUARANTEED
- Multi-device Invoice numbering: NOT SOLVED
- Concurrent cross-device over-return: NOT SOLVED
- InvoiceReturn Firebase transport: NOT REGISTERED
- Cutover: NOT APPROVED
