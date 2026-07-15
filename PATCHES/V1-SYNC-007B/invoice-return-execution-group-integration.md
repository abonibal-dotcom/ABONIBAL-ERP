# InvoiceReturn Execution Group Integration

## Application Boundary

`ExecuteInvoiceReturnDurableCommandService.execute()` is the single execution
boundary. Recorded-return creation remains unchanged and outside this group.

## Pre-Validation

Before capture, the service verifies:

- authenticated matching account;
- `recorded` lifecycle state or exact persisted-group recovery;
- issued source Invoice relationship;
- stable unique return-line and source Invoice-line identities;
- positive quantities within locally remaining returnable quantities;
- valid immutable original `sale_deduction` references;
- no divergent deterministic return movement;
- complete StockMovement and final InvoiceReturn validation.

The cumulative check excludes the return currently being executed and includes
other recorded/executed returns, preserving current local partial/multiple
return behavior.

## Group Shape

- Group ID: `invoice-return-execute-{returnId}`.
- Sequence 1: checksummed InvoiceReturn `recorded -> executed` operation.
- Sequences 2..N+1:
  `invoice-return-{returnId}-{returnLineId}` append operations.
- Required member count: `1 + InvoiceReturn.lines.length`.
- Initial durable capture: one `enqueueBatchAtomic()` invocation.

## Retry And Recovery

- Exact retry is idempotent.
- Divergent recorded state during recovery conflicts.
- Multi-line partial movement recovery creates each movement once.
- Cache-before-marker retry detects the existing deterministic record.
- Same movement ID with different payload conflicts.
- Duplicate return-execution `sale_return` count: `0`.

Local over-return validation passes. Concurrent stale-device allocation is not
solved: two offline devices can still independently validate against stale
state. Full multi-device execution remains blocked pending a trusted canonical
transaction and publication boundary.
