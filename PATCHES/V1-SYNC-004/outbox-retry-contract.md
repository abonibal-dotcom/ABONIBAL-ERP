# V1-SYNC-004 - Outbox and Retry Contract

## Account-Scoped Persistence

| Store | Key |
| --- | --- |
| Active outbox | `syncOutbox:{accountId}` |
| Acknowledgement receipts | `syncReceipts:{accountId}` |
| Conflicts | `syncConflicts:{accountId}` |

All key builders require a non-empty explicit account ID. Repository reads filter out records whose embedded account ID does not match the requested account.

## Outbox Lifecycle

Supported states:

- `pending`
- `syncing`
- `acknowledged`
- `conflict`
- `failed`

The persistent repository supports enqueue, lookup, pending ordering, syncing, acknowledgement, conflict, failure, retry scheduling, interrupted-sync recovery, manual retry, status counts, and acknowledged removal.

Safety rules:

- Operation ID or idempotency-key duplicates are deduplicated only when their identity matches.
- Identity collisions fail safely.
- Pending, conflict, and failed records cannot be silently removed.
- Only acknowledged records can leave the active outbox.
- A receipt must exist before coordinator-driven removal.
- Manual retry is explicit and is limited to a failed record.
- Automatic conflict merge is absent.

## Receipts

Receipts preserve the operation/account/module/record identities, idempotency key, acknowledgement result and time, and optional cloud revision/checksum. They contain no credentials or tokens. Duplicate receipt identity is idempotent; conflicting identity fails.

## Conflicts

Conflict records preserve safe revision and identity details with `unresolved`, `resolved`, or `dismissed` status. Resolution changes only the conflict audit status; it does not merge or overwrite operational data.

## Retry Policy

Chosen defaults:

| Setting | Value |
| --- | --- |
| Maximum attempts | 5 |
| Base delay | 1,000 ms |
| Maximum delay | 60,000 ms |
| Jitter ratio | 20% |
| Backoff | Bounded exponential |

Classification:

- network, disconnected, unavailable, and timeout errors are retryable
- revision conflict becomes `conflict`
- authentication, membership, and permission denial become blocked/paused
- unrecognized non-transient errors become `failed`

The coordinator does not create an automatic timer in this foundation. A future approved runtime adapter must invoke processing deliberately and must respect `nextAttemptAt`; this prevents a hidden tight retry loop.

## Restart Recovery

- Interrupted `syncing` operations return to `pending` with an explicit recovery code and retry timestamp.
- Receipt-backed interrupted operations are finalized locally without another transport call.
- A persisted acknowledged operation with a receipt is removed from the active outbox during coordinator start.
- Local caches and outbox history are not wiped on logout or account switch.

## Explicitly Deferred

- operational repository enqueue integration
- Firebase path adapters under `accounts/{accountId}`
- initial pull and realtime listeners
- local-data migration
- canonical cloud cutover
- conflict-resolution UI or automatic merge
