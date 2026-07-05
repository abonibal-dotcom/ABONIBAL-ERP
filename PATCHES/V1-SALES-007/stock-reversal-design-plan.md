# V1-SALES-007 - Stock Reversal Design Plan

## Classification

INF.

This document defines the V1 stock reversal policy for cancelling issued
invoices. It does not create reversal movements.

## Current Repository Support

- Stock movement storage boundary exists as `stockMovements:{accountId}`.
- `sale_deduction` is the accepted issue-time movement type.
- `sale_return` already exists as a stock movement type.
- `invoice_return` already exists as a stock movement reference type.
- `StockMovement.metadata` exists and can carry audit details.
- There is no first-class `reversesMovementId` field yet.
- There is no Inventory reversal behavior for invoice cancellation yet.

## Movement Type Evaluation

| Candidate | Assessment | Recommendation |
| --- | --- | --- |
| `sale_return` | Existing movement type. Represents stock returning from a sale-related event. Works with positive `quantityDelta` and ledger summation. | Recommended for V1 invoice cancellation reversal. |
| `correction` | Existing type, but too generic. Better for inventory corrections, not business cancellation of a sale. | Do not use for normal invoice cancellation. |
| `void` | Existing type and non-destructive void behavior exists, but voiding the original deduction would obscure the original issued-invoice event. | Do not use for invoice cancellation. |
| `invoice_cancellation_reversal` | Precise name but not currently supported. Adds schema and validation scope beyond the minimal V1 need. | Defer unless future audit requirements need a new type. |

## Official V1 Recommendation

Use one additive `sale_return` stock movement per cancelled invoice line that
originally created a `sale_deduction`.

Recommended fields:

```text
type: "sale_return"
quantityDelta: positive original line quantity
referenceType: "invoice_return"
referenceId: invoice.id
productId: original invoice line productId
accountId: invoice.accountId
createdBy: authenticated user id
reason: cancellation reason
metadata.reversesMovementId: original sale_deduction movement id
metadata.reversalOfInvoiceId: invoice.id
metadata.reversalOfInvoiceLineId: invoice line id
metadata.originalMovementType: "sale_deduction"
metadata.cancellationReason: cancellation reason
```

## Reversal Traceability Policy

Each reversal movement must trace to:

- the cancelled invoice;
- the invoice line;
- the original `sale_deduction` movement;
- the same Product id;
- the same `accountId`;
- the user who performed the cancellation.

V1-SALES-008 may add an optional `reversalStockMovementId` field to invoice
lines if the UI needs direct line-to-reversal display. The source of truth
should still be the movement ledger plus reversal metadata, not Product
quantity.

## Missing Original Movement Policy

If an issued invoice line has no original `stockMovementId`, or the referenced
movement is missing or invalid, cancellation must fail safely before marking
the invoice cancelled.

No partial stock reversal should be hidden from the user. The failure should
leave the invoice issued unless existing reversal movements can be proven and
the operation is completing an interrupted cancellation safely.

## Duplicate Safety Policy

Before appending any reversal movement, the implementation must check for an
existing reversal by:

- `metadata.reversesMovementId`;
- `referenceType = "invoice_return"` and `referenceId = invoice.id`;
- optional future invoice line `reversalStockMovementId`.

If a reversal already exists for an original deduction, the flow must not append
another reversal for the same original movement.

## Product And Inventory Safety

- Product records remain references and snapshot sources only.
- `Product.quantity` must not be updated.
- Current stock remains computed from non-voided `stockMovements:{accountId}`.
- Original `sale_deduction` movements remain preserved.
- Reversal uses additive positive movements so the ledger remains auditable.
