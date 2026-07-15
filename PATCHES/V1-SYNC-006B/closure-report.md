# V1-SYNC-006B Closure Report

## Mission

- Mission: V1-SYNC-006B - StockMovement Void-to-Reversal Domain Alignment
- Classification: Domain Refactor / Inventory Ledger Immutability / Sync Preparation
- Base tag: `v1-sync-006a-stock-movement-void-reversal-architecture-alignment-plan`
- Branch: `v1/sync-006b-stock-movement-void-to-reversal-domain-alignment`
- Execution boundary: local domain only

## Changed Files

Runtime and focused test files:

- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/StockMovementType.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`
- `src/modules/inventory/repositories/StockMovementRepository.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/pages/InventoryPage.ts`
- `scripts/v1-sync-006b-stock-movement-reversal-smoke.ts`

Mission documentation:

- `PATCHES/V1-SYNC-006B/domain-refactor.md`
- `PATCHES/V1-SYNC-006B/legacy-compatibility-validation.md`
- `PATCHES/V1-SYNC-006B/reversal-validation.md`
- `PATCHES/V1-SYNC-006B/closure-report.md`

No Firebase, Container, Product, Invoice, InvoiceReturn, Purchase, Payment,
Expense, Cash, or Ledger source file changed.

## Old Mutable Void Removal

`StockMovementRepository.voidForAccount()` was removed. The repository no
longer inherits a public `clear()` hard-delete path and exposes only account
scoped append/read/find/list/reversal-query operations. Existing records cannot
be updated through its API.

`InventoryService.voidMovement()` remains for caller compatibility but delegates
to `reverseMovement()` and never mutates the original.

## New Reversal Behavior

All newly created movements use immutable semantics version `2`. A generic void
of an eligible movement appends one type `reversal` record with:

- same account and product;
- exact opposite `quantityDelta`;
- `referenceType: movement_reversal`;
- `referenceId` and `reversalOfMovementId` pointing to the original;
- required `reversalReason`;
- deterministic ID `reversal-{originalMovementId}`;
- idempotency key `stockMovement:reverse:{originalMovementId}`;
- creation actor/time and immutable audit metadata.

The original remains byte/domain-equivalent. Reversal-of-reversal is rejected.
Direct reversal creation through `addMovement()` is rejected.

## Double Reversal Protection

- deterministic identity: PASS;
- exact retry returns existing reversal: PASS;
- changed retry conflicts: PASS;
- concurrent-like two-service attempt creates one effect: PASS;
- more than one reversal detected as failure;
- same repository ID with different payload conflicts;
- second inventory effect created: `0`.

## Legacy Compatibility

Legacy normal, legacy voided, V2 normal, and V2 reversal records are read
together. A legacy record with `voidedAt` retains zero effect. No old record is
rewritten or version-stamped on read, and a legacy-voided record cannot receive
a new baseline reversal.

- legacy records rewritten: `0`;
- synthetic legacy reversals created: `0`;
- legacy IDs changed: `0`;
- legacy void fields removed: `0`;
- historical derived quantity change: `0`.

## Derived Quantity

The reducer sums immutable ledger effects while preserving legacy void
suppression. Positive and negative reversal pairs both net to zero. The mixed
legacy/V2 test produced expected quantity `10` through both quantity APIs with
zero storage writes. `Product.quantity` remains non-authoritative.

## Domain Boundaries

- opening stock creation/retry/reversal: PASS;
- invoice issue and `sale_deduction`: PASS;
- invoice return and `sale_return`: PASS;
- generic reversal of Sales-owned movement: rejected;
- Product legacy quantity unchanged in Sales regression: PASS;
- Purchase inventory effects: none in accepted baseline;
- distributed transaction added: NO.

## UI Behavior

Inventory history shows originals and reversals as separate rows, exposes the
original reference/reason, derives a `reversed` state for the original, and
retains legacy void display. No hard delete was added. TypeScript and production
build validate the page changes. No authenticated browser session or deployment
was used in this local domain-refactor mission.

## Validation

- `git diff --check`: PASS
- TypeScript (`pnpm exec tsc --noEmit`): PASS
- Build (`pnpm run build`): PASS
- Build note: existing bundle-size warning only
- V1-SYNC-006B focused smoke: PASS, 14/14
- V1-SYNC-004 foundation smoke: PASS, 18/18
- V1-SYNC-004A durable-capture smoke: PASS, 26/26
- V1-SYNC-005 master-data smoke: PASS, 31/31
- original immutability: PASS
- deterministic/idempotent reversal: PASS
- double reversal prevention: PASS
- legacy derived quantity compatibility: PASS
- SyncMode default: `disabled`

## Cloud And Data Safety

- StockMovement Firebase sync implemented: NO
- operational StockMovement RTDB writes: `0`
- operational StockMovement RTDB listeners: `0`
- existing StockMovement records uploaded: `0`
- migration/backfill: NONE
- local operational data directly modified: NO
- Firebase rules/config changed: NO
- Firebase deployment: NO
- production touched: NO

## Final Result

V1-SYNC-006B READY FOR ARCHITECT REVIEW
