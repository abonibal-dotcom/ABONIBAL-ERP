# Current Mission

## Mission

`ECS-008 - Product Edit Path`

## Classification

`ECS`

This is a Product Edit stabilization mission.

This is not Product Delete, Product Search / Filter, legacy migration, Auth redesign, Route Guard change, Inventory work, Sales work, Sync work, or ECS-009.

## Objective

Implement and verify the minimal Product Edit path on top of the accepted account-scoped Product persistence foundation.

Edited Products are updated only in `products:{AuthSession.accountId}` and legacy `localStorage.products` is never mutated.

## Current Status

`ECS-008 Ready for Architect / Owner Review`

## Verification Completed

- Baseline evidence: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime Verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Runtime Result

- Baseline confirmed unauthenticated Products access is blocked by Route Guard.
- Baseline confirmed Firebase login succeeds and `AuthSession.accountId` exists.
- Baseline confirmed Products render from `products:{accountId}`.
- Baseline confirmed `ProductService.update()` and repository update support exist.
- Baseline confirmed there was no Product Edit UI/action.
- Minimal fix added an Edit action per Product row.
- Minimal fix reused the existing Product dialog and ProductService update path.
- Invalid edit attempt did not update a Product.
- Valid edit updated exactly one Product without changing Product count.
- Edited Product kept the same `id`.
- Edited Product kept the same `accountId`.
- Edited Product preserved `createdBy` and updated `updatedBy`.
- Edited Product appears in the Products UI.
- Edited Product remains visible after reload.
- Legacy `localStorage.products` remained present and hash unchanged.

## Scope Confirmation

- No Product Delete UI.
- No Product Search / Filter feature.
- No destructive migration.
- No legacy Product deletion.
- No legacy `localStorage.products` mutation.
- No Route Guard weakening.
- No Firebase Auth change.
- No persistence driver change.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/ECS-008/verification.md
PATCHES/ECS-008/closure-report.md
outputs/ECS-008/baseline-runtime.json
outputs/ECS-008/baseline-dom.json
outputs/ECS-008/baseline-console.log
outputs/ECS-008/baseline-storage-snapshot-sanitized.json
outputs/ECS-008/baseline-screenshot.png
outputs/ECS-008/after-runtime.json
outputs/ECS-008/after-dom.json
outputs/ECS-008/after-console.log
outputs/ECS-008/after-storage-snapshot-sanitized.json
outputs/ECS-008/after-screenshot.png
outputs/ECS-008/edit-summary.json
```

## Next Mission

Await Architect / Owner review.

Do not start Product Delete until ECS-008 is reviewed and accepted.
