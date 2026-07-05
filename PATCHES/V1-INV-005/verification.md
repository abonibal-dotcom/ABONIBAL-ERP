# V1-INV-005 Verification

## Mission

`V1-INV-005 - Manual Opening Balance / Adjustment Flow`

Classification: `ECS`

## Pre-check

- Working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Branch: `v1/inv-005-manual-opening-balance-adjustment-flow`
- Baseline tag: `v1-inv-004-stock-movement-ledger-runtime-verification`
- Baseline commit: `8f74d3d6acb5c9eb002563056efde49b79a8e255`
- `.env` tracked by Git: no
- Tracked working tree before source changes: clean
- Product regression accepted: ECS-011
- Stock Movement Ledger runtime accepted: V1-INV-004
- Invoice work remains blocked.
- Product records must not be mutated by this mission.

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`: one mission/root cause at a time, Product vs Infrastructure separation, no mixed app/tooling commits.
- `PROJECT_ORIENTATION.md`: V1 prioritizes stable operational flows and documented boundaries.
- `PROJECT_STATUS.md`: Auth, Route Guard, Product account-scoped persistence, Product regression, and Inventory ledger runtime are accepted.
- `CURRENT_MISSION.md`: V1-INV-004 was complete and recommended V1-INV-005 next.
- `ROADMAP.md`: V1-INV-005 is the next Inventory mission; invoice stock deduction remains blocked.
- `CHANGELOG.md`: V1-INV-004 verified ledger runtime without source changes.
- `DECISIONS.md`: `accountId` is the V1 data boundary; Firebase UID/provider user id must not be used as `accountId`; Product quantity is not authoritative.
- `PATCHES/ECS-011/closure-report.md`: Product module regression PASS.
- `PATCHES/V1-INV-002/closure-report.md`: ledger is the authoritative stock model; Product quantity is legacy/display-compatible.
- `PATCHES/V1-INV-003/closure-report.md`: stock movement persistence baseline added under `src/modules/inventory/`.
- `PATCHES/V1-INV-004/verification.md`: ledger runtime verification PASS.
- `PATCHES/V1-INV-004/closure-report.md`: no source fix needed; no Inventory UI/route existed before V1-INV-005.

## Source Inspection

- Inventory route exists before implementation: no.
- Inventory page exists before implementation: no.
- Inventory nav item exists before implementation: no.
- Stock movement service available in container: yes.
- ProductService active product read available: yes, via `ProductService.getAll()`.
- Current quantity computation available: yes, via `InventoryService.getCurrentQuantity()`.

Inspected source:

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
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

Two initial verifier attempts failed before valid evidence capture because of verifier-side JavaScript expression issues. These were classified as TOOL baseline attempts and were not used as baseline evidence.

Valid baseline evidence was then captured successfully.

- Baseline Valid: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Inventory route/page/nav before implementation: absent.
- Login: PASS.
- AuthSession.accountId exists: PASS.
- Route Guard remains active: PASS.
- Products route works: PASS.
- Active Products existed after controlled scoped setup: PASS.
- Stock movement service can read existing movements: PASS.
- Product scoped hash recorded: PASS.
- Legacy Product hash recorded if present: PASS.

Baseline files:

- `outputs/V1-INV-005/baseline-runtime.json`
- `outputs/V1-INV-005/baseline-dom.json`
- `outputs/V1-INV-005/baseline-console.log`
- `outputs/V1-INV-005/baseline-storage-snapshot-sanitized.json`
- `outputs/V1-INV-005/baseline-screenshot.png`

## Implementation Summary

Minimal source changes:

- Added `src/modules/inventory/pages/InventoryPage.ts`.
- Updated `src/router/routes.ts` to register protected `inventory` route and one navigation item.

No Product files, Auth files, persistence drivers, ledger repository/service/validator files, invoices, or migration logic were changed.

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
| Inventory page renders | PASS |
| Product selector uses active Products | PASS |
| Soft-deleted Products not selectable | PASS |
| Current quantity displayed | PASS |
| Invalid opening balance does not write | PASS |
| Valid opening balance writes one movement | PASS |
| Movement writes to `stockMovements:{accountId}` | PASS |
| Movement includes accountId/productId/createdBy | PASS |
| Current quantity reflects opening balance | PASS |
| Invalid manual adjustment does not write | PASS |
| Valid manual adjustment writes one movement | PASS |
| Current quantity reflects opening balance + adjustment | PASS |
| Movement count increases exactly as expected | PASS |
| Reload preserves movement records | PASS |
| Reload preserves computed current quantity | PASS |
| Inventory page displays persisted quantity after reload | PASS |
| `products:{accountId}` hash unchanged | PASS |
| Product records not mutated by Inventory flow | PASS |
| `Product.quantity` not updated | PASS |
| `localStorage.products` unchanged if present | PASS |
| No invoice implementation | PASS |
| No Product CRUD behavior changed | PASS |
| `.env` untracked | PASS |

## Runtime Evidence Summary

- Sanitized accountId: recorded in `after-runtime.json`.
- Storage key: `stockMovements:{accountId}`.
- Product id used: recorded in `inventory-flow-summary.json`.
- Movement count before: 0.
- Movement count after opening balance: 1.
- Movement count after manual adjustment: 2.
- Opening balance movement id: recorded in `inventory-flow-summary.json`.
- Manual adjustment movement id: recorded in `inventory-flow-summary.json`.
- Current quantity after opening balance: 10.
- Current quantity after adjustment: 7.
- Current quantity after reload: 7.
- Product scoped key hash before/after: unchanged.
- Legacy Product key hash before/after: unchanged/null.
- Console errors count: 0.
- Page exceptions count: 0.
- `.env` remains untracked: yes.

After files:

- `outputs/V1-INV-005/after-runtime.json`
- `outputs/V1-INV-005/after-dom.json`
- `outputs/V1-INV-005/after-console.log`
- `outputs/V1-INV-005/after-storage-snapshot-sanitized.json`
- `outputs/V1-INV-005/after-screenshot.png`
- `outputs/V1-INV-005/inventory-flow-summary.json`

## Result

V1-INV-005 verification PASS.
