# Current Mission

## Mission

`V1-AUTH-009 - AccountId / Auth Session Resolution Baseline`

## Classification

`ECS`

This is a limited Auth foundation source-code ECS.

This is not login UI, route guard implementation, Product work, persistence migration, app startup Auth wiring, or ECS-006.

## Objective

Define the minimum provider-neutral account/session resolution boundary required to create a project `AuthSession` without assuming that a provider user id is the same as the V1 `accountId` data boundary.

This mission exists before login/logout because user-facing authentication must not begin until the project can resolve `AuthSession.user.accountId` and `AuthSession.account.id` through an explicit boundary.

## Sequencing Decision

The owner / architect confirmed that the previous roadmap sequence was outdated.

`V1-AUTH-009` is now:

`AccountId / Auth Session Resolution Baseline`

`V1-AUTH-009` is no longer:

`Login / Logout Minimal Flow`

Login / Logout must move after account/session resolution.

## Allowed Scope

- `src/modules/auth/` account/session resolution baseline files.
- Existing Auth contracts only when minimal alignment is required.
- Existing `FirebaseAuthProvider` only if minimal type alignment is required.
- Mission documentation and evidence.

## Implemented

- Added provider-neutral account/session resolution contracts in `src/modules/auth/AuthSessionResolver.ts`.
- Added `DefaultAuthSessionResolver`.
- Required an explicit account resolver to return `accountId` before any `AuthSession` is created.
- Aligned `FirebaseAuthProvider` to pass Firebase users as provider identities.
- Preserved Firebase `uid` as `providerUserId`, not `accountId`.

## Forbidden Scope

- No login UI.
- No route guards.
- No route accessibility changes.
- No app startup Auth wiring.
- No authentication requirement at runtime.
- No Product work.
- No persistence behavior changes.
- No localStorage migration.
- No ECS-006.
- No permission matrix.
- No hardcoded credentials.
- No real credentials.
- No `firebaseUser.uid === accountId` assumption.

## Completion Criteria

- Account/session resolution boundary exists under `src/modules/auth/`.
- The boundary preserves `accountId` as the official V1 data boundary.
- Firebase-specific user ids are not treated as account ids.
- Source changes remain limited to the approved Auth scope.
- TypeScript verification passes.
- Build verification passes.
- Runtime non-regression verification passes.
- Console errors = 0.
- Page exceptions = 0.
- Auth session resolution is not wired into startup.
- Firebase startup network requests remain 0.
- No login UI appears.
- No route guard behavior appears.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-009.
- `PATCHES/V1-AUTH-009/verification.md` exists.
- `PATCHES/V1-AUTH-009/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Verification Status

- TypeScript verification passed.
- Build verification passed.
- Runtime non-regression verification passed.
- Console errors = 0.
- Page exceptions = 0.
- Auth startup requests = 0.
- Firebase startup network requests = 0.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-010 - Login / Logout Minimal Flow`, subject to Architect / Owner approval.
