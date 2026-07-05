# Current Mission

## Mission

`V1-SALES-005 - Invoice Issue / Stock Deduction Flow`

## Classification

`ECS`

This is the minimal Invoice issue and stock deduction flow on top of the accepted draft UI, invoice persistence, and Inventory availability gate.

This is not invoice cancellation, returns, hard delete, Product CRUD, Product quantity migration, Auth work, Route Guard weakening, or localStorage migration.

## Objective

Implement and verify minimal invoice issue behavior that blocks unavailable stock, creates `sale_deduction` stock movements for successful issues, and records the resulting movement ids on invoice lines.

The mission proves:

- Protected invoice route remains active.
- Login succeeds and authenticated invoice access works.
- Draft issue with insufficient stock is blocked safely.
- Failed issue does not create `sale_deduction`.
- Successful issue changes invoice status to `issued`.
- Successful issue creates one `sale_deduction` movement per invoice line.
- `sale_deduction.quantityDelta` is negative.
- Movement `referenceType` is `invoice` and `referenceId` is the invoice id.
- Invoice line `stockMovementId` references the created movement.
- Available stock decreases through the ledger after issue and after reload.
- Duplicate issue attempts do not duplicate stock movements.
- Product records and `Product.quantity` remain unchanged.
- No invoice cancellation behavior is added.

## Accepted Baseline

- Baseline tag: `v1-sales-004-invoice-draft-create-update-flow`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.
- Invoice draft create/update flow PASS through V1-SALES-004.

## Current Status

`V1-SALES-005 Ready for Architect / Owner Review`

## Implementation Result

- Updated `InvoiceService.markIssued()` to call the accepted Inventory availability gate before issuing.
- Blocked issue when requested invoice quantities exceed available ledger stock.
- Created `sale_deduction` stock movements only after availability passes.
- Stored created movement ids on invoice lines as `stockMovementId`.
- Marked invoices as `issued` only after movement creation succeeds.
- Added a minimal `Issue` action for draft invoices on the existing Invoice draft page.
- Prevented issued invoices from being edited through the draft update UI.

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

- No invoice cancellation implemented.
- No invoice return implemented.
- No invoice hard delete implemented.
- No Product CRUD behavior changed.
- No Product records mutated by invoice issue.
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
PATCHES/V1-SALES-005/verification.md
PATCHES/V1-SALES-005/closure-report.md
outputs/V1-SALES-005/baseline-runtime.json
outputs/V1-SALES-005/baseline-dom.json
outputs/V1-SALES-005/baseline-console.log
outputs/V1-SALES-005/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-005/baseline-screenshot.png
outputs/V1-SALES-005/after-runtime.json
outputs/V1-SALES-005/after-dom.json
outputs/V1-SALES-005/after-console.log
outputs/V1-SALES-005/after-storage-snapshot-sanitized.json
outputs/V1-SALES-005/after-screenshot.png
outputs/V1-SALES-005/invoice-issue-summary.json
```

## Next

Recommended next mission:

Owner-approved invoice cancellation / reversal planning or the next Sales dependency gate.

Do not start the next mission until V1-SALES-005 is reviewed and accepted.
