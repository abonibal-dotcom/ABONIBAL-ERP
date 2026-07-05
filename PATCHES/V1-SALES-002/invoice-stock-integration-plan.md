# V1-SALES-002 Invoice Stock Integration Plan

## Classification

INF.

This file defines how future invoice behavior should integrate with the accepted Inventory ledger without implementing stock deduction in this mission.

## Accepted Inventory Boundary

Inventory accepted state:

- Authoritative stock source: `stockMovements:{accountId}`.
- Current stock is computed from non-voided movement `quantityDelta` values.
- Product quantity is not authoritative.
- Stock availability gate exists through V1-INV-007.
- Future invoice stock deduction must create stock movements rather than mutate Products.

## Invoice Confirmation Dependency

Before an invoice can become `issued`, future source work must:

1. Aggregate requested invoice line quantities by `productId`.
2. Call the Inventory availability gate for the authenticated account.
3. Reject issue if any line is invalid, unavailable, missing, soft-deleted, or insufficient.
4. Avoid writing stock movements if availability fails.
5. Avoid changing invoice status to `issued` if availability fails.

## Future Stock Deduction Behavior

When a later mission is approved to implement issue-time stock deduction, each stock-affecting invoice line should create a movement:

```text
type: "sale_deduction"
referenceType: "invoice"
referenceId: invoice.id
productId: invoiceLine.productId
quantityDelta: negative line quantity
accountId: AuthState.session.account.id
createdBy: AuthState.session.user.id
```

The created movement id should be stored on the invoice line as `stockMovementId`.

## Product Safety

Future invoice flow must not:

- Update `Product.quantity`.
- Rewrite Product records.
- Delete Products.
- Read from or write to global `localStorage.products`.
- Treat Product quantity as authoritative stock.

Product records are references and snapshot sources only.

## Cancellation And Reversal

If an issued invoice already created `sale_deduction` movements, cancellation must not delete or mutate those original movements.

Future cancellation behavior should create reversal/return movements or an approved equivalent audit-preserving stock event. The exact return/cancellation stock policy should be a separate owner-approved mission because it affects inventory and accounting correctness.

## Missing Product References

Historical invoices must remain readable if a referenced Product is later soft-deleted or missing. That is why invoice lines must store Product snapshot fields.

New invoice lines should select active Products only.

## Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| Issuing invoices before availability check | HIGH | Keep invoice issue flow blocked until it depends on V1-INV-007 gate. |
| Direct Product.quantity deduction | HIGH | Use only `stockMovements:{accountId}` for stock changes. |
| Stock movement creation before invoice persistence is stable | HIGH | Implement invoice persistence baseline before issue/deduction flow. |
| Cancellation without reversal movements | HIGH | Defer cancellation stock reversal to an explicit mission. |
| Cross-account stock deduction | HIGH | Resolve account from Auth session and use account-scoped repository methods only. |

## Recommended Sequence

1. V1-SALES-003 - Account-Scoped Invoice Persistence Baseline.
2. V1-SALES-004 - Invoice Draft Create / Update Baseline.
3. V1-SALES-005 - Invoice Issue Availability Verification.
4. V1-SALES-006 - Invoice Stock Deduction Runtime Verification.
5. V1-SALES-007 - Invoice Cancellation / Reversal Planning or Baseline.

Invoice UI should wait until persistence and lifecycle behavior are accepted.

