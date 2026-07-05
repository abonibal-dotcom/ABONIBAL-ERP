# V1-SALES-002 Account-Scoped Invoice Persistence Design Plan

## Mission

`V1-SALES-002 - Account-Scoped Invoice Persistence Design Plan`

## Classification

INF.

This mission designs the future invoice persistence boundary only. It does not implement invoices, invoice UI, invoice create/edit/delete behavior, invoice stock deduction, Product behavior, Inventory behavior, Auth behavior, routing, or localStorage migration.

## Baseline

- Baseline tag: `v1-sales-001-invoice-foundation-baseline`.
- V1-SALES-001 confirmed no Sales / Invoice module, route, UI, service, repository, persistence key, or storage boundary exists yet.
- V1-SALES-001 observed no invoice or sales storage keys during read-only runtime verification.
- Products are accepted as future invoice line references.
- Inventory stock availability is accepted as the future invoice confirmation gate.

## Storage Boundary Decision

Recommended V1 invoice storage key:

```text
invoices:{accountId}
```

The `accountId` must come from the authenticated account boundary:

```text
AuthState.status === "authenticated"
AuthState.session.account.id
AuthState.session.user.accountId
session.account.id === session.user.accountId
```

Invoice persistence must reject unauthenticated access and mismatched account context. It must not read or write invoices when no authenticated account context exists.

Rejected boundaries:

- `invoices`: rejected because it is global and violates the V1 account/workspace data boundary.
- `invoices:{providerUserId}`: rejected because Firebase UID/provider user id is not the V1 `accountId`.
- `invoices:{firebaseUid}`: rejected for the same reason.
- Default account fallback: rejected because it can silently mix business data.

## Legacy Storage Policy

No legacy invoice storage exists in the accepted baseline.

Therefore, the first invoice persistence implementation should not add automatic legacy invoice migration. If legacy invoice data is discovered later, it must be handled through a separate owner-approved no-data-loss mission with baseline evidence, backup, compatibility policy, and rollback plan.

## Future Persistence Components

Recommended implementation scope for the next source mission:

- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceStatus.ts`
- `src/modules/sales/persistence/InvoicePersistenceKey.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/services/InvoiceService.ts`
- Minimal container registration only if required by the persistence baseline.

Do not add an invoice route or invoice UI in the persistence baseline.

## Invoice Header Contract

Recommended V1 invoice header fields:

```text
id
accountId
invoiceNumber
status
customerId
customerSnapshot
lines
subtotal
discount
tax
total
notes
createdAt
createdBy
updatedAt
updatedBy
issuedAt
issuedBy
cancelledAt
cancelledBy
cancelReason
```

Rules:

- `id` is immutable.
- `accountId` is required and must match the authenticated account context.
- `invoiceNumber` is unique within `invoices:{accountId}`.
- `status` controls lifecycle behavior.
- Totals are stored on the invoice for historical stability.
- Ownership metadata must use the authenticated V1 user id, not Firebase UID as account id.

## Invoice Line Contract

Recommended V1 invoice line fields:

```text
id
productId
productNameSnapshot
skuSnapshot
barcodeSnapshot
unitSnapshot
quantity
unitPrice
discount
tax
lineSubtotal
lineTotal
stockMovementId
```

Rules:

- `productId` references a stable Product id.
- Snapshot fields preserve historical invoice readability when Product metadata changes.
- `stockMovementId` remains nullable until the future invoice stock deduction mission creates `sale_deduction` movements.
- Lines must not mutate Product records.
- Lines must not update `Product.quantity`.

## Minimum Future Repository Behavior

The future Invoice repository should provide account-scoped methods only:

```text
allForAccount(accountId)
findForAccount(accountId, invoiceId)
appendForAccount(accountId, invoice)
updateForAccount(accountId, invoiceId, invoice)
```

Global `all()` / `save()` behavior from the base repository must not be used for invoice business reads or writes.

## Minimum Future Service Behavior

The future Invoice service should:

- Resolve authenticated account context from Auth state.
- Return safe empty results for unauthenticated reads.
- Reject unauthenticated writes.
- Validate invoice ownership before writing.
- Validate line product references through Product service.
- Keep draft persistence separate from stock deduction.
- Use Inventory availability only when issuing invoices in a later mission.

## Implementation Readiness Decision

- Invoice persistence may proceed next after Architect / Owner approval: yes.
- Invoice UI may proceed next: no.
- Invoice stock deduction may proceed next: no.

