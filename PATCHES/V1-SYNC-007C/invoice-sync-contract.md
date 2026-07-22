# V1-SYNC-007C Invoice Sync Contract

## Scope

V1-SYNC-007C connects Invoice records to the shared synchronization engine without adding InvoiceReturn synchronization, historical migration, or cutover behavior.

The cloud record path is:

`accounts/{accountId}/invoices/{invoiceId}`

The logical `accountId` is resolved from the authenticated application account context. Firebase UID remains membership identity only and is never used as the operational account key.

## Integration Pattern

- `InvoiceSyncRepository` is the sync-aware bridge used by `InvoiceService`.
- `InvoiceRepository` remains the raw account-scoped local cache repository.
- `InvoiceLocalMutationApplier` performs restricted cache/state-only application.
- `InvoiceSyncOperationTransport` owns Invoice RTDB create and lifecycle CAS operations.
- `InvoiceSyncAdapter` validates and applies pulled envelopes without replaying commands.
- `InvoiceSyncStateRepository` records the last accepted cloud revision/checksum and tombstone state.
- `SyncCloudCapabilityRegistry` registers Invoice `create` and `update` capability.

The bridge never calls Firebase directly. Raw cache application never re-enters the sync-aware repository, so durable operations are not captured recursively.

## Supported Operations

- `CREATE_DRAFT`
- `UPDATE_DRAFT`
- `TOMBSTONE_DRAFT`
- `ISSUE_INVOICE`
- `CANCEL_INVOICE`

No generic unrestricted Invoice update exists in the cloud transport.

## Default Disabled Boundary

`SyncMode` remains `disabled` by default. Disabled mode preserves current local Invoice behavior and performs:

- outbox captures: 0
- operational RTDB reads/writes: 0
- operational listeners: 0
- startup scans: 0
- existing Invoice uploads: 0

## Existing Data

No existing local Invoice is scanned, rewritten, enqueued, or uploaded. A transition against a local-only historical Invoice with no cloud baseline returns `MISSING_CLOUD_BASELINE` as a durable conflict. It is never converted silently into cloud create.

## Explicit Exclusions

- InvoiceReturn transport and rules
- document-number allocation across devices
- concurrent return-allocation validation
- migration or backfill
- Payment, Cash, Safe, or Ledger coupling
- production deployment or production data access
