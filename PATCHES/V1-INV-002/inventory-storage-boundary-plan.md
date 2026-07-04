# V1-INV-002 Inventory Storage Boundary Plan

## Mission

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

## Authoritative Storage Boundary

Recommended authoritative key:

```text
stockMovements:{accountId}
```

Rules:

- `accountId` must come from `AuthSession.account.id`.
- Firebase UID must not be used as `accountId`.
- Provider user id must not be used as `accountId`.
- Default account fallback is forbidden.
- Reads and writes must fail safely when authenticated account context is unavailable.

## Optional Future Cache Boundary

Optional derived/cache key:

```text
inventorySnapshots:{accountId}
```

Rules:

- Snapshot is rebuildable from `stockMovements:{accountId}`.
- Snapshot must never be the only source of truth unless a future owner/architect decision changes the model.
- Snapshot rebuild verification is required before relying on it for invoice or dashboard workflows.

## Rejected Storage Options

### Product Stock Fields Inside `products:{accountId}`

Rejected as authoritative source.

Reason:

- Product edit and stock movement semantics would become coupled.
- Direct quantity mutation is hard to audit.
- Invoice deductions and returns need business references.
- Corrections and voids need explainable history.

### Global `stockMovements`

Rejected.

Reason:

- Violates the V1 `accountId` data boundary.
- Creates cross-account visibility risk.

### Firebase UID / Provider User Scoped Keys

Rejected.

Reason:

- The project constitution and Auth sequence preserve `accountId` as the V1 account/workspace boundary.
- `providerUserId === accountId` is explicitly forbidden.

### Snapshot-Only `inventory:{accountId}`

Rejected as authoritative source.

Reason:

- Snapshot-only storage cannot explain how stock changed.
- Data correction, returns, and invoice cancellation require event history.

## Proposed Future Persistence Functions

Future repository/service boundaries should support:

```text
allForAccount(accountId)
findForAccount(accountId, movementId)
appendForAccount(accountId, movement)
voidForAccount(accountId, movementId, voidMetadata)
allForProduct(accountId, productId)
currentQuantityForProduct(accountId, productId)
currentQuantitiesForAccount(accountId)
```

Write policy:

- Append-first for new movements.
- Void/reversal instead of deletion.
- No hard delete for normal business correction.

## No-Data-Loss Policy

Future Inventory implementation must:

- Not mutate Product records during ledger introduction.
- Not delete Product `quantity` or `minimumQuantity`.
- Not delete or mutate `localStorage.products`.
- Not mutate existing `products:{accountId}` records.
- Create backups before any future migration.
- Keep ledger introduction independent from invoice implementation.

## Rollback Plan For Future Implementation

If a future Inventory implementation regresses:

1. Stop before invoice integration.
2. Preserve existing Products.
3. Preserve legacy Product fields.
4. Remove or ignore the new `stockMovements:{accountId}` key only if the rollback plan for that future mission explicitly allows it.
5. Prefer disabling new Inventory writes over deleting data.
6. Restore from backup if a future migration was explicitly approved and performed.

## Verification Gates For Future Implementation

Future implementation must verify:

- TypeScript PASS.
- Build PASS.
- Runtime PASS.
- Console errors = 0.
- Page exceptions = 0.
- Authenticated accountId exists.
- `stockMovements:{accountId}` is used.
- No Firebase UID/provider user id as accountId.
- No default account fallback.
- No Product data mutation during ledger initialization.
- Legacy Product key remains unchanged.
- Movement append preserves previous movements.
- Voided movement remains stored but is excluded from current quantity.
- Current quantity is computed from non-voided movements only.
