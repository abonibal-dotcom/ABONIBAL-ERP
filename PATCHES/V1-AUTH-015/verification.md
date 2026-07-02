# V1-AUTH-015 Verification

## Mission

`V1-AUTH-015 - Route Guard Foundation`

## Classification

ECS limited Auth routing foundation.

This mission is not Product work, persistence migration, account-scoped persistence, permission matrix, advanced roles, or ECS-006.

## Status

`PASS - Ready for Architect / Owner Review`

## Branch

`v1/auth-015-route-guard-foundation`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `PATCHES/V1-AUTH-011/closure-report.md`
- `PATCHES/V1-AUTH-012/account-mapping-runtime-source-decision.md`
- `PATCHES/V1-AUTH-013/closure-report.md`
- `PATCHES/V1-AUTH-014/closure-report.md`
- `PATCHES/V1-AUTH-014/verification.md`
- `CHANGELOG.md`

## Source Files Inspected

- `src/core/Router.ts`
- `src/router/routes.ts`
- `src/router/PageManager.ts`
- `src/ui/navigation/Sidebar.ts`
- `src/modules/auth/pages/LoginPage.ts`
- `src/modules/auth/AuthStateService.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/firebase/FirebaseAuthProvider.ts`
- `src/modules/auth/firebase/FirebaseAccountMappingSource.ts`
- `src/modules/auth/AccountMappingSessionResolver.ts`
- `src/main.ts`
- `src/core/Application.ts`
- `src/core/Container.ts`
- `src/layouts/MainLayout.ts`
- `src/ui/workspace/Workspace.ts`
- `src/pages/DashboardPage.ts`
- `src/modules/products/pages/ProductListPage.ts`

## Files Added

- `src/modules/auth/AuthRouteGuard.ts`
- `PATCHES/V1-AUTH-015/verification.md`
- `PATCHES/V1-AUTH-015/closure-report.md`

## Files Updated

- `src/core/Router.ts`
- `src/router/routes.ts`
- `src/ui/navigation/Sidebar.ts`
- `src/modules/auth/pages/LoginPage.ts`
- `src/modules/auth/firebase/FirebaseAuthProvider.ts`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`

## Route Guard Summary

- Added route access metadata to the route registry.
- Public route: `login`.
- Protected routes: `dashboard`, `products`, and future non-public business routes registered in the route registry.
- Added `AuthRouteGuard` behind `AuthStateService`.
- `Router.navigate()` now checks route access before opening protected pages.
- Unauthenticated protected access redirects to `login`.
- Login success navigates to `dashboard`.
- Existing Firebase session restoration is supported by waiting for Firebase Auth readiness before reading `currentUser`.

## Startup / Session Restoration

- Startup attempts to open `dashboard`.
- Because `dashboard` is protected, the guard initializes AuthState.
- With no restored session, startup redirects to Login.
- With a restored Firebase session and valid account mapping, protected startup access is allowed.
- No fake authenticated state, default owner fallback, hardcoded session, or Firebase UID as `accountId` fallback was added.

## Baseline Evidence

Location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-015\
```

Files:

- `baseline-runtime.json`
- `baseline-dom.json`
- `baseline-console.log`
- `baseline-screenshot.png`

Baseline result:

- Dashboard accessible without auth: yes.
- Products accessible without auth: yes.
- Login accessible: yes.
- Route Guard present: no.
- Console errors: 0.
- Page exceptions: 0.
- Network failures: 0.

## After Evidence

Location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-015\
```

Files:

- `after-runtime.json`
- `after-dom.json`
- `after-console.log`
- `after-screenshot.png`

After result:

- Unauthenticated Dashboard access blocked: yes.
- Unauthenticated Products access blocked: yes.
- Login route accessible: yes.
- Firebase login succeeds: yes.
- Firestore account mapping resolves: yes.
- `AuthSession` is created: yes.
- `AuthState` becomes authenticated: yes.
- Authenticated Dashboard access works: yes.
- Authenticated Products access works: yes.
- Session restoration after reload works: yes.
- Logout returns `AuthState` to unauthenticated: yes.
- Protected routes blocked after logout: yes.
- `accountId` is explicit and not Firebase UID: yes.
- Role is `owner` or `user`: yes.
- Password stored in localStorage: no.
- Product data mutation observed: no.
- localStorage migration observed: no.
- Console errors: 0.
- Page exceptions: 0.
- Network failures: 0.

## Verification Gates

TypeScript:

```text
pnpm exec tsc --noEmit
```

Result: PASS.

Build:

```text
pnpm run build
```

Result: PASS.

Runtime Verification:

Result: PASS.

## Scope Confirmation

- No Product files changed.
- No persistence files changed.
- No localStorage migration.
- No account-scoped Product persistence.
- No permission matrix.
- No advanced roles.
- No hardcoded credentials.
- No `.env` commit.
- No Firebase account mapping data changes.
- No `providerUserId === accountId` assumption.
- No `firebaseUser.uid === accountId` assumption.
- ECS-006 remains blocked.

## Final Result

`V1-AUTH-015 PASS - Ready for Architect / Owner Review`
