# V1-SYNC-006 Closure Report

## Mission

- Mission: V1-SYNC-006 - Inventory Ledger Firebase Sync / StockMovements Append-Only Integration
- Classification: Feature / Append-Only Inventory Ledger Sync / TEST First
- Base tag: `v1-sync-006e-product-opening-stock-durable-group-integration`
- Branch: `v1/sync-006-inventory-ledger-stock-movement-sync`
- Firebase project: `abonibal-erp-test` only

## Changed Files

- `database.test.rules.json`
- `scripts/v1-sync-006-inventory-ledger-smoke.ts`
- `scripts/v1-sync-006-rules-smoke.ts`
- `scripts/v1-sync-006e-product-opening-group-smoke.ts`
- `src/core/Container.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/repositories/StockMovementSyncRepository.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/sync/StockMovementLocalMutationApplier.ts`
- `src/modules/inventory/sync/StockMovementSyncAdapter.ts`
- `src/modules/inventory/sync/StockMovementSyncOperation.ts`
- `src/modules/inventory/sync/StockMovementSyncOperationTransport.ts`
- `src/modules/inventory/sync/StockMovementSyncTypes.ts`
- `src/modules/sync/services/SyncOperationTransportRegistry.ts`
- `PATCHES/V1-SYNC-006/inventory-ledger-sync-contract.md`
- `PATCHES/V1-SYNC-006/append-only-security-rules.md`
- `PATCHES/V1-SYNC-006/group-cloud-processing-boundary.md`
- `PATCHES/V1-SYNC-006/cloud-partial-state-recovery.md`
- `PATCHES/V1-SYNC-006/sync-validation.md`
- `PATCHES/V1-SYNC-006/closure-report.md`

No invoice, return, payment, purchase, expense, cash, or accounting ledger repository was changed.

## Integration Result

- Pattern: sync-aware repository over raw local cache repository.
- Cloud path: `accounts/{accountId}/stockMovements/{movementId}`.
- Cloud policy: immutable create only; update/delete denied.
- Durable capture: outbox before local cache apply.
- Pull: explicit cache-only apply; no business command replay.
- Idempotency: stable operation/idempotency identity and canonical checksum.
- Identical existing record: match/acknowledge.
- Divergent same-ID record: conflict; no overwrite.
- Reversal: separate immutable append; original remains unchanged.

## Group Result

- Capability before StockMovement transport registration: BLOCKED.
- Capability after registration: PRESENT and eligible when all group gates pass.
- Ordering: Product sequence 1, opening movement sequence 2.
- Movement can overtake Product: NO.
- Product acknowledgement plus movement failure: recoverable.
- Restart after Product acknowledgement: resumes movement without Product duplicate.
- Final cleanup: after required acknowledgements only.
- Cloud atomic visibility guaranteed: NO.
- Limitation: transient Product-only cloud visibility can exist before movement acknowledgement; stronger visibility/atomicity policy is deferred before cutover.

## Inventory and Compatibility

- Derived inventory `+10 -3 = 7`: PASS.
- Original plus reversal net `0`: PASS.
- Duplicate pull/reversal pull changes effect: NO.
- Product.quantity authoritative: NO.
- Legacy void records rewritten or uploaded: NO.
- Existing StockMovements auto-enqueued/uploaded: 0.
- Existing ledger deletion or ID rewrite: 0.
- Migration/backfill: NONE.

## Invoice / Return Boundary

- Invoice issue domain flow: PASS; one `sale_deduction` remains domain-owned and active StockMovement capture records it once.
- Invoice return domain flow: PASS; one `sale_return` remains domain-owned and active StockMovement capture records it once.
- Invoice and return repositories synchronized by this mission: NO.
- Full cross-device commercial consistency claimed: NO.

## Rules and Security

- TEST rules evolved for account-member-authorized append-only StockMovements.
- Own-account create/read: PASS.
- Update, overwrite, delete: DENIED.
- Foreign and unauthenticated access: DENIED.
- Membership mutation: DENIED.
- V1-SYNC-006 rules: PASS `17/17`.
- Existing master-data rules: PASS `36/36`.
- Rules deployment: TEST Realtime Database rules only, PASS.
- Operational live RTDB writes: 0.
- Existing user records uploaded: 0.
- Firebase UID used as accountId: NO.

## Validation

- `git diff --check`: PASS.
- TypeScript: PASS.
- Build: PASS.
- Focused StockMovement integration: PASS `41/41`.
- V1-SYNC-004: PASS `18/18`.
- V1-SYNC-004A: PASS `26/26`.
- V1-SYNC-005: PASS `31/31`.
- V1-SYNC-006B: PASS `14/14`.
- V1-SYNC-006D: PASS `24/24`.
- V1-SYNC-006E: PASS `39/39`.
- Runtime HTTP entry: PASS, local preview returned 200.
- Authenticated browser regression: TOOL LIMITATION; no authenticated automation session was available, and no console/page metrics were invented.
- Default `SyncMode`: disabled.
- Production touched: NO.

## Final Result

ACCEPTED locally. The append-only StockMovement integration, rules, recovery paths, and predecessor regressions pass. This mission does not approve migration, second-device bootstrap, commercial-record sync, cloud-atomic group visibility, or production cutover.

V1-SYNC-006 READY FOR ARCHITECT REVIEW
