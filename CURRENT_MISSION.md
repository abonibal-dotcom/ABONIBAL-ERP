# Current Mission

## Mission

`V1-AUTH-011 - Login / Logout Minimal Flow`

## Classification

`ECS`

This is a limited Auth UI/runtime flow ECS.

This is not route guard implementation, Product work, persistence migration, account-scoped storage, or ECS-006.

## Objective

Introduce the smallest safe Login / Logout runtime flow needed to prove that the existing Auth foundation can be used.

The flow must preserve the approved `accountId` boundary: Firebase provider user ids are provider identities only and must not be treated as V1 account ids.

## Allowed Scope

- `src/modules/auth/` minimal Auth runtime and Login page files.
- Existing `FirebaseAuthProvider` only to prevent a confusing partially authenticated Firebase session when project session resolution fails.
- Routing only to expose a public `login` route.
- Mission documentation and evidence.

## Implemented

- Added a minimal public Login page with email and password fields.
- Added Login page loading, safe failure, and AuthState rendering behavior.
- Added a Login navigation route without protecting or redirecting existing business routes.
- Added a minimal Auth runtime factory that creates AuthStateService only when the Login page is opened.
- Preserved no Firebase initialization or Firebase network requests on normal app startup without visiting Login.
- Used a missing-config Auth provider so environments without approved Firebase credentials fail safely.
- Kept account mapping strict: no real mappings, no seeded accounts, and no `firebaseUser.uid === accountId` fallback.
- Aligned `FirebaseAuthProvider.signIn()` to sign out of Firebase if Firebase sign-in succeeds but project `AuthSession` resolution fails.

## Forbidden Scope

- No route guards.
- No Dashboard protection.
- No Products protection.
- No Product work.
- No business persistence behavior changes.
- No localStorage migration.
- No account-scoped persistence.
- No ECS-006.
- No permission matrix.
- No advanced roles.
- No hardcoded credentials.
- No real credentials.
- No production account mappings.
- No real account seeding.
- No `firebaseUser.uid === accountId` assumption.

## Runtime Diagnosis

The first Runtime Verification attempt failed before evidence capture completed.

It produced no `after-runtime.json`, no `after-dom.json`, and no screenshot.

Vite had already reached server readiness, so the failure was classified as a TOOL / verification invocation issue, not an application source failure.

No source changes were made during diagnosis.

A rerun on fresh Vite/CDP ports produced Runtime PASS.

## Completion Criteria

- TypeScript verification passes.
- Build verification passes.
- Runtime verification passes.
- Console errors = 0.
- Page exceptions = 0.
- Login route/page works.
- Failed login remains unauthenticated.
- Password is not stored in localStorage.
- No route guard behavior appears.
- Dashboard remains accessible without auth.
- Products remains accessible without auth.
- No Product files changed.
- No persistence files changed.
- No localStorage migration occurs.
- Firebase startup network requests remain 0 on normal startup when observable.
- No real credentials committed.
- No `firebaseUser.uid === accountId` assumption added.
- `CHANGELOG.md` records V1-AUTH-011.
- `PATCHES/V1-AUTH-011/verification.md` exists.
- `PATCHES/V1-AUTH-011/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Verification Status

- TypeScript verification passed.
- Build verification passed.
- Runtime verification passed.
- Console errors = 0.
- Page exceptions = 0.
- Active network failures = 0.
- External Firebase requests = 0 in the no-config verification environment.
- Dashboard remains accessible without auth.
- Products remains accessible without auth.
- Failed login remains unauthenticated.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is an owner-approved Auth continuation mission after Architect / Owner review of V1-AUTH-011.
