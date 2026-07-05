# Changelog

## V1-SALES-004 - Invoice Draft Create / Update Flow

- Added the first minimal authenticated Invoice draft UI flow.
- Added protected `invoices` route and `Invoices` Sidebar entry.
- Added `src/modules/sales/pages/InvoiceDraftPage.ts`.
- Added active Product selection through `ProductService.getAll()`.
- Verified soft-deleted Products are not selectable.
- Added draft create using `InvoiceService.createDraft()`.
- Added draft update using `InvoiceService.updateDraft()`.
- Verified invalid draft submissions do not write invoices.
- Verified valid draft create writes one draft invoice to `invoices:{accountId}`.
- Verified draft update preserves invoice id, preserves accountId, remains `draft`, and persists updated totals.
- Verified Product snapshot fields are stored on invoice lines.
- Verified reload preserves the draft invoice.
- Verified no invoice issue behavior, no cancellation UI, no stock deduction, no `sale_deduction`, no Product mutation, no Inventory mutation, clean console, zero page exceptions, and `.env` untracked.
- Final status: `V1-SALES-004 Ready for Architect / Owner Review`.

## V1-SALES-003 - Account-Scoped Invoice Persistence Baseline

- Added the first minimal Sales / Invoice persistence baseline under `src/modules/sales/`.
- Added invoice model/types with `draft`, `issued`, and `cancelled` lifecycle status support.
- Added invoice line model with Product snapshot fields and nullable `stockMovementId`.
- Added `invoiceStorageKeyForAccount(accountId)` using `invoices:{accountId}`.
- Added account-scoped Invoice repository methods for read, append, find, and update.
- Added Invoice service methods: `getAll`, `getById`, `createDraft`, `updateDraft`, `markIssued`, and `markCancelled`.
- Registered Invoice repository, validator, and service in `Container`.
- Verified unauthenticated invoice writes fail safely.
- Verified runtime createDraft, updateDraft, markIssued, markCancelled, and reload persistence.
- Verified no global `invoices` key, no invoice UI, no invoice route, no stock deduction, no `sale_deduction`, no Product mutation, no Inventory mutation, clean console, zero page exceptions, and `.env` untracked.
- Final status: `V1-SALES-003 Ready for Architect / Owner Review`.

## V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan

- Designed the future account-scoped invoice storage boundary as `invoices:{accountId}`.
- Rejected global invoice storage, Firebase UID/provider user id storage, and default account fallback.
- Documented the recommended invoice header and line contracts for the future persistence baseline.
- Documented the V1-now lifecycle states: `draft`, `issued`, and `cancelled`.
- Documented invoice numbering policy using account-scoped date prefix plus local sequence with collision checks.
- Documented Product dependency: stable Product id references and snapshot fields, with no Product mutation.
- Documented Inventory dependency: future issue flow must use the stock availability gate and later create `sale_deduction` movements instead of editing `Product.quantity`.
- Recommended `V1-SALES-003 - Account-Scoped Invoice Persistence Baseline` as the next Sales / Invoice mission.
- Confirmed this mission is documentation/design only, with no source changes, no invoice UI, no invoice route, no invoice stock deduction, no Product data mutation, and no Inventory mutation.
- Final status: `V1-SALES-002 Ready for Architect / Owner Review`.

## V1-SALES-001 - Sales / Invoice Foundation Baseline

- Assessed the current Sales / Invoice foundation from the accepted `v1-inv-007-stock-availability-invoice-gate` tag.
- Confirmed no Sales / Invoice module, route, UI, service, repository, persistence key, or storage boundary exists yet.
- Confirmed no invoice or sales storage keys were present during read-only runtime verification.
- Confirmed Products are the accepted future invoice line reference dependency, with stable Product ids and soft-delete behavior.
- Confirmed Inventory stock availability is the accepted future invoice confirmation dependency.
- Recommended `invoices:{accountId}` as the safest V1 invoice storage boundary.
- Recommended draft / issued / cancelled as V1-now invoice lifecycle states.
- Recommended `V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan` as the next Sales / Invoice mission.
- Verified TypeScript, build, read-only runtime, clean console, zero page exceptions, no Product data mutation, no stock movement mutation, no source changes, and `.env` untracked.
- Final status: `V1-SALES-001 Ready for Architect / Owner Review`.

## V1-INV-007 - Inventory Stock Availability / Invoice Dependency Gate

- Added a read-only Inventory availability gate on top of the accepted `stockMovements:{accountId}` ledger.
- Added `InventoryService.getAvailableQuantity()`, `InventoryService.checkAvailability()`, and `InventoryService.checkAvailabilityBatch()`.
- Availability checks use ledger current quantity and the active Product boundary to reject missing or soft-deleted Products safely.
- Verified in-stock requests return `canFulfill = true`.
- Verified over-stock requests return `canFulfill = false` with correct shortage quantity.
- Verified missing productId, missing Product, non-numeric quantity, zero quantity, negative quantity, and soft-deleted Product requests fail safely.
- Verified batch availability aggregates repeated Product requests before fulfillment checks.
- Verified availability checks do not create stock movements, mutate Product records, update `Product.quantity`, or touch legacy `localStorage.products`.
- Confirmed no invoice implementation, invoice UI, invoice stock deduction, sale deduction movement creation, Product CRUD behavior change, Auth behavior change, Route Guard weakening, Firebase UID/accountId fallback, providerUserId/accountId fallback, or default account fallback was introduced.
- Final status: `V1-INV-007 Ready for Architect / Owner Review`.

## V1-INV-006 - Inventory Movement History / Current Stock View

- Added a read-only current stock section to the Inventory page.
- Added a read-only movement history section to the Inventory page.
- Movement history reads valid movement records from `InventoryService.getAll()` / `stockMovements:{accountId}`.
- Movement history displays Product name when available and productId fallback for missing Product references.
- Movement history displays movement type, quantityDelta, reason, createdAt, and status.
- Voided movements remain visible as `Voided` and are excluded from current quantity.
- Verified current stock display matches ledger computation.
- Verified movement history row count matches valid ledger movement count.
- Verified reload preserves current stock display and movement history display.
- Verified Product scoped/legacy storage hashes remain unchanged and `Product.quantity` is not authoritative.
- Confirmed no invoice implementation, invoice stock deduction, Product CRUD behavior change, Product file change, Auth behavior change, Route Guard weakening, Firebase UID/accountId fallback, providerUserId/accountId fallback, or default account fallback was introduced.
- Final status: `V1-INV-006 Ready for Architect / Owner Review`.

## V1-INV-005 - Manual Opening Balance / Adjustment Flow

- Added a protected `inventory` route and minimal authenticated Inventory page.
- Added manual movement UI for `opening_balance` and `manual_adjustment` only.
- Product selector reads active Products through `ProductService.getAll()`.
- Current quantity display is computed from the accepted Stock Movement Ledger.
- Valid opening balance and manual adjustment submissions write to `stockMovements:{accountId}` through `InventoryService`.
- Invalid opening balance and manual adjustment submissions do not write movement records.
- Verified soft-deleted Products are not selectable.
- Verified reload preserves movement records and displayed current quantity.
- Verified Product scoped/legacy storage hashes remain unchanged and `Product.quantity` is not updated.
- Confirmed no invoice implementation, invoice stock deduction, Product CRUD behavior change, Product file change, Auth behavior change, Route Guard weakening, Firebase UID/accountId fallback, providerUserId/accountId fallback, or default account fallback was introduced.
- Final status: `V1-INV-005 Ready for Architect / Owner Review`.

## V1-INV-004 - Stock Movement Ledger Runtime Verification

- Verified the accepted account-scoped Stock Movement Ledger runtime behavior after V1-INV-003.
- Confirmed no source fix was needed.
- Verified valid opening balance, manual adjustment, correction, and missing Product reference movements append successfully.
- Verified invalid movement attempts are rejected and do not write records.
- Verified malformed existing records do not crash current quantity computation.
- Verified current quantities are computed from non-voided movement deltas for multiple Products.
- Verified Product A / Product B isolation and other-account movement isolation.
- Verified non-destructive void behavior, re-void safety, non-existing void safety, and reload persistence.
- Verified Product scoped/legacy storage hashes remain unchanged and `Product.quantity` is not authoritative.
- Confirmed no Inventory UI, Inventory route, invoice implementation, Product CRUD change, Auth change, Route Guard weakening, Firebase UID/accountId fallback, providerUserId/accountId fallback, or default account fallback was introduced.
- Final status: `V1-INV-004 Ready for Architect / Owner Review`.

## V1-INV-003 - Stock Movement Ledger Persistence Baseline

- Added the minimal account-scoped Stock Movement Ledger persistence baseline under `src/modules/inventory/`.
- Added stock movement model/types, persistence key helper, repository, validator, and Inventory service.
- Registered Inventory dependencies in `Container`.
- Implemented scoped storage with `stockMovements:{accountId}` from authenticated `AuthSession.account.id`.
- Implemented opening balance/manual adjustment persistence, current quantity computation from non-voided movement deltas, and non-destructive void behavior.
- Verified login, AuthSession account boundary, Route Guard, scoped ledger writes, void preservation, reload persistence, unchanged Product scoped/legacy storage hashes, clean console, and zero page exceptions.
- Confirmed no Inventory UI, Inventory route, invoice implementation, Product CRUD behavior change, Product quantity migration, Product record mutation, Auth behavior change, Route Guard weakening, Firebase UID/accountId fallback, providerUserId/accountId fallback, or default account fallback was introduced.
- Final status: `V1-INV-003 Ready for Architect / Owner Review`.

## V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan

- Designed the V1 account-scoped Stock Movement Ledger before Inventory implementation or invoice stock deduction.
- Confirmed the authoritative Inventory model should be a stock movement ledger, not direct Product quantity mutation.
- Recommended authoritative storage key `stockMovements:{accountId}`.
- Documented optional future derived cache `inventorySnapshots:{accountId}`.
- Defined the proposed V1 stock movement record shape, movement types, reference policy, voiding policy, and current quantity computation.
- Documented Product quantity field policy: `Product.quantity` remains legacy/display-compatible and `Product.minimumQuantity` remains alert metadata.
- Documented invoice dependency policy: invoices must create stock movements and must not directly edit `Product.quantity`.
- Confirmed invoice stock deduction remains blocked until Inventory persistence and current quantity computation are implemented and verified.
- Recommended next mission: `V1-INV-003 - Stock Movement Ledger Persistence Baseline`.
- Verified TypeScript and build pass.
- Confirmed no source files, Product files, Inventory implementation, Invoice implementation, Product data, localStorage migration, or credentials were changed.
- Final status: `V1-INV-002 Ready for Architect / Owner Review`.

## V1-INV-001 - Inventory / Stock Foundation Baseline

- Assessed the Inventory / Stock foundation from the accepted `ecs-011-product-module-regression-baseline` tag.
- Confirmed no standalone Inventory / Stock module exists.
- Confirmed no Inventory route or active Inventory UI exists.
- Confirmed no stock service, stock repository, stock movement model, invoice module, or stock storage key exists.
- Confirmed Product model includes `quantity` and `minimumQuantity`, with `ProductFactory` defaulting both to `0`.
- Confirmed active Product create/edit dialog does not manage quantity fields.
- Confirmed Product storage uses `products:{accountId}` and Product can safely serve as an Inventory reference dependency.
- Confirmed Product direct `quantity` should not become the authoritative V1 stock source because invoice deduction, returns, corrections, and adjustments require audit history.
- Recommended an account-scoped stock movement ledger as the V1 Inventory model.
- Recommended `stockMovements:{accountId}` as the authoritative Inventory storage boundary.
- Recommended next mission: `V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`.
- Verified TypeScript, build, and read-only runtime verification passed with console errors = 0 and page exceptions = 0.
- Confirmed no source files, Product files, Auth files, Product data, localStorage migration, route guard behavior, or credentials were changed.
- Final status: `V1-INV-001 Ready for Architect / Owner Review`.

## ECS-011 - Product Module Regression Baseline

- Created the Product module runtime regression baseline from the accepted `ecs-010-product-search-filter` tag.
- Confirmed Route Guard remains active and unauthenticated Dashboard / Products access redirects to Login.
- Confirmed Firebase login succeeds, `AuthSession.accountId` exists, and Products is accessible after login.
- Confirmed `accountId` is explicit and distinct from Firebase UID / provider user id.
- Confirmed Product reads use `products:{accountId}` and do not use legacy `localStorage.products` as the active source.
- Verified invalid create does not write data.
- Verified valid create writes exactly one scoped Product.
- Verified created Products persist after reload.
- Verified invalid edit does not update data.
- Verified valid edit updates exactly one scoped Product while preserving id and accountId.
- Verified cancelled delete does not update Product data.
- Verified confirmed safe delete marks one scoped Product as deleted without hard delete.
- Verified deleted Product remains in scoped storage and hidden after reload.
- Verified matching search returns a retained active Product.
- Verified non-matching search returns zero rows and shows the no-results state.
- Verified deleted Product does not appear in search.
- Verified clearing search restores the active list.
- Verified legacy `localStorage.products` remains absent/unchanged with no automatic migration.
- Confirmed no source fix was needed and no Product source files were changed.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `ECS-011 Ready for Architect / Owner Review`.

## ECS-010 - Product Search / Filter Path

- Implemented the minimal Product Search / Filter path on top of accepted account-scoped Product persistence.
- Confirmed baseline unauthenticated Products access is blocked by Route Guard.
- Confirmed baseline login succeeds, `AuthSession.accountId` exists, and Products render from `products:{accountId}`.
- Confirmed baseline active Products exclude soft-deleted records.
- Confirmed baseline Product search input existed but did not filter results.
- Connected the existing Product search input to in-memory filtering of active Products returned by `ProductService.getAll()`.
- Search now matches active Products by `name`, `barcode`, and `category`.
- Verified matching Product name search returns the expected active Product.
- Verified non-matching search returns zero active Products and shows the no-results state.
- Verified search using a deleted Product query returns zero active Products.
- Verified clearing search restores the full active Product list.
- Verified scoped Product storage count remains unchanged during search.
- Verified legacy `localStorage.products` remains present and hash-unchanged.
- Confirmed no Product Create, Edit, Delete, migration, Route Guard, Firebase Auth, credentials, default account fallback, or Firebase UID/accountId assumption changes were introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `ECS-010 Ready for Architect / Owner Review`.

## ECS-009 - Product Safe Delete Path

- Implemented the minimal Product Safe Delete path on top of accepted account-scoped Product persistence.
- Confirmed baseline unauthenticated Products access is blocked by Route Guard.
- Confirmed baseline login succeeds, `AuthSession.accountId` exists, and Products render from `products:{accountId}`.
- Confirmed baseline Product Edit exists and Product Safe Delete UI/action did not exist.
- Added a Safe Delete action per Product row.
- Reused the Product service account boundary and repository update path.
- Removed the hard-delete repository path from the active Product persistence boundary.
- Verified cancelled delete does not update Product data.
- Verified confirmed safe delete keeps the Product record in `products:{accountId}` and hides it from the active list.
- Verified active Product count decreases from 3 to 2 while total stored Product count remains 3.
- Verified deleted Product keeps the same `id`, same `accountId`, and safe-delete metadata.
- Verified deleted Product remains hidden after reload.
- Verified legacy `localStorage.products` remains present and hash-unchanged.
- Confirmed no Product Search / Filter, destructive migration, legacy deletion, Route Guard weakening, Firebase Auth change, credentials, default account fallback, Firebase UID/accountId assumption, or hard delete was introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `ECS-009 Ready for Architect / Owner Review`.

## ECS-008 - Product Edit Path

- Implemented the minimal Product Edit path on top of accepted account-scoped Product persistence.
- Confirmed baseline unauthenticated Products access is blocked by Route Guard.
- Confirmed baseline login succeeds, `AuthSession.accountId` exists, and Products render from `products:{accountId}`.
- Confirmed baseline `ProductService.update()` and repository update support exist, but no Product Edit UI/action existed.
- Added an Edit action per Product row.
- Reused the existing Product dialog and existing `ProductService.update()` write boundary.
- Verified invalid edit attempts do not update Products.
- Verified valid edit updates exactly one Product in `products:{accountId}` without changing Product count.
- Verified the edited Product keeps the same `id` and same `accountId`.
- Verified `createdBy` is preserved and `updatedBy` is updated.
- Verified the edited Product renders in the Products UI and remains visible after reload.
- Verified legacy `localStorage.products` remains present and hash-unchanged.
- Confirmed no Product Delete UI, Product Search / Filter, destructive migration, legacy deletion, Route Guard weakening, Firebase Auth change, credentials, default account fallback, or Firebase UID/accountId assumption were introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `ECS-008 Ready for Architect / Owner Review`.

## ECS-007 - Product Create Path

- Implemented the minimal Product Create path on top of accepted account-scoped Product persistence.
- Confirmed baseline unauthenticated Products access is blocked by Route Guard.
- Confirmed baseline login succeeds, `AuthSession.accountId` exists, and Products render from `products:{accountId}`.
- Confirmed baseline Product Create button, dialog, and Save button existed, but Save was not connected to a working create path.
- Connected the existing Product dialog values to `ProductFactory` and `ProductService.add()` from `ProductListPage`.
- Verified invalid create attempts do not write Products.
- Verified valid create writes exactly one Product to `products:{accountId}`.
- Verified the created Product contains `accountId`, `createdBy`, and `updatedBy`.
- Verified the created Product renders in the Products UI and remains visible after reload.
- Verified legacy `localStorage.products` remains present and hash-unchanged.
- Confirmed no Product Edit UI, Product Delete UI, Product Search / Filter, destructive migration, legacy deletion, Route Guard weakening, Firebase Auth change, credentials, default account fallback, or Firebase UID/accountId assumption were introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `ECS-007 Ready for Architect / Owner Review`.

## V1-PER-006 - Legacy Product Scoped Import

- Implemented a controlled owner-approved legacy Product import path before Product CRUD.
- Confirmed baseline legacy `products` existed with one Product and scoped `products:{accountId}` was empty.
- Confirmed baseline Products UI did not show legacy Products because active reads use scoped storage.
- Added legacy Product key and legacy import backup key helpers.
- Added Product repository methods for reading legacy Products, saving scoped collections, and saving import backups.
- Added `ProductService.importLegacyProducts()` to copy missing legacy Products into `products:{accountId}`.
- Preserved existing scoped Products and skipped duplicate legacy Products by stable Product id.
- Attached `accountId`, `createdBy`, and `updatedBy` to imported Products.
- Created non-destructive backup keys before import operations.
- Verified duplicate import safety: second import copied 0 Products and skipped 1 duplicate.
- Verified legacy `localStorage.products` remained present and hash-unchanged.
- Verified Products UI rendered imported scoped Products and continued reading the scoped key, not legacy `products`.
- Confirmed no Product Create/Edit/Delete UI, Product search/filter, destructive migration, legacy deletion, Route Guard weakening, Firebase Auth change, credentials, default account fallback, or Firebase UID/accountId assumption were introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `V1-PER-006 Ready for Architect / Owner Review`.

## V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer

- Implemented the minimal account-scoped Product persistence compatibility layer before Product CRUD.
- Confirmed baseline Product reads used legacy `products` and did not read the current account scoped key.
- Added optional Product ownership metadata: `accountId`, `createdBy`, and `updatedBy`.
- Added Product account-scoped key resolution for `products:{accountId}`.
- Updated Product repository/service reads and writes to use the authenticated `AuthSession` account boundary.
- Verified empty scoped storage renders an empty Product list.
- Verified malformed scoped storage does not crash.
- Verified scoped Product writes attach ownership metadata and render from `products:{accountId}`.
- Verified legacy `localStorage.products` remains present and hash-unchanged.
- Confirmed no Product Create/Edit/Delete UI, Product search/filter, legacy migration, legacy deletion, Route Guard weakening, Firebase Auth change, persistence driver change, credentials, or Firebase UID/accountId assumption were introduced.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Final status: `V1-PER-005 Ready for Architect / Owner Review`.

## V1-PER-004 - Product Account-Scoped Persistence Plan

- Created an implementation-ready Product account-scoped persistence plan without source changes.
- Confirmed the current Product key remains `localStorage.products`.
- Confirmed Product records still lack `accountId`, `createdBy`, and `updatedBy`.
- Compared global embedded filtering, account-scoped keys, and a compatibility layer preserving legacy global storage.
- Recommended a compatibility layer before Product CRUD: preserve `localStorage.products`, write new scoped Products to `products:{accountId}`, and migrate legacy data only through an owner-approved no-data-loss flow.
- Added a no-data-loss plan for backup, owner-approved account assignment, copy/transform, count verification, and legacy key preservation.
- Added a rollback plan that forbids deleting `localStorage.products`, clearing all localStorage, or treating Firebase UID as `accountId`.
- Confirmed no source files, Product files, persistence files, Auth files, Route Guard behavior, localStorage migration, account-scoped implementation, Product schema change, Product CRUD, credentials, or `.env` tracking changes were introduced.
- Final status: `V1-PER-004 Ready for Architect / Owner Review`.

## V1-PER-003 - Product Persistence Boundary Assessment

- Assessed the Product persistence boundary from the accepted `ecs-006-product-list-read-path` baseline.
- Confirmed TypeScript and build verification passed.
- Verified Route Guard remains active, Firebase login succeeds, Products is accessible after login, and the ECS-006 Product renders.
- Confirmed Product storage uses the global localStorage key `products`.
- Confirmed no account-scoped Product storage keys were observed.
- Confirmed Product records contain `id`, product name/title, and price fields, but do not contain `accountId`, `createdBy`, or `updatedBy`.
- Confirmed Product data did not change during runtime inspection.
- Confirmed console errors = 0 and page exceptions = 0.
- Confirmed no source files, Product files, persistence files, Auth files, Route Guard behavior, localStorage migration, account-scoped implementation, Product schema, Product CRUD, credentials, or `.env` tracking changes were introduced.
- Recommended a separate Product account-scoped persistence plan before Product Create/Edit/Delete work.
- Final status: `V1-PER-003 Ready for Architect / Owner Review`.

## ECS-006 - Product List Read Path

- Started from the accepted `v1-auth-015-route-guard-foundation` baseline.
- Verified unauthenticated Products access remains blocked by Route Guard.
- Verified Firebase login succeeds with the approved local test credentials.
- Verified authenticated Products access succeeds.
- Confirmed valid persisted product data existed in `localStorage.products`.
- Confirmed `ProductService.getAll()` returned the persisted product.
- Confirmed the baseline Products page did not execute the product read path during page entry and continued showing the empty state.
- Fixed the Products page read binding in `src/modules/products/pages/ProductListPage.ts`.
- Rendered persisted products into the existing Products table without adding create/edit/delete behavior.
- Preserved the existing empty state when no products are present.
- Verified malformed `products` storage data does not crash the page.
- Verified TypeScript, build, and runtime verification passed with console errors = 0 and page exceptions = 0.
- Confirmed no Auth files, route files, persistence files, localStorage migration, account-scoped storage migration, Product data deletion, Product schema change, credentials, or Firebase UID/accountId assumption were introduced.
- Final status: `ECS-006 Ready for Architect / Owner Review`.

## V1-AUTH-015 - Route Guard Foundation

- Added minimal Route Guard foundation for business routes.
- Added route access metadata to the route registry.
- Marked Login as public.
- Marked Dashboard and Products as protected.
- Added `AuthRouteGuard` behind `AuthStateService`.
- Updated Router navigation to initialize AuthState and redirect unauthenticated protected access to Login.
- Updated Login success behavior to navigate to Dashboard.
- Updated Firebase current-session lookup to wait for Firebase Auth readiness before reading `currentUser`.
- Verified unauthenticated Dashboard and Products access is blocked.
- Verified Login remains public.
- Verified Firebase login, Firestore account mapping, `AuthSession`, authenticated `AuthState`, Dashboard access, Products access, session restoration, logout, and post-logout route blocking.
- Verified `accountId` remains explicit and does not equal Firebase UID.
- Verified role remains `owner` or `user`.
- Verified console errors = 0, page exceptions = 0, and active network failures = 0.
- Did not modify Product files, persistence files, localStorage behavior, account-scoped persistence, permission matrix, advanced roles, Firebase mapping data, credentials, or ECS-006.
- Final status: `V1-AUTH-015 Ready for Architect / Owner Review`.

## V1-AUTH-014 - Authenticated Session Runtime Verification

- Opened authenticated-session runtime verification on a dedicated mission branch.
- Confirmed `V1-AUTH-013` exists and the Firebase-backed account mapping source is present.
- Confirmed TypeScript and build pass.
- Confirmed authenticated runtime verification passes against the owner-approved Firebase test environment.
- Verified Firebase login succeeds for the approved test user.
- Verified Firestore account mapping resolves from `accountMappings/firebase/providerUsers/{actualProviderUserId}`.
- Verified `AuthSession` is created and `AuthState` becomes authenticated.
- Verified `accountId` is explicit and does not equal Firebase UID.
- Verified role is `owner` or `user`.
- Verified logout returns `AuthState` to unauthenticated.
- Verified Dashboard and Products remain accessible without auth.
- Verified console errors = 0, page exceptions = 0, and active network failures = 0.
- Did not fake success, add hardcoded mapping, add local fallback, commit credentials, create Route Guard, change Product files, change persistence, migrate localStorage, or start ECS-006.
- Final status: `V1-AUTH-014 Ready for Architect / Owner Review`.

## V1-AUTH-013 - Firebase Account Mapping Source Implementation

- Implemented `FirebaseAccountMappingSource` under `src/modules/auth/firebase/`.
- Wired Firebase Auth session resolution through Firestore-backed account mapping when Firebase config is present.
- Recorded the Firestore mapping path: `accountMappings/firebase/providerUsers/{providerUserId}`.
- Required explicit provider, providerUserId, accountId, accountName, userId, displayName, role, and optional email fields.
- Rejected missing or invalid mapping data without default owner fallback, one global account fallback, hardcoded mappings, real credentials, or Firebase uid to `accountId` fallback.
- Aligned `FirebaseAuthProvider` to sign out Firebase Auth if session resolution throws after Firebase sign-in, preventing partial provider-authenticated state.
- Confirmed Dashboard and Products remain accessible without auth and no route guard, Product work, persistence change, localStorage migration, account-scoped persistence, real credentials, production mappings, seeded accounts, or ECS-006 work was added.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors, zero page exceptions, zero active network failures, and zero external Firebase startup requests in the no-config verification environment.

## V1-AUTH-012 - Account Mapping Runtime Source Decision

- Recorded the account mapping runtime source recommendation for Architect / Owner review.
- Recommended a Firebase-backed account mapping source for V1.
- Confirmed Route Guard must wait until account mapping source decision, implementation, and authenticated session runtime verification are complete.
- Evaluated Firebase custom claims, Firebase database account mapping, local development mapping, and hardcoded/default mapping.
- Rejected hardcoded/default mapping, `providerUserId === accountId`, default owner fallback, one global account, and local-only mapping as the official V1 runtime source.
- Recorded required mapping fields: provider, providerUserId, accountId, accountName, userId, displayName, role, and optional email.
- Updated the future Auth sequence to place Route Guard after Firebase account mapping source implementation and authenticated session runtime verification.
- Confirmed no source files, package/build/config files, Product files, persistence files, localStorage behavior, route guards, real mappings, seeded accounts, real credentials, or ECS-006 work were changed.

## V1-AUTH-011 - Login / Logout Minimal Flow

- Added a minimal public Login page with email and password fields.
- Added Login page loading, safe failure, and AuthState rendering behavior.
- Added a public Login route without route guards, redirects, Dashboard protection, or Products protection.
- Added a minimal Auth runtime factory that initializes AuthStateService only when the Login page is opened.
- Preserved no Firebase initialization or Firebase network requests on normal app startup in the no-config verification environment.
- Preserved the approved `accountId` boundary: Firebase uid remains a provider user id and is not treated as a V1 account id.
- Ensured FirebaseAuthProvider signs out if Firebase sign-in succeeds but project AuthSession resolution fails.
- Confirmed failed login remains unauthenticated and the password is not stored in localStorage.
- Runtime diagnosis: the first runtime attempt failed before evidence capture completed and was classified as a TOOL / verification invocation issue; rerun produced Runtime PASS.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors, zero page exceptions, zero active network failures, and zero external Firebase requests in the no-config verification environment.

## V1-AUTH-010 - Account Mapping Source Baseline

- Recorded the owner / architect sequencing decision that `V1-AUTH-010` is Account Mapping Source Baseline.
- Moved Login / Logout after account mapping source baseline.
- Preserved the rule that provider user ids must resolve through an explicit account mapping source before project `AuthSession` creation.
- Added `AccountMappingSource`, `ProviderUserReference`, `AccountMapping`, and `AccountMappingNotFoundError`.
- Added `AccountMappingSessionResolver` to adapt account mapping results into the existing Auth session resolution flow.
- Chose a strict contract-only baseline with no real accounts, no local seeds, no environment placeholder mapping, and no silent mapping success.
- Confirmed missing mapping fails safely by returning `null` from the account-session resolver boundary.
- Confirmed TypeScript, build, and runtime non-regression verification passed with zero console errors, zero page exceptions, zero Auth startup requests, and zero Firebase startup network requests.

## V1-AUTH-009 - AccountId / Auth Session Resolution Baseline

- Recorded the owner / architect sequencing decision that `V1-AUTH-009` is AccountId / Auth Session Resolution Baseline.
- Moved Login / Logout after account/session resolution.
- Preserved the rule that Firebase provider user ids must not be assumed to equal V1 `accountId` values.
- Added a provider-neutral `AuthSessionResolver` boundary under `src/modules/auth/`.
- Added explicit account/session resolution input and output contracts before `AuthSession` creation.
- Added `DefaultAuthSessionResolver` to build `AuthSession` only after an account resolver returns an explicit `accountId`.
- Aligned `FirebaseAuthProvider` to pass Firebase users as provider identities instead of direct session input.
- Confirmed no login UI, route guard, app startup Auth wiring, Product work, persistence change, localStorage migration, or ECS-006 work was added.
- Confirmed TypeScript, build, and runtime non-regression verification passed with zero console errors, zero page exceptions, zero Auth startup requests, and zero Firebase startup network requests.

## V1-AUTH-008 - Auth State Service

- Added a provider-neutral `AuthStateService` under `src/modules/auth/`.
- Added explicit state reading through `getState()`.
- Added private subscriber management with unsubscribe support.
- Added `initialize()`, `signIn()`, and `signOut()` methods that delegate to the existing `AuthProvider` contract.
- Preserved provider-neutral Auth state handling without Firebase-specific leakage.
- Confirmed the service is not wired into app startup, routing, persistence, Products, or runtime Auth behavior.
- Confirmed TypeScript, build, and runtime non-regression verification passed with zero console errors, zero page exceptions, zero AuthStateService startup requests, and zero Firebase startup network requests.

## V1-AUTH-007 - Managed Auth Provider Adapter

- Added a Firebase-backed `AuthProvider` adapter under `src/modules/auth/firebase/`.
- Kept Firebase SDK usage behind the Auth provider boundary.
- Required explicit session resolution before returning a project `AuthSession`.
- Preserved the approved `accountId` boundary by avoiding any `firebaseUser.uid === accountId` assumption.
- Confirmed the adapter is not wired into app startup, routing, persistence, Products, or runtime Auth behavior.
- Confirmed TypeScript, build, and runtime non-regression verification passed with zero console errors, zero page exceptions, and zero Firebase startup network requests.

## V1-AUTH-006 - Managed Auth Dependency & Config Skeleton

- Recorded Firebase Auth as the owner-approved concrete V1 Managed Auth provider.
- Added the `firebase` dependency for future Auth implementation.
- Added safe Vite environment placeholder keys in `.env.example`.
- Added Firebase Auth config reader and initialization skeleton under `src/modules/auth/firebase/`.
- Confirmed the Firebase skeleton is not wired into app startup, routing, persistence, Products, or runtime Auth behavior.

## V1-AUTH-005 - Managed Auth Integration Planning

- Created the Managed Auth integration plan for future V1 Auth implementation.
- Recommended Firebase Auth as the primary first provider while marking the concrete provider decision as pending owner approval.
- Documented dependency, environment/config, `AuthProvider` mapping, session restoration, `accountId` resolution, role, route guard, and persistence-scope plans.
- Recorded the future Auth ECS sequence from dependency/config skeleton through account-scoped persistence planning.
- Confirmed no source, dependency, package, provider implementation, login/logout, route guard, persistence, localStorage migration, Product, or ECS-006 work was performed.

## V1-AUTH-004 - Auth Interfaces And Session Contract

- Added minimal provider-neutral Auth/session TypeScript contracts under `src/modules/auth/`.
- Added `AuthRole` with only `owner` and `user`.
- Added `UserIdentity`, `AccountIdentity`, `AuthSession`, `AuthState`, `SignInCredentials`, `AuthProvider`, and `OwnershipMetadata` contracts.
- Preserved the approved `accountId` account/workspace boundary without applying it to existing Product records in this mission.
- Confirmed no Auth provider dependency, provider implementation, login/logout flow, login UI, route guard, persistence migration, Product change, package change, or routing change was added.
- Confirmed TypeScript, build, and runtime non-regression verification passed with zero console errors and zero page exceptions.

## V1-AUTH-003 - Auth Provider Decision Finalization

- Finalized V1 Auth provider direction as Managed Auth.
- Recorded `accountId` as the official V1 account/workspace data boundary.
- Recorded minimal V1 roles as `owner` and `user`.
- Confirmed permission matrix remains deferred to V2.
- Confirmed existing global localStorage data must not be deleted or migrated automatically.
- Confirmed global-to-account storage migration requires a separate ECS with runtime evidence, no-data-loss plan, rollback plan, and owner / architect approval.
- Confirmed no source, dependency, package, routing, persistence, localStorage migration, or Product implementation changes were made.

## V1-AUTH-002 - Auth Foundation Architecture Decision & User Scope Contract

- Defined the proposed V1 Auth / multi-user architecture contract.
- Recommended current user identity, session state, protected business routes, account/workspace boundary, and record ownership metadata for V1.
- Deferred advanced roles, permission matrix, SSO, MFA, and advanced security policies to V2.
- Recorded Auth provider decision as pending owner / architect approval.
- Confirmed no source, dependency, package, routing, persistence, or Product implementation changes were made.

## V1-AUTH-001 - Auth / Multi-user Foundation Baseline

- Verified Auth / multi-user foundation baseline without source-code changes.
- Confirmed no Auth dependency, Auth module, user identity model, session model, route guard, or user-scoped persistence exists.
- Confirmed Dashboard and Products routes are accessible without login.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors and zero page exceptions.
- Recorded Auth foundation as a confirmed V1 architecture gap before product-module expansion.

## V1-PER-002 - Storage Wrapper Read Resilience

- Contained malformed JSON failures inside `Storage.get<T>()`.
- Preserved existing valid JSON parsing behavior.
- Preserved existing missing-key behavior by returning `null`.
- Preserved malformed raw stored values without deletion, migration, or overwrite.
- Verified `LocalStorageDriver` read behavior remained unchanged.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors and zero page exceptions.

## V1-PER-001 - Persistence Safety Baseline

- Verified persistence safety behavior with isolated runtime localStorage keys.
- Confirmed TypeScript and build verification passed.
- Confirmed `LocalStorageDriver.read<T>()` handles missing and malformed JSON safely.
- Confirmed repository missing collection behavior returns an empty array through the existing repository contract.
- Observed non-silent write failure behavior for simulated `setItem` and circular JSON failures.
- Confirmed `src/core/Storage.ts` has a malformed JSON read-path safety issue in `Storage.get<T>()`.
- Confirmed no files under `src/` were changed.

## V1-FND-001 - Foundation Verification Baseline

- Verified the post-governance foundation runtime baseline.
- Confirmed TypeScript and build verification passed.
- Confirmed application startup, default route rendering, registered route sweep, navigation alignment, refresh behavior, and clean runtime baseline before invalid-route observation.
- Documented invalid-route behavior without changing application source code.
- Confirmed no files under `src/` were changed.

## V1-INF-002 - Governance Baseline Review & Integration

- Integrated the V1-INF-001 governance baseline into the active baseline branch.
- Updated current mission and project status documentation for V1-INF-002.
- Confirmed ECS-006 remains blocked pending Architect / Owner approval.

## V1-INF-001 - Repository Governance & Baseline Lock

- Added the approved complete Engineering Constitution v1.0.
- Added repository governance documents for project orientation, project status, current mission, V1 roadmap, and owner decisions.
- Marked the active mission as INF documentation/governance only.
- Confirmed ECS-006 remains blocked until governance baseline approval.
- Updated release documentation to avoid stale PATCH-000 status ambiguity.

## PATCH-000 - Project Stabilization

### PATCH-000-ECS-001 - Route Registry Stabilization

- Stabilized the Sidebar route surface by deriving visible navigation items from the registered route list.
- Removed Sidebar entries that pointed to unregistered routes.
- Verified that navigation to visible routes completes without browser console errors or page exceptions.

### PATCH-000-ECS-002 - Product Page Listener Lifecycle Stabilization

- Stabilized the product page dialog listener lifecycle.
- Replaced anonymous dialog button listeners with retained callback references.
- Added `onLeave()` cleanup for `create-product`, `cancel-product`, and `close-product-dialog`.
- Verified listener stability over 50 navigation/dialog cycles.

### PATCH-000-ECS-003A - Dashboard Copy Stabilization

- Removed internal implementation/progress copy from the Dashboard page.
- Kept the Dashboard route, layout ownership, and user-facing welcome copy unchanged.
- Verified the Dashboard with DOM-based runtime evidence, clean browser console, and no page exceptions.

### PATCH-000-ECS-004 - Dashboard Text Encoding Investigation

- Investigated the Dashboard text encoding hypothesis with runtime evidence.
- Rejected the hypothesis because the Dashboard rendered valid Arabic text at runtime.
- Closed ECS-004 without source-code changes.

### PATCH-000-ECS-005 - LocalStorage Read Resilience

- Contained malformed JSON failures inside `LocalStorageDriver.read<T>()`.
- Preserved existing successful JSON read behavior.
- Returned the existing contract-compatible safe default `null` for invalid JSON.
- Verified TypeScript, build, and runtime behavior with clean console and no page exceptions.
