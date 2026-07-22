# V1-SYNC-007B Commercial Durable Group Contract

## Scope

This contract covers three future-facing commercial commands only:

- Invoice issue: `draft -> issued` plus one `sale_deduction` per Invoice line.
- Invoice cancellation: `issued -> cancelled` plus one `sale_return` per Invoice line.
- InvoiceReturn execution: `recorded -> executed` plus one `sale_return` per return line.

Draft create/edit/delete and recorded-return creation remain outside these groups.

## Complete Intent Boundary

When `SyncMode` is `active`, each command performs this order:

1. Resolve the authenticated logical `accountId`.
2. Validate the complete command without mutation.
3. Build the final commercial lifecycle record.
4. Build every deterministic StockMovement record.
5. Build checksummed SyncOperations and deterministic group membership.
6. Call `DurableMutationGroupCapture.capture()`, which persists the complete
   group through one `enqueueBatchAtomic()` call.
7. Apply members in sequence through cache-only appliers.
8. Mark local application durably and derive group completion.

Outbox persistence failure therefore leaves zero commercial transitions and
zero StockMovements. No command applies a record manually after capture.

## Deterministic Identities

| Command | Group ID | Commercial member | Movement members |
| --- | --- | --- | --- |
| Issue | `invoice-issue-{invoiceId}` | Invoice transition, sequence 1 | `sale-{invoiceId}-{invoiceLineId}`, sequences 2..N+1 |
| Cancel | `invoice-cancel-{invoiceId}` | Invoice transition, sequence 1 | `invoice-cancel-return-{invoiceId}-{invoiceLineId}`, sequences 2..N+1 |
| Execute return | `invoice-return-execute-{returnId}` | InvoiceReturn transition, sequence 1 | `invoice-return-{returnId}-{returnLineId}`, sequences 2..N+1 |

Human document numbers, array indexes, display order, and retry-time random IDs
do not participate in these identities.

## Local Application Boundary

- Invoice and InvoiceReturn appliers compare expected and intended JSON state.
- Matching intended state is idempotent success.
- Matching expected state is eligible for one restricted repository transition.
- Any other state is a conflict.
- StockMovement uses the existing raw append-only applier.
- No applier invokes issue, cancel, return execution, Payment, Cash, or Ledger
  commands.

## Disabled Mode

The default mode remains `disabled`. The same UI command boundaries delegate to
the accepted local lifecycle services with zero outbox, Firebase calls, or
listeners. Durable outbox crash recovery is not claimed for disabled local-only
mode.

## Explicit Exclusions

- No Invoice or InvoiceReturn Firebase transport.
- No Firebase rules or deployment.
- No migration, backfill, historical scan, or automatic upload.
- No trusted cross-device return allocation.
- No multi-device document-number allocation.
- No Customer balance, Payment, Cash, Safe, or Ledger coupling.
- `Product.quantity` remains non-authoritative.
