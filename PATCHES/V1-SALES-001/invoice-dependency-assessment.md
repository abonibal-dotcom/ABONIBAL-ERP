# V1-SALES-001 Invoice Dependency Assessment

## Product Dependency

Product module accepted state:

- Product regression baseline PASS through ECS-011.
- Products use account-scoped storage via `products:{accountId}`.
- Product records include stable `id`.
- Active Products are returned through `ProductService.getAll()`.
- Soft-deleted Products remain stored but are hidden from active reads through `ProductService.find()` and `ProductService.getAll()`.
- Legacy `localStorage.products` is preserved and not automatically migrated.

Invoice implication:

- Invoice lines should reference `Product.id`.
- Invoice creation should select active Products only.
- Existing invoices must remain readable if a Product is later soft-deleted.
- Invoice lines should store snapshot fields such as Product name, SKU/barcode when useful, unit, and unit price at the time of invoice.
- Product snapshot data prevents historical invoices from changing when Product metadata changes later.

## Inventory Dependency

Inventory accepted state:

- Authoritative stock source is `stockMovements:{accountId}`.
- Current stock is computed from non-voided movement `quantityDelta` values.
- `Product.quantity` is not authoritative.
- Manual opening balance / adjustment flow is accepted.
- Inventory current stock/history view is accepted.
- Stock availability gate is accepted through V1-INV-007.

Invoice implication:

- Invoice confirmation must call the stock availability gate before creating stock-affecting records.
- If stock is insufficient, invoice confirmation must fail safely before any stock deduction.
- Invoice stock deduction must later create `sale_deduction` movements with `referenceType = "invoice"` and `referenceId = invoice.id`.
- Invoices must not directly edit `Product.quantity`.
- Invoice cancellation or return must use reversal/return movements rather than deleting original stock deductions.

## Recommended Invoice Model

Recommended V1 invoice header shape:

```text
id
accountId
invoiceNumber
customerId
customerSnapshot
status
lines
subtotal
discount
tax
total
createdAt
createdBy
updatedAt
updatedBy
issuedAt
cancelledAt
cancelledBy
cancelReason
```

Recommended V1 line shape:

```text
id
productId
productNameSnapshot
skuSnapshot
barcodeSnapshot
unitSnapshot
quantity
unitPrice
discount
tax
lineSubtotal
lineTotal
stockMovementId
```

`stockMovementId` should remain nullable until the future invoice stock deduction mission creates `sale_deduction` movements.

## Storage Boundary Recommendation

Options:

1. `invoices:{accountId}`
   - Recommended.
   - Matches Product and Inventory account-scoped boundaries.
   - Prevents cross-account visibility.
   - Allows future sync/account isolation policy.

2. Global `invoices`
   - Rejected.
   - Violates the V1 `accountId` data boundary.
   - Creates cross-account visibility risk.

3. Mixed legacy + scoped compatibility
   - Not needed now because no invoice legacy storage exists.
   - Should only be revisited if legacy invoice data appears in a future assessment.

Recommended boundary:

```text
invoices:{accountId}
```

## Invoice Lifecycle Recommendation

Recommended V1-now states:

```text
draft
issued
cancelled
```

V1-now meaning:

- `draft`: editable, no stock deduction yet.
- `issued`: finalized invoice, future stock deduction must have passed availability checks.
- `cancelled`: invoice is no longer active; future stock reversal policy must preserve audit trail.

Deferred states:

```text
returned
partially_returned
voided
```

Reason for deferral:

- Returns and partial returns need dedicated business rules, stock reversal policy, and financial implications.
- They should not block the first account-scoped invoice persistence baseline.

## Risk Assessment

| Risk | Level | Reason |
| --- | --- | --- |
| Implementing invoices before account-scoped invoice storage | HIGH | Would violate the V1 `accountId` boundary and risk cross-account data exposure. |
| Implementing invoices before stock availability gate | HIGH | Would violate the owner decision to prevent selling unavailable stock. |
| Direct Product.quantity deduction | HIGH | Would create a competing stock source and bypass the auditable ledger. |
| Invoice cancellation without reversal stock movements | HIGH | Would break auditability and make stock history unreliable. |
| Cross-account invoice visibility | HIGH | Invoice data is business-sensitive and must be account-scoped. |
| Data-loss risk | MEDIUM | No legacy invoice data exists now, but future persistence must avoid silent overwrite and migration. |
| Implementation complexity | MEDIUM | Invoice header/line/lifecycle/persistence are manageable, but stock deduction and returns require staged missions. |

## Recommended Next Mission

```text
V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan
```

Reason:

- No invoice module exists yet.
- No invoice legacy storage exists.
- Persistence, lifecycle, invoice number strategy, Product snapshot policy, and stock deduction dependency should be designed before implementation.
- Invoice UI implementation should wait until the storage and lifecycle plan is approved.

## Implementation Readiness Decision

- Invoice implementation may proceed now: no.
- Invoice persistence planning is required first: yes.
- Invoice UI should start next: no.
- Invoice stock deduction should start next: no.
