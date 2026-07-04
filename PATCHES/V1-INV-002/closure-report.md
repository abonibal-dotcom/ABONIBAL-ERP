# V1-INV-002 Closure Report

## Status

`V1-INV-002 Ready for Architect / Owner Review`

## Classification

INF Inventory architecture and persistence design mission.

This mission produced the account-scoped Stock Movement Ledger design plan only. It did not implement Inventory, stock operations, stock deduction, invoices, Product changes, routes, UI, or migration.

## Branch

`v1/inv-002-stock-movement-ledger-design-plan`

## Baseline Tag

`v1-inv-001-inventory-stock-foundation-baseline`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PATCHES/ECS-011/closure-report.md`
- `PATCHES/V1-INV-001/inventory-stock-foundation-baseline.md`
- `PATCHES/V1-INV-001/verification.md`
- `PATCHES/V1-INV-001/closure-report.md`

## Source Files Inspected

- `src/modules/products/Product.ts`
- `src/modules/products/dto/ProductData.ts`
- `src/modules/products/factories/ProductFactory.ts`
- `src/modules/products/validators/ProductValidator.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/pages/ProductListPage.ts`
- `src/modules/products/dialogs/tabs/InventoryTab.ts`
- `src/modules/products/ui/ProductForm.ts`
- `src/modules/products/stores/ProductStore.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/core/Container.ts`
- `src/router/routes.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`

No invoice, inventory, stock, warehouse, movement, or ledger source files were found.

## Files Changed

Documentation:

- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PATCHES/V1-INV-002/stock-movement-ledger-design-plan.md`
- `PATCHES/V1-INV-002/inventory-storage-boundary-plan.md`
- `PATCHES/V1-INV-002/invoice-stock-dependency-plan.md`
- `PATCHES/V1-INV-002/closure-report.md`

Source:

- None.

## Recommended Inventory Model

Account-scoped Stock Movement Ledger.

The ledger is authoritative. Current stock is computed from movement history rather than direct Product mutation.

## Recommended Storage Boundary

Authoritative:

```text
stockMovements:{accountId}
```

Optional future derived/cache:

```text
inventorySnapshots:{accountId}
```

## Movement Record Shape Summary

Proposed movement fields:

- `id`
- `accountId`
- `productId`
- `type`
- `quantityDelta`
- `unitCost`
- `totalCost`
- `currency`
- `reason`
- `referenceType`
- `referenceId`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`
- `voidedAt`
- `voidedBy`
- `voidReason`

## Movement Types Summary

Recommended movement types:

- `opening_balance`
- `manual_adjustment`
- `purchase_receipt`
- `sale_deduction`
- `sale_return`
- `purchase_return`
- `correction`
- `void`

V1-now candidates:

- `opening_balance`
- `manual_adjustment`
- `correction`
- `void`

Deferred until related modules:

- `purchase_receipt`
- `sale_deduction`
- `sale_return`
- `purchase_return`

## Product Quantity Field Policy

- `Product.quantity` remains legacy/display-compatible and must not be authoritative.
- `Product.minimumQuantity` may remain Product metadata for low-stock alerts.
- Product create/edit flows must not silently become stock adjustment flows.
- Authoritative current quantity is derived from ledger movements.

## Current Quantity Computation Policy

```text
sum(quantityDelta)
where movement.accountId = AuthSession.account.id
and movement.productId = Product.id
and movement is not voided
```

Grouped by `productId` for the current authenticated `accountId`.

## Invoice Dependency Policy

- Invoice creation should create `sale_deduction` movements.
- Invoice cancellation/return should create reversal movements.
- Invoices must not directly edit `Product.quantity`.
- Invoice stock deduction must use explicit `accountId`.
- Invoice stock deduction remains blocked until Inventory persistence and current quantity computation are implemented and verified.

## Risk Assessment

| Risk | Level |
| --- | --- |
| Direct Product.quantity as source of truth | HIGH |
| Stock movement ledger as source of truth | MEDIUM |
| Snapshot-only stock model | HIGH |
| Mixed ledger + derived snapshot model | MEDIUM |
| Implementing invoices before ledger | HIGH |
| Negative stock allowance | MEDIUM |
| Cross-account stock visibility | HIGH |
| Data-loss risk | MEDIUM |
| Implementation complexity | MEDIUM |

## Recommended Next Mission

`V1-INV-003 - Stock Movement Ledger Persistence Baseline`

## Inventory Implementation May Proceed Next

Yes, after Architect / Owner acceptance, limited to a separate approved Inventory implementation mission that introduces the minimal stock movement ledger persistence boundary.

## Invoice Work May Proceed Next

No.

Invoice stock deduction remains blocked until Inventory persistence and current quantity computation are implemented and verified.

## Verification Results

- TypeScript: PASS.
- Build: PASS.
- Runtime mutation: not required and not performed.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No Inventory implementation added.
- No Invoice implementation added.
- No Product data mutation.
- No localStorage migration.
- `.env` remains untracked.

## Commit

Pending.

## Tag

Pending.

## Push Result

Pending.

## Final Git Status

Pending final verification.

## Final Status

`V1-INV-002 Ready for Architect / Owner Review`
