# Invoice Lifecycle Cloud Contract
Human document numbers remain in the current `INV-YYYYMMDD-NNNN` format. They are not RTDB keys, record IDs, operation IDs, or group IDs. Global multi-device uniqueness is not solved in this mission and remains a cutover blocker.
## Lifecycle

The synchronized lifecycle is strictly forward-only:

`draft -> issued -> cancelled`

Each accepted update increments `revision` by exactly one and verifies both the expected revision and canonical expected-record checksum.

## Draft Create

Draft create uses create-if-absent with stable Invoice ID, revision `0`, stable line IDs, logical account ID, and a canonical envelope checksum. An identical retry is acknowledged. The same ID with different data is a conflict.

## Draft Update

Draft update requires an expected draft at revision `N` and produces draft revision `N + 1`. Stale revision, changed pre-state, or an issued/cancelled target is rejected. There is no blind overwrite fallback.

## Draft Tombstone

Draft deletion is represented by a revisioned tombstone. The cloud Invoice node remains present and retains identity, data, lifecycle, operation identity, revision, checksum, and tombstone audit metadata. Physical cloud deletion is denied.

## Issue

Issue requires an existing cloud draft and applies `draft -> issued` by transactional CAS. Exact retry is acknowledged when operation identity and intended envelope match. Missing cloud history or a different issued payload is a conflict.

After issue, commercial identity, customer snapshot, line snapshots, quantities, prices, totals, and document identity are immutable. Stock movements are separate ordered group members and are never created by Invoice pull.

## Cancellation

Cancellation requires an existing issued Invoice and applies `issued -> cancelled` by transactional CAS. Core issued commercial data remains unchanged; only approved cancellation and lifecycle audit metadata advances. Exact retry is acknowledged and divergent retry conflicts.

Cancelled Invoices cannot return to issued or draft and cannot be physically deleted.

## Numbering Boundary

Human document numbers remain in the current `INV-YYYYMMDD-NNNN` format. They are not RTDB keys, record IDs, operation IDs, or group IDs. Global multi-device uniqueness is not solved in this mission and remains a cutover blocker.
