# Changelog

## V1-AUTH-014 - Authenticated Session Runtime Verification

- Opened authenticated-session runtime verification on a dedicated mission branch.
- Confirmed `V1-AUTH-013` exists and the Firebase-backed account mapping source is present.
- Confirmed TypeScript and build pass.
- Blocked authenticated runtime verification because the current environment does not provide approved Firebase config, approved test credentials, or verifiable Firebase account mapping data.
- Did not fake success, add hardcoded mapping, add local fallback, commit credentials, create Route Guard, change Product files, change persistence, migrate localStorage, or start ECS-006.
- Final status: `V1-AUTH-014 BLOCKED - ENV / Owner-provided Firebase test environment required`.

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
