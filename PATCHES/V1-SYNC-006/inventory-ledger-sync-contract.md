# V1-SYNC-006 Inventory Ledger Sync Contract

## Mission Boundary

- Classification: Feature / Append-Only Inventory Ledger Sync / TEST First
- Base tag: `v1-sync-006e-product-opening-stock-durable-group-integration`
- Firebase target: `abonibal-erp-test` only
- Cloud path: `accounts/{accountId}/stockMovements/{movementId}`
- Default `SyncMode`: `disabled`
- Production project: frozen and untouched

This mission connects new `StockMovement` appends to the shared durable sync runtime. It does not migrate, scan, backfill, or upload existing local ledger records. It does not synchronize invoices, returns, payments, purchases, expenses, cash, or accounting ledger records.

## Repository Pattern

`InventoryService` depends on `StockMovementRepositoryPort`. The container supplies:

- `StockMovementSyncRepository` for command-owned writes.
- `StockMovementRepository` as the raw local cache repository.
- `StockMovementLocalMutationApplier` bound only to the raw repository.
- `StockMovementSyncOperationTransport` for TEST RTDB appends.
- `StockMovementSyncAdapter` for explicit cache-only pull/subscription use.
- `SyncOperationTransportRegistry` to route master-data and StockMovement operations without widening either transport.

This prevents recursive capture: cache apply never invokes the sync-aware repository.

## Append Contract

When sync is disabled, append behavior remains local-only and creates no outbox operation.

When sync is active, an ungrouped append follows this order:

1. Validate the explicit logical account boundary.
2. Build one stable `stockMovements/append` operation.
3. Persist the operation in the durable outbox.
4. Apply the immutable movement through the raw local cache applier.
5. Persist the locally-applied marker.
6. Return the stored movement.

Outbox persistence failure prevents local mutation. Cache failure retains the operation as locally failed and keeps it cloud-ineligible. Exact retries preserve one movement and one outbox operation.

## Cloud Identity

Each envelope contains immutable domain data plus metadata for schema version, revision 1, immutable state, operation identity, idempotency identity, canonical checksum, and server update time.

- Missing path: create.
- Existing identical canonical record: idempotent match.
- Existing same ID with divergent data: conflict without overwrite.
- Update: unsupported and denied.
- Delete: unsupported and denied.
- Reversal: a separate immutable append.

Firebase UID is used only by Firebase membership rules. The operation and path use the explicit logical `accountId`.

## Pull Contract

Pull validates the active mode, authenticated logical account, cloud path identity, schema, operation identity, and checksum. It then applies the record to the raw local cache only.

Pull never calls inventory commands, invoice issue/return commands, opening-stock commands, reversal commands, or product creation services. Duplicate pull is idempotent. Divergent local/cloud records create a visible sync conflict and preserve local data.

## Inventory Truth

Inventory remains derived from the immutable `stockMovements:{accountId}` ledger. `Product.quantity` remains legacy compatibility data and is not authoritative. No mutable cloud quantity or inventory balance is stored.

## Explicit Exclusions

- No migration or historical backfill.
- No startup scan, upload, write, or listener.
- No physical cloud delete.
- No full second-device bootstrap or cutover.
- No claim of cross-device commercial consistency.
- No production or Hosting deployment.
