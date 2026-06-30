# V1-AUTH-010 Verification

## Mission

`V1-AUTH-010 - Account Mapping Source Baseline`

Classification:

`ECS`

## Verification Environment

Runtime:

`http://127.0.0.1:5177/`

Browser:

Google Chrome headless

Verification Tool:

Chrome DevTools Protocol direct WebSocket client

Reason for Selection:

CDP verifies browser runtime route accessibility, stable DOM selectors, console output, page exceptions, network activity, and screenshot capture without adding project test dependencies.

Known Limitations:

This verifies runtime non-regression only. Live account mapping requires approved Auth wiring and mapping data in later Auth ECS missions.

## Sequencing Decision

The owner / architect confirmed that `V1-AUTH-010` is Account Mapping Source Baseline.

`V1-AUTH-010` is not Login / Logout Minimal Flow.

Login / Logout moved after account mapping source baseline.

## Mapping Files

Added:

- `src/modules/auth/AccountMappingSource.ts`
- `src/modules/auth/AccountMappingSessionResolver.ts`

No Product, routing, persistence, UI, app startup, localStorage migration, or credential files were modified.

## Mapping Design Summary

- `ProviderUserReference` reuses the provider-neutral identity shape.
- `AccountMapping` records provider identity, explicit `accountId`, account name, user id, display name, role, and optional email.
- `AccountMappingSource` defines the mapping source boundary.
- `AccountMappingNotFoundError` represents an explicit missing mapping.
- `AccountMappingSessionResolver` adapts account mapping results into the existing `AuthAccountSessionResolver` contract.

## Missing Mapping Behavior

This mission chose a strict contract-only baseline:

- No real accounts.
- No local development account seeds.
- No environment placeholder mapping.
- No automatic provider uid to account id mapping.
- Missing mapping fails safely through `AccountMappingNotFoundError`.
- `AccountMappingSessionResolver` converts missing mapping to `null`, preserving the existing session-resolution contract.

Unknown source errors are rethrown.

## accountId Handling Status

- `providerUserId` remains distinct from `accountId`.
- `accountId` must come from an explicit `AccountMapping`.
- No `firebaseUser.uid === accountId` assumption was added.

## Role Handling Status

- Roles remain limited to the existing `AuthRole` contract: `owner` and `user`.
- No permission matrix was added.
- No advanced roles were added.

## AuthSessionResolver Integration Summary

`AuthSessionResolver` was not changed in this mission.

`AccountMappingSessionResolver` implements the existing `AuthAccountSessionResolver` contract so it can be composed with `DefaultAuthSessionResolver` in a later approved wiring mission.

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
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-010\after-runtime.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-010\after-dom.json
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-010\after-console.log
C:\Users\aboni\Documents\Codex\2026-06-26\abonibal-dotcom-abonibal-erp-https-github-3\outputs\V1-AUTH-010\after-screenshot.png
```

Runtime assertions:

- App starts successfully: PASS.
- Default route works: PASS.
- Products route accessibility unchanged: PASS.
- No login UI appears: PASS.
- No route guard behavior appears: PASS.
- Account mapping not wired into startup: PASS.
- AuthStateService not wired into startup: PASS.
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
- No login/logout UI added.
- No route guard added.
- No Auth runtime requirement added.
- No app startup wiring added.
- No Product files changed.
- No persistence behavior changed.
- No localStorage migration performed.
- No credentials added.
- No ECS-006 work started.

## Result

`V1-AUTH-010` verification passed.
