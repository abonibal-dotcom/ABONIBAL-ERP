# V1-SYNC-006A Implementation Roadmap

## Required Sequence

1. Architect / Owner approves or amends INVREV-DEC-001 through
   INVREV-DEC-016.
2. Execute V1-SYNC-006B as a local inventory-domain alignment mission.
3. Validate legacy and V2 derived quantities without cloud sync.
4. Tag the accepted V1-SYNC-006B result.
5. Restart V1-SYNC-006 from the accepted V1-SYNC-006B tag.
6. Implement create-only StockMovement sync and TEST-only rules.
7. Leave migration and cutover for V1-SYNC-009.

No V1-SYNC-006B implementation or V1-SYNC-006 restart is authorized by this
documentation mission.

## Proposed V1-SYNC-006B Mission

**Name:** V1-SYNC-006B - StockMovement Void-to-Reversal Domain Alignment

**Classification:** ECS / Inventory Ledger Domain Alignment

### Allowed runtime scope

- `StockMovement` typed model and movement/reference enums;
- `StockMovementValidator`;
- `StockMovementRepository` append/find/index behavior;
- `InventoryService.voidMovement()` behavior;
- derived quantity compatibility reducer;
- Inventory history display for original/reversal relationships;
- focused inventory, Sales regression, and legacy compatibility tests;
- Container only if a domain dependency is genuinely required.

### Required implementation

1. Add explicit V2 semantics and typed reversal fields.
2. Add `reversal` and `movement_reversal` enum values.
3. Replace future repository mutation with append-only reversal creation.
4. Keep old void fields readable but never add them to a new record.
5. Implement deterministic reversal identity and stable idempotency.
6. Detect one reversal per eligible original.
7. Reject reversal-of-reversal.
8. Keep commercial movement compensation in Sales/Purchase owners.
9. Update derived quantity to support legacy void suppression plus V2 effects.
10. Display both original and reversal without hard delete.

### Explicit exclusions

- no Firebase calls, rules, transport, outbox wiring, listener, or deployment;
- no migration or historical rewrite;
- no Product, Invoice, InvoiceReturn, or Purchase repository sync;
- no automatic conversion of legacy voided records;
- no change to `Product.quantity` authority;
- no production work.

## V1-SYNC-006B Test Contract

### Legacy compatibility

- legacy normal movement retains its effect;
- legacy voided movement remains zero effect;
- legacy record bytes are not rewritten on startup or read;
- mixed V1/V2 ledger derives the expected quantity;
- reload preserves the result.

### Reversal lifecycle

- eligible original creates one exact opposite movement;
- original is byte-for-byte unchanged;
- required reason, actor, account, and product are preserved;
- same logical retry returns the existing reversal;
- different retry payload conflicts;
- concurrent simulation produces one reversal;
- reversal-of-reversal is blocked;
- legacy already-voided reversal request is blocked/idempotently reported;
- missing or cross-account original is rejected.

### Domain regression

- opening balance creation remains stable and duplicate-safe;
- manual adjustments remain stable;
- invoice issue still creates one `sale_deduction` per line;
- invoice cancellation still creates the accepted `sale_return` records;
- partial invoice returns remain supported and are not collapsed into one
  generic reversal;
- Purchase remains status-only until its own integration mission;
- `Product.quantity` remains non-authoritative.

### UI regression

- original and reversal are visible;
- derived reversed marker is correct;
- reason and original reference are visible;
- no hard delete;
- all existing pages open with zero console errors and page exceptions.

## Restarted V1-SYNC-006 Scope

The restarted mission should then add only:

- sync-aware StockMovement repository composition;
- cache-only append applier;
- create-only cloud codec/transport/adapter;
- TEST rules for immutable StockMovement records;
- durable append, crash recovery, idempotency, pull, and derived-quantity tests;
- V1-SYNC-006 documentation.

It must preserve `SyncMode: disabled`, zero startup listeners/writes, zero
historical enqueue, and zero existing-record upload.

## Atomicity Review Gates

Before the restarted V1-SYNC-006 can close, it must explicitly review:

### Product and opening stock

Product creation and opening StockMovement capture are separate records. If the
approved shared sync operation cannot make the pair crash-consistent without a
new distributed-transaction contract, stop at:

```text
PRODUCT OPENING STOCK MULTI-RECORD ATOMICITY GAP
```

### Commercial records and inventory

Invoice issue/cancel/return currently changes a commercial aggregate and one or
more StockMovements through sequential local operations. If the future sync
contract cannot preserve the write set atomically, stop at:

```text
COMMERCIAL RECORD / INVENTORY ATOMICITY GAP
```

V1-SYNC-006B must not solve either sync atomicity problem implicitly.

## Migration And Cutover

V1-SYNC-009 remains responsible for:

- local backup and non-writing dry run;
- legacy/V2 classification;
- CREATE/MATCH/CONFLICT planning;
- idempotent create-only upload;
- counts, IDs, canonical hashes, links, and derived quantities;
- fresh second-device pull;
- explicit owner-approved cutover.

Local storage is not deleted before or after cutover. Conflicts block automatic
overwrite. Firebase becomes canonical only after the accepted migration gates.

## Rollback Policy

- V1-SYNC-006A rollback: remove only its documentation commit/tag locally.
- V1-SYNC-006B rollback: restore the pre-006B code only before creating V2
  records, or use a specifically verified compatibility build.
- Never delete or rewrite V1/V2 StockMovements to make rollback appear clean.
- Preserve account-scoped backups and report any unsupported V2 record before
  attempting a downgrade.

## Stop Conditions

Stop and request a new decision if implementation discovers:

- deterministic reversal identity cannot be guaranteed;
- legacy and V2 effects cannot be distinguished safely;
- an existing domain flow requires generic reversal of a commercial movement;
- derived quantity changes without an authorized new movement;
- source migration would be required for code startup;
- Firebase rules would need to permit update/delete;
- opening-stock or commercial atomicity has no approved contract.
