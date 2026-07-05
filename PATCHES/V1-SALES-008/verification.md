# V1-SALES-008 Verification

## Mission

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`

## Classification

ECS.

## Branch

`v1/sales-008-invoice-cancellation-stock-reversal-implementation`

## Baseline Tag

`v1-sales-007-invoice-cancellation-stock-reversal-design-plan`

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
- `PATCHES/V1-SALES-005/verification.md`
- `PATCHES/V1-SALES-005/closure-report.md`
- `PATCHES/V1-SALES-006/verification.md`
- `PATCHES/V1-SALES-006/closure-report.md`
- `PATCHES/V1-SALES-007/invoice-cancellation-design-plan.md`
- `PATCHES/V1-SALES-007/stock-reversal-design-plan.md`
- `PATCHES/V1-SALES-007/cancellation-atomicity-plan.md`
- `PATCHES/V1-SALES-007/cancellation-ui-policy.md`
- `PATCHES/V1-SALES-007/closure-report.md`

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

| Check | Result |
| --- | --- |
| cancelled status exists | yes |
| markCancelled method exists | yes |
| cancellation UI exists | no, before implementation |
| issued invoice read view exists | yes |
| line stockMovementId exists | yes |
| sale_deduction movement type exists | yes |
| sale_return movement type exists | yes |
| movement reference fields exist | yes |
| movement reversal link field exists | no first-class field before implementation |
| existing markCancelled is reversal-safe | no |
| Product mutation in issue/cancel path | no Product mutation in issue; cancel path was status-only before implementation |

## Baseline Runtime

Command:

```text
node outputs/V1-SALES-008/verify-runtime.mjs
```

Result: PASS.

Baseline evidence:

- `outputs/V1-SALES-008/baseline-runtime.json`
- `outputs/V1-SALES-008/baseline-dom.json`
- `outputs/V1-SALES-008/baseline-console.log`
- `outputs/V1-SALES-008/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-008/baseline-screenshot.png`

Baseline findings:

- Invoice route protected: PASS.
- AuthSession.accountId exists: PASS.
- Issued invoice exists: PASS.
- Invoice line `stockMovementId` exists: PASS.
- Referenced `sale_deduction` exists: PASS.
- Available quantity before cancellation: 3.
- Invoice count before/after read-only baseline: 2 / 2.
- Stock movement count before/after read-only baseline: 2 / 2.
- Product hash unchanged: PASS.
- Cancellation UI absent: PASS.
- Current `markCancelled` not reversal-safe: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Implementation Summary

- Added optional `reversalStockMovementId` to invoice lines.
- Updated `InvoiceService.markCancelled()` so only issued invoices can be cancelled.
- Added validation that each original `stockMovementId` exists, is `sale_deduction`, references the invoice, matches accountId, matches Product id, and has negative quantity.
- Added positive `sale_return` movement creation with `referenceType: "invoice_return"`.
- Added reversal metadata linking the reversal to the original `sale_deduction`, invoice, and invoice line.
- Marked invoice `cancelled` only after reversal creation succeeds.
- Preserved original `sale_deduction` movements and original invoice line `stockMovementId`.
- Added minimal Invoice page cancel action for issued invoices only.
- Displayed reversal stock movement reference after cancellation.

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-SALES-008/verify-runtime.mjs after
```

## Runtime Result

PASS.

After evidence:

- `outputs/V1-SALES-008/after-runtime.json`
- `outputs/V1-SALES-008/after-dom.json`
- `outputs/V1-SALES-008/after-console.log`
- `outputs/V1-SALES-008/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-008/after-screenshot.png`
- `outputs/V1-SALES-008/invoice-cancellation-summary.json`

## Runtime Gates

| Gate | Result |
| --- | --- |
| Unauthenticated invoice route blocked | PASS |
| Login/AuthSession available | PASS |
| AuthSession.accountId exists | PASS |
| accountId is not Firebase UID/providerUserId | PASS |
| Invoice route accessible after auth | PASS |
| Route Guard remains active | PASS |
| Draft cancellation blocked | PASS |
| Missing invoice cancellation fails safely | PASS |
| Issued invoice cancellation succeeds | PASS |
| Invoice id unchanged | PASS |
| Invoice accountId unchanged | PASS |
| Invoice status becomes cancelled | PASS |
| cancelledAt set | PASS |
| cancelledBy set | PASS |
| cancellation reason recorded | PASS |
| Original sale_deduction preserved | PASS |
| sale_return created | PASS |
| sale_return quantityDelta positive | PASS |
| sale_return productId matches invoice line | PASS |
| sale_return references original stockMovementId | PASS |
| sale_return accountId matches invoice accountId | PASS |
| Available stock increases by cancelled quantity | PASS |
| Reload preserves cancelled invoice | PASS |
| Reload preserves original sale_deduction | PASS |
| Reload preserves sale_return | PASS |
| Cancelled status displays | PASS |
| Reversal reference displays | PASS |
| Cancelled invoice is read-only | PASS |
| Duplicate cancellation creates no duplicate sale_return | PASS |
| No returns implementation | PASS |
| Product records unchanged | PASS |
| Product.quantity not updated | PASS |
| localStorage.products unchanged if present | PASS |
| Console errors | 0 |
| Page exceptions | 0 |
| .env untracked | PASS |

## Evidence Summary

- Cancelled invoice id: recorded sanitized.
- Original sale_deduction movement id: recorded sanitized.
- sale_return reversal movement id: recorded sanitized.
- Available quantity: 3 before cancellation, 5 after cancellation.
- Movement count: 2 before cancellation, 3 after cancellation, 3 after duplicate cancellation attempt.
- Invoice status: `issued` before, `cancelled` after.
- Product scoped hash: unchanged.
- Legacy Product key hash: null before and null after.

## Scope Confirmation

- No returns implementation.
- No partial returns.
- No invoice hard delete.
- No Product CRUD behavior change.
- No Product mutation.
- No `Product.quantity` update.
- No Route Guard weakening.
- No Auth behavior change.
- No localStorage migration.
- No Firebase UID/providerUserId as `accountId`.
- No default account fallback.
- `.env` remains untracked.
