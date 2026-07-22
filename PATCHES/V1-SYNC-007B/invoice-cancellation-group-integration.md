# Invoice Cancellation Group Integration

## Application Boundary

`CancelInvoiceDurableCommandService.execute()` owns cancellation orchestration.
The page supplies the Invoice ID and reason only. Active mode never calls the
business cancellation command from a recovery applier.

## Pre-Validation

The service requires an authenticated matching account, an issued Invoice, a
stable cancellation command, a non-empty reason, stable line identities, and
the original immutable `sale_deduction` for every line. Each original movement
must match account, Product, Invoice, type, and quantity.

Any pre-existing deterministic cancellation movement without its group is a
conflict. Original deductions are never edited, voided, or removed.

## Group Shape

- Group ID: `invoice-cancel-{invoiceId}`.
- Sequence 1: checksummed Invoice `issued -> cancelled` operation.
- Sequences 2..N+1:
  `invoice-cancel-return-{invoiceId}-{invoiceLineId}` append operations.
- Required member count: `1 + Invoice.lines.length`.
- Initial durable capture: one `enqueueBatchAtomic()` invocation.

## Retry And Recovery

- Exact retry with the same reason is idempotent.
- A changed reason under the same command identity conflicts.
- Commercial-member failure stops all later members.
- Partial movement application recovers only missing members.
- Cache-before-marker recovery creates no second movement.
- Same movement ID with divergent payload conflicts.
- Original `sale_deduction` snapshots remain byte-equivalent in validation.
- Duplicate cancellation `sale_return` count: `0`.

The cancellation group is cloud-blocked until Invoice transport exists.
