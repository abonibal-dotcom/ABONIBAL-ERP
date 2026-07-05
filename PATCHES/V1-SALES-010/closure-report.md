# V1-SALES-010 Closure Report

## Classification

INF.

## Branch

`v1/sales-010-invoice-returns-partial-returns-design-plan`

## Baseline Tag

`v1-sales-009-invoice-lifecycle-regression-baseline`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PATCHES/ECS-011/closure-report.md`
- `PATCHES/V1-INV-007/closure-report.md`
- `PATCHES/V1-SALES-005/closure-report.md`
- `PATCHES/V1-SALES-006/closure-report.md`
- `PATCHES/V1-SALES-007/closure-report.md`
- `PATCHES/V1-SALES-008/closure-report.md`
- `PATCHES/V1-SALES-009/closure-report.md`

## Source Files Inspected

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceStatus.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/modules/sales/persistence/InvoicePersistenceKey.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Source Inspection Result

| Capability | Current result |
| --- | --- |
| return model exists | no |
| return service exists | no |
| return UI exists | no |
| invoice cancellation exists | yes |
| sale_return movement type exists | yes |
| invoice line stockMovementId exists | yes |
| issued invoice audit view exists | yes |
| partial return tracking exists | no |
| duplicate return protection exists | no |

## Files Changed

- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PATCHES/V1-SALES-010/invoice-returns-design-plan.md`
- `PATCHES/V1-SALES-010/return-storage-boundary-plan.md`
- `PATCHES/V1-SALES-010/return-inventory-integration-plan.md`
- `PATCHES/V1-SALES-010/return-lifecycle-risk-assessment.md`
- `PATCHES/V1-SALES-010/closure-report.md`

## Return Implementation State

No return implementation exists and none was added.

## Recommended Return Storage Boundary

`invoiceReturns:{accountId}`

## Return Record Model Summary

Recommended `InvoiceReturn` fields:

- `id`
- `accountId`
- `invoiceId`
- `returnNumber`
- `status`
- `reason`
- `notes`
- `lines`
- `total`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`
- future reserved void/cancel metadata if explicitly approved

## Return Line Model Summary

Recommended `InvoiceReturnLine` fields:

- `id`
- `invoiceLineId`
- `productId`
- `productNameSnapshot`
- `returnQuantity`
- `unitPriceSnapshot`
- `lineTotal`
- `originalStockMovementId`
- `stockMovementId`

## Inventory Integration Policy

Returns restore stock only through positive `sale_return` movements in
`stockMovements:{accountId}`.

Return movement policy:

- `type: "sale_return"`
- `referenceType: "invoice_return"`
- positive `quantityDelta`
- reference to return record and invoice line through metadata
- no Product mutation
- no `Product.quantity` update

## Invoice Lifecycle Policy

Recommended future invoice statuses:

- `draft`
- `issued`
- `partially_returned`
- `returned`
- `cancelled`

Draft invoices cannot be returned. Cancelled invoices cannot be returned.
Issued invoices may be partially returned. Fully returned invoices should become
`returned`. Invoices with posted returns should not be cancellable in V1.

## Duplicate / Over-Return Protection Policy

Future implementation must compute remaining returnable quantity per invoice
line from posted return records and must reject any return quantity greater than
the remaining quantity.

Duplicate protection must scan:

- existing return records;
- existing return lines;
- existing `sale_return` movement metadata.

## Audit Requirements

Each return must preserve:

- invoice id;
- invoice number;
- invoice line id;
- original `sale_deduction` movement id;
- return id;
- return line id;
- return `sale_return` movement id;
- returned quantity;
- return reason;
- createdBy;
- createdAt;
- accountId.

## Risk Assessment

High risks:

- returns without separate return records;
- returns without over-return protection;
- direct `Product.quantity` mutation;
- returns on cancelled invoices;
- duplicate submit;
- missing original invoice line audit link;
- cross-account visibility.

Medium risks:

- data-loss risk if idempotency is not implemented;
- implementation complexity.

## Recommended Next Mission

`V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline`

## Return Persistence May Proceed Next

Yes, after Architect / Owner review of this design mission.

## Return UI May Proceed Next

No.

Return UI should wait until return persistence, validation, duplicate protection,
and stock movement integration are implemented and verified.

## TypeScript Result

PASS.

## Build Result

PASS.

Build completed successfully. The Vite chunk-size warning is informational and
did not fail the build.

## Scope Confirmation

- No source files changed.
- No Product data mutation.
- No invoice mutation.
- No Inventory mutation.
- `.env` remains untracked.

## Commit Hash

Assigned by final Git commit and reported in delivery output.

## Tag Name

`v1-sales-010-invoice-returns-partial-returns-design-plan`

## Push Result

Pending commit and push.

## Final Git Status

Pending commit and push.

V1-SALES-010 Ready for Architect / Owner Review
