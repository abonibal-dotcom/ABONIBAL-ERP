# V1-PER-005 Verification

## Mission

`V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`

## Classification

ECS.

## Baseline

- Branch: `v1/per-005-product-account-scoped-compatibility-layer`
- Baseline tag: `v1-per-004-product-account-scoped-persistence-plan`
- Baseline source state: accepted V1-PER-004 tag.
- `.env` status: local and untracked.

## Baseline Attempt

The first baseline attempt was cancelled and not used for comparison.

Reason:

- CDP selected an unstable browser target from a reused profile before the Login selector wait completed.
- The attempt did not produce the complete baseline evidence package.
- It is recorded only as `outputs/V1-PER-005/baseline-attempt-failure-1783031293619.json`.

The valid baseline was regenerated from a clean isolated copy of the accepted ECS-006 Chrome profile with explicit CDP target selection for `http://127.0.0.1:61832/`.

## Baseline Runtime Result

- Baseline valid: yes.
- Route Guard active: yes.
- Login succeeds: yes.
- AuthSession created: yes.
- `accountId` present: yes.
- `accountId` equals provider user id: no.
- Products accessible after login: yes.
- Current Product read path reads legacy `products`: yes.
- Current Product read path reads `products:{accountId}`: no.
- Legacy Product renders from `products`: yes.
- Legacy `products` key unchanged during inspection: yes.
- Console errors: 0.
- Page exceptions: 0.

## Root Cause Confirmed

Runtime evidence confirmed that the Products list was still backed by the legacy global key:

```text
ProductListPage -> ProductService.getAll() -> ProductRepository.all() -> Repository.all() -> LocalStorageDriver.read("products")
```

The account-scoped key for the authenticated account did not exist and was not read.

## Files Changed

Source:

- `src/modules/products/Product.ts`
- `src/modules/products/persistence/ProductPersistenceKey.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/core/Container.ts`

Documentation:

- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `PATCHES/V1-PER-005/verification.md`
- `PATCHES/V1-PER-005/closure-report.md`

## Fix Summary

- Added optional Product ownership metadata: `accountId`, `createdBy`, and `updatedBy`.
- Added a Product storage key resolver for `products:{accountId}`.
- Added account-scoped Product repository read/write methods.
- Updated Product service reads to use the authenticated `AuthSession.account.id` boundary.
- Updated Product service writes to attach/preserve ownership metadata.
- Wired ProductService to the existing AuthStateService.

## Safe Default

If there is no authenticated account context, Product reads return an empty list.

This does not fall back to the legacy global `products` key and therefore does not expose global legacy data across accounts.

## Verification Commands

- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Runtime Verification: PASS.

## Runtime Verification Result

- Unauthenticated Products access blocked / redirected: yes.
- Login succeeds: yes.
- AuthSession exists: yes.
- AuthSession account id exists: yes.
- Account id is not Firebase UID / provider user id: yes.
- Role is `owner` or `user`: yes.
- Products accessible after login: yes.
- Route Guard active: yes.
- Current scoped key pattern: `products:{accountId}`.
- Empty scoped storage renders empty list: yes.
- Malformed scoped storage does not crash: yes.
- Product reads use scoped key: yes.
- Product reads do not use legacy `products`: yes.
- Legacy `products` remains present: yes.
- Legacy `products` hash unchanged: yes.
- No migration observed: yes.
- Verification-created scoped Product renders: yes.
- Scoped Product count matches rendered DOM count: yes.
- Console errors: 0.
- Page exceptions: 0.

## Evidence

Evidence location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-PER-005\
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

## Scope Confirmation

- No Product Create/Edit/Delete UI.
- No Product search/filter feature.
- No legacy `localStorage.products` migration.
- No legacy `localStorage.products` deletion.
- No automatic copy from legacy Products to scoped storage.
- No Route Guard weakening.
- No Firebase Auth change.
- No persistence driver change.
- No `providerUserId` / Firebase UID as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

