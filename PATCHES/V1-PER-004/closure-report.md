# V1-PER-004 Closure Report

## Classification

`INF`

## Branch

`v1/per-004-product-account-scoped-persistence-plan`

## Baseline Tag

`v1-per-003-product-persistence-boundary-assessment`

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
- `PATCHES/V1-PER-003/product-persistence-boundary-assessment.md`
- `PATCHES/V1-PER-003/closure-report.md`
- `PATCHES/V1-PER-003/verification.md`

## Source Files Inspected

- `src/modules/products/Product.ts`
- `src/modules/products/dto/ProductData.ts`
- `src/modules/products/factories/ProductFactory.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/modules/products/pages/ProductListPage.ts`
- `src/modules/products/dialogs/ProductDialog.ts`
- `src/modules/products/validators/ProductValidator.ts`
- `src/modules/products/stores/ProductStore.ts`
- `src/modules/products/ui/ProductForm.ts`
- `src/core/repositories/Repository.ts`
- `src/core/persistence/Driver.ts`
- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/Storage.ts`
- `src/core/Container.ts`
- `src/core/Router.ts`
- `src/router/routes.ts`
- `src/router/PageManager.ts`
- `src/modules/auth/AuthSession.ts`
- `src/modules/auth/UserIdentity.ts`
- `src/modules/auth/AccountIdentity.ts`
- `src/modules/auth/OwnershipMetadata.ts`
- `src/modules/auth/AuthState.ts`
- `src/modules/auth/AuthStateService.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/AuthRouteGuard.ts`
- `src/modules/auth/pages/LoginPage.ts`

## Current Storage Model

Products are persisted globally under `localStorage.products`.

Current Product records do not contain `accountId`, `createdBy`, or `updatedBy`.

Current Product reads and writes do not receive account context.

## Target Storage Model

Products should be persisted under an account-scoped boundary using the project `accountId`.

Recommended target key pattern:

```text
products:{accountId}
```

Target Product records should include `accountId`, `createdBy`, and `updatedBy` where appropriate.

## Recommended Storage Key Strategy

Use a compatibility layer:

- Preserve `localStorage.products`.
- Do not read global Products as normal account-scoped Products.
- Write new Product records to `products:{accountId}` after account-scoped persistence is implemented.
- Expose legacy global Products only through owner-approved migration/import planning.

## Legacy Data Strategy

- Preserve original global key.
- Do not delete old data automatically.
- Backup/export before any migration.
- Require owner approval before assigning old Products to an account.
- Assign legacy Products only to an explicit approved `accountId`.
- Never use Firebase UID as `accountId`.
- Verify Product counts before and after migration/import.

## No-Data-Loss Plan

See `PATCHES/V1-PER-004/no-data-loss-plan.md`.

## Rollback Plan

See `PATCHES/V1-PER-004/rollback-plan.md`.

## Risk Assessment

| Risk Area | Risk |
| --- | --- |
| Data loss risk | MEDIUM |
| Cross-account visibility risk | HIGH before scoped implementation |
| Implementation risk | MEDIUM |
| Rollback difficulty | MEDIUM |
| CRUD-before-migration risk | HIGH |

## Recommended Next Mission

`V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`

## May Product CRUD Proceed Now?

No.

## Is Implementation Required Before CRUD?

Yes. Account-scoped Product persistence compatibility should be implemented before Product Create/Edit/Delete.

## TypeScript Result

PASS: `pnpm exec tsc --noEmit`.

## Build Result

PASS: `pnpm run build`.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No persistence source files changed.
- No Auth source files changed.
- No migration executed.
- No Product data deleted.
- `.env` remains untracked.

## Commit

Pending documentation commit: `docs: plan account-scoped product persistence`.

## Tag

Pending tag: `v1-per-004-product-account-scoped-persistence-plan`.

## Final Status

`V1-PER-004 Ready for Architect / Owner Review`
