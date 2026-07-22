# Invoice Issue Group Integration

## Application Boundary

`IssueInvoiceDurableCommandService.execute()` is the single UI issue boundary.
It delegates to the accepted local `InvoiceService.markIssued()` only while
sync is disabled. Active mode builds and captures a complete durable group.

## Pre-Validation

Before outbox persistence, the service verifies:

- authenticated logical account context and account match;
- stable Invoice and command identity;
- current `draft` lifecycle state, except exact persisted-group recovery;
- stable unique line IDs and no prior movement references;
- no divergent deterministic movement ID already exists;
- complete StockMovement validation;
- current ledger-derived stock availability;
- final issued Invoice validation.

Invalid input produces zero outbox writes and zero local mutations.

## Group Shape

- Group ID: `invoice-issue-{invoiceId}`.
- Sequence 1: checksummed Invoice `draft -> issued` operation.
- Sequences 2..N+1: append operations for
  `sale-{invoiceId}-{invoiceLineId}`.
- Required member count: `1 + Invoice.lines.length`.
- Initial durable capture: one `enqueueBatchAtomic()` invocation.

The Invoice intended state contains the exact deterministic movement references
before the group is persisted.

## Retry And Recovery

- Exact retry resolves the same group and applies only missing members.
- Cache applied before its marker is recognized through inspect-before-apply.
- A changed draft after durable capture conflicts; it is not overwritten.
- Same movement ID with divergent payload conflicts before capture.
- Multi-line partial recovery applies remaining movements once.
- Duplicate `sale_deduction` count in validation: `0`.

No Invoice Firebase capability is registered, so the complete group remains
cloud-blocked even though StockMovement append transport exists.
