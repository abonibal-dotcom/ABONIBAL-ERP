# V1-SYNC-006C - Decision Record

All decisions below are recommendations from the architecture audit. Every
decision remains `OWNER APPROVAL REQUIRED` before implementation.

## MULTI-DEC-001 - Complete Group Before First Mutation

**Recommendation:** A multi-record command must persist every required member
durably before the first local cache mutation.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-002 - Durable Group Representation

**Recommendation:** Represent the group through immutable group manifests on
the existing outbox member operations. Do not create a second group store for
this baseline.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-003 - Atomic Local Persistence Boundary

**Recommendation:** Add `enqueueBatchAtomic()` and persist all members through
one `Driver.write()` to `syncOutbox:{accountId}`. Describe this as a single-key
durable write, not multi-key ACID.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-004 - Group And Member Lifecycle

**Recommendation:** Keep existing member local/cloud states. Derive minimal
group local states (`pending_local_apply`, `locally_applied`, `conflict`,
`failed`) and separate cloud states (`blocked_local`, `pending`, `partial`,
`acknowledged`, `conflict`, `failed`).

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-005 - Crash Recovery

**Recommendation:** Reconcile members in sequence with existing cache-only
inspection/apply semantics. Matching state is already applied; divergent state
is conflict; no business command is replayed.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-006 - Deterministic Group Identity

**Recommendation:** Tie group identity to the stable Product-create command and
Product ID, conceptually `product-create:{accountId}:{productId}`. A random
group ID alone is insufficient.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-007 - Member Idempotency

**Recommendation:** Keep the Product operation's V1-SYNC-005 identity and add
deterministic opening movement identity `opening-{productId}` with idempotency
key `stockMovement:opening:{productId}`. Exact retries match; changed payloads
conflict.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-008 - Cloud Processing Group Gate

**Recommendation:** No required member is cloud-eligible until every group
member is locally applied. Before StockMovement transport exists, block both
members of Product/opening groups from cloud processing.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-009 - Cloud Member Ordering

**Recommendation:** Once both transports exist, process Product CREATE before
opening StockMovement APPEND. Preserve durable per-member receipts and retain
grouped outbox entries until the whole group is acknowledged.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-010 - True Cloud Atomic Commit

**Recommendation:** Do not require or claim true cloud atomicity for the
TEST-only no-pull/no-cutover StockMovement foundation. Require an approved
atomic multi-location or reader-visibility group strategy before second-device
bootstrap and cutover.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-011 - Product Application Service Boundary

**Recommendation:** Move Product-plus-opening orchestration out of
`ProductListPage` into `CreateProductWithOpeningStockService`; the page submits
one command and maps one result.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-012 - Zero Opening Quantity

**Recommendation:** Keep the one-command application service, but route zero
opening quantity through the existing single Product operation rather than a
one-member group.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-013 - Conflict Behavior

**Recommendation:** Any group integrity, Product payload, or movement payload
divergence marks the group conflict and blocks remaining automatic application
and cloud processing.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-014 - No Destructive Rollback

**Recommendation:** Never safe-delete Product, delete a movement, overwrite a
record, or append an alternate movement automatically to hide partial state.
Preserve records and durable conflict evidence.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-015 - Legacy And Historical Boundary

**Recommendation:** Apply grouped capture only to future commands. Do not scan,
group, rewrite, upload, or synthesize movements for existing data. V1-SYNC-009
retains migration ownership.

**Status:** OWNER APPROVAL REQUIRED.

## MULTI-DEC-016 - Implementation Sequence

**Recommendation:** Implement and review V1-SYNC-006D foundation separately,
then V1-SYNC-006E Product/opening integration, then recreate V1-SYNC-006 from
the latest accepted tag. Do not merge 006D and 006E.

**Status:** OWNER APPROVAL REQUIRED.
