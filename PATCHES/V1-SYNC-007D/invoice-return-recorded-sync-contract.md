# InvoiceReturn Recorded-State Sync Contract

## Scope

V1-SYNC-007D synchronizes only the mutable `recorded` state of InvoiceReturn records. The cloud record path is:

`accounts/{accountId}/invoiceReturns/{returnId}`

The logical `accountId` remains independent from Firebase Auth UID. Return IDs are stable domain identities; human return numbers are neither RTDB keys nor operation identities.

## Exact Routes

- Create recorded: `invoiceReturns:create:createRecorded`
- Update recorded: `invoiceReturns:update:updateRecorded`
- Execute: `invoiceReturns:update:execute` remains intentionally unsupported in cloud routing.

No generic InvoiceReturn create/update transport is registered.

## Recorded Create

When SyncMode is active, create first captures one durable `createRecorded` operation and then applies the record through the raw local repository. Cloud create is create-if-absent at revision zero. An identical existing record is an idempotent match; the same ID with different data is a conflict.

When SyncMode is disabled, current local behavior remains unchanged and no outbox or Firebase activity occurs.

## Recorded Update

Recorded updates require the expected revision, preserve stable Return and line identities, increment revision exactly once, and use cloud CAS. A stale revision conflicts. A missing cloud record returns `MISSING_CLOUD_BASELINE`; update never becomes an implicit create.

`updateRecorded` cannot transition a record to `executed` and cannot modify an already executed local or cloud record.

## Envelope

The envelope contains explicit logical account identity, stable Return identity, data, schema version, revision, canonical checksums, operation identity, idempotency identity, lifecycle metadata, and stable Return line IDs. Tombstone is fixed to `false`.

## Existing Data Safety

- Existing InvoiceReturn scan: 0
- Existing InvoiceReturn auto-upload: 0
- Historical enqueue: 0
- ID or document-number rewrite: 0
- Migration/backfill: NONE
- Physical cloud delete: NO
