# V1-SALES-007 - Closure Report

## Classification

INF.

## Branch

`v1/sales-007-invoice-cancellation-stock-reversal-design-plan`

## Baseline Tag

`v1-sales-006-issued-invoice-read-stock-deduction-audit-view`

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
- `PATCHES/V1-SALES-002/invoice-lifecycle-plan.md`
- `PATCHES/V1-SALES-002/invoice-stock-integration-plan.md`
- `PATCHES/V1-SALES-003/closure-report.md`
- `PATCHES/V1-SALES-004/closure-report.md`
- `PATCHES/V1-SALES-005/verification.md`
- `PATCHES/V1-SALES-005/closure-report.md`
- `PATCHES/V1-SALES-006/verification.md`
- `PATCHES/V1-SALES-006/closure-report.md`

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
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Source Inspection Result

| Check | Result |
| --- | --- |
| invoice cancelled status exists | yes |
| markCancelled method exists | yes |
| cancellation UI exists | no |
| issued invoice read view exists | yes |
| line stockMovementId exists | yes |
| sale_deduction movement type exists | yes |
| sale_return movement type exists | yes |
| void/correction movement support exists | yes |
| movement reference fields exist | yes |
| movement reversal link field exists | no first-class field; metadata exists |
| Product mutation in invoice issue | no |
| Inventory reversal behavior exists | no |

## Runtime Verification Result

PASS.

Runtime evidence was collected read-only from a copy of the accepted
V1-SALES-006 after-runtime Chrome profile.

Evidence files:

- `outputs/V1-SALES-007/runtime.json`
- `outputs/V1-SALES-007/dom.json`
- `outputs/V1-SALES-007/console.log`
- `outputs/V1-SALES-007/storage-snapshot-sanitized.json`
- `outputs/V1-SALES-007/screenshot.png`
- `outputs/V1-SALES-007/verify-runtime.mjs`

Runtime result:

- Invoice route protected: PASS.
- AuthSession exists: PASS.
- AuthSession.accountId exists: PASS.
- accountId is not provider user id: PASS.
- Issued invoice audit view works: PASS.
- Existing `sale_deduction` movement is visible/traceable: PASS.
- No cancellation UI is exposed: PASS.
- No reversal movement was created: PASS.
- Invoice count before/after read-only verification: 2 / 2.
- Stock movement count before/after read-only verification: 2 / 2.
- Product scoped hash before/after: unchanged.
- Legacy Product key before/after: absent / absent.
- Console errors: 0.
- Page exceptions: 0.

## Files Changed

- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PATCHES/V1-SALES-007/invoice-cancellation-design-plan.md`
- `PATCHES/V1-SALES-007/stock-reversal-design-plan.md`
- `PATCHES/V1-SALES-007/cancellation-atomicity-plan.md`
- `PATCHES/V1-SALES-007/cancellation-ui-policy.md`
- `PATCHES/V1-SALES-007/closure-report.md`
- `outputs/V1-SALES-007/runtime.json`
- `outputs/V1-SALES-007/dom.json`
- `outputs/V1-SALES-007/console.log`
- `outputs/V1-SALES-007/storage-snapshot-sanitized.json`
- `outputs/V1-SALES-007/screenshot.png`
- `outputs/V1-SALES-007/verify-runtime.mjs`

No source files were changed.

## Cancellation Eligibility Policy

- Draft invoices should not use the issued-invoice stock reversal path.
- Issued invoices may be cancelled only through an explicit cancellation flow.
- Already cancelled invoices cannot be cancelled again.
- Cancellation must be idempotent and duplicate-safe.

## Invoice Status Policy

V1 stock-affecting cancellation uses:

```text
issued -> cancelled
```

The flow must set `cancelledAt`, `cancelledBy`, and `cancelReason`, while
preserving invoice id, invoice number, accountId, issued data, totals, and
Product snapshot lines.

## Recommended Reversal Movement Type

`sale_return`.

Reason: it already exists, represents sale-related stock returning to inventory,
and works with additive positive `quantityDelta` ledger summation.

## Reversal Traceability Policy

Each reversal movement should use:

- `type: "sale_return"`
- `referenceType: "invoice_return"`
- `referenceId: invoice.id`
- positive `quantityDelta`
- `metadata.reversesMovementId`
- `metadata.reversalOfInvoiceId`
- `metadata.reversalOfInvoiceLineId`
- `metadata.originalMovementType: "sale_deduction"`
- `metadata.cancellationReason`

## Atomicity Sequence

1. Resolve authenticated account context.
2. Validate invoice status is `issued`.
3. Validate original `stockMovementId` references.
4. Check existing reversal movements.
5. Append missing positive `sale_return` movements.
6. Verify reversal movement creation.
7. Mark invoice `cancelled`.
8. Persist cancellation metadata and optional line reversal links.
9. Re-read invoice and movement state.

## Duplicate Safety Policy

Duplicate prevention is keyed by original `sale_deduction` movement id. A
single original deduction may have at most one cancellation reversal movement.

## UI Policy

- Show cancellation action only for eligible issued invoices.
- Require confirmation.
- Require or strongly prefer non-empty reason text.
- Keep issued and cancelled invoices read-only.
- Show original deduction and reversal movement trace after implementation.
- Do not add returns UI.

## Product Safety Policy

Product records are never mutated by invoice cancellation. `Product.quantity`
is never updated or treated as authoritative.

## Inventory Safety Policy

Inventory remains ledger-based. Original `sale_deduction` movements are
preserved, and cancellation uses additive positive reversal movements.

## Risk Assessment

| Risk | Level |
| --- | --- |
| Deleting `sale_deduction` on cancellation | HIGH |
| Voiding `sale_deduction` directly | HIGH |
| Appending reversal movement with duplicate safety | LOW |
| Marking invoice cancelled before reversal creation | HIGH |
| Duplicate cancellation | HIGH |
| Missing original `stockMovementId` | HIGH |
| Cross-account reversal visibility | HIGH |
| Product.quantity mutation | HIGH |
| Data-loss risk | MEDIUM |
| Implementation complexity | MEDIUM |

## Recommended Next Mission

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`.

Cancellation implementation may proceed next after Architect / Owner approval.

Returns may not proceed next. Returns remain deferred.

## Verification

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- No source files changed: PASS.
- No Product mutation: PASS.
- No Inventory mutation: PASS.
- `.env` untracked: PASS.

## Commit

Pending at report creation.

## Tag

Pending at report creation.

## Push

Pending at report creation.

## Final Git Status

Pending at report creation.

V1-SALES-007 Ready for Architect / Owner Review
