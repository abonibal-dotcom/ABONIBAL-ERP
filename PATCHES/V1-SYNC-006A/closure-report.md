# V1-SYNC-006A Closure Report

## Mission

- Mission: V1-SYNC-006A - StockMovement Void / Reversal Architecture Alignment Plan
- Classification: INF / Inventory Ledger Architecture / Sync Compatibility
- Base tag: `v1-sync-005-master-data-repository-sync`
- Branch: `v1/sync-006a-stock-movement-void-reversal-architecture-alignment-plan`
- Firebase target: none; documentation only

## Reviewed Material

Runtime source reviewed:

- StockMovement entity, types, validator, repository, service, persistence, and
  inventory history page;
- Product opening-stock flow;
- invoice issue, cancellation, and invoice-return stock effects;
- Purchase lifecycle and absence of Purchase inventory effects;
- current derived quantity reducer.

Architecture reviewed:

- V1-SYNC-002 architecture, schema, conflict/idempotency, and migration plans;
- V1-SYNC-004 runtime/outbox contracts;
- V1-SYNC-004A durable mutation capture and reconciliation contracts;
- V1-SYNC-005 repository integration, security evolution, validation, and
  closure evidence.

No operational TEST record was read, rewritten, deleted, migrated, or uploaded.
The compatibility plan is based on the accepted persisted record shape and
reader semantics.

## Root Conflict

The current repository mutates an existing StockMovement when voiding it, and
the current quantity reducer removes that record's effect when `voidedAt` is
present. The proposed cloud contract permits only create and denies update and
delete. Synchronizing both models would either reject a legitimate local void
or let devices derive different inventory.

## Recommended Reversal Model

- original StockMovement remains immutable and visible;
- generic future void creates a separate movement of type `reversal`;
- reversal uses the same account/product and exact opposite `quantityDelta`;
- typed fields link it to the original and preserve the required reason;
- deterministic reversal ID plus stable idempotency key prevents duplicate
  effect across retries and devices;
- reversal state is derived from ledger links, not written onto the original.

## Derived Quantity Policy

- legacy V1 record with `voidedAt`: zero effect;
- legacy V1 normal record: sum `quantityDelta`;
- immutable V2 normal record: sum `quantityDelta`;
- immutable V2 reversal: sum its exact opposite `quantityDelta`.

`Product.quantity` and mutable balance fields remain non-authoritative.

## Legacy Compatibility And Migration

Legacy records are not rewritten. Existing void fields remain readable and a
legacy voided record does not receive an automatic synthetic reversal.
V1-SYNC-009 should upload exact legacy snapshots as immutable records, preserve
IDs and audit metadata, and use CREATE/MATCH/CONFLICT. It must verify counts,
IDs, hashes, links, and product quantities before owner-approved cutover.

## Cloud Rules Impact

Future TEST rules keep membership authorization and default deny. A valid
movement can be created once under its matching account/path identity. Existing
movement update and delete are denied. A reversal is a separate CREATE.
Relational checks such as original existence, same product, exact opposite
effect, eligibility, and uniqueness remain domain responsibilities.

No Firebase rule was changed or deployed in this mission.

## Domain And UI Sequence

The proposed next implementation is:

```text
V1-SYNC-006B - StockMovement Void-to-Reversal Domain Alignment
```

It must align local domain behavior, preserve legacy reads, update derived
quantity and history display, and pass domain regression without cloud sync.
Only after owner acceptance should V1-SYNC-006 restart from the 006B tag.

Invoice cancellation and return remain domain-specific `sale_return` flows.
Purchase currently produces no inventory movement. Opening-stock and commercial
multi-record sync atomicity must be re-evaluated in the restarted V1-SYNC-006.

## Decisions Requiring Owner Approval

`INVREV-DEC-001` through `INVREV-DEC-016` are recorded in
`decision-record.md`. Every decision has status `OWNER APPROVAL REQUIRED`.

## Changed Files

- `PATCHES/V1-SYNC-006A/stock-movement-reversal-contract.md`
- `PATCHES/V1-SYNC-006A/legacy-void-compatibility-plan.md`
- `PATCHES/V1-SYNC-006A/cloud-sync-impact.md`
- `PATCHES/V1-SYNC-006A/implementation-roadmap.md`
- `PATCHES/V1-SYNC-006A/decision-record.md`
- `PATCHES/V1-SYNC-006A/closure-report.md`

## Validation

- `git diff --check`: PASS
- TypeScript (`pnpm exec tsc --noEmit`): PASS
- Build (`pnpm run build`): PASS
- Build note: existing bundle-size warning only; build completed successfully
- Runtime source changes: NONE
- Firebase deployment: NO
- Migration/backfill: NO
- Local operational data changes: NONE
- Production touched: NO

## Final Result

READY FOR ARCHITECT / OWNER DECISION
