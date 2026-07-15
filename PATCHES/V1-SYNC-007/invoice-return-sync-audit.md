# V1-SYNC-007 Invoice Return Sync Audit

## Scope

This document records the current InvoiceReturn behavior and the gaps that must be resolved before Firebase synchronization. No implementation was performed.

Reviewed sources:

- `src/modules/sales/InvoiceReturn.ts`
- `src/modules/sales/InvoiceReturnStatus.ts`
- `src/modules/sales/repositories/InvoiceReturnRepository.ts`
- `src/modules/sales/services/InvoiceReturnService.ts`
- `src/modules/sales/validators/InvoiceReturnValidator.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`

## Current Persistence and Lifecycle

- Local key: `invoiceReturns:{accountId}`.
- Repository storage: one local array per account.
- Statuses: `recorded`, `executed`.
- Create: one recorded InvoiceReturn with random return/line IDs and a local daily number.
- Execute: N positive `sale_return` movements followed by an update to `executed` with movement references.
- Hard delete: no repository or service operation.
- Void/cancel: no implemented service transition or status, although optional void audit fields exist in the model.
- Cloud capability/transport/applier: absent.

The current UI creates one-line return records and immediately executes them. The service and entity support multiple lines.

## Return Record Snapshot

Each return stores:

- Invoice ID and Invoice number snapshot;
- return reason and notes;
- original Invoice line ID;
- Product ID and Product name snapshot;
- original sold quantity;
- unit price and line total snapshots;
- requested return quantity;
- original sale deduction movement reference;
- resulting return movement reference after execution.

The original Invoice is not mutated by return creation or execution. It does not gain `partially_returned` or `returned` status.

## Partial and Multiple Returns

Partial returns are supported. Multiple independent InvoiceReturn records for one issued Invoice are also supported until the cumulative quantity reaches the sold quantity.

`getReturnedQuantity` sums all persisted return lines for the Invoice line, including both `recorded` and `executed` records. Therefore a recorded return behaves as a local quantity reservation. There is no void transition that releases this reservation.

## Current Quantity Validation

Creation requires:

- an issued Invoice;
- valid Invoice line reference;
- original deduction reference;
- positive return quantity;
- requested quantity not exceeding local remaining quantity.

Execution revalidates Invoice status, line/product identity, remaining quantity excluding the current return, original deduction validity, and absence of an existing movement for each return line.

These checks are correct for one current local cache, but they are not a multi-device concurrency guarantee.

## Concurrent Over-Return Risk

Two devices can each hold a stale view of remaining quantity. For sold quantity 10, Device A and Device B can each record return quantity 6. Both are locally valid, but the combined quantity is 12.

Client validation and RTDB rules alone cannot safely aggregate arbitrary immutable return records and simultaneously create all inventory effects. Before cutover, return execution must use a trusted transactional commit or equivalent server-authoritative CAS/reservation boundary.

Recommended policy:

- Offline/local creation may remain `recorded` only.
- `executed` requires online canonical validation.
- A trusted transaction validates cumulative accepted quantity per Invoice line.
- The transaction atomically accepts the return record/lifecycle and all `sale_return` movements.
- One concurrent request succeeds; the other becomes an explicit conflict and never uploads stock effects.
- No silent overwrite or automatic quantity reduction is allowed.

## Execute Command Dependency Audit

For a return with N lines, `executeReturn` currently performs:

1. Read recorded return and issued Invoice.
2. Validate all lines against the local Invoice, return records, and StockMovement ledger.
3. Append N random-ID `sale_return` StockMovements sequentially.
4. Replace the InvoiceReturn with `executed` and movement IDs.

No Payment, Customer balance, CashMovement, JournalEntry, or Invoice status update occurs.

## Failure and Retry Gap

The complete execution intent is not durable before the first movement. If some movements are created and the final return update fails, the return remains `recorded` without references.

On retry, `hasExistingReturnMovement` detects the already-created movement as an error instead of adopting it. This can leave the return permanently recorded with a stock effect already present. Random movement IDs also prevent deterministic reconstruction.

This is a blocking lifecycle alignment gap before sync.

## Stable Identity Audit

- InvoiceReturn ID: random but stable after record creation.
- Return line IDs: random but stable after record creation; there is no edit API.
- Return number: local daily sequence, not multi-device safe.
- `sale_return` movement IDs: random, not derived from return/line identity.
- Execute command ID/idempotency key: absent.
- Revision/CAS: absent.

Recommended deterministic movement identity is based on InvoiceReturn ID plus return line ID. Exact retry must produce one logical return and one movement per line; same identity with changed quantity must conflict.

## Account Boundary Finding

`InvoiceReturnService.currentAccountContext` checks authenticated state, logical account ID, and user ID, but unlike InvoiceService and InventoryService it does not verify `session.user.accountId` equals `session.account.id`.

The repository also does not enforce payload account ID against the storage key. Both checks must be aligned before sync. Firebase UID remains membership identity only and must never become account ID.

## Immutability and Void Policy

The current `executed` return is effectively read-only through the service and has no hard-delete path. The model contains `voidedAt`, `voidedBy`, and `voidReason`, but there is no `voided` status or service command. Sync design must not infer or implement a void lifecycle from unused fields.

Recommended contract:

- `recorded` is revisioned only for narrowly approved pre-execution corrections, if owner-approved.
- `executed` freezes commercial data and movement references.
- No hard delete for any recorded/executed return.
- A future void/correction policy requires a separate approved lifecycle mission.

## Recommended Durable Group

For execution:

- stable group ID from InvoiceReturn ID and execute command identity;
- N deterministic `sale_return` append members;
- one `recorded -> executed` lifecycle member;
- all required members captured before the first local mutation;
- local movement members applied before final executed status;
- all cloud capabilities required before dispatch;
- one trusted atomic cloud commit with over-return validation.

Sequential member-by-member cloud visibility is not acceptable for cutover.

## Sync Readiness Result

InvoiceReturn sync is blocked pending:

1. account context alignment;
2. revision/CAS contract;
3. stable execute command and movement IDs;
4. partial-failure recovery/adoption behavior;
5. multi-device-safe return numbering;
6. trusted concurrent over-return prevention;
7. durable complete execution group;
8. atomic Return plus StockMovement cloud visibility.
