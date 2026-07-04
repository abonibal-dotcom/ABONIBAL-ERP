# V1-INV-001 Inventory / Stock Foundation Baseline

## Mission

`V1-INV-001 - Inventory / Stock Foundation Baseline`

## Classification

INF.

This is an assessment and documentation mission only.

## Accepted Baseline

- Baseline tag: `ecs-011-product-module-regression-baseline`
- Branch: `v1/inv-001-inventory-stock-foundation-baseline`
- Accepted Product foundation: Route Guard, explicit `accountId`, account-scoped Product persistence, Product Read/Create/Edit/Safe Delete/Search regression PASS.

## A. Current Inventory State

| Question | Result | Evidence |
| --- | --- | --- |
| Inventory / Stock module exists | No | `src/modules` contains `auth` and `products` only. |
| Inventory route exists | No | `src/router/routes.ts` registers `dashboard`, `login`, and `products` only. |
| Inventory UI exists | No active UI | No Inventory page exists. `src/modules/products/dialogs/tabs/InventoryTab.ts` exists but is empty and not wired into the active `ProductDialog`. |
| Stock service/repository exists | No | No stock, inventory, warehouse, movement, or invoice service/repository files were found. |
| Stock storage key exists | No | Runtime storage snapshot observed zero inventory/stock/warehouse/movement keys. |
| Product records contain stock fields | Product model contains stock-related fields | `Product` includes `quantity` and `minimumQuantity`; `ProductFactory` defaults both to `0`. Runtime profile had zero stored Product records, so no existing runtime Product record fields were available to inspect. |
| Invoice code expects stock behavior | No | No invoice module or invoice source files were found. |

## B. Product Dependency Analysis

### Accepted Product State

The Product module is accepted through ECS-011 as a runtime-regressed dependency:

- Route Guard active.
- Authenticated account context required.
- Product reads and writes use `products:{accountId}`.
- Product create/edit/safe-delete/search passed runtime regression.
- Legacy `localStorage.products` is preserved and not used as the active account-scoped source.

### Storage Key Strategy

Products are stored per account:

```text
products:{accountId}
```

The current Product repository still knows the legacy key:

```text
products
```

but normal account-scoped Product reads use the scoped key.

### Product Fields Available For Inventory

Product contains these stock-adjacent fields:

- `quantity`
- `minimumQuantity`

The current factory sets both to `0`. The active create/edit dialog only accepts:

- `name`
- `englishName`
- `sku`
- `barcode`

Therefore stock fields exist in the Product shape but are not currently governed by stock operations, stock adjustment rules, stock movement history, invoice deduction, returns, corrections, or audit semantics.

### Product Id Stability

Product id is stable enough for future stock references:

- Product ids are generated once by `ProductFactory`.
- Edit preserves the same Product id.
- Safe delete preserves the same Product id.
- ECS-011 verified identity preservation across edit and safe delete.

### Safe Delete Impact

Safe delete should not remove historical Product references.

Future stock and invoice records should be allowed to reference deleted Products by id for auditability. Deleted Products should remain hidden from active selection by default, but historical stock movements and invoice lines must remain explainable.

## C. Recommended Inventory Model

### Option 1: Store Quantity Directly On Product

Summary:

Use `Product.quantity` as the authoritative stock count.

Pros:

- Lowest implementation complexity.
- Existing table already renders `product.quantity`.
- Product model already includes the field.

Cons:

- Weak auditability.
- Cannot naturally explain corrections, returns, invoice deductions, or stock adjustments.
- High risk of silent overwrite during edit flows.
- Product edit and stock adjustment become coupled.
- Harder rollback and investigation after incorrect stock changes.

Assessment:

Not safe as the authoritative V1 stock model.

### Option 2: Separate Inventory Snapshot Records

Summary:

Store one current stock snapshot per Product, separate from Product records.

Pros:

- Keeps Product identity separate from stock state.
- Can be account-scoped.
- Easier to query current stock than a pure ledger.

Cons:

- Still weak auditability if used alone.
- Requires additional logic to explain how a quantity changed.
- Can drift from invoice/adjustment events unless every write is carefully controlled.

Assessment:

Useful as a future read model, but not sufficient as the authoritative source.

### Option 3: Stock Movement Ledger With Computed Current Quantity

Summary:

Store append-only stock movements and compute current quantity from movement history.

Example movement types:

- opening balance
- purchase / inbound
- adjustment increase
- adjustment decrease
- invoice deduction
- return
- correction / reversal

Pros:

- Best auditability.
- Supports invoices, returns, corrections, and adjustments.
- Preserves history when Product is safely deleted.
- Compatible with account-scoped persistence.
- Reduces risk of silent Product quantity overwrites.

Cons:

- More implementation work.
- Requires movement validation rules.
- May later need a cached snapshot for fast reads.

Assessment:

Recommended V1-safe direction.

## D. Storage Boundary Recommendation

### Compared Options

| Option | Assessment |
| --- | --- |
| `inventory:{accountId}` | Broad name, but ambiguous whether it stores snapshots, movements, or both. |
| `stockMovements:{accountId}` | Clear authoritative movement ledger boundary. Recommended for V1. |
| Product stock fields inside `products:{accountId}` | Not recommended as authoritative stock because Product edit flows and stock operations would be coupled. |
| Mixed snapshot + ledger model | Good future architecture if the ledger remains authoritative and snapshots are derived/cache data. |

### Recommendation

Use:

```text
stockMovements:{accountId}
```

as the authoritative V1 Inventory persistence boundary.

If a snapshot is later required for read performance, use a separate derived/cache key such as:

```text
inventorySnapshots:{accountId}
```

The snapshot must not become the only source of truth unless explicitly approved.

## E. Risk Assessment

| Risk | Level | Reason |
| --- | --- | --- |
| Storing quantity directly on Product | HIGH | Easy to overwrite and weak auditability for invoice deduction, returns, and corrections. |
| Using a stock movement ledger | MEDIUM | More design and implementation work, but safer for ERP correctness. |
| Implementing invoices before Inventory | HIGH | Invoice stock deduction would lack an approved stock boundary and audit model. |
| Implementing Inventory before account-scoped boundary | HIGH | Would risk cross-account stock visibility and data mixing. |
| Cross-account stock visibility | HIGH | Stock data must be scoped by explicit `accountId`; Firebase UID/provider user id must not be used. |
| Data-loss risk | MEDIUM | Ledger design reduces data-loss risk; direct Product quantity mutation increases it. |
| Implementation complexity | MEDIUM | Ledger model requires movement types, validation, account boundary, and runtime verification. |

## F. Recommended Next Mission

Recommended next mission:

```text
V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan
```

Objective:

Define the Inventory movement contract, storage boundary, movement types, validation rules, Product reference behavior, safe-delete reference policy, and verification gates before implementing stock writes.

Invoice work should not proceed yet.

Inventory implementation is required before invoice stock deduction.
