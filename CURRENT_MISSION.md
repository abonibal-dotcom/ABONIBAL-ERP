# Current Mission

## Mission

`V1-AUTH-004 - Auth Interfaces And Session Contract`

## Classification

`ECS`

This is an application architecture/source-code foundation ECS.

This is not login implementation, Auth provider integration, Product work, or ECS-006.

## Objective

Introduce minimal provider-neutral TypeScript contracts for the V1 Auth foundation after the approved V1-AUTH-002 and V1-AUTH-003 decisions.

The contracts express:

- `accountId` as the V1 account/workspace boundary.
- Minimal V1 roles: `owner` and `user`.
- User identity.
- Account identity.
- Auth session.
- Auth state.
- Provider-neutral Auth provider interface.
- Generic ownership metadata for future account-scoped records.

## Allowed

- Add minimal Auth/session contract files under `src/modules/auth/`.
- Update mission and status documentation.
- Create V1-AUTH-004 verification and closure reports.
- Run TypeScript, build, and runtime non-regression verification.
- Commit, tag, and push after all verification gates pass.

## Forbidden

- No dependency installation.
- No `package.json` changes.
- No provider SDK or Firebase/Auth code.
- No login/logout implementation.
- No login screens.
- No route guards.
- No routing behavior changes.
- No navigation behavior changes.
- No persistence behavior changes.
- No localStorage migration.
- No Product work.
- No permission matrix.
- No advanced roles.
- No ECS-006.

## Completion Criteria

- Source changes limited to Auth contract files.
- No Product, routing, persistence, UI, package, build, or config files changed.
- TypeScript verification passes.
- Build verification passes.
- Runtime non-regression verification passes.
- Console errors = 0.
- Page exceptions = 0.
- No Auth UI appears.
- No login route appears.
- No route guard behavior changes.
- No localStorage migration occurs.
- `CHANGELOG.md` records V1-AUTH-004.
- `PATCHES/V1-AUTH-004/verification.md` exists.
- `PATCHES/V1-AUTH-004/closure-report.md` exists.
- Branch, tag, and push complete when remote access is available.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-005 - Managed Auth Integration Planning`, subject to Architect / Owner approval.
