# Commercial Group Capability Transition

## Before V1-SYNC-007C

- StockMovement transport: present
- Invoice transport: absent
- InvoiceReturn transport: absent
- Invoice issue group: cloud blocked
- Invoice cancellation group: cloud blocked
- InvoiceReturn execution group: cloud blocked

The group capability gate prevented a StockMovement member from leaking independently.

## After Invoice Registration

The Container registers Invoice `create` and `update` capability and `InvoiceSyncOperationTransport`.

- Invoice issue group: eligible after all local members are applied
- Invoice cancellation group: eligible after all local members are applied
- InvoiceReturn execution group: still blocked

StockMovement transport alone still cannot release an InvoiceReturn movement because the required InvoiceReturn member has no registered capability.

## Ordering

Issue:

1. Invoice `draft -> issued`
2. One `sale_deduction` StockMovement per line

Cancellation:

1. Invoice `issued -> cancelled`
2. One `sale_return` StockMovement per line

The outbox only exposes the next member after the preceding member is acknowledged. An Invoice conflict blocks all later commercial StockMovement members.

## Remaining Boundary

This is ordered and recoverable cloud processing, not atomic all-or-nothing cloud publication. InvoiceReturn groups remain blocked until a separate approved transport/rules mission.
