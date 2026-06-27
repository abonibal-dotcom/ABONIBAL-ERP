# PATCH-000

# ECS-005 Pre-check

## Current Git Status

- Branch: `patch/000-ecs-004-dashboard-text-encoding`
- Commit: `7aa7e38`
- Tag: `patch-000-ecs-004`
- Git Clean: Yes

## Target

Product persistence read-path resilience for malformed `localStorage` data.

## Scope

Unknown.

No source file is considered responsible before Baseline and Root Cause Confirmation.

## Hypothesis

Malformed persisted `products` data in `localStorage` may break the Products runtime path when the application reads product data.

## Candidate Layers To Observe

- Browser `localStorage`.
- Products route runtime behavior.
- Product repository/read path behavior.
- Browser console output.
- Page exceptions.
- DOM state after navigating to Products.

## Baseline Scenario

1. Start the application.
2. Load the Dashboard route.
3. Inject malformed `localStorage.products` data.
4. Navigate to the Products route through the visible Sidebar item.
5. Capture runtime JSON, console log, screenshot, DOM evidence, current URL, title, active route, visible Sidebar items, browser console output, page exceptions, and network errors.

## Baseline Validation Policy

The baseline is valid only if:

- Runtime evidence is collected completely.
- `baseline-runtime.json` is created.
- `baseline-console.log` is created.
- `baseline-screenshot.png` is created.
- DOM evidence is captured.
- The full scenario is executed.
- No failure occurs while collecting evidence.

If collection fails, the run is a Baseline Attempt and must not be used for engineering decisions.

## Success Criteria For This Phase

- Baseline is valid.
- Hypothesis is either confirmed or rejected by runtime evidence.
- No source files are modified.
- No branch is created.
- No commit is created.
- No tag is created.
- No push is performed.

## Phase Decision Rule

The phase ends with exactly one decision:

- Hypothesis Confirmed.
- Hypothesis Rejected.

No Minimal Fix may begin until Root Cause Confirmation proves a real runtime bug and the minimal scope is known.
