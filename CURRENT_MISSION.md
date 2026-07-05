# Current Mission

## Mission

`V1-SALES-012 - Invoice Return Stock Restoration Execution`

## Classification

`ECS`

This is a service-level invoice return execution mission.

This is not return UI, return routing, Product CRUD, invoice cancellation work,
invoice hard delete, Auth work, Route Guard weakening, or localStorage
migration.

## Objective

Implement and verify execution of an existing persisted invoice return record:

- validate the return record;
- create positive `sale_return` movements in `stockMovements:{accountId}`;
- link each return line to `returnStockMovementId`;
- preserve original `sale_deduction` movements;
- preserve invoices and Products;
- prevent duplicate execution.

## Accepted Baseline

- Baseline tag:
  `v1-sales-011-account-scoped-invoice-returns-persistence-baseline`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Sales / Invoice lifecycle PASS through V1-SALES-009.
- Return persistence baseline PASS through V1-SALES-011.

## Current Status

`V1-SALES-012 Ready for Architect / Owner Review`

## Implementation Result

- Added `executed` as an invoice return lifecycle status.
- Added account-scoped return update support to `InvoiceReturnRepository`.
- Added `InvoiceReturnService.executeReturn()`.
- Injected `InventoryService` into `InvoiceReturnService`.
- Execution appends positive `sale_return` stock movements with
  `referenceType: "invoice_return"`.
- Execution writes the created movement id back to each return line as
  `returnStockMovementId`.

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Runtime evidence saved under `outputs/V1-SALES-012/`.

## Scope Confirmation

- No return UI.
- No return route.
- No invoice mutation.
- No Product record mutation.
- `Product.quantity` unchanged.
- Original `sale_deduction` movements preserved.
- `invoices:{accountId}` hash unchanged.
- `products:{accountId}` hash unchanged.
- `localStorage.products` unchanged/absent.
- No invoice status changes to `partially_returned` or `returned`.
- No invoice issue or cancellation flow behavior changed.
- No Auth behavior changed.
- Route Guard remains active.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.

## Evidence / Documents

```text
outputs/V1-SALES-012/baseline-runtime.json
outputs/V1-SALES-012/baseline-dom.json
outputs/V1-SALES-012/baseline-console.log
outputs/V1-SALES-012/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-012/baseline-screenshot.png
outputs/V1-SALES-012/after-runtime.json
outputs/V1-SALES-012/after-dom.json
outputs/V1-SALES-012/after-console.log
outputs/V1-SALES-012/after-storage-snapshot-sanitized.json
outputs/V1-SALES-012/after-screenshot.png
outputs/V1-SALES-012/invoice-return-execution-summary.json
PATCHES/V1-SALES-012/verification.md
PATCHES/V1-SALES-012/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-012.

Return UI remains blocked until a separately approved mission implements the
next return lifecycle step.
