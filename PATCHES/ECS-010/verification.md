# ECS-010 Verification

## Mission

`ECS-010 - Product Search / Filter Path`

## Classification

ECS.

## Baseline

- Branch: `ecs/010-product-search-filter`
- Baseline tag: `ecs-009-product-safe-delete-path`
- Baseline source state: accepted ECS-009 tag.
- `.env` status: local and untracked.

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
- `PATCHES/V1-PER-005/closure-report.md`
- `PATCHES/V1-PER-006/closure-report.md`
- `PATCHES/ECS-007/closure-report.md`
- `PATCHES/ECS-008/closure-report.md`
- `PATCHES/ECS-009/closure-report.md`
- `PATCHES/ECS-009/verification.md`

## Source Files Inspected

- `src/modules/products/Product.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/pages/ProductListPage.ts`
- `src/modules/products/ui/ProductForm.ts`
- `src/modules/products/dialogs/ProductDialog.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/router/routes.ts`

## Search / Filter Availability Before Fix

```text
existing search UI: yes
existing filter UI: no
existing search service method: no
existing category/barcode fields: yes
deleted Products excluded by getAll: yes
```

Runtime baseline proved the existing `#product-search` input did not filter Product rows. The active Product list already excluded soft-deleted records through `ProductService.getAll()`.

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
- Active Product count: 2.
- Total stored scoped Product count: 3.
- Deleted Product count: 1.
- Deleted Products hidden from active list: yes.
- Search input present: yes.
- Search service method present: no.
- Search appeared functional before fix: no.
- Scoped Product storage unchanged during baseline probe: yes.
- Legacy `products` present and unchanged during baseline: yes.
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
- `PATCHES/ECS-010/verification.md`
- `PATCHES/ECS-010/closure-report.md`

## Implementation Summary

- Reused the existing `#product-search` input.
- Added an `input` listener during `onEnter()`.
- Removed the search listener during `onLeave()`.
- Filtered only the already-loaded active Products returned by `ProductService.getAll()`.
- Matched against `name`, `barcode`, and `category`.
- Kept no-results rendering inside the existing Products table.

No Product Create, Edit, Delete, Safe Delete, Auth, Route Guard, persistence driver, repository, service, router, legacy migration, inventory, invoices, stock, suppliers, expenses, or reports changes were made.

## Runtime Verification Result

- Unauthenticated Products access blocked / redirected: yes.
- Login succeeds: yes.
- AuthSession exists: yes.
- AuthSession account id exists: yes.
- Account id is not Firebase UID / provider user id: yes.
- Products route accessible after login: yes.
- Route Guard active: yes.
- Search UI available: yes.
- Initial active Product count: 2.
- Total stored Product count: 3.
- Deleted Product count: 1.
- Matching Product name search rendered count: 1.
- Matching Product name search returned expected active Product: yes.
- Non-matching search rendered count: 0.
- Non-matching search showed no-results state: yes.
- Deleted Product search rendered count: 0.
- Deleted Product remained hidden from search results: yes.
- Clear search restored full active count: yes.
- Product storage record count changed during search: no.
- Scoped Product storage hash unchanged: yes.
- Legacy `localStorage.products` remained present: yes.
- Legacy `localStorage.products` hash unchanged: yes.
- Console errors: 0.
- Page exceptions: 0.

## Evidence

Evidence location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\ECS-010\
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
- `search-summary.json`

## Scope Confirmation

- No Product Create behavior change.
- No Product Edit behavior change.
- No Product Delete behavior change.
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
