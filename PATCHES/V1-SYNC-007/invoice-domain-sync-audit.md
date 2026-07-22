# V1-SYNC-007 Invoice Domain Sync Audit

## Scope

This is a read-only architecture audit of the current Invoice domain. No runtime source, Firebase configuration, rules, data, or deployment was changed.

Reviewed sources:

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceStatus.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/core/Container.ts`

## Current Persistence Boundary

- Local key: `invoices:{accountId}`.
- Repository storage shape: one local array per account.
- Repository operations: append, find, replace/update, and physical remove.
- Cloud transport/capability/applier: absent.
- Proposed cloud collection root: `accounts/{accountId}/invoices/{invoiceId}`.

`SyncModule` already names `invoices`, but Container registers no Invoice cloud capability, transport, cache applier, or pull adapter.

## Actual Lifecycle

| Transition | Current behavior |
| --- | --- |
| Create | Creates `draft` with random UUID, random line IDs, local daily number, snapshots, totals, and audit metadata. |
| Update | Allowed only while `draft`; replaces draft fields and rebuilds supplied lines with new random line IDs. |
| Delete | Allowed only while `draft`; physically removes the local record. |
| Issue | Allowed only from `draft`; validates local stock, creates one `sale_deduction` per line, then replaces the Invoice with `issued`. |
| Cancel | Allowed only from `issued`; creates one positive `sale_return` per line when absent, then replaces the Invoice with `cancelled`. |
| Edit after issue | Blocked by `InvoiceService` and UI. |
| Hard delete after issue | Blocked by `InvoiceService` and UI. |

There is no `revision`, `expectedRevision`, CAS, transaction, command ID, or commercial idempotency field in the Invoice domain.

## Draft Mutability and Deletion

Drafts are mutable and physically deletable in the current local domain. `updateDraft` preserves Invoice ID/account ID but supplied lines receive new IDs. A future sync contract therefore cannot assume a line ID survives every draft edit.

For cloud synchronization, physical deletion is unsafe because an offline device can resurrect the draft. The recommended cloud contract is a revisioned draft tombstone. Local UI may continue hiding/removing the cache record after durable tombstone capture, but cloud history must retain the tombstone.

## Issued Invoice Immutability

The service prevents draft editing once issued. Cancellation preserves ID, account, customer snapshot, lines, prices, totals, `issuedAt`, and `issuedBy`; it changes lifecycle/audit fields and adds reversal movement references.

This is service-level immutability only. `InvoiceRepository.updateForAccount` is a public replacement method with no status, revision, or immutable-field enforcement. Sync implementation requires a constrained cache applier/codec plus cloud rules; it must not expose generic issued-record replacement.

Recommended cloud model:

- Draft commercial data is revisioned and mutable under CAS.
- Issue freezes the complete commercial snapshot.
- `issued -> cancelled` is a revisioned lifecycle-only transition.
- Issued commercial fields never change.
- No issued/cancelled hard delete.

## Snapshot Audit

Current Invoice lines persist:

- stable-at-that-save line ID;
- Product ID;
- Product name snapshot;
- SKU, barcode, and unit snapshots when supplied;
- quantity, unit price, discount, tax, subtotal, and total;
- deduction and cancellation reversal movement references.

The UI also persists `customerId` and a customer snapshot containing display name plus available phone, secondary phone, email, and address. A manual customer name is stored as a snapshot without `customerId`.

Once issued, later Product or Customer edits do not alter the Invoice. The snapshot is historically stable. The service accepts snapshots from its input and does not independently reload Product or Customer records; this should remain explicit in the future command boundary.

## Current Numbering

`invoiceNumber` is assigned when the draft is created. The service reads the local account array, finds the largest same-day `INV-YYYYMMDD-NNNN`, and increments it.

This is unique only against the current device cache. It has no account-wide cloud transaction and is unsafe for concurrent devices, offline creation, stale caches, and retries. Detailed analysis is in `invoice-numbering-multi-device-analysis.md`.

## Issue Command Dependency Audit

For an Invoice with N lines, `markIssued` currently performs:

1. Read draft Invoice.
2. Verify status and absence of line movement references.
3. Check local ledger availability for all lines.
4. Append N random-ID `sale_deduction` StockMovements sequentially.
5. Replace the Invoice with status `issued` and movement IDs.

No Customer balance, Payment, CashMovement, JournalEntry, or other financial record is created.

### Current Failure and Retry Risk

The complete intent is not persisted before the first movement. A failure after some movement appends and before Invoice replacement leaves a draft with one or more unreferenced deductions. Retrying can create new random movement IDs and duplicate stock effects.

The ordinary duplicate issue guard works only after the Invoice status has been persisted as `issued`; it does not make interrupted issuance idempotent.

The current StockMovement sync bridge makes this more visible in controlled active mode: deductions can be cloud-synchronized while the Invoice remains local-only. Another device can observe reduced stock without the commercial record.

### Stable Identity Audit

- Invoice ID: stable after draft creation.
- Invoice line ID: stable only after the final draft save; draft edits can replace it.
- Sale deduction movement ID: random, not derived from Invoice/line identity.
- Issue command ID/idempotency key: absent.
- Revision/CAS: absent.

Before sync, issue needs deterministic movement IDs or an equivalent stable command identity, for example a contract derived from Invoice ID plus final line ID. Exact retry must match; divergent retry must conflict.

## Cancellation Audit

Cancellation validates every original deduction, detects an existing cancellation `sale_return` using metadata, appends missing positive movements, then changes the Invoice to `cancelled` with reason/audit fields and per-line reversal references.

This preserves the original deductions and commercial snapshot. It is more retry-aware than issue, but it still lacks complete durable group capture, deterministic cancellation movement IDs, CAS, and atomic cloud visibility. A failure in sync-aware capture can leave durable/local members in mixed states.

Recommended cancellation group:

- N deterministic cancellation `sale_return` appends;
- one Invoice lifecycle update from issued to cancelled;
- one stable cancellation command/group identity;
- local movements applied before the final Invoice lifecycle state;
- one atomic cloud commit before cutover.

## Multi-Line Reality

The domain/service support N Invoice lines and issue N movements. The current page builds and edits one line at a time as a single-line draft. Architecture must support N because the domain API and persisted model already do.

## Account Boundary

`InvoiceService.currentAccountContext` requires authenticated account ID to match the authenticated user's logical account ID. Firebase provider UID is not used as account ID.

The repository itself does not verify that an appended/replacement Invoice payload has the same account ID as the storage key. A future raw cache applier/repository port must enforce this boundary explicitly.

## Sync Readiness Result

Invoice sync is not implementation-ready without domain alignment. Required blockers are:

1. revision/CAS lifecycle metadata;
2. stable line and command identities;
3. deterministic sale movement identities;
4. multi-device-safe final document numbering;
5. durable complete issue/cancellation groups;
6. atomic commercial/inventory cloud commit;
7. canonical inventory sufficiency validation at commit time;
8. draft tombstone behavior and constrained issued-record application.
