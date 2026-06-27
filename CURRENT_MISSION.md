# Current Mission

## Mission

`V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`

## Classification

`ECS`

This is a minimal Auth foundation source/config ECS.

This is not login implementation, route guard implementation, Product work, or ECS-006.

## Objective

Add the minimal Firebase Auth dependency and config skeleton required for future Auth implementation while preserving current runtime behavior.

The owner has approved:

- Firebase Auth as the official V1 Auth provider.
- `accountId` as the official V1 data boundary.
- Minimal V1 roles: `owner` and `user`.
- No permission matrix in V1.
- No automatic deletion or migration of existing global localStorage data.

## Allowed

- Add the `firebase` dependency.
- Update `pnpm-lock.yaml`.
- Add safe Firebase environment placeholders.
- Add import-safe Firebase config and initialization skeleton files under `src/modules/auth/firebase/`.
- Record Firebase Auth provider approval in governance documentation.
- Run TypeScript, build, and runtime non-regression verification.
- Create V1-AUTH-006 verification and closure reports.
- Commit, tag, and push after all verification gates pass.

## Forbidden

- No login implementation.
- No logout implementation.
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
- No custom Auth.
- No hardcoded secrets.
- No real Firebase credentials.

## Completion Criteria

- Dependency changes limited to `firebase` and lockfile output.
- Config skeleton contains placeholders only.
- Firebase skeleton is not wired into app startup.
- No Product, routing, persistence, UI, or app startup files changed.
- TypeScript verification passes.
- Build verification passes.
- Runtime non-regression verification passes.
- Console errors = 0.
- Page exceptions = 0.
- No login UI appears.
- No route guard behavior appears.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-006.
- `DECISIONS.md` records Firebase Auth provider approval.
- `PATCHES/V1-AUTH-006/verification.md` exists.
- `PATCHES/V1-AUTH-006/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-007 - Managed Auth Provider Adapter`, subject to Architect / Owner approval.
