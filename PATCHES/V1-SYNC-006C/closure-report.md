# V1-SYNC-006C - Closure Report

## Mission

- Mission: V1-SYNC-006C - Durable Multi-Record Mutation Group Architecture Plan
- Classification: Architecture / Multi-Record Consistency / Durable Sync Foundation
- Base tag: `v1-sync-006b-stock-movement-void-to-reversal-domain-alignment`
- Branch: `v1/sync-006c-durable-multi-record-mutation-group-architecture-plan`
- Execution type: documentation only

## Root Gap

The current page completes Product durable capture and local application before
it asks InventoryService to create opening stock. A crash in that interval
leaves a Product but no StockMovement operation or payload from which
V1-SYNC-004A can recover. The page's later safe-delete compensation cannot run
after process loss and is not an atomicity contract.

## Architecture Recommendation

Extend the existing account-scoped persistent outbox with one atomic batch
enqueue. Persist complete Product and opening StockMovement operations, plus a
shared immutable group manifest, in one write to
`syncOutbox:{accountId}` before either cache applier runs.

This gives durable, deterministic recovery across sequential cache writes. It
does not claim a multi-key ACID transaction. Group local completion is derived
only when every required member is durably marked applied.

## Identity And Retry

- Product ID remains stable for the command.
- Group identity is tied to account and Product ID.
- Product member keeps V1-SYNC-005 create/revision/checksum identity.
- Opening movement uses deterministic `opening-{productId}` identity and
  `stockMovement:opening:{productId}` idempotency.
- Exact retries return existing members.
- Same identity with different data is conflict.

## Recovery And Conflict

Crash scenarios before capture produce no local mutation. Crashes after
complete group capture are reconciled member-by-member with cache-only
inspection and no command replay. Matching records are not duplicated.
Divergent Product or movement state marks the group conflict without silent
overwrite, deletion, alternate movement creation, or destructive rollback.

## Cloud Boundary

No group member can reach cloud processing before all local members are
applied. The later StockMovement foundation should process Product before
opening movement and explicitly acknowledge that this is ordered, not atomic,
cloud behavior. True Firebase multi-location group commit is technically
possible but needs a separate transport/rules proof before multi-device
bootstrap or cutover.

## Application Boundary

The later integration should introduce one
`CreateProductWithOpeningStockService`. ProductListPage submits one command.
Positive quantity uses grouped capture; zero quantity uses the existing single
Product operation. Product metadata edits remain unchanged.

## Relationship To Existing Contracts

- V1-SYNC-004A single operations continue unchanged.
- Group members reuse LocalMutationApplier, durable member markers,
  reconciliation, receipts, conflicts, and cloud gates.
- V1-SYNC-005 Product CAS and cloud envelope remain unchanged.
- V1-SYNC-006B immutable StockMovement/reversal semantics remain unchanged.
- Persistent outbox remains the operational source; no second group store is
  introduced.

## Implementation Sequence

1. V1-SYNC-006D - Durable Multi-Record Mutation Group Foundation.
2. V1-SYNC-006E - Product Creation + Opening Stock Group Integration.
3. Recreate V1-SYNC-006 from the accepted 006E tag for append-only
   StockMovement Firebase sync.

Splitting 006D and 006E is the lower-risk recommendation. No later mission was
started.

## Decision Status

`MULTI-DEC-001` through `MULTI-DEC-016` are documented recommendations and all
require explicit owner approval before implementation.

## Changed Files

Only these documents were added:

- `PATCHES/V1-SYNC-006C/multi-record-mutation-group-contract.md`
- `PATCHES/V1-SYNC-006C/product-opening-stock-atomicity-analysis.md`
- `PATCHES/V1-SYNC-006C/cloud-consistency-options.md`
- `PATCHES/V1-SYNC-006C/crash-recovery-matrix.md`
- `PATCHES/V1-SYNC-006C/implementation-roadmap.md`
- `PATCHES/V1-SYNC-006C/decision-record.md`
- `PATCHES/V1-SYNC-006C/closure-report.md`

## Safety Boundaries

- runtime source changes: NONE
- Product/StockMovement/local operational data mutation: NONE
- Firebase rules/config changes: NONE
- Firebase deployment: NO
- Hosting deployment: NO
- migration/backfill: NONE
- SyncMode activation: NO
- `.env` read or changed: NO
- production touched: NO
- Wakalat-AlFares touched: NO
- push: NOT PERFORMED

## Validation

Validation results:

- `git diff --check`: PASS
- TypeScript (`pnpm exec tsc --noEmit`): PASS
- Build (`pnpm run build`): PASS
- Build note: existing chunk-size warning only
- tracked source diff: NONE
- Firebase diff: NONE

## Final Result

V1-SYNC-006C READY FOR ARCHITECT / OWNER DECISION
