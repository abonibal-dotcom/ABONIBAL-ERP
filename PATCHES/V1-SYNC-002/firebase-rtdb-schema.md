# V1-SYNC-002 Firebase RTDB Schema

## Recommended Root Structure

```text
accountMembers/
  {accountId}/
    {firebaseUid}: true

accounts/
  {accountId}/
    _meta/
      schemaVersion
    _sync/
      operations/{operationId}
      migrations/{migrationId}
    products/{recordId}
    stockMovements/{recordId}
    invoices/{recordId}
    invoiceReturns/{recordId}
    customers/{recordId}
    suppliers/{recordId}
    payments/{recordId}
    purchases/{recordId}
    expenses/{recordId}
    safes/{recordId}
    cashMovements/{recordId}
    ledgerAccounts/{recordId}
    ledgerEntries/{recordId}
```

The proposed `accounts/{accountId}` root is accepted as the recommended
architecture. A `users/{firebaseUid}` operational root is rejected because UID
is an Auth identity, not the ERP account boundary.

## Record Shape

The proposed flat envelope is sound in intent, but a nested generic envelope is
recommended to keep cloud concurrency metadata out of domain types:

```json
{
  "data": {
    "id": "stable-record-id",
    "accountId": "explicit-account-id",
    "createdAt": "ISO-8601",
    "createdBy": "application-user-id",
    "updatedAt": "ISO-8601",
    "updatedBy": "application-user-id",
    "domainFields": "module-specific"
  },
  "meta": {
    "schemaVersion": 1,
    "revision": 1,
    "serverUpdatedAt": 0,
    "lastOperationId": "stable-operation-id",
    "tombstone": false
  }
}
```

`serverUpdatedAt` is populated with the Firebase server timestamp and is used
for synchronization ordering only. Domain audit timestamps remain in `data`
and must not be replaced by client receipt time.

## Domain Data Versus Sync Metadata

### Canonical domain data

Stored inside `data`:

- existing entity ID and explicit `accountId`;
- domain lifecycle status;
- business fields and snapshots;
- references between records;
- `createdAt`, `createdBy`, `updatedAt`, and `updatedBy`;
- issue/post/cancel/void/reversal fields already defined by the domain;
- existing domain idempotency fields such as CashMovement and JournalEntry
  `idempotencyKey`.

### Canonical cloud metadata

Stored inside `meta`:

- `schemaVersion`;
- monotonically increasing `revision`;
- server synchronization timestamp;
- last acknowledged operation ID;
- tombstone metadata when an approved draft deletion must propagate.

The repository adapter maps `CloudRecordEnvelope<T>` to the existing domain
entity. Business services must not use `revision` as a business field.

### Local-only sync metadata

Never stored inside an operational cloud record:

- outbox status and attempt count;
- last local attempt time or local error text;
- pending payload copies;
- local cache dirty flags;
- local retry schedule;
- UI conflict state;
- browser/device identifiers;
- local file paths.

## Prohibited Firebase Payload

- Auth tokens, passwords, API credentials, or `.env` values.
- Raw SDK configuration.
- Mutable derived inventory, Safe, or Ledger balances.
- Large binary data or base64 product images.
- Browser-only diagnostics.
- Cross-account record copies.
- Production data in TEST.

Product `images` may contain validated URL/reference metadata only. Oversized or
embedded image data must block migration pending a separate image-storage plan.

## ID Rules

1. The RTDB key is the existing stable `recordId`.
2. `data.id` must equal the path record ID.
3. `data.accountId` must equal the path account ID.
4. IDs must not contain RTDB-forbidden key characters: `.`, `#`, `$`, `[`,
   `]`, or `/`.
5. Migration preserves IDs exactly; an incompatible ID is a blocking conflict,
   not a reason to generate a replacement.
6. New financial effects should use deterministic idempotency identities even
   when their record ID remains a generated stable ID.

## Date And Type Normalization

RTDB stores JSON. All domain dates must use canonical UTC ISO-8601 strings in
the cloud. Repository adapters rehydrate types required by local domain models.
This is especially important for Product, whose current domain type uses
JavaScript `Date` values while local JSON persistence serializes them.

Non-finite numbers, `undefined`, functions, class instances, and unsupported
metadata values are rejected before enqueueing.

## Revision Contract

- Create: record absent, revision becomes `1`.
- Mutable update: supplied `expectedRevision` must match current revision; new
  revision is current plus one.
- Idempotent retry: matching operation receipt returns the prior acknowledgement
  and does not increment revision again.
- Conflict: expected revision mismatch writes nothing.
- Immutable record: arbitrary update is rejected regardless of revision.
- Approved lifecycle transition: guarded by expected status, expected revision,
  and an operation-specific idempotency key.

Client timestamps are never used as a last-write-wins tie breaker.

## Module Schema Notes

| Module | Aggregate shape | Required reference/index candidates |
| --- | --- | --- |
| Products | One Product per record; image references only | `meta/serverUpdatedAt`, `data/sku`, `data/barcode` |
| Stock movements | One movement per record | `data/productId`, `data/referenceId`, `meta/serverUpdatedAt` |
| Invoices | Header and lines remain one aggregate | `data/status`, `data/customerId`, `meta/serverUpdatedAt` |
| Invoice returns | Return and lines remain one aggregate | `data/invoiceId`, `data/status`, `meta/serverUpdatedAt` |
| Customers | One Customer per record | `data/status`, `meta/serverUpdatedAt` |
| Suppliers | One Supplier per record | `data/status`, `meta/serverUpdatedAt` |
| Payments | One Payment per record | `data/status`, `data/partyId`, `meta/serverUpdatedAt` |
| Purchases | Header and lines remain one aggregate | `data/status`, `data/supplierId`, `meta/serverUpdatedAt` |
| Expenses | One Expense per record | `data/status`, `meta/serverUpdatedAt` |
| Safes | Safe metadata only; no balance field | `data/status`, `meta/serverUpdatedAt` |
| Cash movements | One movement per record | `data/safeId`, `data/idempotencyKey`, `data/transferId` |
| Ledger accounts | One account per record; no balance field | `data/code`, `data/status`, `data/parentAccountId` |
| Ledger entries | Entry and lines remain one aggregate | `data/status`, `data/idempotencyKey`, `data/sourceId` |

Indexes must be added only for approved query paths and measured listener needs.
Do not place a listener at `accounts/{accountId}` or at the database root.

## Sync Operation Receipts

`accounts/{accountId}/_sync/operations/{operationId}` stores a bounded,
non-secret acknowledgement:

```json
{
  "operationId": "stable-operation-id",
  "idempotencyKey": "stable-domain-key",
  "state": "acknowledged",
  "recordRefs": ["module/record-id"],
  "resultRevisions": {"module/record-id": 2},
  "serverAppliedAt": 0,
  "checksum": "canonical-write-set-sha256"
}
```

It must not contain full business payloads. Receipt retention and pruning need
an approved bounded policy; pruning a receipt must never permit a duplicate
financial effect.

## Migration State

`accounts/{accountId}/_sync/migrations/{migrationId}` may store only migration
status, schema version, counts, hashes, phase, and acknowledgement times. It
must not duplicate the exported business dataset.

## Tombstone Policy

1. Existing domain safe-delete/status fields remain canonical.
2. Posted, issued, executed, voided, cancelled, and reversed financial records
   are never deleted.
3. RTDB `remove()` is forbidden during initial migration and V1 sync rollout.
4. An approved draft-only deletion, including invoice draft deletion, must use
   a guarded envelope tombstone with incremented revision so another device
   cannot resurrect the draft.
5. Tombstoned data remains available for rollback/audit until a separate owner
   retention decision.

## Payload And Listener Limits

- Collections use objects keyed by record ID, never JSON arrays.
- Initial pull is per module and may be paged by server update metadata if
  collection size requires it.
- Realtime subscriptions are per module, using child-level events where
  practical.
- Large aggregate lines must be size-checked before write.
- No whole-account listener or whole-array rewrite is allowed.
- Product media must use references rather than embedded binary content.

## Schema Versioning

The account has a declared schema version and every envelope records the
version it satisfies. Readers may accept only explicitly supported versions.
An unknown newer version pauses that module and reports a blocking schema error;
it must not be coerced into the current model.
