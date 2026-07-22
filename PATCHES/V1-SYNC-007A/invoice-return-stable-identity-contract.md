# V1-SYNC-007A InvoiceReturn Stable Identity Contract

## Current Baseline

- InvoiceReturn lifecycle is `recorded -> executed`.
- Return records already use a UUID separate from the Return number.
- Return line IDs and sale return StockMovement IDs are currently random.
- A movement left by partial execution blocks retry rather than being safely adopted.

## Approved Alignment

- A new Return UUID is assigned before Return line construction.
- New Return line identity is deterministic from the Return ID and source Invoice line ID:
  - `return-line-{returnId}-{invoiceLineId}`.
- Execution command identity is `invoice-return-execute-{returnId}`.
- Each executed line has one deterministic movement:
  - movement ID: `invoice-return-{returnId}-{returnLineId}`;
  - idempotency key: `invoice-return-execute-{returnId}-line-{returnLineId}`.
- The Return ID, Return number, source Invoice references, snapshots, quantities, totals, reason, and creation audit are immutable after execution.

## Retry and Conflict Contract

- Exact execution retry returns the existing executed Return after validating its command and deterministic movements.
- A movement left by partial local execution is adopted only when its entire intended payload matches.
- The same movement identity with a different payload is a conflict.
- Executed Return records cannot be edited or hard-deleted.

## Return Quantity Boundary

Partial and multiple Returns remain supported. Local cumulative validation remains unchanged and rejects a Return that exceeds remaining local quantity. Exact retry does not count the same Return twice.

Concurrent stale devices can still each validate against incomplete state. Trusted canonical cumulative allocation is explicitly deferred to the commercial transaction mission before multi-device cutover.
