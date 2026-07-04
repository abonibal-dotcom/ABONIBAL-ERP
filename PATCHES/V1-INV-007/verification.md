# V1-INV-007 Verification

## Mission

`V1-INV-007 - Inventory Stock Availability / Invoice Dependency Gate`

## Classification

ECS.

## Branch

`v1/inv-007-stock-availability-invoice-gate`

## Baseline Tag

`v1-inv-006-inventory-movement-history-current-stock-view`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`: ECS work requires baseline evidence, narrow scope, runtime verification, clean console, no page exceptions, and separation between product and tooling work.
- `PROJECT_ORIENTATION.md`: no source changes before evidence, no random features, no unapproved architecture changes, tool failures are not application failures.
- `PROJECT_STATUS.md`: Auth, Route Guard, Product account-scoped persistence, Product regression, and Inventory missions V1-INV-001 through V1-INV-006 are complete from execution side.
- `CURRENT_MISSION.md`: V1-INV-006 was the current accepted Inventory read/history mission before V1-INV-007.
- `ROADMAP.md`: V1 must prevent selling unavailable stock and uses `accountId` as the data boundary.
- `CHANGELOG.md`: V1-INV-006 added current stock and movement history display on top of the ledger.
- `DECISIONS.md`: `accountId` is the V1 data boundary; Firebase UID/provider user id must not be used as `accountId`; V1 must prevent selling unavailable stock.
- `PATCHES/ECS-011/closure-report.md`: Product module regression PASS.
- `PATCHES/V1-INV-002/closure-report.md`: ledger is authoritative; `Product.quantity` is legacy/display-compatible only.
- `PATCHES/V1-INV-003/closure-report.md`: `stockMovements:{accountId}` persistence baseline accepted.
- `PATCHES/V1-INV-004/closure-report.md`: ledger runtime behavior PASS.
- `PATCHES/V1-INV-005/closure-report.md`: manual opening balance / adjustment flow PASS.
- `PATCHES/V1-INV-006/verification.md`: current stock/history view PASS.
- `PATCHES/V1-INV-006/closure-report.md`: Inventory current stock/history accepted from execution side.

## Source Files Inspected

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/pages/InventoryPage.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

Invoice files present: no.

## Pre-Implementation Source Inspection

- Current quantity computation available: yes, via `InventoryService.getCurrentQuantity()`.
- Availability check exists: no.
- Batch availability check exists: no.
- Soft-deleted Product detection available: yes, via `ProductService.find()` returning only active Products.
- Active Product read available: yes, via `ProductService.getAll()` / `ProductService.find()`.
- Invoice files present: no.

## Baseline Runtime

- Evidence files:
  - `outputs/V1-INV-007/baseline-runtime.json`
  - `outputs/V1-INV-007/baseline-dom.json`
  - `outputs/V1-INV-007/baseline-console.log`
  - `outputs/V1-INV-007/baseline-storage-snapshot-sanitized.json`
  - `outputs/V1-INV-007/baseline-screenshot.png`
- Result: PASS.
- Inventory route protected: PASS.
- Login: PASS.
- AuthSession.accountId exists: PASS.
- Current stock view renders: PASS.
- Movement history renders: PASS.
- Current quantity computation: PASS, quantity 7.
- Availability gate missing/incomplete: PASS.
- `getAvailableQuantity` existed before fix: no.
- `checkAvailability` existed before fix: no.
- `checkAvailabilityBatch` existed before fix: no.
- Console errors: 0.
- Page exceptions: 0.

## Minimal Fix

Files changed:

- `src/modules/inventory/services/InventoryService.ts`
- `src/core/Container.ts`

Reason for file choices:

- `InventoryService.ts` is the accepted ledger service boundary and already owns current quantity computation.
- `Container.ts` needed one wiring change so `InventoryService` can use the existing `ProductService.find()` active Product boundary to reject missing and soft-deleted Products safely.

No Product files, Router files, Auth files, persistence files, or Invoice files were changed.

## After Runtime

- Evidence files:
  - `outputs/V1-INV-007/after-runtime.json`
  - `outputs/V1-INV-007/after-dom.json`
  - `outputs/V1-INV-007/after-console.log`
  - `outputs/V1-INV-007/after-storage-snapshot-sanitized.json`
  - `outputs/V1-INV-007/after-screenshot.png`
  - `outputs/V1-INV-007/availability-summary.json`
- Result: PASS.
- Stock movement scoped key: `stockMovements:{accountId}`.
- Available quantity: 7.
- Ledger current quantity: 7.
- In-stock request: requested 5, `canFulfill = true`, shortage 0.
- Over-stock request: requested 9, `canFulfill = false`, shortage 2.
- Missing productId: rejected with `invalid_product`.
- Missing Product reference: rejected with `invalid_product`.
- Non-numeric request: rejected with `invalid_requested_quantity`.
- Zero request: rejected with `invalid_requested_quantity`.
- Negative request: rejected with `invalid_requested_quantity`.
- Soft-deleted Product: rejected with `invalid_product`.
- Batch check: implemented; repeated same Product requests are aggregated before availability is checked.
- Voided movements excluded from availability: PASS.
- Movement count before checks: 3.
- Movement count after checks: 3.
- Product scoped hash before/after: unchanged.
- Legacy Product hash before/after: unchanged/null.
- `Product.quantity` before/after: 0 / 0.
- Reload preserves availability result: PASS.
- Console errors: 0.
- Page exceptions: 0.
- `.env` tracked by Git: no.

## Verification Commands

```text
pnpm exec tsc --noEmit
pnpm run build
node outputs/V1-INV-007/verify-runtime.mjs baseline
node outputs/V1-INV-007/verify-runtime.mjs after
```

## Results

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Inventory route protected: PASS.
- Availability gate: PASS.
- In-stock request: PASS.
- Over-stock request blocked: PASS.
- Invalid requests rejected: PASS.
- Soft-deleted Product not fulfillable: PASS.
- Voided movements excluded: PASS.
- No movement mutation: PASS.
- Product records unchanged during availability checks: PASS.
- `Product.quantity` not authoritative and not updated: PASS.
- No invoice implementation: PASS.
- No Product CRUD behavior changed: PASS.
- No Firebase UID as `accountId`: PASS.
- No default account fallback: PASS.
- `.env` remains untracked: PASS.
