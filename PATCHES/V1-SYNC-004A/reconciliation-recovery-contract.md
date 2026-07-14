# V1-SYNC-004A - Reconciliation and Recovery Contract

## Purpose

`LocalMutationReconciler` repairs operations interrupted between durable outbox persistence and durable local-applied marking. It applies captured records to cache only and never replays the business command that produced them.

## Startup Order

When the coordinator is explicitly started:

1. Resolve and validate the logical account ID.
2. Clean up receipt-backed acknowledged entries.
3. Recover interrupted cloud `syncing` entries.
4. Start account-scoped local reconciliation.
5. Reconcile pending local applies.
6. Refresh local/cloud status counts.
7. Permit cloud processing only for locally applied operations and only when SyncMode permits it.

Local reconciliation is safe in disabled mode because it uses only an approved cache-only applier. V1-SYNC-004A registers no operational appliers, so normal application startup performs no repository mutation. Cloud writes and listeners remain disabled.

## Deterministic Reconciliation

For each pending local operation in creation order:

1. Verify the active account matches the operation account.
2. Resolve the module applier.
3. Persist a local-apply attempt.
4. Inspect cache state.
5. If intended state already exists, mark applied without applying again.
6. If expected pre-state exists, apply once, verify, then mark applied.
7. If state is divergent, mark local conflict without overwrite.
8. If a technical failure occurs, retain it as local failed.

Failed operations are automatically reset only while `localApplyAttemptCount < 3`. Each reconciliation invocation processes an operation at most once, preventing a tight loop. Conflict operations are never reset automatically.

## Idempotent Rules

### Create

- Record absent: apply create.
- Same stable ID and matching intended checksum/state: already applied.
- Same stable ID with different state: conflict.

### Update

- Current revision equals `expectedRevision`: apply intended next revision.
- Current revision and checksum equal intended result: already applied.
- Missing or unexpected revision: conflict.

### Append

- Stable ID absent: append/create.
- Identical stable record exists: already applied.
- Same ID with different payload: conflict.

### Void and Reverse

Foundation contract only. Future module-specific appliers must apply authoritative cache records and must not invoke lifecycle commands.

## Crash Scenarios

| Scenario | Result |
| --- | --- |
| A. Crash/failure before outbox persistence | No operation and no local mutation. PASS |
| B. Crash after outbox, before cache apply | Reconciler applies once and marks applied. PASS |
| C. Crash after cache apply, before mark | Matching state is detected; no duplicate apply; operation marked applied. PASS |
| D. Crash after mark, before caller success | Same operation retry is idempotent; no duplicate outbox or mutation. PASS |
| E. Local state diverged before reconciliation | Conflict retained; no overwrite and no cloud send. PASS |

## Stop and Account Switch

`stop()` clears the active account. Reconciliation checks the active account before each operation and stops before processing the next record. `SyncCoordinator.stop()`, logout, and account switch stop reconciliation and clear listeners without deleting cache or outbox records.

## Status Visibility

`SyncStatus` now reports:

- `pendingLocalApplyCount`
- `localApplyConflictCount`
- `localApplyFailedCount`

In enabled modes, unresolved local conflicts produce conflict state and local failures produce error state. In default disabled mode, status remains disabled while counts remain inspectable.

## Cloud Gate

Cloud `processNext`/`processPending` can select only operations with:

```text
localApplyState === applied
status === pending
```

Pending, failed, and conflicted local applies never reach the transport.
