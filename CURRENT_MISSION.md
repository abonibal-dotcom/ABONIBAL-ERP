# Current Mission

## Mission

`V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline`

## Classification

`ECS`

This is the first Sales / Invoice returns persistence implementation mission.

This is not return UI, stock restoration, partial return execution, Product
CRUD, invoice cancellation work, Auth work, Route Guard weakening, or
localStorage migration.

## Objective

Implement the minimal account-scoped invoice return persistence baseline using:

`invoiceReturns:{AuthSession.accountId}`

The mission proves that return records can be persisted safely, scoped by the
authenticated account boundary, without mutating invoices, stock movements, or
Products.

## Accepted Baseline

- Baseline tag:
  `v1-sales-010-invoice-returns-partial-returns-design-plan`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Sales / Invoice lifecycle PASS through V1-SALES-009.
- Returns / partial returns design accepted through V1-SALES-010.

## Current Status

`V1-SALES-011 Ready for Architect / Owner Review`

## Implementation Result

- Added `InvoiceReturn` and `InvoiceReturnLine` model contracts.
- Added `InvoiceReturnStatus` with V1 baseline status `recorded`.
- Added account-scoped storage key helper:
  `invoiceReturns:{accountId}`.
- Added `InvoiceReturnRepository`.
- Added `InvoiceReturnValidator`.
- Added `InvoiceReturnService`.
- Registered invoice return dependencies in `Container`.

## Verification Result

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Runtime evidence saved under `outputs/V1-SALES-011/`.

## Scope Confirmation

- No return UI.
- No return route.
- No stock restoration.
- No `sale_return` movement created for returns.
- `stockMovements:{accountId}` unchanged.
- `invoices:{accountId}` unchanged.
- Product scoped storage unchanged.
- `Product.quantity` unchanged.
- No invoice status changed to `partially_returned` or `returned`.
- No invoice issue or cancellation flow behavior changed.
- No Auth behavior changed.
- Route Guard remains active.
- No Firebase UID or provider user id used as `accountId`.
- No default account fallback.
- `.env` remains untracked.

## Evidence / Documents

```text
outputs/V1-SALES-011/runtime.json
outputs/V1-SALES-011/dom.json
outputs/V1-SALES-011/console.log
outputs/V1-SALES-011/storage-snapshot-sanitized.json
outputs/V1-SALES-011/screenshot.png
outputs/V1-SALES-011/invoice-returns-persistence-summary.json
PATCHES/V1-SALES-011/verification.md
PATCHES/V1-SALES-011/closure-report.md
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-011.

Return UI and stock restoration remain blocked until a separately approved
mission implements the next return lifecycle step.
