# V1-PER-003 Product Persistence Boundary Assessment

## Mission

`V1-PER-003 - Product Persistence Boundary Assessment`

## Classification

`INF`

This is an assessment and documentation mission only. No application source files were modified.

## Baseline

- Branch: `v1/per-003-product-persistence-boundary-assessment`
- Baseline tag: `ecs-006-product-list-read-path`
- Baseline commit: `36a23e70bd0bcace09a3164eb6779d095664071f`
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
- `PATCHES/ECS-006/closure-report.md`
- `PATCHES/ECS-006/verification.md`
- `PATCHES/V1-PER-001/closure-report.md`
- `PATCHES/V1-PER-002/closure-report.md`
- Product persistence notes in `PATCHES/V1-AUTH-002/architecture-decision.md` and `PATCHES/V1-AUTH-003/architecture-decision.md`

## Document Findings

- `accountId` is the approved V1 account/workspace data boundary.
- Existing global localStorage data must not be deleted, overwritten, migrated, or reinterpreted automatically.
- Any global-to-account storage migration requires a separate approved mission with runtime evidence, a no-data-loss plan, rollback, and owner/architect approval.
- ECS-006 verified that valid Product data in `localStorage.products` can now be read through `ProductService.getAll()` and rendered by the Products page.
- ECS-006 explicitly did not implement Product CRUD, account-scoped storage, migration, Product schema changes, or Product data deletion.

## Source Inspection Summary

| Area | Role | Account Context | Storage Boundary | Future Account-Scoped Support | Existing Data Impact If Changed |
| --- | --- | --- | --- | --- | --- |
| `src/modules/products/Product.ts` | Product record contract | No `accountId`, `createdBy`, or `updatedBy` fields | Record is account-neutral | Requires schema/compatibility decision before account ownership | Product record shape changes can affect existing global records |
| `src/modules/products/dto/ProductData.ts` | Product dialog data input contract | No account fields | Account-neutral input | Needs future ownership metadata path outside raw form values | Adding account fields here would affect Product form contract |
| `src/modules/products/factories/ProductFactory.ts` | Creates Product records | Does not receive session/account | Creates account-neutral records | Could later add ownership metadata if supplied by service/session boundary | Adding metadata changes new record shape |
| `src/modules/products/repositories/ProductRepository.ts` | Product persistence repository | Does not receive account context | Uses global key `products` via `super("products", driver)` | Can support account-scoped storage later only after key strategy/migration plan | Changing key would stop reading existing global products unless compatibility is planned |
| `src/modules/products/services/ProductService.ts` | Product use-case service | Does not receive account/session context | Delegates to global repository | Needs account/session input before safe account-scoped writes | Service signature change affects callers |
| `src/modules/products/pages/ProductListPage.ts` | Products page read binding | Does not receive account/session context | Reads `ProductService.getAll()` | Can keep UI mostly stable if service contract handles account scope later | Page-level account filtering would be the wrong layer |
| `src/core/repositories/Repository.ts` | Generic repository abstraction | Account-neutral | Reads/writes one configured key | Could remain generic if account-aware keys are supplied by domain repository | Changing globally affects all repositories |
| `src/core/persistence/LocalStorageDriver.ts` | localStorage driver | Account-neutral | Reads/writes exact keys | Should remain a key/value driver, not own Product account policy | Changing driver behavior risks unrelated persistence |
| `src/core/Container.ts` | Dependency wiring | Does not pass AuthSession to Product repository/service | Creates Product repository with global driver only | Future account-aware wiring may be needed, but must be scoped | Wiring changes affect Product service construction |
| `src/modules/auth/*` | Auth/session/account foundation | Produces explicit account identity | Not connected to Product persistence | Auth can provide account context to future Product persistence boundary | Product persistence must not assume Firebase UID equals `accountId` |
| `src/core/Router.ts` / `src/router/routes.ts` | Protected Products access | Route Guard checks authentication only | Does not pass account to page | Route Guard should remain access control, not persistence ownership | Router changes are not required for this assessment |

## A. Current Persistence Map

1. Product storage driver: `LocalStorageDriver`.
2. Product storage key / namespace: `products`.
3. Product repository path: `src/modules/products/repositories/ProductRepository.ts`.
4. Product service read path: `ProductListPage.onEnter()` -> `ProductListPage.readProducts()` -> `ProductService.getAll()` -> `ProductRepository.all()` -> `Repository.all()` -> `LocalStorageDriver.read("products")`.
5. Product service write path present in code: `ProductService.add/update/remove()` -> `ProductRepository.add/update/remove()` -> `Repository.save()` -> `LocalStorageDriver.write("products", items)`.
6. Product UI read binding: `ProductListPage` renders rows into `#products-body`.
7. Storage boundary: global localStorage key, not account-scoped.

## B. Account Boundary Analysis

1. `AuthSession` exists and contains an explicit account identity through the accepted Auth foundation.
2. The Product layer does not receive `AuthSession`, `accountId`, or `user.accountId`.
3. Product records do not include `accountId`.
4. Product reads are not filtered by `accountId`.
5. Product writes would not include `accountId` if CRUD were enabled through the current service/repository contracts.
6. Firebase UID is not used as `accountId` in the inspected Product path.
7. Current Product data is not safe from cross-account mixing if multiple accounts use the same browser storage because all Products are read from the global `products` key.

## Runtime / Storage Evidence

Evidence was collected without source changes and without modifying Product data during inspection.

- Runtime result: PASS.
- Route Guard active: yes.
- Login succeeds with approved local Firebase test user: yes.
- Products route accessible after login: yes.
- ECS-006 product rendered: yes.
- Product storage key: `products`.
- Account-scoped Product keys: none observed.
- Product record contains `accountId`: no.
- Product record contains `createdBy`: no.
- Product record contains `updatedBy`: no.
- Product data mutation check: unchanged.
- Console errors: 0.
- Page exceptions: 0.

Evidence files:

```text
outputs/V1-PER-003/runtime.json
outputs/V1-PER-003/dom.json
outputs/V1-PER-003/console.log
outputs/V1-PER-003/storage-snapshot-sanitized.json
outputs/V1-PER-003/screenshot.png
```

## C. Risk Assessment

| Risk Area | Classification | Rationale |
| --- | --- | --- |
| Proceeding with Product Create on current storage | HIGH | New records would be written to global `products` without `accountId`, deepening migration and cross-account visibility risk. |
| Proceeding with Product Edit on current storage | HIGH | Edits would update global records without verifying account ownership. |
| Proceeding with Product Delete on current storage | HIGH | Deletes would remove global records without account boundary checks. |
| Later migration from global storage to account-scoped storage | HIGH | Existing records lack ownership metadata, and CRUD would add more account-neutral records. |
| Existing user data loss risk | MEDIUM | Read-only access is safe now, but unplanned key changes or migration could orphan or overwrite global data. |
| Cross-account data visibility risk | HIGH | The current global `products` key is shared across any account using the same browser storage. |

## D. Recommendation

Recommendation: **Option 2 - Before CRUD, create a separate Product account-scoped persistence plan.**

Product Create/Edit/Delete should not proceed on the current global Product persistence model. The current model is acceptable for read-path stabilization and assessment, but not for new multi-user Product writes.

## No-Data-Loss Planning Requirement

If account-scoped Product persistence is approved, it must be handled in a separate mission before Product CRUD implementation.

Plan only:

1. Preserve the current global key `products`; do not delete or overwrite it automatically.
2. Export or snapshot current global Product data before any migration attempt.
3. Define a new account-scoped Product key strategy, for example an account namespace derived from the approved project `accountId`, not Firebase UID.
4. Define how existing global records will be assigned to an account. This requires owner approval because existing records do not carry account metadata.
5. Add an owner approval checkpoint before assigning old global records to any account.
6. Provide rollback by keeping the global `products` key untouched until migration is verified and accepted.
7. Verify before/after runtime behavior with storage snapshots, DOM evidence, console log, page exceptions, and screenshot.
8. Likely future files: `Product` contract, Product repository/service boundary, dependency wiring, and dedicated migration/compatibility documentation.
9. Keep this separate from Product CRUD because CRUD would otherwise create or mutate account-neutral records and make the later migration less deterministic.

## Final Assessment

- Product persistence is currently global.
- Product records currently lack `accountId` and ownership metadata.
- Product reads and writes currently ignore account context.
- Product CRUD should not proceed until a Product account-scoped persistence plan is approved.
- No source files were changed in V1-PER-003.
