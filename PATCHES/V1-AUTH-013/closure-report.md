# V1-AUTH-013 Closure Report

## Status

`V1-AUTH-013 Ready for Architect / Owner Review`

## Mission Classification

ECS limited Auth account mapping source implementation.

This mission implemented the Firebase-backed account mapping source approved after `V1-AUTH-012`. It did not implement Route Guard, Dashboard protection, Products protection, Product work, persistence behavior changes, localStorage migration, account-scoped persistence, real credentials, production account mappings, seeded accounts, or ECS-006.

## Branch

`v1/auth-013-firebase-account-mapping-source`

## Documents Reviewed

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_ORIENTATION.md`
- `PROJECT_STATUS.md`
- `CURRENT_MISSION.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `PATCHES/V1-AUTH-010/closure-report.md`
- `PATCHES/V1-AUTH-011/closure-report.md`
- `PATCHES/V1-AUTH-012/account-mapping-runtime-source-decision.md`
- `PATCHES/V1-AUTH-012/closure-report.md`
- `CHANGELOG.md`

## Source Files Inspected

- `src/modules/auth/AccountMappingSource.ts`
- `src/modules/auth/AccountMappingSessionResolver.ts`
- `src/modules/auth/AuthSessionResolver.ts`
- `src/modules/auth/AuthStateService.ts`
- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/firebase/FirebaseAuthProvider.ts`
- `src/modules/auth/firebase/FirebaseAuthClient.ts`
- `src/modules/auth/firebase/FirebaseAuthConfig.ts`
- `src/modules/auth/pages/LoginPage.ts`
- `src/router/routes.ts`
- `package.json`

## Files Added

- `src/modules/auth/firebase/FirebaseAccountMappingSource.ts`
- `PATCHES/V1-AUTH-013/verification.md`
- `PATCHES/V1-AUTH-013/closure-report.md`

## Files Updated

- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/firebase/FirebaseAuthProvider.ts`
- `CURRENT_MISSION.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `CHANGELOG.md`

## Implementation Summary

`FirebaseAccountMappingSource` reads explicit Firebase-backed account mappings from Firestore at:

```text
accountMappings/firebase/providerUsers/{providerUserId}
```

The source validates required mapping fields before returning an `AccountMapping`.

`AuthRuntime` now composes `FirebaseAuthProvider` with Firebase Auth, Firestore, `FirebaseAccountMappingSource`, `AccountMappingSessionResolver`, and `DefaultAuthSessionResolver`.

This wiring occurs only when Firebase config is present and Auth runtime is requested by the Login route.

`FirebaseAuthProvider` now signs out Firebase Auth if session resolution throws after a successful Firebase sign-in, preventing a partial provider-authenticated state when account mapping data is invalid.

## Missing Mapping Behavior

Missing Firebase mapping throws `AccountMappingNotFoundError`.

`AccountMappingSessionResolver` converts missing mapping to `null`.

`FirebaseAuthProvider` signs out Firebase Auth when session resolution returns `null`.

The Login page remains unauthenticated.

## Invalid Mapping Behavior

Invalid Firebase mapping is rejected.

Invalid records include:

- Missing required fields.
- Non-string required fields.
- Provider mismatch.
- Provider user id mismatch.
- `accountId` equal to `providerUserId`.
- Unsupported role.

If invalid mapping causes session resolution to throw after Firebase sign-in, `FirebaseAuthProvider` signs out Firebase Auth before rethrowing.

This prevents partial authenticated state without adding a default account, default role, hardcoded mapping, or local fallback.

## accountId Handling Status

- `accountId` remains the official V1 data boundary.
- Firebase uid remains provider identity only.
- `providerUserId` is not used as `accountId`.
- No fallback from Firebase uid to `accountId` was added.
- No default owner fallback was added.
- No one global account fallback was added.

## Firebase Data Source Choice

Firestore was used for the V1 mapping source because the existing Firebase config already includes `projectId` and the project already depends on the Firebase SDK.

This avoided adding a Realtime Database `databaseURL` placeholder or changing package dependencies.

Security rules and live account mapping verification remain future work for `V1-AUTH-014` with approved test credentials and mapping data.

## Verification Results

- TypeScript: PASS.
- Build: PASS.
- Runtime: PASS.
- Console errors: 0.
- Page exceptions: 0.
- Active network failures: 0.
- External Firebase startup requests: 0.
- External Firebase requests in no-config verification: 0.

Runtime evidence:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-runtime.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-dom.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-console.log
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-screenshot.png
```

## Runtime Behavior Confirmation

- App starts successfully.
- Default route works.
- Dashboard remains accessible without auth.
- Products remains accessible without auth.
- Login route remains accessible.
- No route guard behavior appears.
- No Auth services are registered in the startup Container.
- Account mapping source is not invoked during normal startup.
- Failed sign-in remains unauthenticated in the no-config verification environment.
- Password is not stored in localStorage.
- Firebase app and Firebase Auth are not initialized in the no-config failed-login verification.
- No localStorage migration performed.
- No Product behavior change observed.

## Scope Confirmation

- No Product files changed.
- No persistence files changed.
- No routing behavior changed.
- No route guard added.
- No Dashboard protection added.
- No Products protection added.
- No localStorage migration performed.
- No real credentials committed.
- No production account mappings committed.
- No seeded accounts committed.
- No Firebase uid to `accountId` assumption added.
- No ECS-006 work started.

## Remaining Issues

- Live successful authenticated-session verification requires approved Firebase test credentials and approved Firebase mapping data in `V1-AUTH-014`.
- Firebase security rules for mapping read/write boundaries remain future approved work.
- Vite build emits a chunk-size warning after Firebase modules are bundled. The build still passes.

## Recommended Next Mission

`V1-AUTH-014 - Authenticated Session Runtime Verification`

Reason:

The Firebase account mapping source now exists. The next safe step is live authenticated-session runtime verification with approved test credentials and mapping data before Route Guard work.

## Final Status

`V1-AUTH-013 Ready for Architect / Owner Review`
