# V1-SYNC-006A Decision Record

## Approval Gate

The following recommendations are not implementation authorization. Every item
has status `OWNER APPROVAL REQUIRED`. V1-SYNC-006B must not start until all
items are explicitly approved or amended.

| ID | Recommendation | Rationale | Status |
| --- | --- | --- | --- |
| INVREV-DEC-001 | Future generic void appends a reversal movement rather than mutating the original. | Preserves audit history and aligns with create-only sync. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-002 | Every newly created StockMovement is immutable and cannot be physically deleted. | Prevents device divergence and silent ledger history changes. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-003 | Add explicit movement type `reversal`, reference type `movement_reversal`, and typed reversal fields. | A distinct model is clearer than overloading `void`, `correction`, or an inverse business type. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-004 | Derived quantity sums all non-legacy-void effects; legacy records with `voidedAt` retain zero effect. | Preserves existing totals while making V2 reversals additive. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-005 | Prevent double reversal with deterministic record ID, semantic idempotency key, and `reversalOfMovementId` lookup. | Deterministic create-if-absent is the concurrency guard; lookup is validation and audit support. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-006 | Use semantic key `stockMovement:reverse:{originalMovementId}` and a key-safe deterministic hash/UUID for the reversal ID. | Retries and multiple devices resolve to one logical operation and path. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-007 | Generic reversal is once-only for eligible inventory-admin movements; commercial movements remain domain-owned. | Avoids bypassing invoice and future purchase lifecycle invariants. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-008 | A reversal movement cannot be reversed in the baseline. Later correction uses an explicit adjustment or owning domain command. | Avoids unbounded reversal chains and ambiguous state. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-009 | Invoice cancellation and invoice returns retain `sale_return` movements and their existing audit references. | Returns may be partial/multiple and are not equivalent to generic void. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-010 | Opening balance may be reversed once only through an explicit inventory-administration command; never automatically. | Supports correction while preserving product/opening-stock audit and prevents sync replay. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-011 | Preserve legacy void fields and zero-effect semantics; do not rewrite or synthesize reversals automatically. | Prevents balance changes and duplicate compensation. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-012 | V1-SYNC-009 uploads exact legacy snapshots as immutable legacy records instead of transforming voids into synthetic reversals. | Safest CREATE/MATCH/CONFLICT migration with preserved IDs and effects. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-013 | Cloud StockMovement policy is create-only; reversal is a separate CREATE; update and delete remain denied. | Matches immutable ledger and durable audit requirements. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-014 | RTDB rules enforce membership, path/schema identity, create-only state, and basic reversal shape; domain code enforces relational invariants. | RTDB rules cannot safely replace all original/reversal domain validation. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-015 | Domain services create authorized reversals; sync only captures, transports, pulls, deduplicates, and updates cache. | Pull must never replay inventory or commercial commands. | OWNER APPROVAL REQUIRED |
| INVREV-DEC-016 | Implement V1-SYNC-006B locally first, approve it, then restart V1-SYNC-006 from its tag; migration remains V1-SYNC-009. | Separates domain correctness from cloud transport and cutover risk. | OWNER APPROVAL REQUIRED |

## Decision Consequences

If approved:

- `StockMovementRepository.voidForAccount()` can no longer replace an original
  for future operations;
- `InventoryService.voidMovement()` becomes append-only and idempotent;
- legacy records remain readable without startup mutation;
- future Firebase rules stay create-only;
- Sales and future Purchase compensation remain owned by their domains;
- V1-SYNC-006 resumes only after V1-SYNC-006B passes its domain regression.

If any decision is rejected or amended, V1-SYNC-006 remains blocked until the
replacement contract resolves local/cloud divergence without destructive data
changes.
