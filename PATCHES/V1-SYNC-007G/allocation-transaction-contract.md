# V1-SYNC-007G Allocation Transaction Contract

## Trusted Request

`ReserveReturnAllocationRequest` contains schema version, logical account ID,
stable command identity, command type, Return ID, Invoice ID, expected Return
revision/checksum, canonical request checksum, and all requested lines.

- Command ID: `invoice-return-execute-{returnId}`
- Command type: `invoiceReturn.execute`
- Return number and Invoice number are not identities.
- Duplicate `returnLineId` and duplicate `invoiceLineId` are rejected.

The server recomputes the request checksum over a canonical, line-ID-sorted
request before any canonical reads or allocation write.

## Canonical Preflight

The internal service reads with Firebase Admin SDK:

- `accounts/{accountId}/invoices/{invoiceId}`
- `accounts/{accountId}/invoiceReturns/{returnId}`

The Invoice must exist, match the path and logical account, be `issued`, contain
stable unique line IDs, and have finite positive line quantities. Draft and
cancelled Invoices are rejected.

The Return must exist, match the path/account/Invoice link, be `recorded`, match
the expected revision and record checksum, and exactly match every requested
Return line identity, Invoice-line link, and quantity. Missing records produce
`MISSING_CLOUD_BASELINE`; no implicit baseline is created.

## Atomic Reservation

One Admin RTDB transaction runs on the per-Invoice allocation subtree. Within
the callback it validates all existing evidence, detects exact/conflicting
command identity, checks every line capacity, inserts the complete immutable
reservation, recomputes all reserved aggregates, and increments the aggregate
revision once.

No line is written until every requested line passes. The result is therefore
all accepted or all rejected. No transaction runs at the whole-account root.

## Result Contract

The service returns one typed outcome:

- `reserved`: a new processing reservation was committed.
- `exactMatch`: the identical reservation already exists; no aggregate changed.
- `rejected`: invalid request/baseline/lifecycle/capacity rejection.
- `conflict`: canonical, request identity, or allocation-state divergence.

`RETURN_ALLOCATION_EXCEEDED` is the stable capacity rejection code. A matching
command/checksum/payload is idempotent. The same command with a different
checksum or immutable payload returns `ALLOCATION_REQUEST_CONFLICT` and never
overwrites the first reservation.

## Quantity Policy

The existing domain has no separate decimal precision contract. This mission
therefore keeps exact finite JavaScript number behavior and introduces no new
commercial rounding. Quantities must be finite and greater than zero. Capacity
uses a strict comparison; floating-point drift may conservatively reject a
boundary value but cannot authorize an amount above the sold quantity.
