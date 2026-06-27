# Current Mission

## Mission

`V1-INF-001 - Repository Governance & Baseline Lock`

## Classification

`INF`

This is an Engineering Infrastructure and repository governance mission.

This is not an ECS.

## Objective

Lock the official governance baseline in the repository before any new Version 1.0 product-code work begins.

After this mission, Codex and human contributors must be able to find the current governance rules, project status, current mission, roadmap, and owner decisions inside the repository rather than relying only on chat context.

## Allowed

- Inspect repository state.
- Update governance documentation.
- Update roadmap documentation.
- Update current status documentation.
- Update decision records.
- Update changelog and release notes where needed.
- Commit documentation/governance changes.
- Tag this INF mission.
- Push the branch and tag when remote access is available.

## Forbidden

- No source code changes.
- No files under `src/` may be modified.
- No product fixes.
- No ECS-006.
- No feature work.
- No refactor.
- No routing change.
- No persistence implementation change.
- No sync behavior change.
- No UI behavior change.

## Completion Criteria

- `ENGINEERING_CONSTITUTION.md` contains the approved complete Engineering Constitution v1.0 and is tracked.
- `PROJECT_ORIENTATION.md` exists.
- `PROJECT_STATUS.md` exists.
- `CURRENT_MISSION.md` exists and points to V1-INF-001.
- `ROADMAP.md` exists and states ECS-006 is not started.
- `DECISIONS.md` exists and records owner decisions.
- `CHANGELOG.md` records V1-INF-001.
- `RELEASE_NOTES.md` is updated or clearly marked stale/superseded.
- No files under `src/` changed.
- Documentation files do not contradict each other.
- Commit is created.
- Tag `v1-inf-001-governance-baseline` is created.
- Branch and tag are pushed when remote access is available.

## Next Mission

ECS-006 remains blocked.

The next mission will be selected only after this governance baseline is reviewed and approved by the owner or architect.
