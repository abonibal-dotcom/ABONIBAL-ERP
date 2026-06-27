# Current Mission

## Mission

`V1-PER-001 - Persistence Safety Baseline`

## Classification

`ECS`

This is an application-runtime verification and investigation ECS.

This is not a feature mission and does not authorize source-code fixes.

## Objective

Establish a verified persistence safety baseline before Auth / Multi-user Foundation and product-module implementation.

The mission verifies localStorage driver behavior, repository persistence behavior, missing key behavior, malformed JSON behavior, refresh persistence behavior, write failure behavior where safely observable, runtime console errors, and page exceptions.

## Allowed

- Inspect repository state.
- Read governance documents.
- Inspect persistence source files read-only.
- Run TypeScript verification.
- Run build verification.
- Run application runtime verification.
- Use isolated browser runtime storage keys for verification.
- Capture runtime evidence.
- Update mission tracking and closure documentation only.
- Commit documentation/evidence reports if required.
- Tag this verification mission if a commit is created.
- Push branch and tag when remote access is available.

## Forbidden

- No source code changes.
- No files under `src/` may be modified.
- No persistence implementation fix.
- No storage contract change.
- No product fixes.
- No ECS-006.
- No feature work.
- No refactor.
- No routing change.
- No sync behavior change.
- No UI behavior change.
- No real business data seeding.

## Completion Criteria

- TypeScript verification completed.
- Build verification completed.
- Runtime persistence verification completed.
- Missing key behavior documented.
- Valid read/write behavior documented.
- Malformed JSON behavior documented.
- Refresh behavior documented.
- Write failure behavior documented where safely observable.
- Console errors and page exceptions documented.
- `PROJECT_STATUS.md` reflects V1-PER-001.
- `CHANGELOG.md` records V1-PER-001.
- No files under `src/` changed.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The recommended next mission is `V1-PER-002 - Storage Wrapper Read Resilience`, subject to Architect / Owner approval, because V1-PER-001 confirmed a malformed JSON read-path issue in `src/core/Storage.ts`.
