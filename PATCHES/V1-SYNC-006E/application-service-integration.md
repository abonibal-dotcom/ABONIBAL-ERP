# V1-SYNC-006E - Application Service Integration

## Old Flow

`ProductListPage` previously orchestrated three business steps:

1. create a Product with `ProductFactory`;
2. save it through `ProductService`;
3. call `InventoryService.addOpeningBalanceForNewProduct()` and safe-delete the
   Product if the movement failed.

That page-level sequence allowed the Product cache to change before the
opening-movement intent was durable.

## New Boundary

The page now calls only:

```text
CreateProductWithOpeningStockService.execute(command)
```

The service owns account resolution, validation, stable identity, path
selection, durable group construction, local application, and coherent result
mapping. UI refresh and success messaging occur only after the service reports
success. Product edit and safe-delete continue through the existing
`ProductService` paths.

## Path Selection

| Sync mode / quantity | Behavior |
| --- | --- |
| `active`, quantity `0` | existing ungrouped V1-SYNC-005 Product create |
| `active`, quantity `> 0` | two-member durable group |
| `disabled` or `migration` | local-only Product plus optional deterministic movement; no outbox |

All Product and movement validation happens before grouped outbox persistence
as far as the accepted domain contracts allow.

## Product Member

`MasterDataSyncRepositoryBridge.prepareCreateOperation()` reuses the exact
V1-SYNC-005 codec, revision, envelope, operation-ID, idempotency, and checksum
construction without applying the Product. This makes the complete Product
operation available to the group builder before local mutation.

## StockMovement Member

`buildOpeningStockMovementAppendOperation()` captures the complete immutable
movement payload. `StockMovementLocalMutationApplier` inspects and appends
through the raw account-scoped repository only. It does not call
`InventoryService`, Product commands, invoice commands, reversals, Firebase,
transport, or listeners.

## Container

Container now registers:

- `SyncCloudCapabilityRegistry`;
- raw `StockMovementLocalMutationApplier`;
- `CreateProductWithOpeningStockService`.

No StockMovement cloud transport or remote listener is registered.
