# Current Mission

## Mission

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`

## Classification

`ECS`

This is an invoice cancellation and stock reversal implementation mission.

This is not returns implementation, Product CRUD, Inventory manual adjustment,
invoice hard delete, Auth work, Route Guard weakening, or localStorage
migration.

## Objective

Implement and verify safe cancellation of issued invoices.

The mission proves:

- only issued invoices can be cancelled;
- draft invoices cannot be cancelled through this flow;
- missing invoice cancellation fails safely;
- already cancelled invoices cannot be cancelled again;
- original `sale_deduction` movements remain preserved;
- one positive `sale_return` movement is appended for each cancelled line;
- reversal movements reference the original `stockMovementId`;
- invoice status becomes `cancelled` only after reversal creation;
- duplicate cancellation creates no duplicate reversal movement;
- available stock increases by the cancelled quantity;
- invoice and stock audit history remain readable after reload;
- Product records and `Product.quantity` remain unchanged.

## Accepted Baseline

- Baseline tag:
  `v1-sales-007-invoice-cancellation-stock-reversal-design-plan`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory ledger and availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.
- Invoice draft create/update flow PASS through V1-SALES-004.
- Invoice issue / stock deduction flow PASS through V1-SALES-005.
- Issued invoice read / stock deduction audit view PASS through V1-SALES-006.
- Invoice cancellation / reversal design accepted through V1-SALES-007.

## Current Status

`V1-SALES-008 Ready for Architect / Owner Review`

## Implementation Result

- Added optional `reversalStockMovementId` to invoice lines.
- Updated `InvoiceService.markCancelled()` to accept issued invoices only.
- Validated original `stockMovementId` and `sale_deduction` movement integrity.
- Appended positive `sale_return` movements with `referenceType: "invoice_return"`.
- Added reversal metadata linking invoice, invoice line, and original movement.
- Marked invoice `cancelled` after reversal creation.
- Added minimal Cancel action for issued invoices only.
- Displayed reversal movement reference in invoice audit rows.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- Baseline runtime before source changes: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification after implementation: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Scope Confirmation

- No returns implementation.
- No partial returns.
- No invoice hard delete.
- No Product CRUD behavior changed.
- No Product records mutated.
- `Product.quantity` not updated.
- Inventory manual adjustment behavior not changed.
- Auth behavior not changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-008/verification.md
PATCHES/V1-SALES-008/closure-report.md
outputs/V1-SALES-008/baseline-runtime.json
outputs/V1-SALES-008/baseline-dom.json
outputs/V1-SALES-008/baseline-console.log
outputs/V1-SALES-008/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-008/baseline-screenshot.png
outputs/V1-SALES-008/after-runtime.json
outputs/V1-SALES-008/after-dom.json
outputs/V1-SALES-008/after-console.log
outputs/V1-SALES-008/after-storage-snapshot-sanitized.json
outputs/V1-SALES-008/after-screenshot.png
outputs/V1-SALES-008/invoice-cancellation-summary.json
outputs/V1-SALES-008/verify-runtime.mjs
```

## Next

Recommended next step:

Architect / Owner review of V1-SALES-008.

Do not start the next mission until V1-SALES-008 is reviewed and accepted.
