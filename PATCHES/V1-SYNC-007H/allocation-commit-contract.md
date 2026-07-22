# V1-SYNC-007H Allocation Commit Contract

## Purpose

The canonical Return allocation remains a separate Phase A transaction at:

`accounts/{accountId}/returnAllocations/{invoiceId}`

V1-SYNC-007H adds immutable commit evidence below:

`commits/{commandId}`

The reservation is never deleted or released. A commit moves each quantity from
the derived `reservedReturnedQuantity` aggregate to
`committedReturnedQuantity` while preserving the original reservation.

## Commit Preconditions

- The allocation aggregate and reservation already exist.
- The logical account, Invoice, Return, command, request checksum, reservation
  checksum, and deterministic publication identity all match.
- The reservation checksum is recomputed from immutable reservation fields.
- Aggregate evidence recomputes exactly from reservations and commits.
- `reserved + committed <= sold` for every Invoice line.

Missing or malformed state never creates a baseline. Exact retry returns the
existing commit without changing revision or quantities. A changed publication,
request, reservation, or payload under the same command identity conflicts.

## Atomicity and Recovery

The complete commit and both aggregate transitions are persisted by one RTDB
transaction on the allocation root. A failed transaction leaves the reservation
unchanged. A crash after Phase A is recoverable: Phase B can be retried from the
immutable commit evidence.

Reservations are not expired, released, deleted, or reassigned by this mission.
