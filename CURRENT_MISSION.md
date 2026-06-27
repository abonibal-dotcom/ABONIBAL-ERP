# Current Mission

## Mission

`V1-FND-001 - Foundation Verification Baseline`

## Classification

`ECS`

This is an application-runtime verification ECS.

This is not a feature mission and does not authorize source-code fixes.

## Objective

Establish a verified Foundation runtime baseline after V1 governance integration.

The mission verifies application startup, routing baseline, navigation baseline, page registration, runtime initialization, TypeScript, build, runtime console errors, page exceptions, route sweep, refresh behavior, and observable listener lifecycle.

## Allowed

- Inspect repository state.
- Read governance documents.
- Inspect foundation source files read-only.
- Run TypeScript verification.
- Run build verification.
- Run application runtime verification.
- Capture runtime evidence.
- Update mission tracking and closure documentation only.
- Commit documentation/evidence reports if required.
- Tag this verification mission if a commit is created.
- Push branch and tag when remote access is available.

## Forbidden

- No source code changes.
- No files under `src/` may be modified.
- No product fixes.
- No ECS-006.
- No feature work.
- No product-specific investigation.
- No refactor.
- No routing change.
- No persistence implementation change.
- No sync behavior change.
- No UI behavior change.

## Completion Criteria

- TypeScript verification completed.
- Build verification completed.
- Runtime startup verification completed.
- Route sweep completed.
- Navigation alignment verified.
- Console errors and page exceptions documented.
- Listener lifecycle baseline documented where observable.
- `PROJECT_STATUS.md` reflects V1-FND-001.
- `CHANGELOG.md` records V1-FND-001.
- No files under `src/` changed.
- Branch and tag are pushed if a commit is created.

## Next Mission

ECS-006 remains blocked.

The owner or architect will decide the next mission after V1-FND-001 review.
