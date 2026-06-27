# Changelog

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
