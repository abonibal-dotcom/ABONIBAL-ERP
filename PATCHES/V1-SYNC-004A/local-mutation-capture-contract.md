# V1-SYNC-004A - Local Mutation Capture Contract

## Root Gap

V1-SYNC-002 required a durable outbox entry before cache mutation, a separate locally-applied marker, and startup reconciliation. V1-SYNC-004 had cloud acknowledgement recovery but did not model local-apply state or provide a cache reconciliation contract. Connecting an operational repository at that point could have allowed an ambiguous operation to reach cloud processing.

## Approved Ordering

Every sync-enabled local mutation uses this order:

1. Validate the explicit account-scoped capture request.
2. Persist the complete outbox operation.
3. Persist a local-apply attempt marker.
4. Inspect the cache through an idempotent cache-only applier.
5. Apply only when the expected pre-state is present.
6. Verify the intended state.
7. Persist `localApplyState: applied` and `localAppliedAt`.
8. Return local mutation success.

The cloud lifecycle remains independent. A valid state is:

```text
localApplyState: applied
status: pending
```

This means the mutation is durable in local cache but has not received cloud acknowledgement.

## Local Apply Model

`LocalApplyState` values:

- `pending`
- `applied`
- `conflict`
- `failed`

`SyncOperation` adds:

- `localApplyState`
- `localAppliedAt?`
- `localApplyAttemptCount`
- `localApplyLastAttemptAt?`
- `localApplyErrorCode?`
- `localApplyErrorMessageSafe?`

Local errors are safe summaries only. No stack traces, credentials, tokens, SDK configuration, or secrets are stored.

Legacy outbox entries without the new fields normalize conservatively to `localApplyState: pending`; they cannot be sent to cloud until reconciled and durably marked applied.

## Persistent Outbox API

The account-scoped repository now supports:

- `getPendingLocalApply`
- `markLocalApplyAttempt`
- `markLocallyApplied`
- `markLocalApplyConflict`
- `markLocalApplyFailed`
- `resetRecoverableLocalApply`
- `countByLocalApplyState`

Existing cloud status transitions remain separate. `getPending` and `markSyncing` reject operations whose local-apply state is not `applied`.

## DurableMutationCapture

`DurableMutationCapture` owns outbox-first sequencing. It requires:

- one explicit matching logical account ID
- a module-matching cache applier
- a stable operation ID and idempotency key
- a non-empty write-set checksum
- a safe payload or safe payload reference

Outbox failure prevents the applier from running. Apply failure retains the operation. Mark-applied failure leaves a recoverable operation and reports failure rather than pretending local completion.

Retrying the same operation identity returns the existing durable operation. A changed expected revision or write-set checksum under the same identity is rejected as a collision.

## Cache-Only Applier

`LocalMutationApplier` exposes only:

- `inspect(operation)`
- `apply(operation)`

Inspection returns `not_applied`, `already_applied`, or `conflict`. Implementations must be account-scoped, record-scoped, idempotent, and revision-aware when required.

The applier may update cache/state only. It must never call invoice issue, payment posting, expense posting, stock movement creation, cash posting, journal posting, or another business command.

## Registry

`LocalMutationApplierRegistry` registers and resolves one applier per sync module. It rejects duplicate or unknown registrations. V1-SYNC-004A registers no operational module appliers; only fake appliers are used in tests.

## Failure Semantics

- Outbox write failure: no cache mutation; caller receives failure.
- Cache inspection failure: operation retained as local failed.
- Cache apply failure with unchanged state: operation retained as local failed.
- Cache apply failure after state changed: post-error inspection can safely mark applied.
- Mark-applied persistence failure: operation remains recoverable; cloud processing stays blocked.
- Ambiguous or divergent state: local conflict; no overwrite and no cloud send.
- Local failed retry: bounded and explicit through reconciliation policy.

## Account Boundary

Capture, outbox, reconciliation, and applier operation all use the same explicit logical `accountId`. Firebase provider identity is never used as account ID and there is no fallback account.
