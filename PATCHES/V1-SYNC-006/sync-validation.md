# V1-SYNC-006 Sync Validation

## Environment

- Date: 2026-07-15
- Platform: Windows / PowerShell
- Package manager invocation: `pnpm.cmd`
- Firebase rules target: `abonibal-erp-test` only
- Java: session-only JDK 21 path for Firebase Database Emulator
- Production touched: NO

## Technical Gates

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm run build` | PASS |
| Vite preview HTTP entry | PASS, HTTP 200 |
| Build warning | Known chunk-size warning only |

## Focused StockMovement Coverage

`scripts/v1-sync-006-inventory-ledger-smoke.ts`: PASS `41/41`.

Evidence includes disabled local-only append, active durable capture, cross-account rejection, sale deduction and sale return capture, outbox/cache failures, crash recovery, exact retry, receipt/cleanup ordering, cloud match/conflict, TEST project guard, cache-only pull, duplicate pull, reversal, derived quantity, historical ledger safety, capability transition, grouped ordering, partial-state recovery, restart recovery, and no startup writes/listeners.

Key measured results:

- Business command replays: 0.
- Existing StockMovements enqueued/uploaded: 0.
- Existing user records uploaded: 0.
- Migration/backfill: 0 / NONE.
- Operational live RTDB writes: 0.
- Default `SyncMode`: disabled.
- Product.quantity authoritative: NO.

## Regression Suites

| Suite | Result |
| --- | --- |
| V1-SYNC-004 shared runtime | PASS `18/18` |
| V1-SYNC-004A durable local capture | PASS `26/26` |
| V1-SYNC-005 master-data sync | PASS `31/31` |
| V1-SYNC-006B immutable reversal/domain flows | PASS `14/14` |
| V1-SYNC-006D durable mutation groups | PASS `24/24` |
| V1-SYNC-006E Product/opening group | PASS `39/39` |

V1-SYNC-006B specifically confirms invoice issue still creates one `sale_deduction` and invoice return still creates one `sale_return`. The focused V1-SYNC-006 harness confirms each resulting movement type is captured exactly once by the active StockMovement bridge.

## Rules Suites

| Suite | Result |
| --- | --- |
| V1-SYNC-006 StockMovement rules | PASS `17/17` |
| V1-SYNC-005 existing master-data rules | PASS `36/36` |

TEST Database rules deployment: PASS. Only Realtime Database rules were deployed with explicit TEST config/project arguments.

## Inventory Results

- `+10 -3 = 7`: PASS after cache reload.
- Original `+10` plus reversal `-10 = 0`: PASS.
- Duplicate reversal pull remains `0`: PASS.
- Opening `+10` exact retry remains `10`: PASS.
- Duplicate pull keeps one local record and one derived effect: PASS.
- Product.quantity does not affect derived inventory: PASS.

## Runtime Limitation

The built application served successfully through a local Vite preview with HTTP 200. An authenticated browser automation session was not available for this closure run, so page-by-page authenticated navigation, console-error count, and page-exception count are recorded as TOOL LIMITATION / not measured. No metrics are inferred or invented. Domain, integration, security, TypeScript, build, and HTTP entry gates all passed.

## Repository Safety

- `.env` remains ignored and untracked; its contents were not read or printed.
- No Hosting deployment.
- No production command or write.
- No invoice repository, payment, purchase, expense, cash, or ledger repository changes.
