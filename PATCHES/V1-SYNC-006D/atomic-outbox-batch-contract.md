# V1-SYNC-006D - Atomic Outbox Batch Contract

## API

`PersistentOutboxRepository.enqueueBatchAtomic(accountId, groupInput)` is the
only persistence entry point for grouped operations. Calling the existing
single `enqueue()` with group metadata is rejected.

## Persistence Sequence

The API performs these steps before persistence:

1. Normalize and validate group identity, type, size, and ordered members.
2. Construct every pending `SyncOperation` in memory.
3. Verify one explicit logical account boundary.
4. Read the current account outbox.
5. Resolve exact retry or detect identity collision.
6. Merge the complete group into the outbox array in memory.
7. Call `Driver.write()` once for `syncOutbox:{accountId}`.

No member cache applier runs inside this repository method.

## Failure Boundary

Validation and collision failures occur before `Driver.write()`. A failed
single-key outbox write leaves zero newly durable group members under the
accepted synchronous `LocalStorageDriver` contract. The grouped capture
service therefore runs no local cache mutation when batch persistence fails.

This is one durable local-key replacement. It is not described as an ACID
transaction across the outbox and operational cache keys.

## Retry And Conflict

An exact retry must match:

- group ID/type/checksum;
- complete member count and operation IDs;
- member operation and idempotency identities;
- modules, record IDs, mutation types, and revisions;
- write-set checksums and canonical payload fingerprints;
- ordering and required flags.

An exact match returns the existing group and performs no write. The same
group, operation, or idempotency identity with different content raises an
explicit `SyncOperationGroupConflictError`. It never overwrites, silently
merges, or duplicates a member.

## Cleanup

An acknowledged grouped member remains in the outbox while any sibling is not
acknowledged. After every member is acknowledged, one outbox write removes the
whole group. Ungrouped acknowledged cleanup retains its prior behavior.

## Proof

The synthetic validation suite proves:

- two-member successful persistence: one `Driver.write()`;
- batch validation failure: zero writes;
- injected `Driver.write()` failure: zero partial members;
- exact retry: zero additional writes and zero duplicate members;
- conflicting retry: explicit conflict and no outbox change.
