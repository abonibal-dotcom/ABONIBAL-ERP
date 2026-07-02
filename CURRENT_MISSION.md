# Current Mission

## Mission

`V1-PER-004 - Product Account-Scoped Persistence Plan`

## Classification

`INF`

This is a Product account-scoped persistence planning mission.

This is not Product CRUD work, migration execution, account-scoped Product persistence implementation, Auth redesign, Route Guard change, Product schema change, UI redesign, or ECS-007.

## Objective

Create an implementation-ready, no-data-loss plan for moving Product persistence from global `localStorage.products` toward account-scoped Product persistence.

## Current Status

`V1-PER-004 Ready for Architect / Owner Review`

## Verification Completed

- Baseline tag `v1-per-003-product-persistence-boundary-assessment`: confirmed.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: not required for this planning mission.
- Product storage mutation: none.

## Runtime Result

- Product storage key remains `products`.
- Product storage is global, not account-scoped.
- Product records do not contain `accountId`, `createdBy`, or `updatedBy`.
- Recommended target storage pattern is `products:{accountId}` with a compatibility layer preserving global `products`.
- Product CRUD should wait for account-scoped Product persistence compatibility implementation.

## Scope Confirmation

- No source files changed.
- No Product source files changed.
- No Auth files changed.
- No route files changed.
- No persistence files changed.
- No localStorage migration.
- No account-scoped storage implementation.
- No Product data deletion.
- No Product schema change.
- No Product create/edit/delete implementation.
- No Firebase UID as `accountId`.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-PER-004/product-account-scoped-persistence-plan.md
PATCHES/V1-PER-004/no-data-loss-plan.md
PATCHES/V1-PER-004/rollback-plan.md
PATCHES/V1-PER-004/closure-report.md
```

## Next Mission

Await Architect / Owner review.

Recommended next mission is `V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`.

Do not start the next mission until V1-PER-004 is reviewed.
