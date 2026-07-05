# Current Mission

## Mission

`V1-SALES-004 - Invoice Draft Create / Update Flow`

## Classification

`ECS`

This is the first minimal authenticated Invoice draft UI flow.

This is not invoice issuing, invoice stock deduction, invoice cancellation, Product CRUD, Inventory mutation, Auth work, Route Guard weakening, or localStorage migration.

## Objective

Implement and verify a minimal authenticated Invoice Draft Create / Update flow on top of the accepted account-scoped invoice persistence baseline.

The mission proves:

- Protected invoice route exists.
- Unauthenticated invoice access redirects to Login.
- Authenticated invoice access shows the draft UI.
- Active Products can be selected for invoice lines.
- Soft-deleted Products are not selectable.
- Invalid draft submissions do not write invoices.
- Valid draft create writes exactly one draft invoice to `invoices:{accountId}`.
- Existing draft can be updated without changing id, accountId, or status.
- Invoice lines store Product snapshot data.
- Totals are computed and persisted.
- Reload preserves draft invoice state.
- No invoice issuing, cancellation, or stock deduction behavior exists.

## Accepted Baseline

- Baseline tag: `v1-sales-003-account-scoped-invoice-persistence-baseline`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Inventory availability gate PASS through V1-INV-007.
- Invoice persistence baseline PASS through V1-SALES-003.

## Current Status

`V1-SALES-004 Ready for Architect / Owner Review`

## Implementation Result

- Added protected `invoices` route.
- Added `Invoices` Sidebar navigation entry.
- Added `src/modules/sales/pages/InvoiceDraftPage.ts`.
- Added minimal draft form with customer name, Product selector, quantity, unit price, discount, tax, and notes.
- Added minimal draft list with edit action.
- Used `ProductService.getAll()` for active Product selection.
- Used `InvoiceService.createDraft()` and `InvoiceService.updateDraft()`.
- Stored invoice records under `invoices:{accountId}` through the accepted service/repository path.
- Kept invoice-level discount/tax at zero in the draft page so line-level discount/tax are not double-counted on update.

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

- No invoice issuing implemented.
- No invoice cancellation UI implemented.
- No invoice stock deduction implemented.
- No `sale_deduction` movement created.
- No `stockMovements:{accountId}` mutation.
- No Product records mutated by invoice create/update.
- `Product.quantity` not updated.
- No Product CRUD behavior changed.
- No Inventory behavior changed.
- No Auth behavior changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-004/verification.md
PATCHES/V1-SALES-004/closure-report.md
outputs/V1-SALES-004/baseline-runtime.json
outputs/V1-SALES-004/baseline-dom.json
outputs/V1-SALES-004/baseline-console.log
outputs/V1-SALES-004/baseline-storage-snapshot-sanitized.json
outputs/V1-SALES-004/baseline-screenshot.png
outputs/V1-SALES-004/after-runtime.json
outputs/V1-SALES-004/after-dom.json
outputs/V1-SALES-004/after-console.log
outputs/V1-SALES-004/after-storage-snapshot-sanitized.json
outputs/V1-SALES-004/after-screenshot.png
outputs/V1-SALES-004/invoice-draft-flow-summary.json
```

## Next

Recommended next mission:

Owner-approved invoice issue / stock deduction planning or implementation gate.

Do not start invoice issuing, invoice stock deduction, or the next mission until V1-SALES-004 is reviewed and accepted.
