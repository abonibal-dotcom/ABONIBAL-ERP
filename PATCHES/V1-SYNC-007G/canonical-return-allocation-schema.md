# V1-SYNC-007G Canonical Return Allocation Schema

## Scope

V1-SYNC-007G adds an internal trusted reservation aggregate at:

`accounts/{accountId}/returnAllocations/{invoiceId}`

The root is logical-account scoped and Invoice scoped. Firebase Auth UID is not
part of the operational path and is never used as `accountId`.

## Schema Version 1

```text
returnAllocations/{invoiceId}
  schemaVersion: 1
  accountId
  invoiceId
  revision
  lines/{invoiceLineId}
    invoiceLineId
    soldQuantity
    reservedReturnedQuantity
    committedReturnedQuantity
  reservations/{commandId}
    schemaVersion: 1
    accountId
    invoiceId
    returnId
    commandId
    commandType: invoiceReturn.execute
    requestChecksum
    sourceReturnRevision
    sourceReturnChecksum
    status: processing
    allocations/{returnLineId}
      returnLineId
      invoiceLineId
      quantity
    createdAt
    updatedAt
```

The aggregate `revision` starts at `1` and increments once per new reservation.
An exact retry neither adds a reservation nor increments the revision.

## Immutable Evidence

Reservation identity, source Return revision/checksum, line identities, and
quantities are immutable after insertion. V1-SYNC-007G implements only the
`processing` state. Commit, release, rejection compensation, publication, and
automatic expiry are intentionally absent.

`soldQuantity` is seeded only from the immutable line quantity of a canonical
issued Invoice. `Product.quantity`, client totals, current Product master data,
and caller-supplied sold quantities are not accepted as authority.

## Aggregate Integrity

Every transaction validates the entire existing subtree before use:

- Root schema, account, Invoice identity, and revision are valid.
- Aggregate line identities exactly match the canonical issued Invoice.
- Every stored sold quantity still matches the immutable Invoice snapshot.
- Reserved and committed values are finite, non-negative, and do not exceed sold.
- Stored processing reservations are structurally valid and account/Invoice scoped.
- Every reservation allocation points to a known Invoice line.
- Recomputed processing reservation totals equal stored reserved aggregates.

Malformed or divergent state produces `ALLOCATION_STATE_CONFLICT`; it is never
repaired or overwritten automatically.
