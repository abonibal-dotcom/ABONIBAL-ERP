# V1-PER-004 Rollback Plan

## Mission

`V1-PER-004 - Product Account-Scoped Persistence Plan`

## Classification

`INF`

This rollback plan applies to the future account-scoped Product persistence implementation. V1-PER-004 itself changes documentation only.

## Rollback Principle

Rollback is safe only if the legacy global key remains untouched.

Therefore future implementation must preserve `localStorage.products` until the owner approves a later deprecation/removal mission.

## Documentation Mission Rollback

To revert V1-PER-004 itself:

1. Revert the documentation commit `docs: plan account-scoped product persistence`.
2. Delete the tag `v1-per-004-product-account-scoped-persistence-plan` locally and remotely if needed.
3. No source rollback is required because no source files are changed.
4. No data rollback is required because no Product data is modified.

## Future Implementation Rollback

If a future account-scoped implementation regresses:

1. Stop Product CRUD and any migration/import flow.
2. Keep `localStorage.products` untouched.
3. Disable or revert the account-scoped Product persistence code commit.
4. Remove only newly created scoped keys from the test environment if owner/architect approves cleanup.
5. Restore any scoped Product test data from the pre-migration backup if needed.
6. Re-run TypeScript, build, and runtime verification.
7. Confirm Products read behavior has returned to the last accepted baseline.

## Data Rollback Requirements

Any future migration/import mission must preserve:

- Raw backup of `localStorage.products`.
- Sanitized storage snapshot.
- Before count.
- After count.
- Scoped key written.
- Acting accountId.
- Acting userId.
- Runtime evidence.

Rollback must never infer account assignment from Firebase UID.

## Safe Rollback Gates

Rollback is complete only when:

- Global `products` data is still present.
- Global `products` hash matches baseline if it was supposed to remain untouched.
- Account-scoped key behavior is either removed or restored to the accepted state.
- Product list renders according to the chosen restored baseline.
- Console errors = 0.
- Page exceptions = 0.
- `.env` remains untracked.

## Non-Rollback Items

The following must not be used as rollback shortcuts:

- Deleting `localStorage.products`.
- Clearing all localStorage.
- Reassigning legacy records to a default account.
- Treating Firebase UID as `accountId`.
- Hiding global data loss with an empty Product list.
