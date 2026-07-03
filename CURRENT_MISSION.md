# Current Mission

## Mission

`ECS-011 - Product Module Regression Baseline`

## Classification

`ECS`

This is a Product module stabilization and regression verification mission.

This is not a new Product feature, invoices, stock, suppliers, clients, expenses, reports, sync, or ECS-012.

## Objective

Create and preserve a full runtime regression baseline for the accepted Product module after:

- ECS-006 Product List Read Path.
- V1-PER-005 Account-Scoped Product Persistence Compatibility Layer.
- V1-PER-006 Legacy Product Scoped Import.
- ECS-007 Product Create Path.
- ECS-008 Product Edit Path.
- ECS-009 Product Safe Delete Path.
- ECS-010 Product Search / Filter Path.

The goal is to prove the Product module is stable as a dependency for future ERP modules such as Inventory, invoices, and stock.

## Current Status

`ECS-011 Ready for Architect / Owner Review`

## Verification Completed

- Pre-check: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime Regression Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Route Guard remains active.
- Unauthenticated Dashboard access redirects to Login.
- Unauthenticated Products access redirects to Login.
- Firebase login succeeds.
- AuthSession exists and contains explicit `accountId`.
- `accountId` is distinct from Firebase UID / provider user id.
- Products route is accessible after login.
- Product active storage key is `products:{accountId}`.
- Product module does not use legacy `localStorage.products` as the active source.
- Legacy `localStorage.products` remained absent/unchanged during verification.
- Products render from the scoped key.
- Invalid create does not write.
- Valid create writes exactly one scoped Product.
- Created Products persist after reload.
- Invalid edit does not update.
- Valid edit updates exactly one scoped Product while preserving id and accountId.
- Cancelled delete does not update Product data.
- Confirmed safe delete marks Product as deleted without hard delete.
- Deleted Product remains in scoped storage and hidden from UI after reload.
- Matching search returns the retained active Product.
- Non-matching search returns zero rows and the no-results state.
- Deleted Product does not appear in search.
- Clearing search restores the active list.

## Scope Confirmation

- No source fix was needed.
- No Product feature was added.
- No Product source files were changed.
- No Auth behavior was changed.
- No Route Guard weakening.
- No persistence implementation change.
- No localStorage migration.
- No legacy Product deletion.
- No legacy `localStorage.products` mutation.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/ECS-011/verification.md
PATCHES/ECS-011/closure-report.md
outputs/ECS-011/baseline-runtime.json
outputs/ECS-011/baseline-dom.json
outputs/ECS-011/baseline-console.log
outputs/ECS-011/baseline-storage-snapshot-sanitized.json
outputs/ECS-011/baseline-screenshot.png
outputs/ECS-011/after-runtime.json
outputs/ECS-011/after-dom.json
outputs/ECS-011/after-console.log
outputs/ECS-011/after-storage-snapshot-sanitized.json
outputs/ECS-011/after-screenshot.png
outputs/ECS-011/regression-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start the next mission until ECS-011 is reviewed and accepted.
