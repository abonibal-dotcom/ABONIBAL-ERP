# Current Mission

## Mission

`V1-AUTH-005 - Managed Auth Integration Planning`

## Classification

`INF`

This is an architecture, planning, and implementation-design mission.

This is not an ECS implementation mission, not Product work, and not ECS-006.

No Auth implementation is authorized in this mission.

## Objective

Prepare the safe implementation plan for Managed Auth integration after V1-AUTH-004 introduced provider-neutral Auth/session contracts.

The plan must define:

- Recommended first Managed Auth provider.
- Dependency and package impact for a future ECS.
- Required environment and configuration values.
- Mapping from the provider SDK to the existing `AuthProvider` interface.
- Session restoration behavior.
- `accountId` resolution strategy.
- Minimal `owner` / `user` role handling.
- Future route guard and persistence-scope sequence.
- Risks and required owner decisions.

## Allowed

- Inspect documentation.
- Inspect `package.json` read-only.
- Inspect `src/modules/auth/` contracts read-only.
- Inspect routing, container, app bootstrap, and config files read-only.
- Create `PATCHES/V1-AUTH-005/managed-auth-integration-plan.md`.
- Create `PATCHES/V1-AUTH-005/closure-report.md`.
- Update mission/status/changelog documentation.
- Update `ROADMAP.md` only to reflect the planned Auth sequence.
- Commit documentation-only changes.
- Tag and push when remote access is available.

## Forbidden

- No dependencies may be installed.
- No `package.json` changes.
- No files under `src/` may be modified.
- No provider SDK code.
- No Firebase/Auth or provider implementation.
- No login screens.
- No login/logout implementation.
- No route guards.
- No routing behavior changes.
- No persistence behavior changes.
- No localStorage migration.
- No Product work.
- No ECS-006.
- No runtime Auth behavior.

## Completion Criteria

- Managed Auth integration plan exists.
- Closure report exists.
- Provider status is clearly labeled as recommended and pending owner decision.
- `CURRENT_MISSION.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, and `ROADMAP.md` remain aligned.
- No `src/` files changed.
- No package/build/config files changed.
- No dependencies installed.
- ROADMAP keeps Auth before Products.
- ECS-006 remains blocked.
- Git diff contains documentation only.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`, subject to Architect / Owner approval.
