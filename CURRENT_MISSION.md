# Current Mission

## Mission

`V1-SALES-003 - Account-Scoped Invoice Persistence Baseline`

## Classification

`ECS`

This is the first Sales / Invoice persistence implementation mission.

This is not invoice UI implementation, invoice route implementation, invoice stock deduction, Product CRUD, Inventory mutation, Auth work, Route Guard work, or localStorage migration.

## Objective

Implement the minimal account-scoped Invoice persistence baseline using:

```text
invoices:{accountId}
```

The mission proves:

- Invoices are stored account-scoped.
- Invoice records include `accountId`.
- Invoice records support `draft`, `issued`, and `cancelled` lifecycle states at model/service level.
- Invoice lines can store Product snapshot data.
- Invoice persistence does not mutate Products.
- Invoice persistence does not mutate Inventory.
- No stock deduction is performed.
- No invoice UI is added.

## Accepted Baseline

- Baseline tag: `v1-sales-002-account-scoped-invoice-persistence-design-plan`.
- Firebase Auth.
- Explicit `accountId`.
- Route Guard.
- Account-scoped Products.
- Product regression PASS through ECS-011.
- Stock Movement Ledger and availability gate PASS through V1-INV-007.
- V1-SALES-001 confirmed no invoice implementation existed.
- V1-SALES-002 accepted the invoice persistence design.

## Current Status

`V1-SALES-003 Ready for Architect / Owner Review`

## Implementation Result

- Added `src/modules/sales/` invoice model, status, persistence key, repository, validator, and service.
- Registered invoice repository, validator, and service in `Container`.
- Storage key: `invoices:{accountId}`.
- Service methods: `getAll`, `getById`, `createDraft`, `updateDraft`, `markIssued`, and `markCancelled`.
- `createDraft` stores account id, createdBy, invoice number, draft status, line snapshots, and totals.
- `updateDraft` updates draft metadata without changing account id.
- `markIssued` sets issued status and issue metadata without stock movements.
- `markCancelled` sets cancellation status and metadata without hard delete.

## Verification Completed

- Pre-check: PASS.
- Document read: PASS.
- Source inspection: PASS.
- TypeScript: PASS.
- Build: PASS.
- Runtime verification: PASS.
- Console errors: 0.
- Page exceptions: 0.

## Scope Confirmation

- No invoice UI added.
- No invoice route added.
- No invoice create/edit/delete screen added.
- No invoice stock deduction added.
- No `sale_deduction` movements created.
- No `stockMovements:{accountId}` mutation.
- No Product records mutated.
- `Product.quantity` not updated.
- No Product CRUD behavior changed.
- No Inventory behavior changed.
- No Auth behavior changed.
- Route Guard not weakened.
- No localStorage migration.
- No Firebase UID or provider user id as `accountId`.
- No default account fallback.
- No credentials committed.
- `.env` remains untracked.

## Evidence

```text
PATCHES/V1-SALES-003/verification.md
PATCHES/V1-SALES-003/closure-report.md
outputs/V1-SALES-003/runtime.json
outputs/V1-SALES-003/dom.json
outputs/V1-SALES-003/console.log
outputs/V1-SALES-003/storage-snapshot-sanitized.json
outputs/V1-SALES-003/screenshot.png
outputs/V1-SALES-003/invoice-persistence-summary.json
```

## Next

Recommended next mission:

`V1-SALES-004 - Invoice Draft Create / Update Flow`

Do not start invoice UI or invoice stock deduction until V1-SALES-003 is reviewed and accepted.
