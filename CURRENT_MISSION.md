# Current Mission

## Mission

`V1-SALES-013 - Invoice Returns UI Flow`

## Classification

`ECS`

This is the first minimal protected Invoice Returns UI flow.

This is not Product CRUD, invoice hard delete, invoice cancellation work, manual
Inventory adjustment work, Auth work, Route Guard weakening, or localStorage
migration.

## Objective

Implement and verify a minimal UI flow that lets an authenticated user:

- view issued invoice returnable lines;
- see remaining returnable quantity per line;
- enter a return quantity;
- reject invalid and excessive return quantities;
- create an account-scoped invoice return record;
- execute stock restoration through the accepted return execution service;
- display the return audit result.

## Accepted Baseline

- Baseline tag:
  `v1-sales-012-invoice-return-stock-restoration-execution`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Sales / Invoice lifecycle PASS through V1-SALES-009.
- Return persistence baseline PASS through V1-SALES-011.
- Return stock restoration execution PASS through V1-SALES-012.

## Current Status

`V1-SALES-013 Ready for Architect / Owner Review`

## Implementation Result

- Added return controls to issued invoice lines on the existing protected
  Invoice page.
- Displayed remaining returnable quantity per line.
- Rejected invalid and excessive return quantities before storage writes.
- Created account-scoped return records through
  `InvoiceReturnService.createReturnRecord()`.
- Executed valid returns through `InvoiceReturnService.executeReturn()`.
- Displayed return audit result with return number, execution status, return
  quantity, and `returnStockMovementId`.

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Runtime evidence saved under `outputs/V1-SALES-013/`.

## Scope Confirmation

- No return route.
- No Product CRUD behavior change.
- No Product record mutation.
- `Product.quantity` unchanged.
- No direct invoice mutation by the UI flow.
- `invoices:{accountId}` hash unchanged.
- `products:{accountId}` hash unchanged.
- `localStorage.products` unchanged/absent.
- No invoice hard delete.
- No invoice cancellation behavior change.
- No manual Inventory adjustment behavior change.
- No Auth behavior change.
- Route Guard remains active.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.

## Evidence / Documents

```text
outputs/V1-SALES-013/baseline-runtime.json
outputs/V1-SALES-013/baseline-dom.json
outputs/V1-SALES-013/baseline-console.log
outputs/V1-SALES-013/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-013/baseline-screenshot.png
outputs/V1-SALES-013/after-runtime.json
outputs/V1-SALES-013/after-dom.json
outputs/V1-SALES-013/after-console.log
outputs/V1-SALES-013/after-storage-snapshot-sanitized.json
outputs/V1-SALES-013/after-screenshot.png
outputs/V1-SALES-013/invoice-return-ui-summary.json
PATCHES/V1-SALES-013/verification.md
PATCHES/V1-SALES-013/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-013.

Do not start V1-SALES-014 until V1-SALES-013 is reviewed and accepted.
