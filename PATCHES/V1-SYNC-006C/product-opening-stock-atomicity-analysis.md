# V1-SYNC-006C - Product Opening Stock Atomicity Analysis

## Current Runtime Sequence

The current create flow is orchestrated by
`src/modules/products/pages/ProductListPage.ts`:

1. Read dialog values and validate a non-negative opening quantity.
2. `ProductFactory.create()` generates a random Product ID and a Product whose
   legacy `quantity` field is zero.
3. `ProductService.add(product)` persists the Product.
4. Only after Product success, a positive opening quantity calls
   `InventoryService.addOpeningBalanceForNewProduct(product.id, quantity)`.
5. That method searches for a matching prior opening record and otherwise
   calls `addMovement()`.
6. `addMovement()` generates a new random StockMovement ID, validates it, and
   appends it to `stockMovements:{accountId}`.
7. If movement creation returns an ordinary failure, the page tries to
   safe-delete the Product.

The UI rollback is not a crash-recovery contract. It runs only if control
returns from the movement call with failure. It cannot run after process loss,
and in active sync mode it is itself another Product mutation.

## Active Product Capture Sequence

V1-SYNC-005 composes Product persistence as:

```text
ProductService
  -> ProductSyncRepository
  -> MasterDataSyncRepositoryBridge
  -> DurableMutationCapture
  -> PersistentOutboxRepository.enqueue(Product operation)
  -> Product cache-only apply
  -> Product local-applied marker
  -> return success
```

Only after this complete sequence returns does the page request opening stock.
The Product operation contains no opening-quantity intent and no future
StockMovement member identity.

## Current Identity Limitations

- Product ID: stable after `ProductFactory.create()`, but newly generated for a
  fresh UI submission.
- Product operation ID: deterministic from Product identity, revision, and
  checksum under V1-SYNC-005.
- Opening movement ID: currently random in `InventoryService.addMovement()`.
- Opening retry detection: query by Product ID, type, reference, and metadata;
  it is not a deterministic record identity.
- Multi-record command/group ID: absent.
- Durable link proving that a Product requires an opening member: absent.

V1-SYNC-006B supplies deterministic identity for reversal movements only. It
does not define deterministic opening-movement identity.

## Crash Windows

| Window | Persisted evidence | Local state | Current recovery result |
| --- | --- | --- | --- |
| A. Before Product durable capture | none | no Product, no movement | safe retry |
| B. After Product outbox capture, before Product local apply | Product operation | neither record | V1-SYNC-004A applies Product once |
| C. After Product local apply, before opening movement durable capture | Product operation marked applied | Product only | **unrecoverable missing movement intent** |
| D. After opening movement durable capture, before movement local apply | would require future append capture | Product present, movement absent | recoverable only after grouped/append applier exists |
| E. After both local applies, before caller success | both complete operations required | both records present | exact retry can be idempotent only with stable group/member identity |

Window C includes a crash immediately after Product success and before the
page enters the opening-stock branch. It also includes failure while building
or durably enqueuing the movement operation.

## Why V1-SYNC-004A Cannot Repair Window C

`LocalMutationReconciler` reads only operations already present in the durable
outbox. At Window C there is no StockMovement operation to inspect or apply.
The Product payload deliberately contains no authoritative opening quantity,
and `Product.quantity` cannot be used to infer one. Replaying the page or
Inventory business command would invent intent rather than reconcile captured
intent.

Therefore all required members must be known and durably captured before the
Product cache applier runs.

## Required Future Application Boundary

Move orchestration from the page to one application service, recommended name:

```text
CreateProductWithOpeningStockService
```

Responsibilities:

- validate the combined command;
- assign and retain stable command/Product/movement identities;
- build complete Product and StockMovement payloads;
- choose single-operation Product capture for zero opening quantity;
- choose grouped capture for positive opening quantity;
- invoke no Firebase API directly;
- map capture, conflict, and recovery outcomes to safe UI results.

`ProductListPage` then submits one command and must not separately call
`ProductService.add()` followed by `InventoryService`.

## Source-Of-Truth Constraint

The fix must not place opening stock into `Product.quantity`. A positive
opening quantity is represented only by an immutable opening StockMovement.
Current historical records remain untouched and are handled later by the
approved migration mission.
