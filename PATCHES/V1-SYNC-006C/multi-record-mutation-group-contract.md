# V1-SYNC-006C - Durable Multi-Record Mutation Group Contract

## Scope

This document defines the architecture required to make one future business
command, `Create Product With Opening Stock`, durably recoverable as a unit.
It does not implement the group runtime, change Product or StockMovement
behavior, enable sync, migrate data, or deploy Firebase resources.

The contract extends V1-SYNC-004A. Existing single-record capture remains
unchanged. Only commands with more than one required record use grouped
capture.

## Required Invariant

Before the first member changes local cache, durable storage must contain the
complete, validated set of required member operations:

```text
validate command
  -> build every stable member
  -> persist the complete group in one local write boundary
  -> apply members through cache-only appliers
  -> durably mark each member locally applied
  -> derive group local completion
  -> return success
```

The required local guarantee is **durable recoverability**, not an untrue
claim of a multi-key ACID transaction. Member cache writes may occur in
sequence, but every intermediate state has enough durable intent for
deterministic reconciliation.

## Recommended Representation

Use the existing account-scoped persistent outbox as the sole operational
source for local and cloud operations. Add an atomic batch API:

```text
PersistentOutboxRepository.enqueueBatchAtomic(accountId, groupInput)
```

The API validates and constructs all members in memory, merges them into the
account outbox, and calls `Driver.write()` exactly once for:

```text
syncOutbox:{accountId}
```

`LocalStorageDriver.write()` maps that call to one synchronous
`localStorage.setItem()`. A quota or serialization failure must leave the
previous outbox value in place and run no cache applier. This is a single-key
application persistence boundary; it is not a transaction across the Product,
StockMovement, and outbox keys.

A separate `syncMutationGroups:{accountId}` store is not recommended for this
baseline. Persisting a group in one key and its cloud operations in another
would require a second materialization protocol and create avoidable
dual-source ambiguity. A command-intent journal is also unnecessary because
the final member payloads are already known before capture.

## Group Manifest

Each grouped `SyncOperation` carries the same immutable group manifest plus
its own sequence number. Repetition is deliberate: the outbox remains an
array of operations, old ungrouped records continue to normalize, and every
remaining member can validate group completeness.

Conceptual manifest:

```text
groupId
groupType: product_create_with_opening_stock
groupVersion: 1
accountId
memberOperationIds[]       ordered
memberWriteSetChecksums[]  ordered
groupChecksum
createdAt
```

Conceptual member fields:

```text
groupId
groupSequence
groupSize
groupChecksum
```

The group checksum covers the immutable group identity, type, version,
account, ordered operation IDs, ordered member checksums, and member count. It
does not cover mutable local/cloud processing states.

All members must have:

- the same explicit logical `accountId`;
- unique operation IDs and idempotency keys;
- contiguous sequence numbers starting at zero;
- a module-matching cache-only applier;
- complete safe payloads and checksums;
- the same exact manifest and checksum.

## Members

### Product Member

- module: `products`
- operation type: `create`
- revision: `1`
- record ID: the stable Product ID generated for the command
- payload: the complete Product cloud envelope accepted by V1-SYNC-005
- local applier: existing raw Product cache applier

### Opening StockMovement Member

- module: `stockMovements`
- operation type: `append`
- record ID: deterministic opening movement ID
- payload: the complete immutable StockMovement record/envelope
- local applier: future raw append-only StockMovement cache applier

The opening quantity is part of this member payload. Recovery must never infer
it from `Product.quantity`, from a Product reread, or by replaying
`InventoryService.addOpeningBalanceForNewProduct()`.

## Deterministic Identity

The application command creates and retains one stable Product ID before
capture. The recommended identities are:

```text
group idempotency key: product-create:{accountId}:{productId}
groupId: product-create-{safe productId}
opening movement ID: opening-{productId}
opening idempotency key: stockMovement:opening:{productId}
```

The implementation must use an RTDB/local-key-safe encoding if an accepted
Product ID can contain unsupported characters. Current Product IDs are UUIDs,
so the direct form is safe. The Product operation keeps the existing
V1-SYNC-005 deterministic operation/checksum construction. The StockMovement
operation must use its append checksum and stable opening identity.

An exact retry with the same group identity and identical members returns the
existing group. Reusing any group, operation, movement, or idempotency identity
with different payload data is a conflict.

## Minimal Lifecycle

Local group state is derived from member `localApplyState` values:

| Group state | Derived condition |
| --- | --- |
| `pending_local_apply` | complete manifest exists and at least one member is pending |
| `locally_applied` | every required member is applied |
| `conflict` | any member is conflict or group integrity diverges |
| `failed` | no conflict and at least one member is failed |

An additional persisted `applying` state is unnecessary. Member attempt
markers already make an interrupted apply observable.

Cloud group state is separate and derived from member outbox statuses plus
durable receipts:

| Cloud state | Derived condition |
| --- | --- |
| `blocked_local` | group is not locally applied |
| `pending` | group locally applied and no member acknowledged |
| `partial` | some but not all members have durable receipts |
| `acknowledged` | every member has a matching durable receipt |
| `conflict` | any cloud member conflicts |
| `failed` | no conflict and a member is terminally failed |

Grouped acknowledged operations remain in the outbox until all group members
have matching durable receipts. The coordinator then removes the whole group
in one account-outbox write. Single operations retain their current cleanup
behavior.

## Capture And Local Apply

1. Validate Product input and opening quantity.
2. Generate or receive the command's stable Product ID.
3. Build the complete Product record and validate it.
4. If quantity is positive, build and validate the deterministic opening
   StockMovement record.
5. Build every `SyncOperationInput` and the canonical group manifest.
6. Call `enqueueBatchAtomic()` once.
7. Resolve each member's cache-only applier in group sequence order.
8. Inspect, apply if absent/expected, verify, and mark each member applied.
9. Derive `locally_applied` only when all required members are applied.
10. Return caller success only after that condition is durable.

If batch persistence fails, neither Product nor StockMovement applier runs. If
an apply or marker fails, the complete group remains available for startup
reconciliation.

## Cloud Gate And Ordering

`PersistentOutboxRepository.getPending()` and `markSyncing()` must reject a
group member unless:

```text
all required group members have localApplyState === applied
```

V1-SYNC-006D and V1-SYNC-006E must additionally hold Product/opening-stock
groups from cloud processing until both module transports are configured.
Once V1-SYNC-006 supplies StockMovement transport, cloud member order is:

1. Product CREATE.
2. Opening StockMovement APPEND.

This ordering avoids a cloud movement referencing a Product that has never
been cloud-visible. It does not claim cloud atomicity; temporary Product-only
cloud state remains possible until the second member is acknowledged.

## Account And Security Boundary

- Every group and member uses one explicit logical account ID.
- Firebase UID is membership identity only and is never `accountId`.
- Group lookup, batch enqueue, reconciliation, processing, and cleanup are all
  account-scoped.
- Account A cannot capture, inspect, apply, process, or clean a group owned by
  account B.
- Logout/account switch stops group reconciliation before the next member and
  unsubscribes the old account exactly as V1-SYNC-004A requires.

## Conflict And Rollback Policy

Conflicts preserve evidence:

- no silent overwrite;
- no physical delete;
- no automatic Product safe-delete rollback;
- no alternate movement ID;
- no second inventory effect;
- mark the group conflict and expose a safe diagnostic.

For example, a matching Product plus a divergent movement under the expected
movement ID is a group conflict. The Product remains present and the missing
movement is not applied blindly.

## Zero Opening Quantity

The application service remains the single UI entry point, but quantity zero
uses the existing single Product CREATE operation. There is no second required
record, so a one-member group adds lifecycle and cleanup complexity without
closing another consistency gap.

## Unchanged Boundaries

- Product metadata edits remain V1-SYNC-005 single-record CAS updates.
- `StockMovement` remains inventory truth.
- `Product.quantity` remains non-authoritative.
- Existing Products and StockMovements are not scanned, grouped, rewritten,
  enqueued, uploaded, or repaired.
- No migration, backfill, cutover, listener startup, or deployment is implied.
