# V1-SYNC-006D - Group Foundation Contract

## Scope

This foundation adds generic durable multi-record mutation groups to the
existing sync outbox. It does not connect a Product command, an opening
StockMovement, or any other operational flow to grouped capture.

The existing single-operation path remains valid and unchanged. Grouped
operations are accepted only through the atomic batch API.

## Representation

Each grouped `SyncOperation` carries immutable membership metadata:

- `groupId`
- `groupType`
- `groupSequence`, contiguous and one-based
- `groupSize`
- `requiredForLocalCompletion`
- `groupChecksum`, a canonical SHA-256 checksum

The checksum covers the logical account, group identity and type, ordered
operation identities, record identities, operation types, revisions,
write-set checksums, payload fingerprints, sequence values, and required
flags. Mutable local and cloud lifecycle states are excluded.

There is no separate group record or group persistence key. A complete group
is reconstructed and validated from operations stored under:

```text
syncOutbox:{accountId}
```

No `syncMutationGroups:{accountId}` store exists.

## Validation

The group builder rejects:

- an empty group;
- blank or key-unsafe group identity/type;
- a declared group size that differs from member count;
- missing, duplicate, non-positive, or non-contiguous sequence values;
- mixed or missing logical account IDs;
- duplicate operation IDs or idempotency keys;
- duplicate module/record identities inside one group;
- missing write-set checksums;
- no required local-completion member;
- preassigned member group metadata;
- missing cache-only appliers in `DurableMutationGroupCapture` preflight.

Stored groups are also revalidated for member count, shared metadata,
checksum, sequence, identity uniqueness, account consistency, and required
membership before reconciliation, cloud eligibility, or cleanup.

## Derived Lifecycle

No mutable group lifecycle record is persisted. Local state is derived with
this precedence:

```text
conflict > failed > pending > applied
```

- `conflict`: any member conflicts or group integrity is invalid.
- `failed`: no conflict and at least one member has failed local apply.
- `pending`: no conflict/failure and a required member is not applied.
- `applied`: every required member is locally applied.

Cloud state is independently derived as `blocked_local`, `pending`,
`partial`, `acknowledged`, `conflict`, or `failed`.

## Compatibility And Boundaries

- Existing ungrouped outbox entries normalize without group metadata.
- Ungrouped capture, reconciliation, and cloud eligibility remain unchanged.
- Every group API requires one explicit logical `accountId`.
- Firebase UID is not accepted or derived as `accountId`.
- No migration, backfill, historical scan, or existing outbox rewrite occurs.
- `SyncMode` remains `disabled` by default.
- No operational repository or Firebase resource is changed.
