# V1-SYNC-006C - Implementation Roadmap

## Recommendation

Keep V1-SYNC-006D and V1-SYNC-006E separate. Combining foundation mechanics
with the first operational Product/Inventory command would increase the blast
radius and make crash-test failures harder to classify. The lower-risk order is
foundation first, one command integration second, then rebuild V1-SYNC-006.

## V1-SYNC-006D - Durable Multi-Record Mutation Group Foundation

Classification: sync foundation; no operational Product flow change.

Recommended scope:

- optional immutable group metadata on `SyncOperation`;
- canonical group manifest/checksum types;
- `PersistentOutboxRepository.enqueueBatchAtomic()`;
- exact batch retry and collision checks;
- group integrity and derived lifecycle helpers;
- `DurableMutationGroupCapture`;
- group-aware local reconciler using existing `LocalMutationApplierRegistry`;
- group cloud eligibility gate;
- grouped acknowledgement retention and atomic group cleanup;
- status visibility for pending/conflict/failed groups;
- fake cache appliers and deterministic crash tests;
- single-operation V1-SYNC-004A regression unchanged.

Expected implementation areas:

```text
src/modules/sync/SyncOperation.ts
src/modules/sync/SyncMutationGroup.ts                 (new)
src/modules/sync/repositories/PersistentOutboxRepository.ts
src/modules/sync/services/DurableMutationGroupCapture.ts  (new)
src/modules/sync/services/LocalMutationGroupReconciler.ts  (new or narrow extension)
src/modules/sync/services/SyncCoordinator.ts
src/modules/sync/services/SyncStatusService.ts        (only if visibility is needed)
src/core/Container.ts                                 (foundation registration only)
scripts/v1-sync-006d-mutation-group-smoke.ts
PATCHES/V1-SYNC-006D/*
```

Required tests:

- batch validation failure writes nothing;
- one outbox write contains every member;
- exact retry creates no duplicate group/member;
- same identity/different payload conflicts;
- crash scenarios A-E recover exactly once;
- scenarios F-G preserve conflict without overwrite;
- no grouped member is cloud-eligible until all are locally applied;
- grouped acknowledgement cleanup is all-or-none;
- account isolation/logout/account-switch behavior;
- all V1-SYNC-004 and V1-SYNC-004A regressions pass;
- no Product, StockMovement, Firebase rule, or operational RTDB change.

## V1-SYNC-006E - Product Creation And Opening Stock Group Integration

Classification: application integration; no StockMovement Firebase transport.

Recommended scope:

- `CreateProductWithOpeningStockService` application boundary;
- stable command/Product identities;
- deterministic opening movement identity and idempotency key;
- complete Product CREATE member construction through the accepted Product
  codec/revision contract;
- complete immutable StockMovement APPEND member construction;
- Product and StockMovement cache-only applier use;
- positive quantity grouped capture;
- zero quantity single Product operation path;
- Product page invokes one application command;
- remove page-level Product safe-delete compensation for this create path;
- disabled-mode behavior remains locally compatible;
- grouped Product/opening members remain cloud-blocked until StockMovement
  transport is implemented.

Expected implementation areas:

```text
src/modules/products/pages/ProductListPage.ts
src/modules/products/services/CreateProductWithOpeningStockService.ts (new)
src/modules/products/factories/ProductFactory.ts        (only if identity injection is needed)
src/modules/inventory/StockMovement.ts                   (opening identity helper if approved)
src/modules/inventory/services/InventoryService.ts       (record construction extraction only)
src/modules/inventory/repositories/StockMovementRepository.ts (raw applier port only if needed)
src/modules/sync/*                                       (approved group adapters only)
src/core/Container.ts
scripts/v1-sync-006e-product-opening-group-smoke.ts
PATCHES/V1-SYNC-006E/*
```

Required tests:

- positive opening quantity creates one Product and one movement;
- zero quantity creates Product only;
- complete group exists before either cache write;
- all crash scenarios A-G;
- exact retry and page double-submit create no duplicate;
- movement ID/checksum divergence conflicts;
- no destructive rollback;
- `Product.quantity` remains non-authoritative;
- existing Product edit and safe-delete behavior remains single-record;
- no existing local record scan/upload/backfill;
- no Firebase operational write/listener or rules deployment.

## Rebuild V1-SYNC-006

After owner acceptance of 006D and 006E:

1. Create V1-SYNC-006 again from the latest accepted 006E tag.
2. Add append-only StockMovement sync transport, cloud envelope, raw cache
   applier, explicit pull adapter, and TEST rules.
3. Enable grouped cloud eligibility now that Product and StockMovement
   transports both exist.
4. Process Product before opening movement.
5. Keep SyncMode disabled by default and perform no migration/backfill.
6. Run StockMovement, reversal, derived inventory, Product-opening group,
   V1-SYNC-004A, and V1-SYNC-005 regressions.
7. Stop again before V1-SYNC-007.

## Pre-Cutover Follow-Up

Before second-device bootstrap or canonical-cloud cutover, approve and
implement one cloud group visibility strategy:

- atomic Firebase multi-location group commit; or
- staged group records hidden from readers until a complete group receipt.

That decision needs TEST rules, emulator concurrency/retry tests, migration
verification, and explicit owner cutover approval. It is not part of 006D,
006E, or the local planning mission.

## Deferred Reuse

The group pattern can later support other approved multi-record commands, but
006D/006E must not integrate invoices, returns, payments, purchases, expenses,
cash, or journal entries. Each needs its own dependency and atomicity review.
