# Current Mission

## Mission

`V1-AUTH-003 - Auth Provider Decision Finalization`

## Classification

`INF`

This is an architecture, governance, and decision finalization mission.

This is not an ECS implementation mission, not Product work, and not ECS-006.

## Objective

Finalize the official Auth provider and V1 multi-user direction for ABONIBAL ERP before any Auth implementation begins.

The owner has approved:

- `accountId` as the official V1 data boundary.
- Managed Auth as the V1 provider direction.
- Minimal `owner` / `user` roles without a permission matrix.
- No automatic deletion or migration of existing global localStorage data.

## Allowed

- Inspect existing documents.
- Inspect V1-AUTH-002 architecture decision and closure reports.
- Update `DECISIONS.md`.
- Update `ROADMAP.md`.
- Update `PROJECT_STATUS.md`.
- Update `CURRENT_MISSION.md`.
- Update `CHANGELOG.md`.
- Create `PATCHES/V1-AUTH-003/architecture-decision.md`.
- Create `PATCHES/V1-AUTH-003/closure-report.md`.
- Commit documentation-only changes.
- Tag and push when remote access is available.

## Forbidden

- No Auth implementation.
- No dependency install.
- No `package.json` changes.
- No files under `src/` may be modified.
- No Firebase/Auth or provider code.
- No login screens.
- No source-code user models.
- No routing behavior changes.
- No persistence behavior changes.
- No localStorage migration.
- No ECS-006.
- No Product work.
- No feature work.

## Completion Criteria

- `DECISIONS.md` records all owner-approved Auth decisions.
- `ROADMAP.md` keeps Auth / Multi-user before Products.
- `ROADMAP.md` states ECS-006 remains blocked.
- `ROADMAP.md` states localStorage migration is not automatic and requires a separate ECS.
- `PROJECT_STATUS.md` reflects approved Auth decisions.
- `CURRENT_MISSION.md` reflects V1-AUTH-003.
- `CHANGELOG.md` records V1-AUTH-003.
- `PATCHES/V1-AUTH-003/architecture-decision.md` exists.
- `PATCHES/V1-AUTH-003/closure-report.md` exists.
- No files under `src/` changed.
- No package/build/config files changed.
- No dependency installed.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-004 - Auth Interfaces And Session Contract`, subject to Architect / Owner approval.
