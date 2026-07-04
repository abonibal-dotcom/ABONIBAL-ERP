# V1-INV-006 Verification

## Mission

`V1-INV-006 - Inventory Movement History / Current Stock View`

Classification: `ECS`

## Pre-check

- Working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Branch: `v1/inv-006-inventory-movement-history-current-stock-view`
- Baseline tag: `v1-inv-005-manual-opening-balance-adjustment-flow`
- Baseline commit: `d2262452a703884c61fbc2498e756b485430c07c`
- `.env` tracked by Git: no
- Tracked working tree before source changes: clean
- Product regression accepted: ECS-011
- Stock Movement Ledger runtime accepted: V1-INV-004
- Manual Inventory flow accepted: V1-INV-005
- Invoice work remains blocked.
- Product records must not be mutated by this mission.

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`: one mission at a time, source/product work separated from tooling, minimal scoped change.
- `PROJECT_ORIENTATION.md`: V1 prioritizes stable operational flows and documented boundaries.
- `PROJECT_STATUS.md`: Auth, Route Guard, Product account-scoped persistence, Product regression, and Inventory manual movement flow are accepted.
- `CURRENT_MISSION.md`: V1-INV-005 was complete and ready for Architect / Owner review.
- `ROADMAP.md`: V1-INV-006 follows V1-INV-005 before any invoice stock deduction.
- `CHANGELOG.md`: V1-INV-005 added the protected Inventory route and manual movement flow.
- `DECISIONS.md`: `accountId` is the V1 data boundary; Firebase UID/provider user id must not be used as `accountId`; Product quantity is not authoritative.
- `PATCHES/ECS-011/closure-report.md`: Product module regression PASS.
- `PATCHES/V1-INV-002/closure-report.md`: ledger is the authoritative stock model; Product quantity is legacy/display-compatible.
- `PATCHES/V1-INV-003/closure-report.md`: stock movement persistence baseline added under `src/modules/inventory/`.
- `PATCHES/V1-INV-004/closure-report.md`: ledger runtime PASS.
- `PATCHES/V1-INV-005/verification.md`: manual Inventory opening balance / adjustment flow PASS.
- `PATCHES/V1-INV-005/closure-report.md`: protected Inventory route and manual movement UI accepted.

## Source Inspection

- Current stock display exists before implementation: yes, via `#inventory-products-table`.
- Movement history display exists before implementation: no.
- Movement records readable from service: yes, via `InventoryService.getAll()`.
- Current quantity computation available: yes, via `InventoryService.getCurrentQuantity()`.
- Voided movement display support exists before implementation: no.
- Active Product read available: yes, via `ProductService.getAll()`.

Inspected source:

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/pages/InventoryPage.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/ui/navigation/Sidebar.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/core/Application.ts`
- `src/main.ts`

## Baseline Validation

One initial verifier attempt failed before valid evidence capture because of a verifier-side selector-expression syntax issue. It was classified as a TOOL baseline attempt and was not used as baseline evidence.

Valid baseline evidence was then captured successfully.

- Baseline Valid: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Inventory route protected: PASS.
- Login: PASS.
- AuthSession.accountId exists: PASS.
- Route Guard remains active: PASS.
- Inventory route works: PASS.
- V1-INV-005 opening balance / manual adjustment flow still works: PASS.
- Stock movement service can read records: PASS.
- Current quantity can be computed from service: PASS.
- Current stock table visible: PASS.
- Movement history visible before implementation: no.
- Product scoped hash recorded: PASS.
- Legacy Product hash recorded if present: PASS.

Baseline files:

- `outputs/V1-INV-006/baseline-runtime.json`
- `outputs/V1-INV-006/baseline-dom.json`
- `outputs/V1-INV-006/baseline-console.log`
- `outputs/V1-INV-006/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-INV-006/baseline-screenshot.png`

## Implementation Summary

Minimal source change:

- Updated `src/modules/inventory/pages/InventoryPage.ts`.

The page now renders:

- A stable `#inventory-current-stock-view` section.
- A read-only `#inventory-movement-history-view` section.
- Movement rows from `InventoryService.getAll()`.
- Product names for active Products and productId fallback for missing Product references.
- Movement type, quantityDelta, reason, createdAt, and status.
- Voided movements as `Voided`, while current quantity remains computed by the service from non-voided movements.

No Product files, Auth files, route files, persistence drivers, ledger repository/service/validator files, invoices, or migration logic were changed.

## Verification Results

- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

Runtime gates:

| Gate | Result |
| --- | --- |
| Unauthenticated Inventory access blocked/redirected | PASS |
| Login succeeds | PASS |
| AuthSession exists | PASS |
| AuthSession.accountId exists | PASS |
| Inventory route accessible after login | PASS |
| Route Guard remains active | PASS |
| accountId not Firebase UID | PASS |
| accountId not providerUserId | PASS |
| Current stock view renders | PASS |
| Active Product rows render | PASS |
| Current quantity displayed equals ledger computation | PASS |
| Product.quantity not authoritative | PASS |
| Soft-deleted Products not shown as active stock rows | PASS |
| Movement history renders | PASS |
| Opening balance movement appears | PASS |
| Manual adjustment movement appears | PASS |
| Movement count displayed matches valid ledger count | PASS |
| Voided movement shown as voided | PASS |
| Voided movement excluded from current quantity | PASS |
| Missing Product reference safe | PASS |
| Malformed movement record safe | PASS |
| Reload preserves current stock | PASS |
| Reload preserves movement history | PASS |
| `stockMovements:{accountId}` readable | PASS |
| `products:{accountId}` hash unchanged | PASS |
| Product records not mutated by Inventory read/history display | PASS |
| Product.quantity not updated | PASS |
| `localStorage.products` unchanged if present | PASS |
| No invoice implementation | PASS |
| No Product CRUD behavior changed | PASS |
| `.env` untracked | PASS |

## Runtime Evidence Summary

- Sanitized accountId: recorded in `after-runtime.json`.
- Inventory route result: protected and accessible after login.
- Product ids displayed: one active Product row.
- Raw movement count in storage: 5, including one intentionally malformed runtime record.
- Valid ledger movement count: 4.
- Movement count displayed: 4.
- Service current quantity: 7.
- DOM current quantity: 7.
- Voided movement display: PASS.
- Reload current stock result: 7.
- Reload movement history result: 4 rows.
- Product scoped key hash before/after: unchanged.
- Legacy Product key hash before/after: unchanged/null.
- Console errors count: 0.
- Page exceptions count: 0.
- `.env` remains untracked: yes.

After files:

- `outputs/V1-INV-006/after-runtime.json`
- `outputs/V1-INV-006/after-dom.json`
- `outputs/V1-INV-006/after-console.log`
- `outputs/V1-INV-006/after-storage-snapshot-sanitized.json`
- `outputs/V1-INV-006/after-screenshot.png`
- `outputs/V1-INV-006/inventory-read-summary.json`

## Result

V1-INV-006 verification PASS.
