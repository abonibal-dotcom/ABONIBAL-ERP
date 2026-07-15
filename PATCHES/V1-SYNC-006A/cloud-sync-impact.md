# V1-SYNC-006A Cloud Sync Impact

## Future Path And Envelope

The approved future operational path remains:

```text
accounts/{accountId}/stockMovements/{movementId}
```

Firebase UID is membership identity only. The path always uses the explicit
logical account ID resolved by the authenticated application session.

Each cloud record should use the shared envelope:

```text
data
meta.schemaVersion
meta.revision
meta.serverUpdatedAt
meta.lastOperationId
meta.tombstone
meta.writeSetChecksum
```

For immutable StockMovements, initial `meta.revision` is `1` and never advances.
`meta.tombstone` is always false. The domain payload carries the existing stable
movement ID and its V1 or V2 semantics.

## Create-Only Rule Policy

| Operation | Policy |
| --- | --- |
| CREATE absent movement | Allowed only for an authorized account member and valid schema |
| CREATE identical existing movement | Transport returns idempotent MATCH; no write |
| CREATE same ID with different payload | Conflict; no overwrite |
| UPDATE existing movement | Denied |
| DELETE existing movement | Denied |
| Reversal | Separate CREATE at its deterministic movement ID |

Legacy records are also immutable after migration. Their old mutable history is
preserved as a snapshot; the cloud does not continue the mutable void behavior.

## RTDB Rules Boundary

Future TEST rules can and should validate:

- authenticated membership under `accountMembers/{accountId}/{auth.uid}`;
- path `accountId` equals `data.accountId`;
- path `movementId` equals `data.id`;
- required envelope and schema-version shape;
- initial immutable revision metadata;
- finite JSON numeric quantity and required string identities;
- supported semantics-version and movement-type shape;
- V2 reversal fields are present, non-empty, and not self-referencing;
- existing path is absent for CREATE;
- UPDATE and DELETE are denied;
- foreign-account and unauthenticated access is denied;
- clients cannot mutate membership.

RTDB rules should not be claimed to prove all domain invariants. The application
and migration validator must prove:

- original movement exists;
- original and reversal share account and product;
- original is eligible and is not a reversal;
- legacy void state is not reversed again;
- exactly one reversal exists;
- reversal effect exactly negates the original;
- reason and actor are valid;
- deterministic ID, idempotency key, payload, and checksum agree;
- commercial movements use their owning domain lifecycle.

## Durable Capture Impact

After V1-SYNC-006B aligns the domain, the restarted V1-SYNC-006 may compose:

```text
InventoryService
  -> sync-aware StockMovement repository
  -> DurableMutationCapture
  -> StockMovement cache-only applier
  -> raw local StockMovement repository
```

For active mode only:

1. build a stable append operation;
2. persist the complete account-scoped outbox item;
3. append through the cache-only applier;
4. verify canonical identity/checksum;
5. durably mark local apply complete;
6. permit cloud processing.

The applier stores records only. It must never call `addMovement()`,
`voidMovement()`, invoice issue/cancel/return, opening-stock creation, purchase
posting, or another business command.

## Idempotent Cloud Transport

The deterministic reversal ID provides one cloud target for concurrent devices.
The semantic idempotency key and write-set checksum provide operation identity.

- absent target and no prior receipt: create record and receipt atomically;
- matching target/receipt/checksum: acknowledge MATCH;
- same identity with different checksum: conflict;
- existing target without matching trusted migration/operation evidence:
  investigate and do not guess;
- receipt is persisted locally before acknowledged outbox removal.

Create-if-absent must use a transaction or equivalent guarded operation. A
blind multi-path overwrite of an existing movement is forbidden.

## Pull Boundary

Pull validates account, movement ID, schema, semantics, checksum, and reversal
shape before applying through the raw cache repository.

Pull may:

- append an absent authoritative record;
- acknowledge an identical local record;
- report a divergent same-ID conflict;
- rebuild derived quantity and a reversal lookup from cached records.

Pull may not:

- replay a business command;
- create a second StockMovement for the received movement;
- mutate the original record;
- update `Product.quantity`;
- perform a historical scan or upload;
- overwrite unresolved local work.

## Legacy Cloud Representation

V1-SYNC-009 should preserve a legacy movement's exact domain snapshot. The
envelope may identify legacy semantics in migration metadata without rewriting
the domain record. Both legacy normal and legacy voided records become immutable
after their create-only upload.

V2 records carry explicit `ledgerSemanticsVersion: 2`. Reversal validation uses
typed top-level fields, not metadata-only conventions.

## Safety And Deployment Impact

V1-SYNC-006A authorizes no rule edit and no Firebase deployment. The eventual
rule evolution must be emulator-tested and may target `abonibal-erp-test` only
with explicit config and project flags. `abonibal-production` remains frozen,
and `wakalat-alfares` remains out of scope.

Default SyncMode remains `disabled`. There is no listener, startup scan,
migration, backfill, upload, cutover, or operational RTDB write in this mission.
