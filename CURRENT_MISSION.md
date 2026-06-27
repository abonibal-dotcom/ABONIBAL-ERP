# Current Mission

## Mission

`V1-PER-002 - Storage Wrapper Read Resilience`

## Classification

`ECS`

This is an application source-code stabilization ECS.

This is not a feature mission, not Product work, and not ECS-006.

## Objective

Fix the confirmed malformed JSON read-path issue in `src/core/Storage.ts`.

V1-PER-001 confirmed that `Storage.get<T>()` executed `JSON.parse(value)` without an exception boundary and propagated `SyntaxError` for malformed persisted JSON.

## Allowed

- Modify `src/core/Storage.ts` only for the minimal fix.
- Run TypeScript verification.
- Run build verification.
- Run application runtime verification.
- Use isolated browser runtime storage keys for verification.
- Capture runtime evidence.
- Update required mission tracking and closure documentation only.
- Commit the minimal source fix and required mission documentation.
- Tag this mission after commit.
- Push branch and tag when remote access is available.

## Forbidden

- No Product code changes.
- No ECS-006.
- No LocalStorageDriver change unless new evidence proves it is required.
- No persistence redesign.
- No repository contract change.
- No storage key change.
- No new storage abstraction.
- No routing change.
- No sync behavior change.
- No UI behavior change.
- No Auth, Inventory, Sales, Dashboard, or Product work.
- No feature work.

## Completion Criteria

- Source changes limited to `src/core/Storage.ts`.
- TypeScript verification completed.
- Build verification completed.
- Runtime persistence verification completed.
- Missing key behavior remains unchanged.
- Valid JSON behavior remains unchanged.
- Malformed JSON no longer propagates `SyntaxError`.
- Malformed JSON returns `null`.
- Console errors and page exceptions documented.
- `PROJECT_STATUS.md` reflects V1-PER-002.
- `CHANGELOG.md` records V1-PER-002.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-AUTH-001 - Auth / Multi-user Foundation Baseline`, subject to Architect / Owner approval.
