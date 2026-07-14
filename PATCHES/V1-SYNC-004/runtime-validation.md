# V1-SYNC-004 - Runtime Validation

## Environment

- Date: 2026-07-14
- Branch: `v1/sync-004-shared-firebase-sync-runtime-outbox-foundation`
- Base tag: `v1-sync-003-firebase-rtdb-security-account-membership-foundation`
- Intended Firebase target: `abonibal-erp-test`
- Production: frozen and untouched
- Foundation adapter: in-memory Driver and fake transport

## Technical Gates

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `pnpm exec tsc --noEmit` | PASS |
| Smoke script TypeScript check | PASS |
| `pnpm run build` | PASS |
| Vite production preview HTTP readiness | PASS (`HTTP 200`) |
| Default sync mode | PASS (`disabled`) |
| Operational Firebase reads by foundation tests | 0 |
| Operational Firebase writes by foundation tests | 0 |
| Business command replays | 0 |
| Operational repository imports in sync foundation | NONE |

The existing bundle-size warning remains non-blocking and unchanged in nature.

## Foundation Tests

Command:

```text
pnpm dlx tsx scripts/v1-sync-004-foundation-smoke.ts
```

| Check | Result |
| --- | --- |
| Default mode is disabled | PASS |
| Disabled mode performs zero transport calls | PASS |
| Outbox persists across repository restart | PASS |
| Duplicate operation/idempotency identity is deduplicated | PASS |
| `markSyncing` records one explicit attempt | PASS |
| Receipt is persisted before outbox removal | PASS |
| Conflict remains visible | PASS |
| Non-retryable failure remains visible | PASS |
| Network retry is bounded | PASS |
| Permission failure pauses without tight loop | PASS |
| Interrupted syncing entry recovers | PASS |
| Persisted receipt prevents cloud replay after interruption | PASS |
| Logout stops coordinator and removes listeners | PASS |
| Account switch detaches old-account listeners | PASS |
| Outbox/receipt/conflict keys are account-scoped | PASS |
| Provider user ID is not used as account ID | PASS |
| Local echo is suppressed without business replay | PASS |
| No realtime listener is registered by default | PASS |

## Scope Audit

- No Product, Inventory, Sales, Customer, Supplier, Payment, Purchase, Expense, Cash, or Ledger repository was modified.
- No operational repository is imported by `src/modules/sync` or the smoke harness.
- No migration, localStorage wipe, ID change, cloud cutover, or operational listener was added.
- No Firebase command or deployment was executed for V1-SYNC-004.
- No operational RTDB path was read or written by the new runtime.
- `FirebaseRealtimeClient` is registered lazily and is not attached to the operation transport.
- The operation transport registered in `Container` is explicitly unconfigured.

## Existing Application Runtime

The built application served successfully from a local Vite production preview and returned `HTTP 200`. TypeScript and the full production build include all existing pages and route registrations without compile-time regression.

Authenticated page-by-page browser validation was not executed. The available browser-control connection failed before it could access an authenticated session. Per mission policy, console errors and page exceptions are therefore recorded as `NOT MEASURED - TOOL LIMITATION`, not fabricated as zero.

| Runtime item | Result |
| --- | --- |
| Dashboard through Basic Ledger authenticated navigation | NOT MEASURED - TOOL LIMITATION |
| Existing local data visibility in authenticated browser | NOT MEASURED - TOOL LIMITATION |
| Console errors count | NOT MEASURED - TOOL LIMITATION |
| Page exceptions count | NOT MEASURED - TOOL LIMITATION |
| Build/runtime startup regression | PASS |

## Final Validation Result

Foundation tests, compile, build, HTTP readiness, account isolation, and zero-write scope gates pass. Authenticated visual runtime remains an explicitly documented tool limitation permitted by the mission.
