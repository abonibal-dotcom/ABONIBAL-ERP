# Current Mission

## Mission

`V1-AUTH-002 - Auth Foundation Architecture Decision & User Scope Contract`

## Classification

`INF`

This is an architecture, governance, and decision mission.

This is not an ECS implementation mission, not Product work, and not ECS-006.

## Objective

Define the official Version 1.0 Auth / Multi-user foundation contract before any Auth implementation or Product module work begins.

This mission converts the V1-AUTH-001 confirmed Auth gap into an architecture contract covering user identity, session state, route protection, user/account data boundaries, ownership metadata, V1/V2 Auth scope, provider options, and future implementation sequence.

## Allowed

- Inspect existing documents.
- Inspect V1-AUTH-001 evidence and closure reports.
- Inspect source read-only if needed to confirm current architecture constraints.
- Review `package.json` read-only.
- Review routing/persistence files read-only.
- Produce Auth architecture decision documentation.
- Update `DECISIONS.md`.
- Update `ROADMAP.md` only to align Auth phases and gates.
- Update `PROJECT_STATUS.md`.
- Update `CURRENT_MISSION.md`.
- Update `CHANGELOG.md`.
- Create `PATCHES/V1-AUTH-002/architecture-decision.md`.
- Create `PATCHES/V1-AUTH-002/closure-report.md`.
- Commit documentation-only changes.
- Tag and push when remote access is available.

## Forbidden

- No Auth implementation.
- No dependency changes.
- No Firebase/Auth or other provider addition.
- No login screens.
- No source-code user models.
- No files under `src/` may be modified.
- No `package.json` changes.
- No routing behavior changes.
- No persistence behavior changes.
- No repository changes.
- No ECS-006.
- No Product behavior investigation.
- No feature work.
- No refactor.
- No runtime data mutation.

## Completion Criteria

- V1-AUTH-001 confirmed gap recorded.
- V1 Auth goal documented.
- V1 Auth scope documented.
- V2 deferred Auth scope documented.
- User identity contract documented.
- Session contract documented.
- Route protection contract documented.
- Persistence/user scope options evaluated.
- Recommended data ownership contract documented.
- Auth provider options documented with provider status.
- Future implementation sequence documented.
- Risks documented.
- `DECISIONS.md` records the Auth architecture decision.
- `ROADMAP.md` keeps Auth / Multi-user before Products and ECS-006 blocked.
- `PROJECT_STATUS.md` reflects V1-AUTH-002.
- `CHANGELOG.md` records V1-AUTH-002.
- No files under `src/` changed.
- No package/build/config files changed.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-003 - Auth Provider Decision Finalization`, subject to Architect / Owner approval.
