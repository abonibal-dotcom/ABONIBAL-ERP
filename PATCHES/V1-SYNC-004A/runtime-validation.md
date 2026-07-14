# V1-SYNC-004A - Runtime Validation

## Environment

- Date: 2026-07-14
- Base tag: `v1-sync-004-shared-firebase-sync-runtime-outbox-foundation`
- Branch: `v1/sync-004a-durable-local-mutation-capture-recovery-foundation`
- Firebase operational target for future work: `abonibal-erp-test`
- Production: frozen and untouched
- Test adapters: in-memory Driver, fake cache applier, fake cloud transport

## Technical Gates

| Gate | Result |
| --- | --- |
| `git diff --check` | PASS |
| `pnpm exec tsc --noEmit` | PASS |
| Smoke scripts TypeScript check | PASS |
| `pnpm run build` | PASS |
| Local Vite production preview | PASS (`HTTP 200`) |
| Default SyncMode | `disabled` |
| Operational repositories modified | NO |
| Operational repository imports | NONE |
| Operational RTDB reads | 0 |
| Operational RTDB writes | 0 |
| Migration/backfill | NONE |

The existing non-blocking bundle-size warning remains documented.

## Foundation Tests

Commands:

```text
pnpm dlx tsx scripts/v1-sync-004-foundation-smoke.ts
pnpm dlx tsx scripts/v1-sync-004a-local-mutation-smoke.ts
```

- V1-SYNC-004 regression foundation: PASS, 18/18.
- V1-SYNC-004A local mutation foundation: PASS, 26/26.

The 26 checks cover outbox ordering, persistence failure, local success/failure, cloud gate, crash recovery, create/update/append reconciliation, conflict visibility, account isolation, stop behavior, no command replay, no operational appliers, zero RTDB writes, and default disabled mode.

## Crash Recovery Results

| Scenario | Result |
| --- | --- |
| A - before outbox persistence | PASS |
| B - after outbox/before cache | PASS |
| C - after cache/before local mark | PASS |
| D - after local mark/before caller acknowledgement | PASS |
| E - divergent local state | PASS |

## Scope Safety

- Product, Customer, Supplier, and all other operational repositories are unchanged.
- No runtime module applier is registered.
- No Firebase client or transport is called by local capture/reconciliation.
- No localStorage wipe, ID change, migration, scan, upload, or backfill exists.
- `v1/sync-005-master-data-repository-sync` remains untouched at its original clean base.
- No Firebase deploy or Hosting deploy was executed.

## Browser Runtime Limitation

The full build served successfully and returned HTTP 200. Authenticated page-by-page browser control was unavailable due the existing browser-control tool limitation. Console errors and page exceptions are therefore `NOT MEASURED - TOOL LIMITATION`, not reported as fabricated zero values.

Existing local data was not read, modified, migrated, or deleted by the validation harness.

## Result

Foundation compile, build, scope, ordering, crash recovery, account isolation, and zero-write gates pass.
