# Current Mission

## Mission

`V1-AUTH-007 - Managed Auth Provider Adapter`

## Classification

`ECS`

This is a limited Auth provider adapter implementation ECS.

This is not login implementation, route guard implementation, Product work, persistence migration, or ECS-006.

## Objective

Add a Firebase-backed adapter behind the existing provider-neutral `AuthProvider` contract while preserving current runtime behavior.

The owner has approved:

- Firebase Auth as the official V1 Auth provider.
- `accountId` as the official V1 data boundary.
- Minimal V1 roles: `owner` and `user`.
- No permission matrix in V1.
- No automatic deletion or migration of existing global localStorage data.

## Implemented

- Added `FirebaseAuthProvider` under `src/modules/auth/firebase/`.
- Kept Firebase SDK usage contained inside the Auth Firebase adapter layer.
- Required an explicit `FirebaseAuthSessionResolver` for converting Firebase users into project `AuthSession` values.
- Avoided assuming `firebaseUser.uid === accountId`.
- Preserved current app startup, routing, Products, persistence, and localStorage behavior.

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
- No hardcoded Firebase credentials.
- No real Firebase credentials.

## Verification Status

- TypeScript verification passed.
- Build verification passed.
- Runtime non-regression verification passed.
- Console errors = 0.
- Page exceptions = 0.
- Firebase startup network requests = 0.

## Completion Criteria

- Adapter source changes are limited to `src/modules/auth/firebase/`.
- No Product, routing, persistence, UI, or app startup files changed.
- No login UI appears.
- No route guard behavior appears.
- No Firebase network call is required for normal startup.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-007.
- `PATCHES/V1-AUTH-007/verification.md` exists.
- `PATCHES/V1-AUTH-007/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-008 - Auth State Service`, subject to Architect / Owner approval.
