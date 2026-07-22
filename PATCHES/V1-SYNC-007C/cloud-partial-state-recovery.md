# Cloud Partial-State Recovery

## Issue Recovery

When the Invoice issue transition is acknowledged and a later `sale_deduction` fails transiently:

- the Invoice acknowledgement remains durable
- the Invoice member is not dispatched again
- the StockMovement member remains pending/retryable
- reconstructed outbox state resumes only the movement
- deterministic movement identity prevents duplicate inventory effect

## Cancellation Recovery

When cancellation is acknowledged and a later `sale_return` fails:

- cancellation acknowledgement remains durable
- cancellation is not replayed
- the remaining movement resumes after restart
- deterministic movement identity prevents a second return effect

## Conflict Boundary

If the Invoice member conflicts, no later commercial StockMovement becomes dispatchable. Same movement identity with a different immutable payload remains a conflict under the StockMovement append-only contract.

## Visibility Limitation

Cloud visibility is not atomic across the Invoice and all StockMovements. TEST may temporarily expose an issued or cancelled Invoice before every movement acknowledgement completes. The durable group makes this state recoverable and ordered, but does not hide partial publication.

Full cutover remains blocked pending trusted validation, commercial publication/visibility strategy, multi-device numbering, and canonical concurrent return allocation.
