# V1-SYNC-005 Master Data Sync Contract

## Scope

This mission integrates only these account-scoped master-data repositories:

- `products`
- `customers`
- `suppliers`

Approved cloud paths are:

```text
accounts/{accountId}/products/{recordId}
accounts/{accountId}/customers/{recordId}
accounts/{accountId}/suppliers/{recordId}
```

The Firebase UID is membership identity only. The operational root always uses
the explicit logical `accountId` resolved by the authenticated application
session.

## Repository Composition

Each module uses the same composition:

```text
Domain service
  -> repository port
  -> sync-aware repository wrapper
  -> MasterDataSyncRepositoryBridge
  -> DurableMutationCapture
  -> cache-only MasterDataLocalMutationApplier
  -> existing LocalStorage repository
```

UI and domain services contain no Firebase calls. The Firebase transport is
owned by the shared sync layer. Pull applies validated state through a
cache-only applier and never replays a domain command.

## Mode Boundary

`SyncMode` remains `disabled` by default.

In `disabled` or `migration` mode, the bridge delegates directly to the
existing local repository. It performs no outbox capture, Firebase read,
Firebase write, listener startup, scan, upload, or backfill.

`active` mode still requires the existing owner-approved gates:

- owner approval
- verified migration
- explicit cutover approval
- approval reference

This mission does not grant that approval, run migration, or activate sync at
application startup.

## Durable Mutation Order

For an active create or update:

1. Build a deterministic operation ID and idempotency key.
2. Persist the operation in the account-scoped outbox.
3. Apply the mutation through the cache-only applier.
4. Persist local revision/checksum state.
5. Mark the operation durably as locally applied.
6. Return success.

Cloud processing can select only operations whose local apply state is
`applied`. If outbox persistence fails, no cache mutation runs. If cache apply
or durable marking fails, the operation remains visible for bounded recovery.

## Cloud Record Contract

Each record is an object envelope with:

```text
data
meta.schemaVersion
meta.revision
meta.serverUpdatedAt
meta.lastOperationId
meta.tombstone
meta.writeSetChecksum
```

Create starts at revision 1 and is create-if-absent. Update requires
`expectedRevision` and advances exactly one revision. A stale or divergent
state is a visible conflict; there is no last-write-wins overwrite.

The transport writes the record and operation receipt in one RTDB multi-path
update. The coordinator persists a local receipt before removing an
acknowledged operation from the active outbox. Exact operation/checksum retries
are idempotent.

## Pull Boundary

Pull is explicit and requires active mode plus one matching authenticated
logical account. Subscriptions exist as module adapters but are not started by
`Container.boot()`.

Remote records are validated for schema, checksum, account, record identity,
and module codec. An unresolved local operation blocks pull for the same
record. Equal divergent revisions become conflicts. Older revisions are
ignored. Cache updates do not invoke Product, Customer, Supplier, Inventory,
Sales, Purchase, or Payment commands.

## Delete And Inventory Boundaries

Physical cloud delete is unsupported and denied by rules. Existing safe-delete
fields synchronize only as a revisioned tombstone update.

`Product.quantity` remains a legacy compatibility field and is not inventory
truth. Stock availability continues to derive from `stockMovements`. Product
pull creates zero StockMovement records. StockMovement sync remains deferred to
V1-SYNC-006.

## Existing Data Safety

Existing local records are neither scanned nor enqueued. There is no automatic
historical upload, second-device bootstrap, local deletion, ID rewrite, cloud
deletion, or migration. V1-SYNC-009 remains the dedicated migration mission.
