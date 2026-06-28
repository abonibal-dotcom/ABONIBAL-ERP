# Current Mission

## Mission

`V1-AUTH-010 - Account Mapping Source Baseline`

## Classification

`ECS`

This is a limited Auth foundation source-code ECS.

This is not login UI, login/logout UI, route guard implementation, Product work, persistence migration, app startup Auth wiring, or ECS-006.

## Objective

Introduce the minimal account mapping source baseline required before Login / Logout UI can be safely implemented.

V1-AUTH-009 separated provider identity from project account identity. This mission defines where account mapping data comes from without assuming that provider user ids are V1 `accountId` values.

## Sequencing Decision

`V1-AUTH-010` is:

`Account Mapping Source Baseline`

`V1-AUTH-010` is not:

`Login / Logout Minimal Flow`

Login / Logout must move after account mapping source baseline.

## Allowed Scope

- `src/modules/auth/` account mapping source baseline files.
- Existing Auth contracts only when minimal alignment is required.
- Existing `AuthSessionResolver` if account mapping alignment is required.
- Mission documentation and evidence.

## Implemented

- Added `AccountMappingSource` contract.
- Added `ProviderUserReference` and `AccountMapping` contracts.
- Added `AccountMappingNotFoundError`.
- Added `AccountMappingSessionResolver`.
- Chose a strict contract-only baseline with no real accounts, no seeded accounts, no environment placeholder mapping, and no silent success path.
- Preserved `providerUserId` as distinct from `accountId`.

## Forbidden Scope

- No login UI.
- No login/logout UI.
- No route guards.
- No route accessibility changes.
- No app startup Auth wiring.
- No authentication requirement at runtime.
- No Product work.
- No business persistence behavior changes.
- No localStorage migration.
- No ECS-006.
- No permission matrix.
- No advanced roles.
- No hardcoded credentials.
- No real credentials.
- No production account seeds.
- No `firebaseUser.uid === accountId` assumption.

## Completion Criteria

- Account mapping source boundary exists under `src/modules/auth/`.
- Missing mapping fails safely.
- `providerUserId` remains distinct from `accountId`.
- Roles remain limited to `owner` and `user`.
- Source changes remain limited to the approved Auth scope.
- TypeScript verification passes.
- Build verification passes.
- Runtime non-regression verification passes.
- Console errors = 0.
- Page exceptions = 0.
- Account mapping source is not wired into startup.
- Firebase startup network requests remain 0.
- No login UI appears.
- No route guard behavior appears.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-010.
- `PATCHES/V1-AUTH-010/verification.md` exists.
- `PATCHES/V1-AUTH-010/closure-report.md` exists.
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

The recommended next mission is `V1-AUTH-011 - Login / Logout Minimal Flow`, subject to Architect / Owner approval.
