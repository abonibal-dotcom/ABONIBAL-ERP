# V1-INV-002 Invoice Stock Dependency Plan

## Mission

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

## Invoice Dependency Decision

Invoice implementation remains blocked for stock-affecting behavior until Inventory persistence is implemented and verified.

Invoice work may not directly edit:

```text
Product.quantity
```

Invoice stock deduction must go through the Inventory movement ledger.

## Future Invoice Creation Policy

When an invoice is created and finalized, future invoice code should create `sale_deduction` movements:

```text
referenceType = "invoice"
referenceId = invoice.id
quantityDelta = -soldQuantity
accountId = AuthSession.account.id
productId = invoiceLine.productId
createdBy = AuthSession.user.id
```

Rules:

- Product id must reference `Product.id`.
- `accountId` must be explicit.
- Firebase UID/provider user id must not be used as `accountId`.
- The invoice must not mutate Product quantity directly.
- The movement must be auditable and tied to the invoice id.

## Future Invoice Cancellation / Return Policy

Invoice cancellation, return, or correction should create reversal movements rather than deleting the original deduction.

Examples:

```text
sale_return
quantityDelta = returnedQuantity
referenceType = "invoice_return"
referenceId = return.id
```

or:

```text
correction
quantityDelta = correctedQuantityDelta
referenceType = "correction"
referenceId = correction.id
```

Rules:

- Original deduction movement remains stored.
- Reversal/correction movements explain why stock changed.
- Current quantity uses the full non-voided movement set.

## Negative Stock Policy For Invoices

Default V1 policy:

```text
Do not allow invoice sale deduction when computed current quantity would go below zero.
```

Reason:

- ROADMAP locks V1 requirement to prevent selling unavailable stock.
- Negative stock allowance would require explicit owner/architect decision and separate verification.

## Product Safe Delete And Invoice History

If a Product is safely deleted:

- Existing invoice lines should remain referenceable.
- Existing stock movements should remain referenceable.
- Deleted Product should not appear in normal active Product selection.
- Historical invoice/stock views should show a safe historical Product reference.

## Required Preconditions Before Invoice Stock Deduction

Before invoice stock deduction can begin:

1. Stock movement contracts exist.
2. Account-scoped movement persistence exists.
3. Movement validation exists.
4. Current quantity computation is verified.
5. Negative stock policy is approved and enforced.
6. Voiding/reversal behavior is verified.
7. Product safe-delete reference behavior is verified.
8. Runtime verification proves no Product quantity direct mutation.

## Recommended Sequencing

1. `V1-INV-003 - Stock Movement Ledger Persistence Baseline`
2. `V1-INV-004 - Stock Movement Append / Current Quantity Runtime Verification`
3. `V1-INV-005 - Manual Opening Balance / Adjustment Flow`
4. Invoice foundation planning
5. Invoice stock deduction integration

Invoice implementation may begin only after the relevant Inventory gates are accepted.
