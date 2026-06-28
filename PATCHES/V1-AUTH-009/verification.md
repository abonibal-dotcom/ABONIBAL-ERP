# V1-AUTH-009 Verification

## Mission

`V1-AUTH-009 - AccountId / Auth Session Resolution Baseline`

Classification:

`ECS`

## Verification Environment

Runtime:

`http://127.0.0.1:5176/`

Browser:

Google Chrome headless

Verification Tool:

Chrome DevTools Protocol direct WebSocket client

Reason for Selection:

CDP verifies browser runtime route accessibility, stable DOM selectors, console output, page exceptions, network activity, and screenshot capture without adding project test dependencies.

Known Limitations:

This verifies runtime non-regression only. Live account/session resolution requires approved Auth wiring and account resolver data in later Auth ECS missions.

Port note:

The final runtime evidence was collected from a fresh Vite instance on `5176`.

## Sequencing Decision

The owner / architect confirmed that the previous roadmap sequence was outdated.

`V1-AUTH-009` is now AccountId / Auth Session Resolution Baseline.

Login / Logout moved after account/session resolution.

Reason:

Firebase provider user ids must not be assumed to equal V1 `accountId` values.

## Source Files

Added:

- `src/modules/auth/AuthSessionResolver.ts`

Updated:

- `src/modules/auth/firebase/FirebaseAuthProvider.ts`

No Product, routing, persistence, UI, app startup, localStorage migration, or credential files were modified.

## Account / Session Resolution Design Summary

- `AuthProviderIdentity` represents the provider-level identity.
- `providerUserId` is distinct from `accountId`.
- `AuthAccountSessionResolver` is the explicit boundary that must resolve account/user/session data.
- `DefaultAuthSessionResolver` creates `AuthSession` only after account resolution returns an explicit `accountId`.
- Empty required session fields throw errors rather than producing fake sessions.
- Unsupported roles throw errors rather than producing invalid sessions.
- Returning `null` means no safe project session could be resolved.

## Firebase Alignment Summary

- `FirebaseAuthProvider` maps Firebase `User.uid` to `providerUserId`.
- `FirebaseAuthProvider` does not map Firebase `uid` to `accountId`.
- `FirebaseAuthProvider` delegates account/session creation to the provider-neutral resolver boundary.

## TypeScript Verification

Command:

```text
pnpm exec tsc --noEmit
```

Result:

PASS

## Build Verification

Command:

```text
pnpm run build
```

Result:

PASS

Observed build output:

```text
vite v8.0.16 building client environment for production...
27 modules transformed.
dist/index.html                  0.47 kB
dist/assets/index-CYFgx684.css   0.70 kB
dist/assets/index-BF1T1Qgs.js   10.14 kB
```

## Runtime Non-regression Verification

Result:

PASS

Runtime evidence:

```text
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-009\after-runtime.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-009\after-dom.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-009\after-console.log
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-009\after-screenshot.png
```

Runtime assertions:

- App starts successfully: PASS.
- Default route works: PASS.
- Products route accessibility unchanged: PASS.
- No login UI appears: PASS.
- No route guard behavior appears: PASS.
- Account/session resolution not wired into startup: PASS.
- Firebase adapter not invoked during startup: PASS.
- Auth startup requests: 0.
- Firebase startup network requests: 0.
- Console errors: 0.
- Page exceptions: 0.
- Network failures: 0.
- No localStorage migration occurs: PASS.
- No Product behavior change observed: PASS.

## Scope Confirmation

- No login UI added.
- No route guard added.
- No Auth runtime requirement added.
- No app startup wiring added.
- No Product files changed.
- No persistence behavior changed.
- No localStorage migration performed.
- No credentials added.
- No ECS-006 work started.

## Result

`V1-AUTH-009` verification passed.
