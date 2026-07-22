# Outbox Backward Compatibility

## Stored Operations

`cloudAction` is optional. Stored operations created before V1-SYNC-007DA do
not contain it and remain valid and readable without migration or rewriting.
No startup scan, historical enqueue, or backfill was introduced.

## Identity and Conflict Safety

For new operations, `cloudAction` participates in single-operation and grouped
outbox identity comparison. Reusing an operation ID or idempotency key with a
different action is therefore a conflict rather than an alias or overwrite.

## Group Checksums

The group checksum descriptor includes `cloudAction` only when the member
declares it.

- Legacy member without an action: descriptor shape and checksum are unchanged.
- Specific member with an action: action contributes to the canonical checksum.
- Changing an action changes group identity evidence and is rejected as a
  conflicting retry.

Existing outbox records and existing durable group checksums are not rewritten.

## Migration Result

- Existing outbox records rewritten: `0`
- Existing group checksums changed: `0`
- Existing operational records uploaded: `0`
- Migration/backfill: `NONE`
