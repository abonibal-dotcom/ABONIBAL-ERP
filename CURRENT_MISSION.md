# Current Mission

## Mission

`V1-SALES-006 - Issued Invoice Read / Stock Deduction Audit View`

## Classification

`ECS`

This is the minimal read-only issued invoice audit visibility layer after the accepted invoice issue and stock deduction flow.

This is not invoice cancellation, returns, hard delete, Product CRUD, Inventory manual adjustment work, Auth work, Route Guard weakening, or localStorage migration.

## Objective

Implement and verify a minimal read-only view that makes issued invoices and their stock deduction relationship visible and auditable.

The mission proves:

- Protected invoice route remains active.
- Login succeeds and authenticated invoice access works.
- Issued invoice is visible after reload.
- Issued invoice status, number, total, and issuedAt are displayed.
- Invoice line Product snapshot is displayed.
- Invoice line quantity, unit price, and line total are displayed.
- Invoice line `stockMovementId` is visible or traceable.
- The referenced movement exists and is a `sale_deduction`.
- The referenced movement has negative `quantityDelta`.
- The referenced movement belongs to the same accountId and Product id.
- Available stock remains reduced after reload.
- Duplicate issue attempts do not create duplicate movements.
- Product records and `Product.quantity` remain unchanged.
- No invoice cancellation or reversal behavior is added.

## Accepted Baseline

- Baseline tag: `v1-sales-005-invoice-issue-stock-deduction-flow`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.
- Invoice draft create/update flow PASS through V1-SALES-004.
- Invoice issue / stock deduction flow PASS through V1-SALES-005.

## Current Status

`V1-SALES-006 Ready for Architect / Owner Review`

## Implementation Result

- Added read-only invoice line audit visibility to the existing Invoice page.
- Displayed invoice created timestamp and issued timestamp.
- Displayed invoice line Product snapshot, quantity, unit price, and line total.
- Displayed line `stockMovementId` / deduction reference.
- Preserved issued invoice edit blocking.
- Preserved no cancellation UI/action.

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
- No reversal movement created.
- No Product CRUD behavior changed.
- No Product records mutated by invoice read/audit display.
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
PATCHES/V1-SALES-006/verification.md
PATCHES/V1-SALES-006/closure-report.md
outputs/V1-SALES-006/baseline-runtime.json
outputs/V1-SALES-006/baseline-dom.json
outputs/V1-SALES-006/baseline-console.log
outputs/V1-SALES-006/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-006/baseline-screenshot.png
outputs/V1-SALES-006/after-runtime.json
outputs/V1-SALES-006/after-dom.json
outputs/V1-SALES-006/after-console.log
outputs/V1-SALES-006/after-storage-snapshot-sanitized.json
outputs/V1-SALES-006/after-screenshot.png
outputs/V1-SALES-006/issued-invoice-audit-summary.json
```

## Next

Recommended next mission:

Owner-approved invoice cancellation / reversal planning or the next Sales dependency gate.

Do not start the next mission until V1-SALES-006 is reviewed and accepted.
