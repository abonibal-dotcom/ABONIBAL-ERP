# Invoice Returns / Partial Returns Design Plan

## Mission

`V1-SALES-010 - Invoice Returns / Partial Returns Design Plan`

## Classification

INF.

This is a design-only mission. No source files were changed and no return
behavior was implemented.

## Accepted Baseline

`v1-sales-009-invoice-lifecycle-regression-baseline`

## Current State

- Invoice draft create/update is accepted.
- Invoice issue creates `sale_deduction` movements.
- Issued invoice audit view is accepted.
- Issued invoice cancellation creates additive `sale_return` movements.
- Duplicate issue and duplicate cancellation are safe.
- Product records remain unchanged.
- `Product.quantity` remains non-authoritative.
- Returns and partial returns are not implemented.

## V1 Return Scope

V1 should support returns only for issued invoices.

### V1-Now

- Full invoice return.
- Partial line return.
- Multiple partial returns for the same invoice line, bounded by remaining
  returnable quantity.
- Required return reason.
- Optional return notes.
- Full audit trail from invoice line to return record to stock movement.

### Deferred

- Returns for draft invoices.
- Returns for cancelled invoices.
- Product exchange workflow.
- Refund/payment settlement workflow.
- Return voiding or cancellation.
- Return UI until return persistence and rules are implemented and verified.

## Eligibility Policy

| Invoice state | Return policy |
| --- | --- |
| `draft` | Not returnable. Drafts have not deducted stock. |
| `issued` | Returnable if at least one line has remaining returnable quantity. |
| `partially_returned` | Returnable for remaining quantities only. |
| `returned` | Not returnable; all issued quantities are returned. |
| `cancelled` | Not returnable; cancellation already reverses the issued stock deduction. |

## Recommended Invoice Status Policy

Future implementation should extend invoice lifecycle status with:

- `partially_returned`
- `returned`

Existing statuses remain:

- `draft`
- `issued`
- `cancelled`

Status rules:

1. `issued -> partially_returned` when at least one line has a posted return
   and at least one issued quantity remains unreturned.
2. `issued -> returned` when all issued line quantities are returned.
3. `partially_returned -> returned` when remaining quantities become fully
   returned.
4. `cancelled` is terminal for return purposes.
5. `returned` is terminal for return purposes unless a future return-voiding
   policy is explicitly approved.
6. Cancellation should be blocked after any posted return exists to avoid
   double reversal of stock.

## Return Record Model

Recommended record:

```ts
interface InvoiceReturn {
    id: string;
    accountId: string;
    invoiceId: string;
    returnNumber: string;
    status: "posted";
    reason: string;
    notes?: string;
    lines: InvoiceReturnLine[];
    total: number;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    voidedAt?: string;
    voidedBy?: string;
    voidReason?: string;
}
```

`voidedAt`, `voidedBy`, and `voidReason` are reserved for future return
voiding. V1 implementation should not expose return voiding unless a separate
approved mission designs it.

## Return Line Model

Recommended line record:

```ts
interface InvoiceReturnLine {
    id: string;
    invoiceLineId: string;
    productId: string;
    productNameSnapshot: string;
    returnQuantity: number;
    unitPriceSnapshot: number;
    lineTotal: number;
    originalStockMovementId: string;
    stockMovementId: string;
}
```

Rules:

1. `invoiceLineId` references the original invoice line.
2. `productId` and snapshot fields come from the historical invoice line, not
   live Product data.
3. `originalStockMovementId` references the original `sale_deduction`.
4. `stockMovementId` references the return `sale_return`.
5. `returnQuantity` must be positive.
6. `returnQuantity` must not exceed remaining returnable quantity.

## Full Return Policy

A full invoice return is represented as a posted return record containing every
remaining returnable invoice line quantity.

It is not a separate lifecycle path. It is the same return mechanism with all
remaining quantities selected.

## Partial Return Policy

A partial return is represented as a posted return record containing one or more
lines with quantities less than or equal to each line's remaining returnable
quantity.

Multiple partial returns are allowed for the same invoice line only while the
sum of posted return quantities stays less than or equal to the original issued
quantity.

## Cancellation Interaction

Cancellation and returns must not overlap.

- An issued invoice with no posted returns may be cancelled through the accepted
  cancellation flow.
- An invoice with any posted return must not be cancelled in V1.
- A cancelled invoice must not accept returns.

This avoids double stock restoration because cancellation and returns both use
positive `sale_return` movements.

## Product Safety

- Product records are never mutated by returns.
- `Product.quantity` is never updated by returns.
- Historical invoice Product snapshots remain the source for return display and
  audit.
- Live Product data is only used for optional read-only labels or validation
  messages and must not block a return for a valid historical invoice line.

## Recommended Next Mission

`V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline`

Return UI should not proceed until return persistence, validation, duplicate
protection, and stock movement creation are implemented and verified.
