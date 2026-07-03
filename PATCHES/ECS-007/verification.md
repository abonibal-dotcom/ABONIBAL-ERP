# ECS-007 Verification

## Mission

`ECS-007 - Product Create Path`

## Classification

ECS.

## Baseline

- Branch: `ecs/007-product-create-path`
- Baseline tag: `v1-per-006-legacy-product-scoped-import`
- Baseline source state: accepted V1-PER-006 tag.
- `.env` status: local and untracked.

## Baseline Attempt Note

`baseline-attempt-001-*` files were produced by a first runtime attempt on a new localhost port.

That attempt was rejected as a Baseline because localStorage is origin-scoped and the new port did not expose the accepted V1-PER-006 Product storage state.

The valid Baseline was regenerated on `http://127.0.0.1:61832/`, the accepted Product evidence origin, and is the only baseline used for ECS-007 comparison.

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `PATCHES/V1-AUTH-014/closure-report.md`
- `PATCHES/V1-AUTH-015/closure-report.md`
- `PATCHES/ECS-006/closure-report.md`
- `PATCHES/V1-PER-005/closure-report.md`
- `PATCHES/V1-PER-006/closure-report.md`
- `PATCHES/V1-PER-006/verification.md`

## Source Files Inspected

- `src/modules/products/Product.ts`
- `src/modules/products/dto/ProductData.ts`
- `src/modules/products/factories/ProductFactory.ts`
- `src/modules/products/validators/ProductValidator.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/pages/ProductListPage.ts`
- `src/modules/products/ui/ProductForm.ts`
- `src/modules/products/dialogs/ProductDialog.ts`
- `src/modules/products/dialogs/tabs/GeneralTab.ts`
- `src/modules/products/dialogs/tabs/PricingTab.ts`
- `src/modules/products/dialogs/tabs/InventoryTab.ts`
- `src/modules/products/dialogs/tabs/ImagesTab.ts`
- `src/modules/products/dialogs/components/ProductTabs.ts`
- `src/modules/products/dialogs/components/ProductHeader.ts`
- `src/modules/products/dialogs/components/ProductFooter.ts`
- `src/modules/products/stores/ProductStore.ts`
- `src/core/Container.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/router/routes.ts`

## Create Path Availability Before Fix

```text
existing create service: yes
existing create repository method: yes
existing create UI/dialog: partial
existing validation: yes
```

The missing boundary was the Products page save binding. Runtime baseline proved the Save button existed but did not create a Product.

## Baseline Runtime Result

- Baseline valid: yes.
- Route Guard active: yes.
- Unauthenticated Products access blocked: yes.
- Login succeeds: yes.
- AuthSession exists: yes.
- `accountId` present: yes.
- `accountId` equals provider user id: no.
- Products route accessible after login: yes.
- Products render from `products:{accountId}`: yes.
- Scoped Product count before create: 2.
- Legacy `products` present: yes.
- Legacy Product count: 1.
- Product Create button present: yes.
- Product dialog present: yes.
- Save button present: yes.
- Baseline save attempt with valid fields created Product: no.
- Scoped Product count after baseline save attempt: 2.
- Legacy key unchanged during baseline: yes.
- Product Edit UI present: no.
- Product Delete UI present: no.
- Console errors: 0.
- Page exceptions: 0.

## Files Changed

Source:

- `src/modules/products/pages/ProductListPage.ts`

Documentation:

- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PATCHES/ECS-007/verification.md`
- `PATCHES/ECS-007/closure-report.md`

## Implementation Summary

- Reused the existing `ProductDialog` for input collection.
- Reused the existing `ProductFactory` for Product object creation.
- Reused the existing `ProductService.add()` account-scoped write boundary.
- Added a retained Save button listener in `ProductListPage`.
- Removed the Save listener during `onLeave()` to preserve listener lifecycle behavior.
- Re-rendered the Product table only after a successful create.

No Product Edit, Product Delete, search/filter, Auth, Route Guard, persistence driver, repository, service, router, or legacy migration changes were made.

## Runtime Verification Result

- Unauthenticated Products access blocked / redirected: yes.
- Login succeeds: yes.
- AuthSession exists: yes.
- AuthSession account id exists: yes.
- Account id is not Firebase UID / provider user id: yes.
- Products route accessible after login: yes.
- Route Guard active: yes.
- Product Create UI/action available: yes.
- Invalid create attempt wrote Product: no.
- Scoped Product count before create: 2.
- Scoped Product count after invalid create attempt: 2.
- Valid Product Create succeeded: yes.
- Scoped Product count after valid create: 3.
- Product count increased by exactly 1: yes.
- New Product written to `products:{accountId}`: yes.
- New Product includes `accountId`: yes.
- New Product includes `createdBy`: yes.
- New Product includes `updatedBy`: yes.
- New Product appears in Products UI: yes.
- New Product remains visible after reload: yes.
- Legacy `localStorage.products` remained present: yes.
- Legacy `localStorage.products` hash unchanged: yes.
- Product Edit UI added: no.
- Product Delete UI added: no.
- Console errors: 0.
- Page exceptions: 0.

## Evidence

Evidence location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\ECS-007\
```

Baseline:

- `baseline-runtime.json`
- `baseline-dom.json`
- `baseline-console.log`
- `baseline-storage-snapshot-sanitized.json`
- `baseline-screenshot.png`

After:

- `after-runtime.json`
- `after-dom.json`
- `after-console.log`
- `after-storage-snapshot-sanitized.json`
- `after-screenshot.png`
- `create-summary.json`

## Scope Confirmation

- No Product Edit UI.
- No Product Delete UI.
- No Product Search / Filter feature.
- No destructive migration.
- No legacy `localStorage.products` deletion.
- No legacy `localStorage.products` mutation.
- No automatic import on app startup.
- No Route Guard weakening.
- No Firebase Auth behavior change.
- No persistence driver change.
- No Firebase UID / provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.
