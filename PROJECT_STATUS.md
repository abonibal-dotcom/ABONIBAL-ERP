# ABONIBAL ERP Project Status

## Current Status

PATCH-000 is complete.

V1 roadmap execution is in progress through approved verification missions.

ECS-006 Product List Read Path is complete from execution side and ready for Architect / Owner review.

V1-INF-001 has been executed and integrated into the active baseline branch.

V1-INF-002 governance baseline review and integration is complete.

V1-FND-001 Foundation Verification Baseline is complete from execution side and ready for Architect / Owner review.

V1-PER-001 Persistence Safety Baseline is complete from execution side and ready for Architect / Owner review.

V1-PER-002 Storage Wrapper Read Resilience is complete from execution side and ready for Architect / Owner review.

V1-AUTH-001 Auth / Multi-user Foundation Baseline is complete from execution side and ready for Architect / Owner review.

V1-AUTH-002 Auth Foundation Architecture Decision & User Scope Contract is complete from execution side and ready for Architect / Owner review.

V1-AUTH-003 Auth Provider Decision Finalization is complete from execution side and ready for Architect / Owner review.

V1-AUTH-004 Auth Interfaces And Session Contract is complete from execution side and ready for Architect / Owner review.

V1-AUTH-005 Managed Auth Integration Planning is complete from execution side and ready for Architect / Owner review.

V1-AUTH-006 Managed Auth Dependency & Config Skeleton is complete from execution side and ready for Architect / Owner review.

V1-AUTH-007 Managed Auth Provider Adapter is complete from execution side and ready for Architect / Owner review.

V1-AUTH-008 Auth State Service is complete from execution side and ready for Architect / Owner review.

V1-AUTH-009 AccountId / Auth Session Resolution Baseline is complete from execution side and ready for Architect / Owner review.

V1-AUTH-010 Account Mapping Source Baseline is complete from execution side and ready for Architect / Owner review.

V1-AUTH-011 Login / Logout Minimal Flow is complete from execution side and ready for Architect / Owner review.

V1-AUTH-012 Account Mapping Runtime Source Decision is complete from execution side and ready for Architect / Owner review.

V1-AUTH-013 Firebase Account Mapping Source Implementation is complete from execution side and ready for Architect / Owner review.

V1-AUTH-014 Authenticated Session Runtime Verification is complete from execution side and ready for Architect / Owner review.

V1-AUTH-015 Route Guard Foundation is complete from execution side and ready for Architect / Owner review.

ECS-006 Product List Read Path is complete from execution side and ready for Architect / Owner review.

V1-PER-003 Product Persistence Boundary Assessment is complete from execution side and ready for Architect / Owner review.

V1-PER-004 Product Account-Scoped Persistence Plan is complete from execution side and ready for Architect / Owner review.

V1-PER-005 Product Account-Scoped Persistence Compatibility Layer is complete from execution side and ready for Architect / Owner review.

V1-PER-006 Legacy Product Scoped Import is complete from execution side and ready for Architect / Owner review.

ECS-007 Product Create Path is complete from execution side and ready for Architect / Owner review.

ECS-008 Product Edit Path is complete from execution side and ready for Architect / Owner review.

ECS-009 Product Safe Delete Path is complete from execution side and ready for Architect / Owner review.

ECS-010 Product Search / Filter Path is complete from execution side and ready for Architect / Owner review.

ECS-011 Product Module Regression Baseline is complete from execution side and ready for Architect / Owner review.

V1-INV-001 Inventory / Stock Foundation Baseline is complete from execution side and ready for Architect / Owner review.

V1-INV-002 Account-Scoped Stock Movement Ledger Design Plan is complete from execution side and ready for Architect / Owner review.

V1-INV-003 Stock Movement Ledger Persistence Baseline is complete from execution side and ready for Architect / Owner review.

V1-INV-004 Stock Movement Ledger Runtime Verification is complete from execution side and ready for Architect / Owner review.

V1-INV-005 Manual Opening Balance / Adjustment Flow is complete from execution side and ready for Architect / Owner review.

V1-INV-006 Inventory Movement History / Current Stock View is complete from execution side and ready for Architect / Owner review.

V1-INV-007 Inventory Stock Availability / Invoice Dependency Gate is complete from execution side and ready for Architect / Owner review.

V1-SALES-001 Sales / Invoice Foundation Baseline is complete from execution side and ready for Architect / Owner review.

V1-SALES-002 Account-Scoped Invoice Persistence Design Plan is complete from execution side and ready for Architect / Owner review.

V1-SALES-003 Account-Scoped Invoice Persistence Baseline is complete from execution side and ready for Architect / Owner review.

V1-SALES-004 Invoice Draft Create / Update Flow is complete from execution side and ready for Architect / Owner review.

V1-SALES-005 Invoice Issue / Stock Deduction Flow is complete from execution side and ready for Architect / Owner review.

V1-SALES-006 Issued Invoice Read / Stock Deduction Audit View is complete from execution side and ready for Architect / Owner review.

V1-SALES-007 Invoice Cancellation / Stock Reversal Design Plan is complete from execution side and ready for Architect / Owner review.

V1-SALES-008 Invoice Cancellation / Stock Reversal Implementation is complete from execution side and ready for Architect / Owner review.

V1-SALES-009 Sales / Invoice Lifecycle Regression Baseline is complete from execution side and ready for Architect / Owner review.

Completed stabilization work:

- `PATCH-000-ECS-001 - Route Registry Stabilization`
- `PATCH-000-ECS-002 - Product Page Listener Lifecycle Stabilization`
- `PATCH-000-ECS-003A - Dashboard Copy Stabilization`
- `PATCH-000-ECS-004 - Dashboard Text Encoding Investigation`
- `PATCH-000-ECS-005 - LocalStorage Read Resilience`

## Engineering State

- Engineering workflow is stable.
- Git workflow is stable.
- Runtime verification workflow is stable.
- Baseline and evidence policy is established.
- Product engineering and infrastructure/tooling work are separated by mission type.

## Application State

- Foundation exists.
- Routing and Sidebar route surface exist.
- Dashboard exists as a basic page.
- Persistence exists with localStorage driver and repository abstraction.
- Persistence safety baseline confirmed `LocalStorageDriver.read<T>()` contains malformed JSON safely.
- Persistence safety baseline confirmed `Storage.get<T>()` had a malformed JSON read-path safety issue.
- V1-PER-002 contained malformed JSON failures inside `Storage.get<T>()` while preserving valid and missing-key behavior.
- Auth / multi-user foundation baseline confirmed no Auth dependency, user identity model, session model, route guard, or user-scoped persistence currently exists.
- V1-AUTH-002 defined the proposed Auth/user scope contract: user identity, session state, protected business routes, account/workspace boundary, and ownership metadata.
- Owner approved `accountId` as the V1 data boundary.
- Owner approved Managed Auth as the V1 provider direction.
- Owner approved minimal `owner` / `user` roles for V1.
- Owner approved no automatic deletion or migration of existing global localStorage data.
- V1-AUTH-003 finalized provider decision documentation.
- V1-AUTH-004 introduced minimal provider-neutral Auth/session TypeScript contracts under `src/modules/auth/`.
- V1-AUTH-004 did not add dependencies, provider code, login/logout behavior, route guards, routing changes, persistence changes, localStorage migration, Product changes, or UI changes.
- V1-AUTH-005 recommended Firebase Auth as the first Managed Auth provider for V1, with the concrete provider decision still pending owner approval.
- V1-AUTH-005 documented dependency/config, provider adapter, Auth state, login/logout, route guard, `accountId`, legacy storage compatibility, and account-scoped persistence planning sequence.
- V1-AUTH-005 did not change source code, dependencies, package/build/config files, runtime behavior, routing, persistence, Products, or ECS-006.
- Owner approved Firebase Auth as the concrete V1 Managed Auth provider for V1-AUTH-006.
- V1-AUTH-006 added the Firebase dependency, safe environment placeholders, and call-only Firebase config/client skeleton.
- V1-AUTH-006 did not wire Firebase into app startup, login/logout, route guards, persistence, Products, or ECS-006.
- V1-AUTH-007 added a Firebase-backed `AuthProvider` adapter behind the existing Auth contract.
- V1-AUTH-007 keeps full `AuthSession` creation behind an explicit session resolver and does not assume `firebaseUser.uid === accountId`.
- V1-AUTH-007 did not add login UI, route guards, route accessibility changes, app startup wiring, persistence changes, localStorage migration, Product work, or ECS-006.
- V1-AUTH-008 added a provider-neutral `AuthStateService` behind the existing Auth contracts.
- V1-AUTH-008 manages `loading`, `authenticated`, and `unauthenticated` state transitions through `AuthProvider` without app startup wiring.
- V1-AUTH-008 did not add login UI, route guards, route accessibility changes, app startup wiring, persistence changes, localStorage migration, Product work, or ECS-006.
- Owner / architect updated the Auth sequence: V1-AUTH-009 is now AccountId / Auth Session Resolution Baseline, not Login / Logout Minimal Flow.
- Login / Logout moves after account/session resolution because Firebase provider user ids must not be assumed to be V1 `accountId` values.
- V1-AUTH-009 added a provider-neutral account/session resolution boundary under `src/modules/auth/`.
- V1-AUTH-009 added `DefaultAuthSessionResolver`, which creates an `AuthSession` only after an account resolver returns an explicit `accountId`.
- V1-AUTH-009 aligned `FirebaseAuthProvider` so Firebase users become provider identities and do not directly become account/session records.
- V1-AUTH-009 did not add login UI, route guards, route accessibility changes, app startup wiring, persistence changes, localStorage migration, Product work, or ECS-006.
- Owner / architect updated the Auth sequence: V1-AUTH-010 is now Account Mapping Source Baseline, not Login / Logout Minimal Flow.
- Login / Logout moves after account mapping source baseline because provider identity must resolve through an explicit account mapping source before user-facing auth flow begins.
- V1-AUTH-010 added account mapping source contracts under `src/modules/auth/`.
- V1-AUTH-010 added `AccountMappingSessionResolver` to adapt account mapping into the existing Auth session resolution flow.
- V1-AUTH-010 chose a strict contract-only baseline with no real accounts, no local seeds, no environment placeholder mapping, and no silent mapping success.
- V1-AUTH-010 did not add login UI, login/logout UI, route guards, route accessibility changes, app startup wiring, persistence changes, localStorage migration, Product work, or ECS-006.
- V1-AUTH-011 added a minimal public Login page and Logout affordance behind AuthState.
- V1-AUTH-011 added a minimal Auth runtime factory that is created only when the Login page is opened.
- V1-AUTH-011 added a public `login` route without adding route guards, redirects, Dashboard protection, Products protection, Product work, persistence changes, localStorage migration, or ECS-006.
- V1-AUTH-011 preserved the rule that Firebase uid is a provider user id and is not a V1 `accountId`.
- V1-AUTH-011 keeps failed sign-in unauthenticated and does not store the password in localStorage.
- V1-AUTH-012 recommended a Firebase-backed account mapping source for V1.
- V1-AUTH-012 records that Route Guard must wait until account mapping source decision, implementation, and authenticated session runtime verification are complete.
- V1-AUTH-012 rejects hardcoded/default mapping, `providerUserId === accountId`, default owner fallback, one global account, and local-only mapping as the official V1 runtime source.
- V1-AUTH-012 did not change source files, package/build/config files, Product files, persistence behavior, localStorage behavior, route guards, account mappings, seeded accounts, credentials, or ECS-006.
- Owner approved the Firebase-backed account mapping source for `V1-AUTH-013`.
- V1-AUTH-013 added `FirebaseAccountMappingSource` under `src/modules/auth/firebase/`.
- V1-AUTH-013 reads explicit account mappings from Firestore at `accountMappings/firebase/providerUsers/{providerUserId}`.
- V1-AUTH-013 wires Auth runtime to Firebase Auth, Firestore account mapping, `AccountMappingSessionResolver`, and `DefaultAuthSessionResolver` only when Firebase config is present and Auth runtime is requested.
- V1-AUTH-013 preserves the approved `accountId` boundary by rejecting Firebase uid to `accountId` fallback, default owner fallback, one global account fallback, and invalid mapping data.
- V1-AUTH-013 aligns `FirebaseAuthProvider` to sign out Firebase Auth if session resolution throws after Firebase sign-in.
- V1-AUTH-013 did not add route guards, Dashboard protection, Products protection, Product work, persistence behavior changes, localStorage migration, account-scoped persistence, real credentials, production mappings, seeded accounts, or ECS-006.
- V1-AUTH-014 confirmed TypeScript, build, and authenticated runtime verification pass.
- V1-AUTH-014 verified Firebase login, Firestore account mapping resolution at `accountMappings/firebase/providerUsers/{actualProviderUserId}`, `AuthSession` creation, authenticated `AuthState`, explicit `accountId` distinct from Firebase UID, allowed role, logout to unauthenticated state, Dashboard accessibility without auth, and Products accessibility without auth.
- V1-AUTH-014 did not change source files, route guards, Product files, persistence files, localStorage behavior, credentials, account mappings, seeded accounts, or ECS-006.
- V1-AUTH-015 added the minimal Route Guard foundation for business routes.
- V1-AUTH-015 marks Login as public and Dashboard/Products as protected in the route registry.
- V1-AUTH-015 redirects unauthenticated protected-route access to Login.
- V1-AUTH-015 verifies authenticated users can access Dashboard and Products, session restoration works after reload, logout returns unauthenticated state, and protected routes are blocked again after logout.
- V1-AUTH-015 did not change Product files, persistence files, localStorage behavior, account-scoped persistence, permission matrix, advanced roles, credentials, Firebase mapping data, or ECS-006.
- Products module is partial.
- ECS-006 confirmed persisted products can be read through `ProductService.getAll()` and rendered by the Products page after authenticated access.
- ECS-006 fixed the Products page read binding without Auth changes, routing changes, persistence changes, localStorage migration, account-scoped storage migration, Product schema changes, create/edit/delete behavior, or Product data deletion.
- V1-PER-003 assessed the Product persistence boundary without source changes.
- V1-PER-003 confirmed Product persistence currently uses the global `products` localStorage key.
- V1-PER-003 confirmed Product records do not contain `accountId`, `createdBy`, or `updatedBy`.
- V1-PER-003 confirmed Product reads and existing write methods do not receive or apply account context.
- V1-PER-003 recommends a separate Product account-scoped persistence plan before Product Create/Edit/Delete work.
- V1-PER-004 recommends a compatibility layer before Product CRUD: preserve `localStorage.products`, write new scoped Products to `products:{accountId}`, and migrate legacy global data only through an owner-approved no-data-loss flow.
- V1-PER-005 implemented the compatibility layer: normal Product reads and writes now use `products:{accountId}` from the authenticated `AuthSession` account boundary.
- V1-PER-005 preserved legacy `localStorage.products` without deletion, rewrite, automatic copy, or migration.
- V1-PER-006 added a controlled owner-approved import path that copies legacy Products into `products:{accountId}` with backup, duplicate handling, ownership metadata, and legacy key preservation.
- V1-PER-006 verified duplicate import safety and confirmed Product CRUD UI remains blocked.
- ECS-007 added the minimal Product Create path on top of the accepted account-scoped Product persistence foundation.
- ECS-007 verified invalid create attempts do not write Products, valid create writes exactly one Product to `products:{accountId}`, ownership metadata is attached, reload persistence works, and legacy `localStorage.products` remains hash-unchanged.
- ECS-008 added the minimal Product Edit path on top of the accepted account-scoped Product persistence foundation.
- ECS-008 verified invalid edit attempts do not update Products, valid edit updates exactly one scoped Product without changing count, identity and ownership boundaries are preserved, reload persistence works, and legacy `localStorage.products` remains hash-unchanged.
- ECS-009 added the minimal Product Safe Delete path on top of the accepted account-scoped Product persistence foundation.
- ECS-009 verified cancelled delete does not update Product data, confirmed safe delete marks one scoped Product with safe-delete metadata, active count decreases by exactly 1, total stored count does not decrease, reload hiding works, and legacy `localStorage.products` remains hash-unchanged.
- ECS-010 added the minimal Product Search / Filter path on top of the accepted account-scoped Product persistence foundation.
- ECS-010 verified matching Product name search, non-matching no-results, deleted Product exclusion from search results, clear-search restoration, unchanged scoped Product storage count, and legacy `localStorage.products` hash preservation.
- ECS-011 verified the accepted Product module end to end across Route Guard, account-scoped read, create, edit, safe delete, search/filter, legacy key preservation, and runtime stability without source changes.
- V1-INV-001 assessed Inventory / Stock foundation and confirmed no standalone Inventory module, route, active UI, stock service, stock repository, stock movement model, invoice module, or stock storage boundary exists yet.
- V1-INV-001 confirmed Product contains `quantity` and `minimumQuantity`, but recommended against using direct Product quantity as the authoritative V1 stock model.
- V1-INV-001 recommended an account-scoped stock movement ledger with `stockMovements:{accountId}` before invoice stock deduction work.
- V1-INV-002 designed the account-scoped Stock Movement Ledger as the authoritative V1 Inventory model.
- V1-INV-002 recommended `stockMovements:{accountId}` as the authoritative storage boundary and `inventorySnapshots:{accountId}` only as an optional rebuildable cache.
- V1-INV-002 documented that invoices must create stock movements and must not directly edit `Product.quantity`.
- V1-INV-002 confirmed invoice stock deduction remains blocked until Inventory persistence and current quantity computation are implemented and verified.
- V1-INV-003 added the minimal account-scoped Stock Movement Ledger persistence baseline under `src/modules/inventory/`.
- V1-INV-003 implemented `stockMovements:{accountId}` storage, movement validation, append, current quantity computation, and non-destructive void behavior.
- V1-INV-003 verified opening balance and manual adjustment writes, non-voided current quantity computation, void preservation, reload persistence, unchanged Product storage hashes, clean console, and zero page exceptions.
- V1-INV-003 did not add Inventory UI, Inventory routes, invoice implementation, invoice stock deduction, Product CRUD changes, Product quantity migration, Auth changes, Route Guard weakening, Firebase uid/accountId fallback, or default account fallback.
- V1-INV-004 verified the Stock Movement Ledger runtime behavior without requiring a source fix.
- V1-INV-004 verified valid appends, invalid rejection, malformed record tolerance, multi-product current quantity computation, other-account movement isolation, non-destructive void behavior, reload persistence, Product storage safety, clean console, and zero page exceptions.
- V1-INV-004 did not change source files, add Inventory UI, add Inventory routes, add invoice implementation, alter Product CRUD, mutate Product records, change Auth, weaken Route Guard, use Firebase uid/provider user id as accountId, or add default account fallback.
- V1-INV-005 added the minimal authenticated Inventory route and manual movement UI for opening balance and manual adjustment.
- V1-INV-005 writes manual movements only to `stockMovements:{accountId}` through the accepted `InventoryService`.
- V1-INV-005 verifies invalid manual movement submissions do not write, valid opening balance and manual adjustment each write one movement, current quantity updates and survives reload, soft-deleted Products are not selectable, Product storage hashes remain unchanged, and `Product.quantity` is not updated.
- V1-INV-005 did not add invoice implementation, invoice stock deduction, Product CRUD changes, Product files, Product quantity migration, Auth behavior changes, Route Guard weakening, Firebase uid/provider user id as accountId, or default account fallback.
- V1-INV-006 added the minimal read-only Inventory current stock section and movement history section.
- V1-INV-006 displays valid movements from `stockMovements:{accountId}`, shows voided movements as voided, uses productId fallback for missing Product references, and keeps current quantity computed from non-voided ledger movements.
- V1-INV-006 verifies current quantity display matches service computation, movement history row count matches valid ledger count, reload preserves both views, Product storage hashes remain unchanged, and `Product.quantity` is not authoritative.
- V1-INV-006 did not add invoice implementation, invoice stock deduction, Product CRUD changes, Product files, Product quantity migration, Auth behavior changes, Route Guard weakening, Firebase uid/provider user id as accountId, or default account fallback.
- Product dialog lifecycle was stabilized.
- Malformed product localStorage read failures were contained.
- Inventory now has a minimal stock movement ledger persistence module, a minimal authenticated manual movement flow, and a read-only movement history/current stock view.
- Clients are missing.
- Suppliers are missing.
- Sales and invoices are partial.
- V1-SALES-001 confirmed no invoice module, route, UI, service, repository, persistence key, or storage boundary exists yet.
- V1-SALES-002 designed the future invoice persistence boundary as `invoices:{accountId}`.
- V1-SALES-002 rejected global invoice storage, Firebase UID/provider user id storage, and default account fallback.
- V1-SALES-002 documented the future invoice header/line contracts, draft/issued/cancelled lifecycle, account-scoped numbering policy, Product snapshot dependency, and Inventory stock availability/deduction dependency.
- V1-SALES-002 did not change source files, add invoice UI, add invoice routes, implement invoice persistence, create stock movements, mutate Products, mutate Inventory, change Auth, weaken Route Guard, or migrate localStorage.
- V1-SALES-003 added the minimal account-scoped Invoice persistence baseline under `src/modules/sales/`.
- V1-SALES-003 implemented `invoices:{accountId}`, invoice model/types, invoice lifecycle status, invoice line Product snapshots, repository, validator, service methods, and Container registration.
- V1-SALES-003 verified createDraft, updateDraft, markIssued, markCancelled, reload persistence, scoped storage, no global invoice key, no Product mutation, no Inventory mutation, no stock deduction, clean console, and zero page exceptions.
- V1-SALES-003 did not add invoice UI, add invoice routes, implement invoice stock deduction, create `sale_deduction` movements, mutate Product records, update `Product.quantity`, mutate Inventory, change Auth, weaken Route Guard, migrate localStorage, use Firebase uid/provider user id as `accountId`, or add default account fallback.
- V1-SALES-004 added the first minimal authenticated Invoice draft UI flow.
- V1-SALES-004 added a protected `invoices` route and `Invoices` Sidebar entry.
- V1-SALES-004 verifies invalid draft submissions do not write, valid draft create writes exactly one invoice to `invoices:{accountId}`, draft update preserves id/accountId/status, Product snapshot fields are persisted, totals are correct, and reload preserves the draft.
- V1-SALES-004 did not add invoice issue behavior, cancellation UI, stock deduction, `sale_deduction` movements, Product mutation, Inventory mutation, Auth changes, Route Guard weakening, localStorage migration, Firebase uid/provider user id as `accountId`, or default account fallback.
- V1-SALES-005 added the minimal Invoice issue / stock deduction flow.
- V1-SALES-005 verifies insufficient-stock issue is blocked without writing movements, successful issue creates `sale_deduction` movements, invoice lines store `stockMovementId`, availability decreases through the stock ledger, duplicate issue attempts do not duplicate movements, and reload preserves the issued invoice and movement.
- V1-SALES-005 did not add cancellation, returns, hard delete, Product CRUD behavior changes, Product mutation, `Product.quantity` updates, Auth changes, Route Guard weakening, localStorage migration, Firebase uid/provider user id as `accountId`, or default account fallback.
- V1-SALES-006 added read-only issued invoice and stock deduction audit visibility.
- V1-SALES-006 verifies issued invoice status, number, total, issuedAt, line Product snapshot, quantity, unit price, line total, and `stockMovementId` are visible after reload.
- V1-SALES-006 verifies the referenced movement exists as `sale_deduction`, has negative quantityDelta, matches the invoice line Product/account boundary, and available stock remains reduced after reload.
- V1-SALES-006 did not add cancellation, returns, reversal movements, hard delete, Product CRUD behavior changes, Product mutation, `Product.quantity` updates, Auth changes, Route Guard weakening, localStorage migration, Firebase uid/provider user id as `accountId`, or default account fallback.
- V1-SALES-007 designed the V1 invoice cancellation and stock reversal policy without changing source files.
- V1-SALES-007 recommends audit-preserving `issued -> cancelled` cancellation with `cancelledAt`, `cancelledBy`, and `cancelReason`.
- V1-SALES-007 recommends additive positive `sale_return` movements with `referenceType: "invoice_return"` to reverse prior `sale_deduction` movements.
- V1-SALES-007 recommends reversal traceability through metadata linking the reversal to the original `sale_deduction`, invoice, and invoice line.
- V1-SALES-007 verified read-only runtime evidence: issued invoice visible, sale deduction traceable, no cancellation UI, no reversal movement created, invoice/movement counts unchanged, Product hash unchanged, clean console, zero page exceptions, and `.env` untracked.
- V1-SALES-007 did not change source files, implement cancellation, add cancellation UI, implement returns, create reversal movements, mutate Products, mutate Inventory, update `Product.quantity`, weaken Route Guard, change Auth, migrate localStorage, use Firebase uid/provider user id as `accountId`, or add default account fallback.
- V1-SALES-008 implemented safe issued-invoice cancellation and stock reversal.
- V1-SALES-008 added optional invoice line `reversalStockMovementId`, positive `sale_return` movement creation with `referenceType: "invoice_return"`, and reversal metadata linking the reversal to the original `sale_deduction`, invoice, and invoice line.
- V1-SALES-008 verifies draft cancellation is blocked, missing invoice cancellation fails safely, issued invoice cancellation succeeds, invoice status becomes `cancelled`, original `sale_deduction` remains stored, one `sale_return` is created, duplicate cancellation creates no duplicate movement, available quantity increases from 3 to 5, reload preserves the audit trail, Product scoped hash remains unchanged, clean console, zero page exceptions, and `.env` untracked.
- V1-SALES-008 did not implement returns, partial returns, invoice hard delete, Product CRUD changes, Product mutation, `Product.quantity` updates, Auth changes, Route Guard weakening, localStorage migration, Firebase uid/provider user id as `accountId`, or default account fallback.
- V1-SALES-009 verified the accepted Sales / Invoice lifecycle end to end without requiring a source fix.
- V1-SALES-009 verifies protected invoice route, draft create/update, failed issue blocking, successful issue, `sale_deduction`, issued audit visibility, duplicate issue safety, issued cancellation, `sale_return`, duplicate cancellation safety, reload persistence, Product storage safety, Inventory ledger correctness, clean console, zero page exceptions, and `.env` untracked.
- V1-SALES-009 did not implement returns, partial returns, invoice hard delete, Product CRUD changes, Product mutation, `Product.quantity` updates, Auth changes, Route Guard weakening, localStorage migration, Firebase uid/provider user id as `accountId`, or default account fallback.
- Expenses are missing.
- Safes and cash movement are missing.
- Basic ledger is missing.
- Sync/data-safety module is missing.
- Reports are missing.
- Auth implementation now includes the V1 foundation, provider adapter, Auth state service, account/session resolution, account mapping boundary, minimal Login / Logout runtime flow, Firebase-backed account mapping source implementation, live authenticated-session runtime verification, and Route Guard foundation. Account-scoped persistence and storage migration remain future approved missions.

## Current Mission

Current mission:

`V1-SALES-009 - Sales / Invoice Lifecycle Regression Baseline`

Current next mission:

V1-SALES-009 complete from execution side and ready for Architect / Owner review.

Classification:

`INF`

Allowed scope:

Issued invoice cancellation and stock reversal implementation only.

Forbidden scope:

No returns implementation, no partial returns, no invoice hard delete, no Product CRUD behavior change, no Product quantity migration, no Product record mutation, no Auth redesign, no Route Guard weakening, no destructive migration, no localStorage migration, no hardcoded credentials, no real credentials committed, and no Firebase uid/provider user id to `accountId` assumption.

## Next State

Await Architect / Owner review for V1-SALES-009. Returns remain blocked until a later owner-approved mission explicitly defines return policy and runtime verification gates.
