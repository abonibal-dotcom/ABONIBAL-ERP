# Draft Tombstone Contract

## Purpose

Local draft deletion remains compatible with the current UI while cloud synchronization preserves an auditable non-destructive record.

## Active-Mode Flow

1. Validate that the Invoice is a draft.
2. Build a stable tombstone operation from the current draft revision.
3. Persist the durable operation before local mutation.
4. Remove or hide the draft through the restricted raw cache applier.
5. Mark local application complete.
6. Apply the cloud tombstone through revision/checksum CAS.

## Cloud Representation

The Invoice node is retained with:

- stable Invoice ID and logical account ID
- draft lifecycle status
- incremented revision
- operation and idempotency identities
- record and write-set checksums
- `tombstone: true`
- `tombstonedAt` and `tombstonedBy`

Physical delete is not used by the transport and is denied by TEST rules.

## Conflict Policy

- A stale tombstone conflicts.
- A missing cloud baseline conflicts and does not create history implicitly.
- A pending incompatible local update is preserved as conflict evidence.
- Pulling a valid tombstone updates cache/state only and does not replay deletion commands or create inventory effects.
- Issued and cancelled records cannot be tombstoned.

No migration, backfill, historical scan, or local data wipe occurs.
