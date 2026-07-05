# Return Storage Boundary Plan

## Mission

`V1-SALES-010 - Invoice Returns / Partial Returns Design Plan`

## Recommendation

Use account-scoped return storage:

```text
invoiceReturns:{accountId}
```

## Boundary Comparison

| Option | Recommendation | Reason |
| --- | --- | --- |
| `invoiceReturns:{accountId}` | Use for V1 | Preserves account boundary, keeps return history append-friendly, avoids inflating invoice records, and supports independent audit. |
| Embedded returns inside `invoices:{accountId}` | Do not use as authoritative storage | Makes invoice records large and makes duplicate/over-return checks harder as history grows. |
| Global `invoiceReturns` | Reject | Violates the approved account boundary. |
| Stock movement only | Reject | Restores stock but loses business-level return record, reason, notes, totals, and audit ownership. |

## Recommended Persistence Shape

Future implementation should add:

- `InvoiceReturn` model/types.
- `InvoiceReturnRepository`.
- `InvoiceReturnValidator`.
- `InvoiceReturnService`.
- `invoiceReturnStorageKeyForAccount(accountId)`.
- Container registration for the return persistence dependencies.

## Storage Key Contract

```ts
const INVOICE_RETURN_STORAGE_KEY_PREFIX = "invoiceReturns:";

function invoiceReturnStorageKeyForAccount(accountId: string): string {
    return `${INVOICE_RETURN_STORAGE_KEY_PREFIX}${accountId.trim()}`;
}
```

Implementation must reject empty account ids and must use the authenticated
`AuthSession.account.id` boundary. It must not use Firebase UID, provider user
id, or a default account fallback.

## Return Numbering

Return numbers should be account-scoped and locally sequenced, similar to
invoice numbering.

Recommended format:

```text
RET-YYYYMMDD-0001
```

The sequence should be computed from existing `invoiceReturns:{accountId}`
records for that account.

## Invoice Interaction

`invoiceReturns:{accountId}` is authoritative for return records.

The invoice record may store derived summary fields only if implementation needs
fast display, for example:

```ts
returnStatus?: "none" | "partial" | "full";
returnedAt?: string;
```

However, derived summary fields must be rebuildable from
`invoiceReturns:{accountId}` and `stockMovements:{accountId}`.

## Idempotency Boundary

Return persistence must prevent duplicate submissions by checking:

1. Existing return records for the same `invoiceId`.
2. Existing return lines for the same `invoiceLineId`.
3. Existing `sale_return` movements whose metadata references the same return
   id or original deduction movement id.

Future implementation may add an optional local `requestId` or `idempotencyKey`
to return records, but it must not be required for data correctness.

## Data Preservation

Return persistence must not:

- delete invoices;
- delete stock movements;
- mutate Product records;
- update `Product.quantity`;
- migrate legacy localStorage data;
- rewrite unrelated accounts.

## Recommended Next Mission Boundary

`V1-SALES-011 - Account-Scoped Invoice Returns Persistence Baseline` should
implement storage, repository, validator, service contract, and service-level
verification only.

Return UI should remain deferred until persistence is accepted.
