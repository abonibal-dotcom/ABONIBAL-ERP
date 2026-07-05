# ABONIBAL ERP Version 1.0 Roadmap

## Roadmap Status

This is the official Version 1.0 roadmap baseline for repository governance.

ECS-006 Product List Read Path is complete from execution side and ready for Architect / Owner review.

Product-code work resumed only after the approved Auth / Route Guard foundation reached the accepted V1-AUTH-015 baseline.

## V1 Definition

Version 1.0 is a stable daily-operation ERP foundation, not a full enterprise suite.

V1 must prioritize reliable business operation, data safety, basic auditability, and predictable runtime behavior over breadth of features.

## Owner Decisions Locked For V1

- V1 must support more than one user.
- Product images are optional in V1.
- V1 must prevent selling unavailable stock.
- V1 supports basic discounts.
- Tax rules are deferred unless legally or business required.
- V1 includes a basic auditable ledger.
- Full double-entry accounting is deferred unless later approved.
- V1 sync scope is data safety and no silent overwrite.
- Advanced conflict resolution is V2.
- V1 reports are basic only.
- V1 uses `accountId` as the account/workspace data boundary.
- V1 uses Managed Auth direction.
- V1 uses Firebase Auth as the concrete Managed Auth provider.
- V1 role model is limited to `owner` and `user`.
- Existing global localStorage data must not be deleted automatically.

## V1 Scope

V1 includes:

- Foundation reliability.
- Persistence safety.
- Auth / multi-user foundation.
- Products.
- Inventory.
- Clients.
- Suppliers.
- Sales / invoices.
- Expenses.
- Safes / cash movement.
- Basic auditable ledger.
- Data safety / no silent overwrite.
- Basic dashboard.
- Basic reports.

## V2 Deferred Scope

The following are deferred to V2 unless the owner or architect changes the roadmap:

- Advanced roles.
- Permission matrix.
- Advanced admin console.
- Multi-branch support.
- Full advanced accounting.
- Advanced analytics.
- Advanced reports.
- Advanced import/export.
- Full UI redesign.
- Large refactors.
- Advanced sync conflict automation.
- Advanced product image flow.

These items do not block V1 because V1 must first prove stable daily operation, data safety, and core business correctness.

## Implementation Order

1. Repository Governance & Baseline Lock.
2. Foundation Verification.
3. Persistence Safety.
4. Auth / Multi-user Foundation.
5. Products.
6. Inventory.
7. Clients / Suppliers.
8. Sales / Invoices.
9. Expenses.
10. Safes / Cash.
11. Basic Ledger.
12. Sync / Data Safety.
13. Dashboard / Basic Reports.
14. V1 Release Candidate.

## Dependency Graph

Foundation Verification

-> Persistence Safety

-> Auth / Multi-user Foundation

-> Products

-> Inventory

-> Clients / Suppliers

-> Sales / Invoices

-> Expenses

-> Safes / Cash

-> Basic Ledger

-> Sync / Data Safety

-> Dashboard / Basic Reports

-> V1 Release Candidate

## First Execution Candidate After Governance Integration

The first mission after V1-INF-002 should not automatically be Products.

The next candidate should be selected from Foundation Verification, Persistence Safety, or Auth / Multi-user Foundation based on evidence and owner approval.

ECS-006 was explicitly approved by the owner and executed after the accepted V1-AUTH-015 Route Guard foundation baseline.

## Auth / Multi-user Foundation Gate

Before Products or other business modules continue, V1 must approve and implement the minimum Auth foundation:

- User identity.
- Session state.
- Protected business routes.
- Account/workspace data boundary.
- Record ownership metadata.
- Runtime user/account isolation verification.

Auth provider direction is Managed Auth.

`accountId` boundary is required before business modules become user-safe.

Advanced roles and permission matrix are V2.

localStorage migration is not automatic and must be a separate ECS with runtime evidence, no-data-loss plan, rollback plan, and owner / architect approval.

Product-code work may proceed only through owner-approved missions after the accepted Auth / Route Guard foundation baseline.

## Planned Auth Foundation Sequence

The concrete Managed Auth provider is approved.

Approved provider:

`Firebase Auth`

Recommended next Auth sequence:

1. `V1-AUTH-006 - Managed Auth Dependency & Config Skeleton`.
2. `V1-AUTH-007 - Managed Auth Provider Adapter`.
3. `V1-AUTH-008 - Auth State Service`.
4. `V1-AUTH-009 - AccountId / Auth Session Resolution Baseline`.
5. `V1-AUTH-010 - Account Mapping Source Baseline`.
6. `V1-AUTH-011 - Login / Logout Minimal Flow`.
7. `V1-AUTH-012 - Account Mapping Runtime Source Decision`.
8. `V1-AUTH-013 - Firebase Account Mapping Source Implementation`.
9. `V1-AUTH-014 - Authenticated Session Runtime Verification`.
10. `V1-AUTH-015 - Route Guard Foundation`.
11. `V1-AUTH-016 - Protected Route Runtime Verification`.
12. `V1-AUTH-017 - Legacy Storage Compatibility Plan`.
13. `V1-AUTH-018 - Account-scoped Persistence Planning`.

Sequencing decision:

`V1-AUTH-009` is no longer Login / Logout Minimal Flow.

Login / Logout must occur after account/session resolution because `FirebaseAuthProvider` must not assume `firebaseUser.uid === accountId`, and the project must preserve `accountId` as the official V1 data boundary before user-facing authentication flow work begins.

`V1-AUTH-010` is Account Mapping Source Baseline, not Login / Logout Minimal Flow.

Login / Logout must also occur after a safe source exists for resolving provider identity into account identity, `accountId`, and V1 role.

`V1-AUTH-012` is Account Mapping Runtime Source Decision, not Route Guard Foundation.

Route Guard must occur only after account mapping source decision, Firebase account mapping source implementation, and authenticated session runtime verification.

Owner-approved V1 runtime mapping source is Firebase-backed account mapping.

The official V1 mapping source must return explicit provider, providerUserId, accountId, accountName, userId, displayName, and role data. It must not use providerUserId as accountId, default owner fallback, one global account, hardcoded production mappings, or local-only mappings as the official runtime source.

`V1-AUTH-013` implements the Firebase-backed account mapping source. Live authenticated-session runtime verification remains `V1-AUTH-014`.

Product-code work resumed through ECS-006 after owner approval and the accepted V1-AUTH-015 Route Guard foundation baseline.

## Product Persistence Boundary Gate

V1-PER-003 assessed Product persistence after ECS-006.

Current Product persistence uses the global localStorage key `products`.

Current Product records do not contain `accountId`, `createdBy`, or `updatedBy`.

Product reads and existing write methods do not currently receive account context.

Recommended next Product persistence step:

`V1-PER-004 - Product Account-scoped Persistence Plan`

Product Create/Edit/Delete should wait for an approved Product account-scoped persistence plan and no-data-loss compatibility strategy.

V1-PER-004 recommends the next implementation mission:

`V1-PER-005 - Product Account-Scoped Persistence Compatibility Layer`

The recommended strategy is to preserve `localStorage.products`, write new scoped Products to `products:{accountId}`, and migrate legacy global Products only through an owner-approved no-data-loss flow.

V1-PER-005 implemented the compatibility layer. Normal Product reads and writes now use `products:{accountId}` from the authenticated account boundary, while legacy `localStorage.products` remains preserved and unmigrated.

V1-PER-006 implemented the owner-approved controlled legacy Product import into `products:{accountId}` with backup, duplicate handling, ownership metadata, and legacy key preservation.

ECS-007 implemented the minimal Product Create path on top of the accepted account-scoped Product persistence foundation.

ECS-008 implemented the minimal Product Edit path on top of the accepted account-scoped Product persistence foundation.

ECS-009 implemented the minimal Product Safe Delete path on top of the accepted account-scoped Product persistence foundation.

ECS-010 implemented the minimal Product Search / Filter path on top of the accepted account-scoped Product persistence foundation.

ECS-011 created the Product module runtime regression baseline across read, create, edit, safe delete, search/filter, account-scoped persistence, legacy key preservation, and Route Guard behavior.

V1-INV-001 assessed the Inventory / Stock foundation and confirmed that no standalone Inventory module, route, stock service, stock repository, stock movement model, invoice module, or stock storage boundary exists yet.

Inventory should proceed through an account-scoped stock movement ledger design before invoice stock deduction work.

Recommended next Inventory mission:

`V1-INV-002 - Account-Scoped Stock Movement Ledger Design Plan`

V1-INV-002 designed the account-scoped Stock Movement Ledger as the authoritative Inventory model, with `stockMovements:{accountId}` as the target storage boundary and `inventorySnapshots:{accountId}` reserved as an optional rebuildable cache.

Recommended next Inventory mission:

`V1-INV-003 - Stock Movement Ledger Persistence Baseline`

V1-INV-003 implemented the minimal account-scoped Stock Movement Ledger persistence baseline with `stockMovements:{accountId}`, movement validation, append, current quantity computation, non-destructive void behavior, and runtime verification.

Recommended next Inventory mission:

`V1-INV-004 - Stock Movement Append / Current Quantity Runtime Verification`

V1-INV-004 verified Stock Movement Ledger runtime behavior across valid appends, invalid rejection, malformed record tolerance, multi-product current quantity computation, other-account isolation, non-destructive void behavior, reload persistence, and Product storage safety without requiring a source fix.

Recommended next Inventory mission:

`V1-INV-005 - Manual Opening Balance / Adjustment Flow`

V1-INV-005 implemented the minimal authenticated manual Inventory movement flow for opening balance and manual adjustment, using `stockMovements:{accountId}` through the accepted ledger service.

Recommended next Inventory mission:

`V1-INV-006 - Inventory Movement History / Current Stock View`

V1-INV-006 implemented the minimal read-only Inventory movement history and current stock view on top of `stockMovements:{accountId}`.

Recommended next Inventory mission:

`V1-INV-007 - Inventory Stock Availability / Invoice Dependency Gate`

V1-INV-007 implemented the minimal read-only Inventory stock availability gate for future invoice dependency checks. The gate uses the ledger as the stock source of truth and rejects unavailable, invalid, missing, and soft-deleted Product requests safely.

Invoice implementation proceeded through owner-approved Sales / Invoice missions after the accepted Inventory availability gate.

The next Product, Inventory, or Invoice mission may proceed only after V1-INV-007 is reviewed and accepted by the Architect / Owner.

## Sales / Invoice Foundation Gate

V1-SALES-001 assessed the current Sales / Invoice foundation after the accepted Inventory stock availability gate.

Current finding:

- No Sales / Invoice module exists.
- No invoice route or UI exists.
- No invoice service, repository, persistence key, or storage boundary exists.
- No invoice or sales storage keys were observed during read-only runtime verification.
- Products are ready to serve as invoice line references.
- Inventory stock availability is ready to serve as the future invoice confirmation dependency.

Recommended next Sales / Invoice mission:

`V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan`

Invoice UI and invoice stock deduction remain blocked until account-scoped invoice persistence, invoice lifecycle, invoice numbering, Product snapshot policy, and stock deduction dependency are planned and approved.

V1-SALES-002 completed the account-scoped invoice persistence design plan.

Accepted design direction:

- Future invoice storage boundary: `invoices:{accountId}`.
- Global `invoices` storage is rejected.
- Firebase UID/provider user id scoped invoice storage is rejected.
- Default account fallback is rejected.
- Future V1 invoice lifecycle states: `draft`, `issued`, `cancelled`.
- Future invoice numbering policy: account-scoped date prefix plus local sequence with collision checks.
- Future invoice lines must reference stable Product ids and store Product snapshot fields.
- Future invoice issue flow must call the accepted Inventory availability gate before stock deduction.
- Future stock deduction must create `sale_deduction` movements and must not edit `Product.quantity`.

Recommended next Sales / Invoice mission:

`V1-SALES-003 - Account-Scoped Invoice Persistence Baseline`

Invoice UI and invoice stock deduction remain blocked until the account-scoped invoice persistence baseline is approved and verified.

V1-SALES-003 implemented the minimal account-scoped Invoice persistence baseline.

Accepted implementation result:

- Invoice module exists under `src/modules/sales/`.
- Invoice storage boundary: `invoices:{accountId}`.
- Invoice records include `accountId`, ownership metadata, lifecycle fields, totals, and lines.
- Invoice lines store Product snapshot fields.
- Repository/service methods are account-scoped.
- `createDraft`, `updateDraft`, `markIssued`, and `markCancelled` are available at service level.
- `markIssued` does not create stock movements in this baseline.
- No invoice UI or invoice route exists yet.
- No invoice stock deduction exists yet.
- Product and Inventory data remain unmutated by invoice persistence.

Recommended next Sales / Invoice mission:

`V1-SALES-004 - Invoice Draft Create / Update Flow`

V1-SALES-004 implemented the first minimal authenticated Invoice draft create/update flow.

Accepted implementation result:

- Protected `invoices` route exists.
- Minimal Invoice draft UI exists.
- Draft create and update use the accepted `InvoiceService` and `invoices:{accountId}` boundary.
- Active Products can be selected and soft-deleted Products are excluded.
- Invoice lines store Product snapshot data.
- Draft totals are computed and persisted.
- Reload preserves the draft invoice.
- No invoice issue behavior, cancellation UI, stock deduction, or `sale_deduction` movement exists yet.
- Product and Inventory data remain unmutated by invoice draft create/update.

V1-SALES-005 implemented the minimal Invoice issue / stock deduction flow.

Accepted implementation result:

- Draft issue with insufficient stock is blocked without writing `sale_deduction`.
- Successful issue creates `sale_deduction` movements through `InventoryService`.
- Invoice lines store the created movement id as `stockMovementId`.
- Available stock decreases through the accepted Stock Movement Ledger.
- Duplicate issue attempts do not duplicate stock movements.
- Product records remain unchanged and `Product.quantity` is not authoritative.
- No invoice cancellation, return, or hard delete behavior exists yet.

V1-SALES-006 implemented minimal issued invoice read / stock deduction audit visibility.

Accepted implementation result:

- Issued invoice remains visible after reload.
- Issued invoice status, number, total, and issuedAt are displayed.
- Invoice line Product snapshot, quantity, unit price, line total, and `stockMovementId` are displayed.
- The referenced `sale_deduction` movement can be verified against the invoice line, Product id, accountId, and negative quantityDelta.
- Duplicate issue attempts do not duplicate stock movements.
- Product records remain unchanged and `Product.quantity` is not authoritative.
- No invoice cancellation, return, reversal, or hard delete behavior exists yet.

V1-SALES-007 designed the V1 invoice cancellation and stock reversal policy.

Accepted design recommendation:

- Issued invoice cancellation should be audit-preserving.
- V1 cancellation transition should be `issued -> cancelled`.
- Cancellation should set `cancelledAt`, `cancelledBy`, and `cancelReason`.
- Original invoice id, invoice number, accountId, issued data, totals, and Product snapshot lines must remain preserved.
- Original `sale_deduction` movements must not be deleted or used as mutable stock correction.
- Cancellation should append positive `sale_return` movements with `referenceType: "invoice_return"`.
- Reversal movements should link to the original `sale_deduction`, invoice, and invoice line through metadata and optional future invoice-line reversal ids.
- Duplicate cancellation must be prevented by checking existing reversal movements by original deduction id.
- Product records remain unchanged and `Product.quantity` remains non-authoritative.
- Returns remain deferred until cancellation and stock reversal implementation is accepted.

Recommended next Sales / Invoice mission:

`V1-SALES-008 - Invoice Cancellation / Stock Reversal Implementation`.

## Verification Expectation

Each future ECS must include:

- Pre-check.
- Baseline evidence.
- Root cause confirmation.
- Minimal scope.
- TypeScript verification.
- Build verification.
- Runtime verification.
- Evidence package.
- Documentation updates.
- Commit.
- Tag.
- Push.
- Closure report.
