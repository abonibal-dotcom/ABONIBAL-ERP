# V1-SALES-002 Closure Report

## Classification

INF.

## Branch

`v1/sales-002-account-scoped-invoice-persistence-design-plan`

## Baseline Tag

`v1-sales-001-invoice-foundation-baseline`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PATCHES/V1-SALES-001/invoice-foundation-baseline.md`
- `PATCHES/V1-SALES-001/invoice-dependency-assessment.md`
- `PATCHES/V1-SALES-001/verification.md`
- `PATCHES/V1-SALES-001/closure-report.md`

## Source Files Inspected

- Sales / Invoice files: none found.
- `src/router/routes.ts`
- `src/core/Container.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Files Changed

- `PATCHES/V1-SALES-002/account-scoped-invoice-persistence-design-plan.md`
- `PATCHES/V1-SALES-002/invoice-lifecycle-plan.md`
- `PATCHES/V1-SALES-002/invoice-numbering-plan.md`
- `PATCHES/V1-SALES-002/invoice-stock-integration-plan.md`
- `PATCHES/V1-SALES-002/closure-report.md`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`

## Recommended Invoice Storage Boundary

```text
invoices:{accountId}
```

The `accountId` must come from the authenticated V1 account boundary, `AuthState.session.account.id`, and must match `AuthState.session.user.accountId`.

Global `invoices`, Firebase UID/provider user id scoped keys, and default account fallback are rejected.

## Invoice Record Shape Summary

Header fields:

```text
id
accountId
invoiceNumber
status
customerId
customerSnapshot
lines
subtotal
discount
tax
total
notes
createdAt
createdBy
updatedAt
updatedBy
issuedAt
issuedBy
cancelledAt
cancelledBy
cancelReason
```

## Invoice Line Shape Summary

Line fields:

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

## Lifecycle Policy

V1-now states:

```text
draft
issued
cancelled
```

- Draft: editable, persisted, no stock deduction.
- Issued: finalized, must pass future availability gate before stock deduction.
- Cancelled: non-destructive, remains stored for auditability.

Deferred states:

```text
returned
partially_returned
voided
```

## Numbering Policy

Recommended:

```text
INV-{YYYYMMDD}-{accountLocalSequence}
```

The future Invoice service should generate the number, validate uniqueness within `invoices:{accountId}`, and never overwrite an existing invoice.

## Product Dependency

- Future invoice lines should reference `Product.id`.
- New invoice lines should select active Products only.
- Snapshot fields should preserve historical invoice readability.
- Product records must not be mutated by invoice persistence.
- `Product.quantity` must not be authoritative.

## Inventory Dependency

- Invoice issue must call the accepted Inventory availability gate before stock-affecting writes.
- Future deduction must create `sale_deduction` movements with `referenceType = "invoice"` and `referenceId = invoice.id`.
- Invoice persistence baseline should not create stock movements yet.
- Cancellation/reversal stock rules require a separate future mission.

## Risk Assessment

| Risk | Level | Result |
| --- | --- | --- |
| Global invoice storage | HIGH | Rejected. |
| Firebase UID/provider user id as accountId | HIGH | Rejected. |
| Default account fallback | HIGH | Rejected. |
| UI before persistence baseline | HIGH | Rejected as next step. |
| Issue before availability check | HIGH | Blocked until future issue mission. |
| Direct Product.quantity mutation | HIGH | Rejected. |
| Cancellation without stock reversal policy | HIGH | Deferred to separate mission. |
| Invoice number collision | MEDIUM | Mitigated by account-scoped sequence and collision check. |
| Future sync collision | MEDIUM | Noted for future sync/server allocator. |

## Recommended Next Mission

`V1-SALES-003 - Account-Scoped Invoice Persistence Baseline`

## Invoice Persistence May Proceed Next

Yes, after Architect / Owner approval.

## Invoice UI May Proceed Next

No.

## TypeScript Result

PASS.

## Build Result

PASS.

## Runtime Verification

Not required for this INF design mission. No runtime data mutation was performed.

## No Source Files Changed

Confirmed.

## No Product Data Mutation

Confirmed. No runtime mutation was performed.

## No Inventory Mutation

Confirmed. No runtime mutation was performed.

## `.env` Untracked

Confirmed.

## Commit Hash

To be assigned by the V1-SALES-002 commit.

## Tag Name

`v1-sales-002-account-scoped-invoice-persistence-design-plan`

## Push Result

Pending final Git gate.

## Final Git Status

Pending final Git gate.

V1-SALES-002 Ready for Architect / Owner Review
