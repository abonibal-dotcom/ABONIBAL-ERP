# Return Inventory Integration Plan

## Mission

`V1-SALES-010 - Invoice Returns / Partial Returns Design Plan`

## Inventory Policy

Invoice returns must restore stock through the accepted Stock Movement Ledger.

Required movement:

```text
type: sale_return
referenceType: invoice_return
quantityDelta: positive returned quantity
```

`Product.quantity` must not be updated.

## Movement Reference Policy

For a customer invoice return, future implementation should create one
`sale_return` movement per returned invoice line.

Recommended movement fields:

```ts
{
    productId: returnLine.productId,
    type: "sale_return",
    quantityDelta: returnLine.returnQuantity,
    reason: `Invoice return ${returnNumber}: ${reason}`,
    referenceType: "invoice_return",
    referenceId: invoiceReturn.id,
    metadata: {
        invoiceId,
        invoiceLineId,
        invoiceNumber,
        returnId: invoiceReturn.id,
        returnLineId: returnLine.id,
        originalStockMovementId,
        returnReason: reason
    }
}
```

The existing cancellation flow also uses `sale_return` and `invoice_return`.
Customer returns must distinguish themselves through return records and movement
metadata (`returnId`, `returnLineId`, `originalStockMovementId`).

## Quantity Policy

For each invoice line:

```text
remainingReturnableQuantity =
    issued line quantity
    - sum(posted non-voided return quantities for the invoice line)
```

The requested return quantity must be:

- numeric;
- finite;
- greater than zero;
- less than or equal to `remainingReturnableQuantity`.

## Original Deduction Link

Each return line must validate:

1. The invoice line has `stockMovementId`.
2. The original movement exists in `stockMovements:{accountId}`.
3. The original movement is `sale_deduction`.
4. The original movement belongs to the same accountId.
5. The original movement references the same invoice.
6. The original movement productId matches the invoice line productId.
7. The original movement quantityDelta is negative.

## Missing Product Policy

Returns are based on historical issued invoice lines.

- A missing live Product record must not crash return validation.
- A soft-deleted live Product must not block return of a valid historical
  invoice line.
- Product records must not be recreated or mutated by return processing.

## LocalStorage Safety Sequence

Because localStorage is not transactional, future implementation should use a
strict validate-then-write sequence:

1. Load invoice, existing returns, and stock movements for the authenticated
   account.
2. Validate invoice status and account boundary.
3. Validate return quantities against remaining returnable quantities.
4. Validate every original `stockMovementId`.
5. Check duplicate return records and duplicate return movements.
6. Prepare return record and `sale_return` movement records in memory.
7. Append all `sale_return` movements.
8. Persist the return record.
9. Update invoice lifecycle summary/status only after movement and return record
   creation succeeds.

If validation fails, no records are written.

If movement creation fails, the return record and invoice status must not be
written.

If a retry happens after a partial local failure, the service must detect any
existing return movement metadata and complete or reject safely without creating
duplicates.

## Ledger Correctness

Current quantity remains:

```text
sum(non-voided stockMovements:{accountId}.quantityDelta)
```

Returns increase current quantity only through positive `sale_return`
movements.

## Deferred Inventory Behavior

The following are deferred:

- return voiding;
- return cancellation;
- negative return corrections;
- Product exchange flow;
- payment/refund ledger integration.
