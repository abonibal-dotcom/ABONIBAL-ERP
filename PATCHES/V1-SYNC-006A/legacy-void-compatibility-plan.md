# V1-SYNC-006A Legacy Void Compatibility Plan

## Objective

Preserve every existing StockMovement, preserve its current inventory effect,
and permit a future immutable reversal model without destructive rewriting.
This plan performs no migration and inspects or changes no user record.

## Current Legacy Semantics

The accepted local reader treats a StockMovement with `voidedAt` as zero effect.
`StockMovementRepository.voidForAccount()` created that state by replacing the
original stored record. Existing records do not carry a semantics-version field.

Consequently, removing or ignoring the legacy void fields during an upgrade
would incorrectly restore previously voided inventory effects.

## Record Classification

Readers introduced by V1-SYNC-006B should classify records deterministically:

| Classification | Recognition | Quantity treatment | Mutation policy |
| --- | --- | --- | --- |
| Legacy normal V1 | no `ledgerSemanticsVersion: 2`, no `voidedAt` | sum `quantityDelta` | original becomes immutable after upgrade |
| Legacy voided V1 | no V2 marker and valid `voidedAt` | effect is zero | preserve exact record; no synthetic reversal |
| Immutable normal V2 | `ledgerSemanticsVersion: 2`, type is not `reversal` | sum `quantityDelta` | immutable |
| Immutable reversal V2 | V2 marker, type `reversal`, valid reversal fields | sum opposite `quantityDelta` | immutable |

If a record has contradictory markers, invalid reversal fields, or a V2 record
with mutable void fields, classify it as a conflict. Do not guess, rewrite, or
include a duplicated effect silently.

## Compatibility Rules

1. Do not add a version field to existing records automatically.
2. Do not remove `voidedAt`, `voidedBy`, `voidReason`, `updatedAt`, or
   `updatedBy` from legacy records.
3. Do not generate a reversal automatically for a legacy voided record.
4. Do not allow future `voidMovement()` to mutate any original.
5. A legacy normal record may receive one new V2 reversal after the new domain
   operation validates it.
6. A legacy voided record is treated as already voided and cannot receive an
   automatic V2 reversal.
7. New V2 records never use mutable void metadata.

These rules prevent the two dangerous outcomes:

- counting a legacy voided effect again;
- counting both a legacy void suppression and a synthetic reversal.

## Derived Quantity Compatibility

The compatibility reducer is intentionally dual-mode:

```text
legacy voided V1: 0
legacy normal V1: quantityDelta
immutable normal V2: quantityDelta
immutable reversal V2: quantityDelta
```

For every account and product, verification must compare:

- quantity before the code upgrade under the current reducer;
- quantity after the code upgrade under the compatibility reducer;
- quantity after reload;
- quantity after a duplicate pull simulation.

All four values must match unless a newly authorized reversal was appended.

## Local Upgrade And Rollback

V1-SYNC-006B should be a read-compatible code upgrade, not a data migration:

- local arrays remain under `stockMovements:{accountId}`;
- existing IDs and record bytes remain untouched;
- newly created records use the V2 contract;
- rollback to the old code is not safe after a V2 `reversal` is created unless
  the rollback version understands that type.

Therefore V1-SYNC-006B must include a rollback compatibility assessment and a
backup gate before owner runtime testing. It must not silently downgrade or
strip V2 records.

## V1-SYNC-009 Migration Recommendation

The safest migration policy is preservation, not transformation.

### A. Legacy normal movement

- upload the existing ID and exact domain snapshot once;
- mark the immutable cloud envelope as legacy semantics in migration metadata;
- initial cloud revision is `1`;
- CREATE if absent, MATCH if identical, CONFLICT if divergent.

### B. Legacy voided movement

- upload the existing ID and exact snapshot including legacy void audit fields;
- retain zero-effect legacy interpretation;
- do not create a synthetic reversal;
- classify the cloud envelope as immutable legacy-void semantics.

### C. New V2 normal or reversal movement

- upload the existing ID and exact V2 payload;
- validate all reversal invariants;
- preserve the deterministic reversal ID and idempotency key;
- CREATE/MATCH/CONFLICT only.

Transforming legacy void into original plus synthetic reversal is rejected for
the initial migration. It invents a new ID, risks duplicate effects, and makes
idempotent retries harder to prove. A later audited normalization mission may
propose such a transformation only with explicit owner approval.

## Migration Verification

Before any StockMovement cutover, V1-SYNC-009 must prove:

1. local backup exists and local data was not deleted;
2. local and cloud counts by classification match;
3. stable ID sets match;
4. per-record canonical hashes match;
5. legacy void fields and audit actors are preserved;
6. reversal links are complete and unique;
7. derived quantity per product matches before upload, cloud reconstruction,
   and fresh pull;
8. invoice cancellation and return references remain traceable;
9. conflicts are zero or explicitly resolved without overwrite;
10. owner approves cutover explicitly.

No migration, historical backfill, automatic upload, local delete, cloud
delete, or ID rewrite is authorized by V1-SYNC-006A.

## Conflict Cases

Migration or pull must stop the affected record when it finds:

- same ID with different canonical payload;
- a V2 reversal whose original is missing;
- account or product mismatch between original and reversal;
- reversal effect not exactly opposite for a generic reversal;
- more than one generic reversal for one original;
- legacy `voidedAt` plus a synthetic/new reversal for the same logical void;
- an invalid or unsupported semantics version.

No automatic merge or balance repair is permitted.
