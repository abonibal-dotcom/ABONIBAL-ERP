# V1-SYNC-006E - Product Opening Stock Group Contract

## Scope

This mission integrates only future Product creation commands that include
opening stock. It does not scan, group, upload, or rewrite existing Products or
StockMovements.

## Command Identity

`ProductListPage` creates one command identity when the create dialog opens and
retains it across a failed save attempt:

```text
Product ID:       <stable UUID supplied by the page command>
Group ID:         product-create-<productId>
Group type:       product_create_with_opening_stock
Movement ID:      opening-<productId>
Movement key:     stockMovement:opening:<productId>
```

The command also retains one ISO creation timestamp. Product dates and the
immutable opening movement date therefore remain stable during an exact retry.
Changing the Product or opening payload under the same identity produces a
conflict rather than a new identity.

## Zero Opening Quantity

An opening quantity of zero uses the accepted V1-SYNC-005 Product create path:

- one ungrouped Product operation in active mode;
- no StockMovement;
- no group metadata;
- no change to Product edit/update behavior.

## Positive Opening Quantity

Active mode builds the complete group before any local cache mutation:

| Sequence | Module | Operation | Local applier |
| --- | --- | --- | --- |
| 1 | `products` | `create` | existing `MasterDataLocalMutationApplier<Product>` |
| 2 | `stockMovements` | `append` | new raw `StockMovementLocalMutationApplier` |

Both members are required for local completion. The existing
`PersistentOutboxRepository.enqueueBatchAtomic()` stores both members under
`syncOutbox:{accountId}` with one `Driver.write()` before sequence 1 is
inspected or applied.

## Retry And Conflict

- Exact retry returns the same two durable members and applies no duplicate.
- Existing matching Product or movement state is treated as already applied.
- Same Product ID with divergent Product data is a conflict.
- Same opening movement ID with divergent movement data is a conflict.
- A conflict blocks later automatic local application and all grouped cloud
  dispatch.
- No Product safe-delete, movement delete, alternate movement, or silent
  overwrite is used as compensation.

## Inventory Boundary

The opening quantity exists only as a positive immutable
`opening_balance` StockMovement. `Product.quantity` remains `0` for the new
Product and is not inventory truth. Current quantity is derived by summing the
StockMovement ledger.

## Disabled Mode

Default SyncMode remains `disabled`. The same application service performs the
local Product and deterministic opening movement writes without outbox,
Firebase, or listeners. This preserves a local-only command boundary but does
not claim durable multi-record recovery. If the second local write fails, the
Product is retained and the same stable command can safely retry the missing
movement; no destructive rollback is performed.
