# V1-SYNC-006C - Cloud Consistency Options

## Separate Questions

Local command recoverability and cloud visibility are different guarantees.
V1-SYNC-006C requires a complete local durable group before any cache apply.
It does not automatically provide an atomic Firebase commit for all members.

## Option Comparison

### A. Independent Cloud Members After Local Completion

After all local members are applied, send each existing `SyncOperation`
through its module transport.

Advantages:

- smallest extension to V1-SYNC-004A and V1-SYNC-005;
- existing per-operation receipts, retries, and conflict handling remain;
- no new Firebase transaction protocol.

Risks:

- temporary cloud partial state;
- restart can occur after Product acknowledgement but before movement;
- future cross-device readers need a visibility or dependency rule.

Assessment: acceptable for TEST-only controlled sync foundation while pull,
second-device bootstrap, migration, and cutover remain disabled.

### B. Ordered Independent Cloud Members

This is Option A with a required dependency order:

1. Product CREATE acknowledgement.
2. Opening StockMovement APPEND acknowledgement.

It prevents a movement from becoming visible before its Product, but a Product
can be temporarily visible without opening stock.

Assessment: recommended baseline for the later rebuilt V1-SYNC-006. It is
conservative, compatible with existing operation transports, and honest about
partial cloud state.

### C. Atomic Firebase Multi-Location Group Commit

Firebase Realtime Database supports one atomic `update()` covering multiple
descendant paths. A future group transport could attempt one account-root
write containing:

```text
products/{productId}
stockMovements/{movementId}
_sync/operations/{productOperationId}
_sync/operations/{movementOperationId}
_sync/groups/{groupId}
```

Rules evaluate the combined proposed state, so membership, path identity,
create-if-absent, checksums, group completeness, and immutable records can be
validated together.

Limitations and required design work:

- the current transport executes one operation, not one group;
- rules currently understand master-data records and receipts only;
- create-only paths reject an update that includes an already-existing path;
- exact retry requires a group receipt or preflight proof that every existing
  member is identical;
- mixed state, where some exact members exist and others are absent, needs a
  defined recovery protocol;
- preflight reads alone are not compare-and-set, so rules remain the final
  write guard;
- all payloads and receipts must fit one validated update.

Assessment: technically feasible under `accounts/{accountId}`, but not proven
or required by this planning mission.

## Recommendation

Use ordered independent members for the first StockMovement sync foundation,
subject to all of these gates:

- the complete group is locally durable first;
- every member is locally applied before either can sync;
- Product is processed before its opening movement;
- no subscription or second-device bootstrap consumes partial group state;
- SyncMode remains disabled by default;
- no migration or cutover occurs.

Before any owner-approved multi-device cutover, adopt one of:

1. atomic multi-location group commit with a durable group receipt; or
2. cloud group staging plus reader visibility gating that exposes no member
   until the group is complete.

The first option is preferred for a create-only Product/opening pair if
emulator tests prove rules, exact retry, partial-recovery, and conflict
semantics. This is a future decision, not an implementation claim.

## Rules Implications

The future TEST rules must retain:

- explicit account membership;
- default deny;
- Firebase UID only in membership checks;
- Product create revision/checksum validation;
- StockMovement create-only validation;
- StockMovement update/delete denial;
- accountId/path and recordId/path consistency;
- immutable group/member identity;
- client denial for membership mutation.

Ordered independent processing requires no group write rule for the local-only
006D/006E stages. If atomic group commit is later chosen, group receipts and
cross-path completeness validations need their own TEST-first rules and
emulator mission before deployment.

## Cutover Boundary

Neither ordered members nor Firebase multi-location capability authorizes
cutover. RTDB becomes canonical only after migration verification, counts/IDs/
hashes and derived-balance verification, and explicit owner approval. Existing
local records are not uploaded or changed by this architecture plan.
