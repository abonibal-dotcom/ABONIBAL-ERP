# V1-PER-004 No-Data-Loss Plan

## Mission

`V1-PER-004 - Product Account-Scoped Persistence Plan`

## Classification

`INF`

This document plans future no-data-loss behavior. It does not execute migration.

## Data Safety Rule

The existing global key `localStorage.products` is a protected legacy data source.

It must not be deleted, overwritten, rewritten, migrated, or reinterpreted automatically.

## Current Data

- Current key: `products`.
- Current storage location: browser localStorage.
- Current shape: Product array.
- Current records lack `accountId`.
- Current records lack `createdBy`.
- Current records lack `updatedBy`.

## Target Data

- Target key pattern: `products:{accountId}`.
- Target records include `accountId`.
- Target records include `createdBy` on create.
- Target records include `updatedBy` on update where appropriate.
- Target reads and writes are account-scoped.

## Future Backup Step

Before any implementation or migration writes Product storage:

1. Capture the raw global `products` value.
2. Capture a sanitized storage snapshot.
3. Capture Product count.
4. Capture Product identifiers and names only if they are not sensitive, or hash them if needed.
5. Save evidence before migration.
6. Do not modify `localStorage.products` during backup.

## Future Account Assignment Step

Existing global Products cannot be assigned automatically because they have no account metadata.

Required owner checkpoint:

1. Show the count of legacy Products.
2. Show the target account name/id from the authenticated `AuthSession`.
3. Ask owner/architect to approve assignment of the legacy global Products to that account.
4. If more than one account exists, require explicit owner mapping per account.
5. If owner approval is not provided, keep legacy data untouched and do not migrate.

## Future Copy / Transform Step

After owner approval:

1. Read `localStorage.products`.
2. Validate it is an array.
3. For each Product, create a transformed record with:
   - original Product fields preserved.
   - `accountId` set to the approved target account.
   - `createdBy` set to the approved acting user or migration actor.
   - `updatedBy` set according to the approved metadata contract.
4. Write transformed records to `products:{accountId}`.
5. Do not delete or mutate `localStorage.products`.

## Future Verification Step

Verification must prove:

- Global `products` still exists.
- Global `products` hash is unchanged after migration/import.
- Account-scoped key exists.
- Account-scoped Product count matches approved expected count.
- Products render from the scoped key for the target account.
- Another account does not see the target account Products.
- Console errors = 0.
- Page exceptions = 0.

## Future Failure Handling

If any validation fails:

- Stop immediately.
- Do not delete global data.
- Do not continue Product CRUD.
- Record failure evidence.
- Restore from the pre-migration backup only if a write already occurred to the scoped key and rollback is required.

## Files Likely Involved In Future Implementation

Likely future source areas:

- `src/modules/products/Product.ts`
- `src/modules/products/factories/ProductFactory.ts`
- `src/modules/products/repositories/ProductRepository.ts`
- `src/modules/products/services/ProductService.ts`
- `src/core/Container.ts`
- Possibly a small Product persistence compatibility helper under the Product module.

Files that should likely remain unchanged unless new evidence proves otherwise:

- `src/core/persistence/LocalStorageDriver.ts`
- `src/core/repositories/Repository.ts`
- `src/modules/auth/firebase/*`
- `src/modules/auth/AuthRouteGuard.ts`

## Why This Must Be Separate From Product CRUD

Product CRUD creates, edits, and deletes data.

If CRUD starts before the account boundary exists, it will create more global records without ownership metadata and make migration less reliable.

The account-scoped persistence compatibility layer must therefore precede CRUD.
