# V1-SYNC-006E - Runtime Validation

## Environment

- Date: 2026-07-15
- Platform: Windows / PowerShell
- Branch: `v1/sync-006e-product-opening-stock-durable-group-integration`
- Base: `v1-sync-006d-durable-multi-record-mutation-group-foundation`
- Default SyncMode: `disabled`
- Firebase runtime/deployment: not invoked

## Focused Product Flow

`scripts/v1-sync-006e-product-opening-group-smoke.ts` was compiled to a unique
system temporary directory and executed against real local adapters.

| Required area | Result |
| --- | --- |
| one page/application command boundary | PASS |
| zero opening single-operation path | PASS |
| positive opening two-member group | PASS |
| deterministic Product/movement/group identities | PASS |
| one complete atomic outbox batch before cache writes | PASS |
| Product and movement applied once | PASS |
| derived quantity correct; Product.quantity non-authoritative | PASS |
| batch/Product/movement failure recovery | PASS |
| crash scenarios A-G | PASS |
| exact retry no Product/movement/group duplicate | PASS |
| changed Product/opening payload conflict | PASS |
| grouped Product and movement cloud blocked | PASS |
| zero-opening Product cloud behavior unchanged | PASS |
| no business command replay | PASS |
| no existing-record upload/migration/backfill | PASS |
| Firebase UID fallback absent | PASS |

Focused result: **PASS (`39/39`)**.

## Regression Suites

| Suite | Result |
| --- | --- |
| V1-SYNC-004 foundation | PASS (`18/18`) |
| V1-SYNC-004A local mutation | PASS (`26/26`) |
| V1-SYNC-005 master data | PASS (`31/31`) |
| V1-SYNC-006B immutable reversal | PASS (`14/14`) |
| V1-SYNC-006D durable groups | PASS (`24/24`) |

The V1-SYNC-006B suite includes opening stock, manual reversal, invoice issue,
and invoice return domain regressions. Product metadata edit was also exercised
through the V1-SYNC-005 revisioned update path after grouped creation.

## Technical Gates

- `git diff --check`: PASS (line-ending notices only).
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Build note: existing chunk-size warning only.
- StockMovement Firebase transport: NOT REGISTERED.
- StockMovement cloud listeners: `0`.
- Operational RTDB reads/writes: `0` / `0`.
- Existing records uploaded: `0`.
- Migration/backfill: NONE.
- Production touched: NO.

## Browser Tool Limitation

No authenticated browser automation session was available for this local
mission, and opening a TEST runtime would exceed the zero-operational-Firebase
boundary. Browser console errors and page exceptions are therefore **NOT
MEASURED**, not reported as zero. Runtime behavior is evidenced by the focused
real-adapter harness, regression harnesses, TypeScript, and production build.
