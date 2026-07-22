# Canonical Return Allocation Contract

## Invariant

For every immutable issued Invoice line:

`sum(accepted return allocations) <= issued Invoice line quantity`

The invariant is account-scoped, line-scoped, and decided only by the trusted executor against canonical RTDB control state.

## Sold Quantity Source

The sold quantity source is the immutable issued Invoice line snapshot. It is not Product data, Product.quantity, a current catalog value, or a client-computed inventory balance.

Before trusted Return execution can be enabled, Invoice issue publication must establish or verify a trusted allocation baseline containing the issued Invoice checksum, Invoice revision, line IDs, Product snapshot references, and sold quantities. A missing or mismatched baseline blocks execution; it is never synthesized from an unverified client Return request.

## Recommended Canonical Representation

Use immutable allocation events plus a transactionally maintained aggregate under:

`accounts/{accountId}/returnAllocations/{invoiceId}`

Conceptual shape:

```text
invoiceId
invoiceRevision
invoiceChecksum
invoiceStatus: issued
lines/{invoiceLineId}
  soldQuantity
  allocatedReturnedQuantity
  allocationRevision
  executions/{commandId}
    returnId
    returnLineId
    quantity
    requestChecksum
    state: reserved | committed
    reservedAt
    committedAt?
```

The event map is the audit source. `allocatedReturnedQuantity` is a transactionally maintained accelerator that includes every accepted reservation, including one awaiting final publication. It must equal the sum of trusted execution event quantities. No client may write this subtree.

## Why Events Plus Aggregate

- Immutable events preserve which command consumed each quantity.
- The aggregate makes transaction validation bounded and efficient.
- Exact retry can find the existing command event.
- A conflicting retry can compare the stored request checksum.
- A crash after reservation retains durable evidence and prevents over-allocation.
- Reconciliation can recompute the aggregate from events and stop on mismatch.

Aggregate-only storage is rejected because it loses command-level audit and retry evidence. Event-only storage is possible but makes every transaction scan grow indefinitely.

## Multi-Line Transaction Boundary

An InvoiceReturn belongs to one Invoice and may contain multiple lines. The transaction root should be:

`accounts/{accountId}/returnAllocations/{invoiceId}`

One RTDB transaction validates and reserves all Return lines together. The transaction callback must be pure and retry-safe because RTDB may invoke it multiple times.

The transaction performs:

1. require a matching immutable Invoice allocation baseline;
2. require every Return line to map to a distinct Invoice line;
3. require stable Return and Return-line identities;
4. require positive finite quantities;
5. reject if any line would exceed its sold quantity;
6. reject a command ID with a different request checksum;
7. return the existing reservation for an exact retry;
8. otherwise append one reserved execution event per line and increment every affected aggregate in the same transaction.

If any line fails, the transaction returns no new state. Partial multi-line execution is forbidden.

## Command Identity

The execution command identity remains:

`invoice-return-execute-{returnId}`

Contract:

- first valid request: reserve or reject canonically;
- exact retry while processing: return/reuse the same processing state;
- exact retry after acceptance: return the original accepted receipt;
- same command ID with a different request checksum: conflict;
- concurrent duplicate requests: one logical allocation only;
- client timeout: retry by the same identity, never generate another command ID.

## Receipt and Request Paths

Recommended trusted paths:

- request/audit input: `accounts/{accountId}/commercialCommandRequests/{commandId}`
- result: `accounts/{accountId}/commercialCommandReceipts/{commandId}`

The callable function may create the canonical request record itself after validating the caller; ordinary clients should not write result fields.

Recommended receipt states:

- `processing`: trusted execution has durable identity and may have reserved resources;
- `accepted`: final committed publication exists;
- `rejected`: command failed business validation without publication;
- `conflict`: the command identity or expected state diverged.

`pending` remains primarily a client/outbox state. If persisted in cloud, only the trusted runtime may create or advance it.

Receipt metadata:

- command ID and command type;
- logical account ID and target Return ID;
- caller provider identity fingerprint or trusted audit reference, not exposed raw in general UI;
- request checksum and expected Return revision;
- result checksum and accepted Return revision;
- allocation reservation identity;
- assigned document number and business date when applicable;
- publication/commit ID;
- created, processing, completed timestamps;
- safe rejection/conflict code.

Clients may read receipts for their own account. Only the trusted runtime writes receipt results.

## Transaction Scope Assessment

### Account-root transaction

A transaction on `accounts/{accountId}` could read and mutate every required path, but it would transfer a growing account snapshot, serialize unrelated work, and increase contention. It is rejected for normal command execution.

### Allocation-subtree transaction

A transaction on the per-Invoice allocation subtree is compact and serializes exactly the Return allocation invariant. It is recommended.

### Number allocation transaction

Canonical numbering uses a separate compact account/day/type counter transaction. The durable command receipt binds the resulting number to the command ID, so a crash between resource reservations is recoverable without duplicate allocation.

### Publication after transaction

A transaction cannot safely combine a compact allocation read with arbitrary sibling writes outside its subtree. Therefore final commercial publication is a later trusted atomic multi-location update. The reservation and processing receipt close the crash window: accepted quantity remains reserved and exact retry resumes publication.

## Rejection and Recovery

Business rejection before reservation creates no allocation, number, executed Return, or StockMovement.

If the executor crashes after allocation reservation:

- reservation remains visible to later allocation transactions;
- receipt remains `processing`;
- retry validates the same checksum and adopts the reservation;
- no quantity is reserved twice;
- final publication resumes idempotently.

Automatic release of a reservation is not allowed merely because time elapsed. Release or repair requires a separately audited trusted recovery operation to avoid reopening quantity while an accepted publication may still complete.

## Current Boundary

- Local cumulative validation: PASS for one current cache.
- Concurrent stale-device validation: NOT SOLVED by current runtime.
- Trusted allocation transaction: NOT IMPLEMENTED.
- Full multi-device Return execution: BLOCKED.
