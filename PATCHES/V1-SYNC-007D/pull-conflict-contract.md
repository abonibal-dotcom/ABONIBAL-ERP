# InvoiceReturn Pull and Conflict Contract

InvoiceReturn pull is an explicitly active, authenticated, account-scoped cache operation. The adapter is registered but is not started automatically.

## Validation

Every pulled record validates:

- logical account and RTDB path identity
- stable Return ID
- schema version
- lifecycle metadata
- revision
- canonical record checksum
- stable commercial snapshots

## State Handling

- Same revision and same state: no-op/duplicate.
- Older cloud revision: ignored.
- Newer valid recorded revision without pending local work: cache apply.
- Pending incompatible local operation: conflict evidence is preserved.
- Existing local record without a verified cloud baseline and different cloud data: conflict.
- Synthetic trusted executed snapshot: cache/state apply only when valid.
- Different immutable executed snapshot: conflict; no silent overwrite.

## Side-Effect Boundary

Pull never calls the InvoiceReturn execution command, durable commercial orchestration, Invoice service, StockMovement command path, Payment, Cash, Safe, Ledger, or Product quantity mutation.

- Business command replay: 0
- Pull-created StockMovements: 0
- Pull-created Payments/Cash/Ledger records: 0
- Product.quantity mutation: 0
