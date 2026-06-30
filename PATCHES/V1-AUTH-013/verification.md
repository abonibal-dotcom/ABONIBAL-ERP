# V1-AUTH-013 Verification

## Mission

`V1-AUTH-013 - Firebase Account Mapping Source Implementation`

## Classification

ECS limited to Auth account mapping source implementation.

## Verification Environment

Runtime:

`http://127.0.0.1:5184/`

Browser:

Google Chrome headless.

Verification Tool:

Chrome DevTools Protocol direct WebSocket client.

Reason for Selection:

CDP verifies browser runtime route accessibility, Login DOM selectors, no-startup Firebase requests, console output, page exceptions, network activity, storage state, and screenshot capture without adding project test dependencies.

Known Limitations:

Live successful Firebase sign-in with a real account mapping requires approved Firebase test credentials and approved Firebase mapping data in `V1-AUTH-014`. This verification proves implementation wiring, no-startup regression, no-config safe failure, and unchanged public route access.

## Source Scope

Files updated:

- `src/modules/auth/AuthRuntime.ts`
- `src/modules/auth/firebase/FirebaseAuthProvider.ts`

Files added:

- `src/modules/auth/firebase/FirebaseAccountMappingSource.ts`

No Product, persistence, router behavior, route guard, Dashboard protection, Products protection, localStorage migration, real credentials, real mappings, or ECS-006 work was added.

## Firebase Account Mapping Source

Implemented source:

`FirebaseAccountMappingSource`

Firestore path:

`accountMappings/firebase/providerUsers/{providerUserId}`

Required mapping fields:

- `provider`
- `providerUserId`
- `accountId`
- `accountName`
- `userId`
- `displayName`
- `role`

Optional field:

- `email`

Validation:

- `provider` must be `firebase`.
- `providerUserId` must match the authenticated Firebase provider user id.
- `accountId` must be explicit and distinct from `providerUserId`.
- `role` must be `owner` or `user`.
- Missing mapping throws `AccountMappingNotFoundError`.
- Invalid mapping is rejected and does not create an authenticated `AuthSession`.

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

Note:

Vite emitted the chunk-size warning after Firebase modules were bundled. The build completed successfully.

## Runtime Verification

Runtime evidence:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-runtime.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-dom.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-console.log
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-013\after-screenshot.png
```

Runtime result:

PASS.

Measured results:

- Console errors: 0.
- Page exceptions: 0.
- Active network failures: 0.
- External Firebase startup requests: 0.
- External Firebase requests in no-config verification: 0.
- Dashboard route accessible without auth: yes.
- Products route accessible without auth: yes.
- Login route accessible: yes.
- No route guard metadata present: yes.
- Login UI is not rendered on normal startup: yes.
- Account mapping source is not registered in the startup Container: yes.
- AuthStateService is not registered in the startup Container: yes.
- Failed sign-in remains unauthenticated: yes.
- Password is not stored in localStorage: yes.
- Firebase app is not initialized in no-config failed-login verification: yes.
- Firebase Auth is not initialized in no-config failed-login verification: yes.

## Scope Confirmations

- No route guard.
- Dashboard remains accessible without auth.
- Products remains accessible without auth.
- No Product files changed.
- No persistence files changed.
- No localStorage migration.
- No real credentials.
- No production account mappings.
- No seeded accounts.
- No Firebase uid to `accountId` fallback.
- No default owner fallback.
- No one global account fallback.
- ECS-006 remains blocked.

## Result

`V1-AUTH-013` verification passed and is ready for commit, tag, push, and Architect / Owner review.
