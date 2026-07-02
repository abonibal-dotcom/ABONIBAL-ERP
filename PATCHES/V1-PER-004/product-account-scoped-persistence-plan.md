# V1-PER-004 Product Account-Scoped Persistence Plan

## Mission

`V1-PER-004 - Product Account-Scoped Persistence Plan`

## Classification

`INF`

This is a planning and design mission only. It does not modify application source code, Product records, localStorage, Auth, Route Guard, or Product CRUD behavior.

## Baseline

- Baseline tag: `v1-per-003-product-persistence-boundary-assessment`
- Baseline commit: `bf9c99b6a63d83c40daceef1e99114c72480c36a`
- Branch: `v1/per-004-product-account-scoped-persistence-plan`

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

## Source Inspection Summary

| Area | Current Role | Needs `accountId` Later | Likely Future Change | Existing Data Risk |
| --- | --- | --- | --- | --- |
| `src/modules/products/Product.ts` | Product record shape | Yes | Add ownership metadata contract through approved implementation mission | Medium; existing records lack those fields |
| `src/modules/products/dto/ProductData.ts` | Product form/input DTO | No direct account input from UI | Likely unchanged; account metadata should come from session boundary | Low |
| `src/modules/products/factories/ProductFactory.ts` | Creates Product records | Yes | Accept ownership metadata from service boundary | Medium for new records only |
| `src/modules/products/repositories/ProductRepository.ts` | Reads/writes Product collections | Yes | Use account-scoped key strategy or account-aware repository boundary | High if key changes without compatibility |
| `src/modules/products/services/ProductService.ts` | Product use-case layer | Yes | Resolve current account/session before read/write operations | Medium; service API and callers may change |
| `src/modules/products/pages/ProductListPage.ts` | Product UI read binding | Indirectly | Prefer minimal/no change if service owns account boundary | Low |
| `src/modules/products/dialogs/ProductDialog.ts` | Product dialog form shell | No | Likely unchanged for persistence boundary | Low |
| `src/modules/products/stores/ProductStore.ts` | In-memory Product store scaffold | Yes if used later | Either retire or account-scope before use | Medium if introduced without account context |
| `src/core/repositories/Repository.ts` | Generic repository abstraction | No domain-specific account policy | Likely unchanged; keep generic key/value collection behavior | Medium if changed globally |
| `src/core/persistence/LocalStorageDriver.ts` | localStorage driver | No | Should remain account-neutral | High if driver silently rewrites keys |
| `src/core/Storage.ts` | generic localStorage wrapper | No | Likely unchanged | Medium if used for migration without guardrails |
| `src/core/Container.ts` | Dependency wiring | Yes | Wire account/session-aware Product persistence boundary | Medium |
| `src/modules/auth/AuthSession.ts` / `AuthState.ts` | Holds authenticated account/session state | Already supplies account identity | No Product-specific change expected | Low |
| `src/modules/auth/AuthRuntime.ts` | Creates AuthStateService | Already resolves explicit accountId | No Product-specific change expected | Low |
| `src/modules/auth/AuthRouteGuard.ts` | Protects route access | No persistence ownership | Should remain access control only | Low |
| App bootstrap/router | Starts app and navigates protected routes | Indirectly | Should not own Product persistence policy | Low |

## A. Current State

- Current Product key: `localStorage.products`.
- Current Product record shape includes product fields such as `id`, `sku`, `barcode`, `name`, `englishName`, `description`, `images`, `category`, `brand`, `unit`, price fields, stock fields, `isActive`, `createdAt`, and `updatedAt`.
- Current Product record shape does not include `accountId`.
- Current Product record shape does not include `createdBy` or `updatedBy`.
- Current read path: `ProductListPage` -> `ProductService.getAll()` -> `ProductRepository.all()` -> `Repository.all()` -> `LocalStorageDriver.read("products")`.
- Current write path present in code: `ProductService.add/update/remove()` -> `ProductRepository.add/update/remove()` -> `Repository.save()` -> `LocalStorageDriver.write("products", items)`.
- Current Product reads do not filter by `accountId`.
- Current Product writes do not attach `accountId`, `createdBy`, or `updatedBy`.
- Current Route Guard protects Products access, but it does not make Product persistence account-scoped.

## B. Target State

Target V1 Product persistence behavior:

- Product persistence is scoped by the project `AuthSession.account.id` / `AuthSession.user.accountId` boundary.
- Product records include explicit `accountId`.
- Product records include `createdBy` on create.
- Product records include `updatedBy` on update where appropriate.
- Reads return only Products belonging to the current authenticated `accountId`.
- Writes attach the current authenticated `accountId`.
- Create attaches `createdBy` and may set `updatedBy` to the same user if the implementation chooses one consistent contract.
- Update preserves `accountId` and `createdBy`, and sets `updatedBy`.
- Delete only applies inside the current account boundary.
- Firebase UID / provider user id must never be used as Product `accountId`.
- Existing global `localStorage.products` must remain preserved until an approved migration/retirement decision.

## C. Storage Key Strategy

### Option 1 - Reuse `localStorage.products` With Embedded `accountId` Filtering

Description:

- Keep all Product records in one global `products` array.
- Add `accountId` to records.
- Filter reads by current account.

Pros:

- Minimal key change.
- Easier to inspect one localStorage key.

Cons:

- Existing records lack `accountId`.
- A filtering bug can expose another account's Products.
- All accounts still share one mutable array.
- Write conflicts and accidental overwrite risk remain higher.
- It does not create a strong storage boundary.

Assessment: not recommended.

### Option 2 - Create Account-Scoped Keys, For Example `products:{accountId}`

Description:

- Store Products under an account-specific key.
- Example: `products:{accountId}`.
- Product reads/writes operate only on the current account key.

Pros:

- Clear storage boundary.
- Lower cross-account visibility risk.
- Easier per-account backup and rollback.
- Aligns with the approved `accountId` data boundary.

Cons:

- Requires compatibility handling for existing global `products`.
- Requires a migration/import plan for legacy records.
- Requires account-aware repository/service construction.

Assessment: strong target storage model, but must be paired with legacy compatibility.

### Option 3 - Compatibility Layer Preserving `localStorage.products` While Writing New Scoped Records

Description:

- Keep existing `localStorage.products` unchanged.
- Introduce account-scoped keys for new and migrated records.
- Product runtime reads from `products:{accountId}` only.
- Legacy global records are exposed only through an owner-approved migration/import flow, not as normal Products for every account.

Pros:

- Preserves existing data.
- Avoids silent migration.
- Avoids cross-account visibility in normal Product reads.
- Allows Product CRUD to proceed after implementation without writing more global records.
- Supports a separate owner-approved migration path for legacy data.

Cons:

- Requires more explicit implementation than a pure key rename.
- Requires future migration tooling or compatibility UI/flow.

Recommendation: **Option 3**.

## Recommended Implementation Shape For Future Mission

The future implementation mission should introduce a Product persistence compatibility layer before Product CRUD:

1. Keep `LocalStorageDriver` generic and account-neutral.
2. Keep `Repository<T>` generic unless evidence proves a small targeted change is required.
3. Introduce Product account key resolution near the Product repository/service boundary.
4. Use current `AuthStateService` or a narrow session/account provider to get the authenticated account.
5. Store account-scoped Product collections under `products:{accountId}`.
6. Do not read global `products` in normal account-scoped Product list runtime.
7. Preserve global `products` for backup/export/migration.
8. Add ownership metadata to new Product records through the Product service/factory boundary, not from user-entered form fields.

## D. Legacy Data Strategy

Existing records in `localStorage.products` must be treated as legacy global data.

Required behavior:

- Preserve the original global key.
- Do not delete `localStorage.products` automatically.
- Do not rewrite `localStorage.products` automatically.
- Do not assign legacy Products to any account without owner approval.
- Export or snapshot global Products before any migration attempt.
- Show legacy Product counts and identifiers in sanitized evidence before assignment.
- Assign legacy Products to a target `accountId` only after an explicit owner/architect checkpoint.
- Avoid cross-account visibility by keeping normal Products reads scoped to `products:{accountId}`.
- Verify Product counts before and after any future migration.

Legacy assignment rule:

- Use the approved project `accountId` from the authenticated `AuthSession`.
- Never use Firebase UID or provider user id as `accountId`.
- If more than one account exists, the owner must decide which legacy records belong to which account before migration.

## E. Migration Strategy

Do not implement this in V1-PER-004.

Future migration steps:

1. Capture baseline runtime and storage evidence.
2. Backup/export current `localStorage.products`.
3. Authenticate with the approved test user.
4. Resolve explicit `AuthSession.account.id`.
5. Identify the target accountId for legacy Product assignment.
6. Require owner approval for the target assignment.
7. Copy or transform legacy Products into `products:{accountId}`.
8. Add `accountId`, `createdBy`, and `updatedBy` metadata according to the approved contract.
9. Verify legacy global key still exists unchanged.
10. Verify account-scoped Product count matches expected migrated count.
11. Verify account-scoped Products render in the UI for the target account.
12. Verify another account cannot see the target account's Products.
13. Keep rollback path available.
14. Only after a later owner-approved deprecation mission consider hiding, archiving, or removing the old global key.

## F. Runtime Verification Plan

Future implementation must prove:

- Login succeeds.
- `AuthSession.account.id` exists.
- Products route remains protected.
- Legacy global data is preserved.
- Account-scoped Products render for the authenticated account.
- Global Products are not accidentally visible to another account.
- Product Create writes to the account-scoped key and attaches `accountId`.
- Product Create attaches `createdBy`.
- Product Edit remains inside the account boundary and attaches `updatedBy`.
- Product Delete remains inside the account boundary.
- Product counts are verified before and after any migration/import.
- Console errors = 0.
- Page exceptions = 0.
- `.env` remains untracked.

## G. Risk Assessment

| Risk Area | Risk | Reason |
| --- | --- | --- |
| Data loss risk | MEDIUM | Existing global data can be preserved if untouched, but migration/import mistakes could orphan or duplicate records. |
| Cross-account visibility risk | HIGH before implementation, LOW after scoped keys are enforced | Current global key is shared; scoped keys make normal reads account-specific. |
| Implementation risk | MEDIUM | Requires Product repository/service/account wiring but can remain localized if planned carefully. |
| Rollback difficulty | MEDIUM | Easy if global key is preserved; harder if future mission mutates Product schemas without backup. |
| CRUD-before-migration risk | HIGH | CRUD on global storage creates more account-neutral records and worsens later migration uncertainty. |

## H. Recommendation

Choose: **Option 2 - Implement account-scoped Product persistence compatibility layer before CRUD.**

This recommendation means the next implementation mission should build the compatibility layer and account-scoped Product persistence behavior before Product Create/Edit/Delete.

Reasoning:

- Product CRUD on global storage is high risk.
- A full migration before any CRUD may be too broad for the next mission.
- A compatibility layer can stop new global writes while preserving legacy global data.
- Existing global Product data can remain untouched until a dedicated no-data-loss migration/import mission is approved.

## Recommended Next Mission

`V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`

Classification: `ECS`

Scope should be limited to account-scoped Product persistence behavior and compatibility preservation. It should not include Product Create/Edit/Delete UI.
