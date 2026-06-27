# Current Mission

## Mission

`V1-AUTH-001 - Auth / Multi-user Foundation Baseline`

## Classification

`ECS`

This is an application architecture and runtime investigation ECS.

This is not a feature implementation mission, not Product work, and not ECS-006.

## Objective

Establish the Auth / Multi-user foundation baseline for ABONIBAL ERP Version 1.0.

This mission determines whether Auth, user identity, session state, route guards, and user-scoped persistence already exist before product-module expansion continues.

## Allowed

- Inspect repository state.
- Read governance documents.
- Inspect source files read-only.
- Inspect dependencies and config read-only.
- Run TypeScript verification.
- Run build verification.
- Run application runtime verification.
- Capture runtime evidence.
- Update required mission tracking and closure documentation only.
- Commit documentation/evidence reports if required.
- Tag this verification mission if a commit is created.
- Push branch and tag when remote access is available.

## Forbidden

- No source code changes.
- No files under `src/` may be modified.
- No Auth implementation.
- No login screens.
- No users or permissions.
- No Product work.
- No ECS-006.
- No persistence contract change.
- No routing behavior change.
- No navigation behavior change.
- No dependency changes.
- No feature work.

## Completion Criteria

- Documentation baseline completed.
- Dependency/config baseline completed.
- Auth-related source search completed.
- Route guard status documented.
- User/session model status documented.
- Persistence user-scope status documented.
- Runtime login requirement documented.
- TypeScript verification completed.
- Build verification completed.
- Runtime verification completed.
- Console errors and page exceptions documented.
- `PROJECT_STATUS.md` reflects V1-AUTH-001.
- `CHANGELOG.md` records V1-AUTH-001.
- No files under `src/` changed.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-002 - Auth Foundation Architecture Decision & User Scope Contract`, subject to Architect / Owner approval.
