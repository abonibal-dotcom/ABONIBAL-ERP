# V1-SALES-003 Closure Report

## Classification

ECS.

## Branch

`v1/sales-003-account-scoped-invoice-persistence-baseline`

## Baseline Tag

`v1-sales-002-account-scoped-invoice-persistence-design-plan`

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
- `PATCHES/V1-SALES-001/closure-report.md`
- `PATCHES/V1-SALES-002/account-scoped-invoice-persistence-design-plan.md`
- `PATCHES/V1-SALES-002/invoice-lifecycle-plan.md`
- `PATCHES/V1-SALES-002/invoice-numbering-plan.md`
- `PATCHES/V1-SALES-002/invoice-stock-integration-plan.md`
- `PATCHES/V1-SALES-002/closure-report.md`

## Source Files Inspected

- Sales / Invoice files: none found before implementation.
- `src/router/routes.ts`
- `src/ui/navigation/Sidebar.ts`
- `src/core/Container.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`

## Files Changed

Source:

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceStatus.ts`
- `src/modules/sales/persistence/InvoicePersistenceKey.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/core/Container.ts`

Documentation:

- `PATCHES/V1-SALES-003/verification.md`
- `PATCHES/V1-SALES-003/closure-report.md`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`

Evidence:

- `outputs/V1-SALES-003/runtime.json`
- `outputs/V1-SALES-003/dom.json`
- `outputs/V1-SALES-003/console.log`
- `outputs/V1-SALES-003/storage-snapshot-sanitized.json`
- `outputs/V1-SALES-003/screenshot.png`
- `outputs/V1-SALES-003/invoice-persistence-summary.json`

## Invoice Model Summary

V1 invoice model includes:

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

Allowed statuses:

```text
draft
issued
cancelled
```

Invoice lines include Product snapshot fields:

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

## Invoice Storage Key Used

```text
invoices:{accountId}
```

No global `invoices` key is used by the service or repository path.

## Repository / Service Summary

Repository methods:

- `allForAccount(accountId)`
- `appendForAccount(accountId, invoice)`
- `findForAccount(accountId, invoiceId)`
- `updateForAccount(accountId, invoiceId, invoice)`

Service methods:

- `getAll()`
- `getById(invoiceId)`
- `createDraft(input)`
- `updateDraft(invoiceId, input)`
- `markIssued(invoiceId)`
- `markCancelled(invoiceId, reason)`

All service methods resolve account context from authenticated Auth state. Unauthenticated reads return safe empty results and unauthenticated writes fail safely.

## createDraft Result

PASS.

`createDraft` writes one draft invoice to `invoices:{accountId}`, includes `accountId`, includes `createdBy`, creates an account-scoped invoice number, and stores Product snapshot data on the invoice line.

## updateDraft Result

PASS.

`updateDraft` updates draft metadata and preserves the original invoice `accountId`.

## markIssued Result

PASS.

`markIssued` changes status to `issued` and sets `issuedAt` / `issuedBy`.

No stock movements are created.

## markCancelled Result

PASS.

`markCancelled` changes status to `cancelled` and sets `cancelledAt` / `cancelledBy`.

The invoice remains stored. No hard delete occurs.

## Invoice Line Snapshot Result

PASS.

The runtime-created invoice line preserved `productId`, `productNameSnapshot`, and optional snapshot fields without depending on live Product mutation.

## Product Safety Result

PASS.

- Product scoped key hash before/after: unchanged.
- Legacy Product key hash before/after: unchanged.
- Product records were not mutated.
- `Product.quantity` was not updated.

## Inventory Safety Result

PASS.

- Stock movement count before/after: 0 / 0.
- No `sale_deduction` movement was created.
- `stockMovements:{accountId}` was not mutated.

## Route Guard Result

PASS.

Unauthenticated Products access remains blocked and protected routes remain protected.

## TypeScript Result

PASS.

## Build Result

PASS.

## Runtime Result

PASS.

## Console Errors Count

0.

## Page Exceptions Count

0.

## Confirmation No Invoice UI

Confirmed.

## Confirmation No Stock Deduction

Confirmed.

## Confirmation No Firebase UID As accountId

Confirmed.

## Confirmation No Default Account Fallback

Confirmed.

## Confirmation `.env` Untracked

Confirmed.

## Commit Hash

To be assigned by the V1-SALES-003 commit.

## Tag Name

`v1-sales-003-account-scoped-invoice-persistence-baseline`

## Push Result

Pending final Git gate.

## Final Git Status

Pending final Git gate.

## Recommended Next Mission

`V1-SALES-004 - Invoice Draft Create / Update Flow`

Do not start the next mission until V1-SALES-003 is reviewed and accepted.

V1-SALES-003 Ready for Architect / Owner Review

