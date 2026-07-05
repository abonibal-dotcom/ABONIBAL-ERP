# Return Lifecycle Risk Assessment

## Mission

`V1-SALES-010 - Invoice Returns / Partial Returns Design Plan`

## Duplicate / Over-Return Protection

Future implementation must protect against:

1. Returning the same invoice line twice beyond its remaining quantity.
2. Returning more quantity than issued.
3. Duplicate submit/retry creating duplicate return records.
4. Return after cancellation.
5. Return against a missing live Product.
6. Return against a soft-deleted live Product.
7. Malformed old invoice lines missing `stockMovementId`.
8. Cross-account invoice or return visibility.

## Required Validation Rules

1. Authenticated account context is required.
2. Invoice must exist in `invoices:{accountId}`.
3. Invoice status must be `issued` or `partially_returned`.
4. Invoice status must not be `draft`, `cancelled`, or `returned`.
5. Each return line must reference an existing invoice line.
6. Each invoice line must have an original `stockMovementId`.
7. Original stock movement must be `sale_deduction`.
8. Original stock movement must belong to the same accountId.
9. Return quantity must be positive and within remaining returnable quantity.
10. Existing return records and movement metadata must be scanned before write.

## Invoice Lifecycle Policy

Recommended future invoice statuses:

- `draft`
- `issued`
- `partially_returned`
- `returned`
- `cancelled`

Policy:

- Draft invoices cannot be returned.
- Issued invoices can be partially returned.
- Fully returned invoices should become `returned`.
- Partially returned invoices should remain returnable only for remaining
  quantities.
- Cancelled invoices cannot be returned.
- Invoices with posted returns cannot be cancelled in V1.

## Audit Requirements

Each posted return must preserve:

- original invoice id;
- original invoice number;
- original invoice line id;
- original `sale_deduction` movement id;
- return record id;
- return line id;
- return `sale_return` movement id;
- returned quantity;
- return reason;
- optional return notes;
- createdBy;
- createdAt;
- accountId.

## Risk Matrix

| Risk | Level | Notes |
| --- | --- | --- |
| Returns without separate return records | HIGH | Stock may be restored, but business audit, reason, and line history are lost. |
| Returns without over-return protection | HIGH | Can inflate stock and break invoice correctness. |
| Returns that directly edit `Product.quantity` | HIGH | Violates accepted ledger authority and destroys auditability. |
| Returns on cancelled invoices | HIGH | Causes duplicate stock restoration because cancellation already uses `sale_return`. |
| Duplicate return submit | HIGH | Can create duplicate `sale_return` movements. |
| Missing audit link to original invoice line | HIGH | Makes later audit and refund reconciliation unreliable. |
| Cross-account return visibility | HIGH | Violates approved `accountId` data boundary. |
| Data-loss risk | MEDIUM | Append-only records are safe if validation and idempotency are enforced. |
| Implementation complexity | MEDIUM | Requires a new persistence boundary, validator, service, and lifecycle summary logic. |

## Proceed / Defer Decision

Return persistence may proceed next after Architect / Owner review.

Return UI must remain deferred until return persistence, validation, stock
movement creation, and lifecycle status rules pass runtime verification.

Returns beyond sales invoice returns, such as exchanges or refund accounting,
remain deferred.
