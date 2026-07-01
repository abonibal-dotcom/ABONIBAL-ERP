# V1-AUTH-014 Verification

## Mission

`V1-AUTH-014 - Authenticated Session Runtime Verification`

## Classification

ECS runtime verification mission.

This mission did not implement Route Guard, Dashboard protection, Products protection, Product work, persistence changes, localStorage migration, account-scoped persistence, real credentials, production mappings, seeded accounts, or ECS-006.

## Status

`PASS - Ready for Architect / Owner Review`

## Branch

`v1/auth-014-authenticated-session-runtime-verification`

## Verification Environment

- Runtime: Vite dev server on `http://127.0.0.1:5190/`.
- Browser: Chrome headless through CDP.
- Verification Tool: local CDP runtime verifier stored outside source in `outputs/V1-AUTH-014/`.
- Reason for Selection: deterministic DOM, runtime, console, exception, network, and screenshot evidence without modifying application source.
- Known Limitations: local `.env` and test credentials are local-only and were not printed or committed.

## Pre-check

- `.env` exists locally: yes.
- Required `VITE_FIREBASE_*` keys are present: yes.
- `ABONIBAL_AUTH_TEST_EMAIL` is present: yes.
- `ABONIBAL_AUTH_TEST_PASSWORD` is present: yes.
- `.env` tracked by Git: no.
- No credential values were printed.
- No `.env` values were printed.

## TypeScript Verification

Command:

```text
pnpm exec tsc --noEmit
```

Result:

PASS.

## Build Verification

Command:

```text
pnpm run build
```

Result:

PASS.

Notes:

- Vite emitted the existing chunk-size warning.
- Build completed successfully.

## Runtime Verification

Result:

PASS.

Scenario:

1. Start fresh Vite dev server.
2. Load the app.
3. Confirm Dashboard is accessible without auth.
4. Confirm Products is accessible without auth.
5. Open Login.
6. Sign in with the approved Firebase test user.
7. Resolve Firestore mapping from `accountMappings/firebase/providerUsers/{actualProviderUserId}`.
8. Confirm `AuthSession` creation.
9. Confirm `AuthState` becomes authenticated.
10. Confirm explicit `accountId` is present and is not Firebase UID.
11. Confirm role is `owner` or `user`.
12. Logout.
13. Confirm `AuthState` returns to unauthenticated.
14. Confirm Dashboard remains accessible without auth.
15. Confirm Products remains accessible without auth.

## Runtime Evidence

Evidence location:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-014\
```

Files:

- `after-runtime.json`
- `after-dom.json`
- `after-console.log`
- `after-screenshot.png`

## Runtime Results

- Firebase login succeeds: yes.
- Firebase provider user id observed: yes.
- Firestore account mapping resolves: yes.
- `AuthSession` is created: yes.
- `AuthState` becomes authenticated: yes.
- `accountId` is explicit: yes.
- `accountId` equals Firebase UID: no.
- Role is `owner` or `user`: yes.
- Logout returns `AuthState` to unauthenticated: yes.
- Dashboard accessible without auth before login: yes.
- Products accessible without auth before login: yes.
- Dashboard accessible without auth after logout: yes.
- Products accessible without auth after logout: yes.
- Route Guard present: no.
- Product runtime regression observed: no.
- Persistence/localStorage migration observed: no.
- Password stored in localStorage: no.
- External Firebase startup requests before login: 0.
- Console errors: 0.
- Page exceptions: 0.
- Network failures: 0.

## Scope Confirmation

- No source files changed during runtime verification.
- No Product files changed.
- No persistence files changed.
- No localStorage migration.
- No Route Guard.
- No Dashboard protection.
- No Products protection.
- No account-scoped Product persistence.
- No real credentials committed.
- No test credentials committed.
- No `.env` file committed.
- No hardcoded mapping.
- No default owner fallback.
- No one global account fallback.
- No `providerUserId === accountId` assumption.
- No `firebaseUser.uid === accountId` assumption.
- ECS-006 remains blocked.

## Final Result

`V1-AUTH-014 PASS - Ready for Architect / Owner Review`
