# V1-SALES-001 Invoice Foundation Baseline

## Mission

`V1-SALES-001 - Sales / Invoice Foundation Baseline`

## Classification

INF.

This mission assessed the Sales / Invoice foundation only. It did not implement invoices, invoice UI, invoice persistence, invoice stock deduction, Product work, Inventory work, Auth behavior, or localStorage migration.

## Accepted Baseline

`v1-inv-007-stock-availability-invoice-gate`

Accepted foundations:

- V1-AUTH-014 authenticated session runtime verification.
- V1-AUTH-015 route guard foundation.
- ECS-006 through ECS-011 Product foundations and regression baseline.
- V1-PER-005 and V1-PER-006 Product account-scoped persistence and legacy import.
- V1-INV-001 through V1-INV-007 Inventory foundation, ledger, manual flow, current stock/history, and stock availability gate.

## Pre-check

- Current working directory: `C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\work\ABONIBAL-ERP`
- Branch: `v1/sales-001-invoice-foundation-baseline`
- Baseline tag: `v1-inv-007-stock-availability-invoice-gate`
- Baseline commit: `a691e3b8f168fd6b9ece20c39542870d9c65b158`
- `.env` tracked by Git: no.
- Product regression accepted: yes, ECS-011.
- Inventory ledger accepted: yes, V1-INV-003 through V1-INV-004.
- Stock availability gate accepted: yes, V1-INV-007.
- Invoice implementation has not started: confirmed.
- Tracked working tree before documentation updates: clean.

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`: INF missions must not change product behavior and must keep documentation consistent.
- `PROJECT_ORIENTATION.md`: product behavior changes are forbidden inside INF missions.
- `PROJECT_STATUS.md`: Product, Auth, Inventory, and stock availability foundations are complete from execution side.
- `CURRENT_MISSION.md`: V1-INV-007 was complete before V1-SALES-001 started.
- `ROADMAP.md`: Sales / Invoices belong in V1 after Inventory.
- `CHANGELOG.md`: V1-INV-007 added the stock availability gate.
- `DECISIONS.md`: V1 must prevent selling unavailable stock; sales/invoice work must include stock availability checks before invoice confirmation.
- `PATCHES/ECS-011/closure-report.md`: Product module regression PASS.
- `PATCHES/V1-INV-005/closure-report.md`: manual Inventory movement flow PASS.
- `PATCHES/V1-INV-006/closure-report.md`: Inventory current stock/history PASS.
- `PATCHES/V1-INV-007/verification.md`: stock availability gate PASS.
- `PATCHES/V1-INV-007/closure-report.md`: stock availability gate accepted from execution side.

## Source Inspection

Inspected:

- Invoice / Sales source paths: none found.
- `src/router/routes.ts`
- `src/core/Container.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

## Current Invoice State

- Invoice module exists: no.
- Invoice route exists: no.
- Invoice UI exists: no.
- Invoice service exists: no.
- Invoice repository exists: no.
- Invoice storage key exists: no.
- Invoice storage is account-scoped: unknown, because no invoice storage exists.
- Invoice depends on Products: no current invoice code exists.
- Invoice depends on Inventory: no current invoice code exists.
- Retail sales module exists: no.
- Existing invoice data in localStorage: none observed during runtime verification.
- Existing sales storage in localStorage: none observed during runtime verification.

## Runtime Evidence

Evidence files:

- `outputs/V1-SALES-001/runtime.json`
- `outputs/V1-SALES-001/dom.json`
- `outputs/V1-SALES-001/console.log`
- `outputs/V1-SALES-001/storage-snapshot-sanitized.json`
- `outputs/V1-SALES-001/screenshot.png`

Runtime result: PASS.

- Login: PASS.
- Products route: PASS.
- Inventory route: PASS.
- Stock availability gate available: PASS.
- Invoice route absent: PASS.
- Sales route absent: PASS.
- Invoice storage absent: PASS.
- Product data mutation: none.
- Stock movement mutation: none.
- Console errors: 0.
- Page exceptions: 0.

## Finding

The repository is ready for Sales / Invoice planning, not invoice implementation.

The next mission should define the account-scoped invoice storage boundary, invoice lifecycle, invoice number strategy, line item contract, Product snapshot policy, and future stock deduction dependency before any UI or invoice creation behavior is added.
