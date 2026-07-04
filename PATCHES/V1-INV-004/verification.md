# V1-INV-004 Verification

## Mission

`V1-INV-004 - Stock Movement Ledger Runtime Verification`

## Classification

ECS.

## Baseline

- Branch: `v1/inv-004-stock-movement-ledger-runtime-verification`.
- Baseline tag: `v1-inv-003-stock-movement-ledger-persistence-baseline`.
- Baseline commit: `8f67b19ba52b194e91516ca7fb5b2e86412a97de`.
- `.env` tracked by Git: no.
- Product regression accepted: yes, through ECS-011.
- Stock Movement Ledger persistence accepted: yes, through V1-INV-003.

## Document Read Summary

- `ENGINEERING_CONSTITUTION.md`: ECS requires evidence before code, runtime verification, complete evidence, documentation, commit, tag, and push.
- `PROJECT_ORIENTATION.md`: runtime evidence has priority over terminal output and assumptions.
- `PROJECT_STATUS.md`: V1-INV-003 is accepted as the current Inventory ledger persistence baseline.
- `CURRENT_MISSION.md`: V1-INV-003 recommended V1-INV-004 as the next Inventory mission.
- `ROADMAP.md`: invoice stock deduction remains blocked until Inventory ledger gates are reviewed and accepted.
- `CHANGELOG.md`: V1-INV-003 added the minimal ledger baseline without UI, routes, invoices, Product mutation, Auth changes, or fallback account behavior.
- `DECISIONS.md`: V1 uses explicit `accountId`; Firebase uid/provider user id fallback is rejected.
- `PATCHES/ECS-011/closure-report.md`: Product regression and Route Guard baseline are accepted.
- `PATCHES/V1-INV-001/closure-report.md`: Product is a safe Inventory reference but not an authoritative stock source.
- `PATCHES/V1-INV-002/closure-report.md`: ledger is the authoritative Inventory model and Product quantity is not authoritative.
- `PATCHES/V1-INV-003/verification.md`: scoped ledger append, void, reload, and Product safety passed.
- `PATCHES/V1-INV-003/closure-report.md`: V1-INV-003 implemented the accepted minimal ledger persistence baseline.

## Source Inspection Summary

- Existing add movement: yes.
- Existing getAll: yes.
- Existing getByProductId: yes.
- Existing getCurrentQuantity: yes.
- Existing getCurrentQuantities: yes.
- Existing voidMovement: yes.
- Validator present: yes.
- Scoped storage key helper present: yes.
- Invoice files present: no.

Inspected source files:

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/core/Container.ts`
- `src/modules/products/Product.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/router/routes.ts`

## Verification Environment

- Runtime: Vite dev server.
- Browser: Chrome headless with isolated temporary profile.
- Verification Tool: Chrome DevTools Protocol direct WebSocket client stored under `outputs/V1-INV-004/`.
- Reason for Selection: CDP is the established repository runtime verifier and does not require adding project test dependencies.
- Known Limitations: Runtime evidence is collected from an isolated browser profile. Tool failures are classified separately and are not treated as application failures.

## TypeScript Verification

Command:

```bash
pnpm exec tsc --noEmit
```

Result: PASS.

## Build Verification

Command:

```bash
pnpm run build
```

Result: PASS.

## Runtime Verification

Command:

```bash
node outputs/V1-INV-004/verify-runtime.mjs
```

Result: PASS.

## Runtime Evidence Files

```text
outputs/V1-INV-004/runtime.json
outputs/V1-INV-004/dom.json
outputs/V1-INV-004/console.log
outputs/V1-INV-004/storage-snapshot-sanitized.json
outputs/V1-INV-004/screenshot.png
outputs/V1-INV-004/ledger-runtime-summary.json
```

## Runtime Gates

| Gate | Result |
| --- | --- |
| Login succeeds | PASS |
| AuthSession exists | PASS |
| AuthSession.accountId exists | PASS |
| accountId is not Firebase UID | PASS |
| accountId is not providerUserId | PASS |
| Route Guard remains active | PASS |
| Ledger uses `stockMovements:{accountId}` | PASS |
| No global stock movement key is used | PASS |
| No other account movement key affects current account | PASS |
| Movement records include accountId | PASS |
| Movement records include productId | PASS |
| Movement records include createdBy | PASS |
| Opening balance append | PASS |
| Manual adjustment append | PASS |
| Correction append | PASS |
| Existing valid movements preserved | PASS |
| Movement ids unique | PASS |
| Expected valid append count only | PASS |
| Missing productId rejected | PASS |
| Missing / invalid accountId rejected | PASS |
| Non-numeric quantityDelta rejected | PASS |
| Invalid movement type rejected | PASS |
| Invalid attempts do not write records | PASS |
| Malformed existing record does not crash quantity computation | PASS |
| Product A current quantity | PASS |
| Product B grouped quantity | PASS |
| Product A / Product B isolation | PASS |
| Voided movement excluded from current quantity | PASS |
| Missing Product reference handled safely | PASS |
| Voiding preserves movement record | PASS |
| Void metadata recorded | PASS |
| Count does not decrease after void | PASS |
| Re-void is safe | PASS |
| Non-existing void is safe | PASS |
| Reload preserves records | PASS |
| Reload preserves current quantity | PASS |
| Service recomputes after reload | PASS |
| `products:{accountId}` hash unchanged | PASS |
| Product records not mutated | PASS |
| Product.quantity not updated | PASS |
| Product.quantity not authoritative | PASS |
| `localStorage.products` hash unchanged | PASS |
| No Inventory UI | PASS |
| No Inventory route | PASS |
| No invoice implementation | PASS |
| No Product CRUD behavior change | PASS |
| Console errors = 0 | PASS |
| Page exceptions = 0 | PASS |
| `.env` remains untracked | PASS |

## Ledger Measurements

- Sanitized accountId: `abonibal...3627edde0203`.
- Stock movement scoped key: `stockMovements:{accountId}`.
- Product ids used:
  - `v1-inv-004-product-a`
  - `v1-inv-004-product-b`
  - `v1-inv-004-missing-reference-product`
- Movement count before verification: 0.
- Valid append count: 5.
- Invalid append count: 4.
- Invalid writes rejected count: 4.
- Movement count after valid appends: 5.
- Movement count after invalid attempts: 5.
- Movement count after void: 5.
- Product A current quantity after valid appends: 9.
- Product A current quantity after void: 11.
- Product B current quantity: 4.
- Missing Product reference quantity: 3.
- Reload Product A quantity: 11.
- Reload Product B quantity: 4.
- Product scoped hash before/after: unchanged.
- Legacy Product hash before/after: unchanged.
- Console errors: 0.
- Page exceptions: 0.
- `.env` remains untracked: yes.

## Source Fix Decision

No source fix was needed. V1-INV-004 found no ledger runtime regression.

## Result

V1-INV-004 verification PASS.
