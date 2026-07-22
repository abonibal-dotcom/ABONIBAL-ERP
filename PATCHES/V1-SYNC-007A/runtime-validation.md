# V1-SYNC-007A Runtime Validation

## Environment

- Repository: ABONIBAL-ERP
- Branch: `v1/sync-007a-sales-domain-stable-identity-lifecycle-alignment`
- Base: `v1-sync-007-sales-commercial-records-sync-architecture-audit-plan`
- Validation date: 2026-07-15
- Shell: Windows PowerShell
- Node.js: 24.x
- Firebase deployment: none
- Operational Firebase access: none

## Primary Domain Smoke

Command:

```text
pnpm dlx tsx scripts/v1-sync-007a-sales-identity-smoke.ts
```

Result: PASS, 6/6 scenarios.

| Scenario | Result |
| --- | --- |
| Invoice line identity survives edit and reorder | PASS |
| Draft update uses expected revision and stale revision conflicts | PASS |
| Partial issue resumes with deterministic deductions | PASS |
| Exact issue retry creates zero duplicate deductions | PASS |
| Conflicting issue command is rejected | PASS |
| Issued Invoice destructive repository update is rejected | PASS |
| Issued Invoice draft deletion is rejected | PASS |
| Product snapshot remains unchanged after Product edit | PASS |
| Product.quantity remains unchanged/non-authoritative | PASS |
| Partial cancellation resumes with deterministic sale return | PASS |
| Exact cancellation retry creates zero duplicate movements | PASS |
| Conflicting cancellation reason is rejected | PASS |
| Original sale_deduction remains byte-stable | PASS |
| Return line identity is deterministic | PASS |
| Partial Return execution resumes and adopts exact movement | PASS |
| Exact Return retry creates zero duplicate movements | PASS |
| Conflicting Return execution command is rejected | PASS |
| Executed Return destructive repository update is rejected | PASS |
| Partial Returns remain supported | PASS |
| Multiple Returns remain supported | PASS |
| Local cumulative over-return is rejected | PASS |
| Legacy Invoice without line ID remains readable | PASS |
| Legacy Return without line ID remains readable | PASS |
| Legacy read performs zero storage writes | PASS |
| Explicit legacy draft save assigns line ID and revision | PASS |
| Default SyncMode remains disabled | PASS |

## Deterministic Identity Evidence

- Issue command: `invoice-issue-{invoiceId}`.
- Deduction movement: `sale-{invoiceId}-{invoiceLineId}`.
- Cancellation command: `invoice-cancel-{invoiceId}`.
- Cancellation movement: `invoice-cancel-return-{invoiceId}-{invoiceLineId}`.
- Return line: `return-line-{returnId}-{invoiceLineId}`.
- Return execution command: `invoice-return-execute-{returnId}`.
- Return movement: `invoice-return-{returnId}-{returnLineId}`.

Exact identities with exact payloads return the stored movement. Exact identities with divergent payloads return an explicit conflict.

## Regression Smokes

| Command | Result |
| --- | --- |
| `pnpm dlx tsx scripts/v1-sync-006b-stock-movement-reversal-smoke.ts` | PASS 14/14 |
| `pnpm dlx tsx scripts/v1-sync-006d-mutation-group-smoke.ts` | PASS 24/24 |
| `pnpm dlx tsx scripts/v1-sync-006-inventory-ledger-smoke.ts` | PASS 41/41 |

The historical V1-SYNC-006E script cannot start under Node 24 because it combines CommonJS `require` with ESM execution. No prior-mission file was modified. Its critical opening-stock and ordered-group behaviors passed in the V1-SYNC-006 41/41 smoke and V1-SYNC-006D 24/24 smoke.

## Legacy and Migration Gates

- Startup commercial-record rewrite count: 0.
- Legacy Invoice IDs changed: 0.
- Legacy Return IDs changed: 0.
- Legacy StockMovement IDs changed: 0.
- Human document numbers changed: 0.
- Existing Invoices uploaded: 0.
- Existing InvoiceReturns uploaded: 0.
- Migration/backfill: NONE.

## Sync and Accounting Boundaries

- Invoice Firebase transport registered: NO.
- InvoiceReturn Firebase transport registered: NO.
- Invoice/InvoiceReturn RTDB rules changed: NO.
- Operational RTDB writes: 0.
- Operational RTDB listeners: 0.
- Customer balance mutation: NONE.
- Payment coupling: NONE.
- Cash/Safe coupling: NONE.
- Ledger coupling: NONE.
- Product.quantity authoritative: NO.

## Technical Validation

- `git diff --check`: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Vite output: production build completed; existing chunk-size warning remains non-blocking.
- Domain smoke failures: 0.
- Browser console/page exception collection: not applicable; this mission used isolated domain runtime smokes and did not open an authenticated browser or perform operational writes.
- Production touched: NO.

## Unresolved Boundary

Concurrent stale devices can still independently validate cumulative Return quantities. Trusted canonical transaction/allocation and atomic group publication remain required before multi-device commercial cutover.
