# V1-INV-002 Stock Movement Ledger Design Plan

## Mission

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

## Classification

INF.

This is a design-only mission. No source files are changed by this plan.

## Accepted Baseline

- Baseline tag: `v1-inv-001-inventory-stock-foundation-baseline`
- Product module regression: accepted through ECS-011.
- Inventory foundation assessment: accepted through V1-INV-001.
- Current known state: no Inventory module, no Inventory route, no stock service/repository, no stock movement model, no invoice module, and no stock storage boundary.

## Source Inspection Summary

Future Inventory implementation will likely add new files under a future `src/modules/inventory/` boundary, plus registration wiring in `Container` and route registry only when a UI route is explicitly approved.

Existing files that inform the design:

- `src/modules/products/Product.ts`: Product identity and stock-adjacent metadata.
- `src/modules/products/factories/ProductFactory.ts`: default Product stock-adjacent fields.
- `src/modules/products/validators/ProductValidator.ts`: Product validation currently ignores stock semantics.
- `src/modules/products/repositories/ProductRepository.ts`: accepted account-scoped Product persistence pattern.
- `src/modules/products/services/ProductService.ts`: accepted account context boundary and safe-delete behavior.
- `src/modules/products/persistence/ProductPersistenceKey.ts`: accepted `products:{accountId}` key pattern.
- `src/modules/products/pages/ProductListPage.ts`: Product quantity is displayed but not authoritative.
- `src/core/repositories/Repository.ts`: generic repository pattern.
- `src/core/persistence/LocalStorageDriver.ts`: localStorage persistence driver.
- `src/core/Storage.ts`: storage wrapper.
- `src/core/Container.ts`: dependency registration point.
- `src/router/routes.ts`: route registry, currently no Inventory route.
- `src/modules/auth/AuthSession.ts`: session includes account identity.
- `src/modules/auth/AuthState.ts`: authenticated/unauthenticated state.
- `src/modules/auth/AuthRuntime.ts`: AuthStateService access.
- `src/modules/auth/AuthRouteGuard.ts`: protected route boundary.

No invoice, inventory, stock, warehouse, or movement source files were found.

## Recommended Authoritative Inventory Model

Use an account-scoped Stock Movement Ledger as the authoritative V1 Inventory model.

The ledger stores immutable or append-first movement events that explain how stock changed. Current stock is derived from those movements, not from direct Product mutation.

## Movement Record Shape

Proposed V1 record shape:

```ts
interface StockMovement {
  id: string;
  accountId: string;
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  unitCost?: number;
  totalCost?: number;
  currency?: string;
  reason: string;
  referenceType: StockMovementReferenceType;
  referenceId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}
```

Required V1 rules:

- `id` is a stable movement id.
- `accountId` is the authenticated V1 account/workspace boundary.
- `productId` references `Product.id`.
- `type` is constrained to approved movement types.
- `quantityDelta` is signed.
- Positive deltas increase stock.
- Negative deltas decrease stock.
- `reason` is required for manual or correction movements.
- `referenceType` identifies the business source.
- `referenceId` links to an external business record when applicable.
- `createdAt` and `createdBy` are required.
- Voiding should be modeled without deleting the original record.

## Movement Types

Recommended type union:

```ts
type StockMovementType =
  | "opening_balance"
  | "manual_adjustment"
  | "purchase_receipt"
  | "sale_deduction"
  | "sale_return"
  | "purchase_return"
  | "correction"
  | "void";
```

### V1 Now

- `opening_balance`: initial stock quantity for a Product/account.
- `manual_adjustment`: controlled increase/decrease before purchasing/sales modules are complete.
- `correction`: explicit correction with required reason and audit fields.
- `void`: reversal/voiding metadata or paired reversal movement.

### V1 Later, Before Related Modules

- `purchase_receipt`: needed before supplier purchase receiving.
- `sale_deduction`: needed before invoice stock deduction.
- `sale_return`: needed before invoice returns.
- `purchase_return`: needed before supplier return flow.

## Reference Types

Recommended V1 reference type union:

```ts
type StockMovementReferenceType =
  | "manual"
  | "opening_balance"
  | "invoice"
  | "invoice_return"
  | "purchase"
  | "purchase_return"
  | "correction"
  | "void";
```

## Product Quantity Field Policy

V1-INV-001 confirmed Product has:

- `quantity`
- `minimumQuantity`

Policy:

- `Product.quantity` must not be authoritative for V1 Inventory.
- `Product.quantity` may remain legacy/display-compatible until a future migration policy is approved.
- Current stock quantity must be computed from the ledger.
- `Product.minimumQuantity` may remain Product metadata for low-stock alerts.
- Product create/edit flows must not silently update stock quantity.
- Future UI should clearly separate Product metadata from Inventory adjustments.

This avoids two competing sources of truth by declaring:

```text
Authoritative stock = ledger sum
Product.quantity = legacy/display/import-compatible field only
Product.minimumQuantity = Product metadata for alert threshold
```

## Current Quantity Computation

Current stock for a Product/account:

```text
sum(quantityDelta)
where movement.accountId = AuthSession.account.id
and movement.productId = Product.id
and movement is not voided
```

Grouped form:

```text
group stockMovements:{accountId} by productId
sum non-voided quantityDelta
```

## Edge Case Policy

### Deleted / Archived Products

Soft-deleted Products remain referenceable by `productId`.

- Existing movement history remains valid.
- Historical invoice and stock references must remain explainable.
- Deleted Products should be excluded from active Product selection by default.
- Inventory history views may still display deleted Product references.

### Voided Movements

Preferred policy:

- Do not delete movement records.
- Mark a movement voided with `voidedAt`, `voidedBy`, and `voidReason`, or create a paired reversal movement.
- Current stock computation excludes voided movements.
- Audit views should still show voided records.

### Malformed Movement Records

Future implementation should:

- Validate movement records before accepting them.
- Reject malformed writes.
- Treat malformed stored records as verification failures, not silent stock values.
- Prefer safe read handling that does not crash the app, while surfacing corruption in verification evidence.

### Missing Product References

Future implementation should:

- Preserve movements with missing Product references.
- Treat missing Product references as an integrity issue.
- Display a safe placeholder in history views.
- Never delete stock movements just because the Product record is missing.

### Negative Stock Policy

Recommended V1 policy:

- Default: do not allow negative stock for invoice sale deduction.
- Manual adjustment may create negative stock only if the owner explicitly approves this later.
- Any negative stock allowance must be account-scoped, auditable, and runtime verified.

## Future Implementation Boundary

Likely future files:

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/persistence/StockMovementPersistenceKey.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`

Potential future wiring:

- `src/core/Container.ts` for repository/service registration.
- `src/router/routes.ts` only when Inventory UI/route is explicitly approved.

Product files should not be changed to introduce the ledger unless a specific future mission proves a minimal Product integration boundary is required.

## Recommended Next Mission

```text
V1-INV-003 - Stock Movement Ledger Persistence Baseline
```

Expected scope:

- Add the minimum stock movement contracts and persistence key design.
- Add account-scoped repository/service boundary.
- Verify no Product mutation and no invoice integration.
- Keep UI and invoice work blocked.
