# V1-SALES-005 Closure Report

## Classification

ECS.

## Branch

`v1/sales-005-invoice-issue-stock-deduction-flow`

## Baseline Tag

`v1-sales-004-invoice-draft-create-update-flow`

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
- `PATCHES/V1-SALES-002/invoice-stock-integration-plan.md`
- `PATCHES/V1-SALES-003/closure-report.md`
- `PATCHES/V1-SALES-004/verification.md`
- `PATCHES/V1-SALES-004/closure-report.md`

## Source Files Inspected

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/modules/sales/persistence/InvoicePersistenceKey.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Files Changed

Source:

- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/core/Container.ts`

Documentation:

- `PATCHES/V1-SALES-005/verification.md`
- `PATCHES/V1-SALES-005/closure-report.md`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`

Evidence:

- `outputs/V1-SALES-005/baseline-runtime.json`
- `outputs/V1-SALES-005/baseline-dom.json`
- `outputs/V1-SALES-005/baseline-console.log`
- `outputs/V1-SALES-005/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-005/baseline-screenshot.png`
- `outputs/V1-SALES-005/after-runtime.json`
- `outputs/V1-SALES-005/after-dom.json`
- `outputs/V1-SALES-005/after-console.log`
- `outputs/V1-SALES-005/after-storage-snapshot-sanitized.json`
- `outputs/V1-SALES-005/after-screenshot.png`
- `outputs/V1-SALES-005/invoice-issue-summary.json`
- `outputs/V1-SALES-005/verify-runtime.mjs`

## Invoice Issue Mechanism Summary

`InvoiceService.markIssued()` now:

1. Resolves authenticated account context.
2. Requires the target invoice to be `draft`.
3. Rejects drafts that already contain stock movement references.
4. Checks all invoice lines through `InventoryService.checkAvailabilityBatch()`.
5. Blocks issue if availability fails.
6. Creates one `sale_deduction` movement per invoice line.
7. Writes created movement ids onto invoice lines as `stockMovementId`.
8. Marks the invoice `issued` only after movement creation succeeds.

The Invoice page now exposes an `Issue` action for draft invoices only.

## Failed Issue Result

PASS.

A draft invoice requesting more than available stock was blocked. The invoice remained `draft`, no `sale_deduction` was created, movement count stayed unchanged, and a safe status message was recorded.

## Successful Issue Result

PASS.

A draft invoice within available stock was issued. The invoice kept the same id and accountId, status became `issued`, and `issuedAt` was set.

## sale_deduction Result

PASS.

One `sale_deduction` movement was created:

```text
quantityDelta: -2
referenceType: invoice
referenceId: issued invoice id
```

## Invoice Line stockMovementId Result

PASS.

The issued invoice line received the created movement id, and the id references the persisted `sale_deduction` movement.

## Duplicate Issue Safety Result

PASS.

Re-issuing the same invoice failed safely with no new movement. Movement count remained unchanged and the invoice stayed `issued`.

## Availability Before / After Result

PASS.

```text
available before issue: 5
available after issue: 3
available after reload: 3
```

## Product Safety Result

PASS.

- Product scoped hash remained unchanged during issue.
- Product quantity remained unchanged at 999 in the runtime fixture.
- Legacy Product key remained unchanged/null.
- No Product CRUD behavior changed.

## Inventory Safety Result

PASS.

- Failed issue did not write stock movements.
- Successful issue wrote exactly one `sale_deduction`.
- Duplicate issue did not write another movement.
- Manual adjustment behavior was not changed.

## Route Guard Result

PASS.

Invoice route remains protected, Login remains public, and authenticated access works after login.

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

## Confirmation No Invoice Cancellation Behavior

Confirmed.

No cancellation UI/action was added.

## Confirmation No Product CRUD Behavior Changed

Confirmed.

No Product files were modified and runtime Product hashes stayed unchanged during issue.

## Confirmation No Firebase UID As AccountId

Confirmed.

Runtime verified explicit accountId remains distinct from Firebase UID/provider user id.

## Confirmation No Default Account Fallback

Confirmed.

The flow uses the authenticated `AuthSession.account.id` boundary.

## Confirmation .env Untracked

Confirmed.

`.env` remains untracked by Git.

## Commit Hash

Pending until commit.

## Tag Name

`v1-sales-005-invoice-issue-stock-deduction-flow`

## Push Result

Pending until push.

## Final Git Status

Pending until commit and push.

## Recommended Next Mission

Owner-approved invoice cancellation / reversal planning or the next Sales/Clients dependency gate after review of V1-SALES-005.

Do not start the next mission in this closure.
