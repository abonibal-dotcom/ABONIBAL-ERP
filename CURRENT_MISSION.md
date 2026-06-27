# Current Mission

## Mission

`V1-AUTH-008 - Auth State Service`

## Classification

`ECS`

This is a limited Auth foundation source-code ECS.

This is not login UI, route guard implementation, Product work, persistence migration, or ECS-006.

## Objective

Add a minimal provider-neutral Auth State Service that manages the existing `AuthState` contract using the existing `AuthProvider` interface while preserving current runtime behavior.

The owner has approved:

- Firebase Auth as the official V1 Auth provider.
- `accountId` as the official V1 data boundary.
- Minimal V1 roles: `owner` and `user`.
- No permission matrix in V1.
- No automatic deletion or migration of existing global localStorage data.
- No `firebaseUser.uid === accountId` final-design assumption.

## Implemented

- Added `AuthStateService` under `src/modules/auth/`.
- Added current state reading through `getState()`.
- Added subscribe/unsubscribe support with a private subscriber set.
- Added `initialize()` delegation to `AuthProvider.getCurrentSession()`.
- Added `signIn()` delegation to `AuthProvider.signIn(...)`.
- Added `signOut()` delegation to `AuthProvider.signOut()`.
- Preserved provider-neutral state handling and avoided Firebase-specific leakage.

## Forbidden Scope Preserved

- No login UI.
- No route guards.
- No authentication requirement at runtime.
- No route accessibility changes.
- No app startup behavior change.
- No persistence behavior change.
- No localStorage migration.
- No Product work.
- No ECS-006.
- No permission matrix.
- No hardcoded credentials.
- No real credentials.

## Verification Status

- TypeScript verification passed.
- Build verification passed.
- Runtime non-regression verification passed.
- Console errors = 0.
- Page exceptions = 0.
- AuthStateService startup requests = 0.
- Firebase startup network requests = 0.

## Completion Criteria

- Source changes are limited to `src/modules/auth/AuthStateService.ts`.
- No Product, routing, persistence, UI, or app startup files changed.
- No login UI appears.
- No route guard behavior appears.
- No AuthStateService runtime wiring exists.
- No Firebase network call is required for normal startup.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-008.
- `PATCHES/V1-AUTH-008/verification.md` exists.
- `PATCHES/V1-AUTH-008/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-009 - Login / Logout Minimal Flow`, subject to Architect / Owner approval.
