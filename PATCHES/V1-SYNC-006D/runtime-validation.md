# V1-SYNC-006D - Runtime Validation

## Test Environment

- Date: 2026-07-15
- Platform: Windows / PowerShell
- Node.js: `v24.14.0`
- pnpm: `11.7.0`
- Base tag: `v1-sync-006c-durable-multi-record-mutation-group-architecture-plan`
- Branch: `v1/sync-006d-durable-multi-record-mutation-group-foundation`
- Firebase runtime: not invoked

## Foundation Checklist

| Check | Result |
| --- | --- |
| Complete two-member batch uses one outbox write | PASS |
| Validation failure writes nothing | PASS |
| Driver write failure leaves no partial members | PASS |
| Exact batch retry is idempotent | PASS |
| Changed payload under same identity conflicts | PASS |
| Capture exposes identity conflict | PASS |
| Mixed account rejected | PASS |
| Duplicate operation ID rejected | PASS |
| Duplicate sequence rejected | PASS |
| Group-size mismatch rejected | PASS |
| Complete group exists before first cache apply | PASS |
| Missing applier rejected before persistence | PASS |
| Account isolation | PASS |
| Firebase UID fallback absent | PASS |
| Existing ungrouped outbox record readable | PASS |
| Default SyncMode remains disabled | PASS |

## Crash Recovery

Generic synthetic scenarios A-G: **PASS**.

- Fully pending group recovered in sequence.
- Matching first member was not duplicated.
- Matching cache state before a marker repaired the marker only.
- Fully applied exact retry added no effect.
- First-member divergence stopped later application.
- Second-member stable-ID divergence was retained as conflict.
- Business-command replays: `0`.

## Cloud Gate

Fake transport only: **PASS**.

- Pending sibling blocked cloud processing.
- All required members applied unlocked the first ordered member.
- Later sequence waited for earlier acknowledgement.
- Conflict and failure blocked every sibling.
- Partial acknowledgement retained the complete group.
- Full acknowledgement removed the group together.
- Operational Firebase reads: `0`.
- Operational Firebase writes: `0`.

## Regression

| Suite | Result |
| --- | --- |
| V1-SYNC-006D group smoke | PASS (`24/24`) |
| V1-SYNC-004 foundation | PASS (`18/18`) |
| V1-SYNC-004A local mutation | PASS (`26/26`) |
| V1-SYNC-005 master data | PASS (`31/31`) |
| Ungrouped durable capture | PASS |
| Ungrouped reconciliation | PASS |
| Ungrouped cloud eligibility | PASS |
| Products/Customers/Suppliers sync regression | PASS |

## Technical Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Build warning: existing JavaScript chunk-size warning only
- Operational business repositories modified: NO
- Product/StockMovement operational flows modified: NO
- RTDB rules changed: NO
- Firebase deployment: NO
- Migration/backfill: NONE
- Production touched: NO
