# V1-SYNC-007H Atomic Commercial Publication Contract

## Two-Phase Boundary

Phase A commits an existing canonical Return allocation. Phase B publishes all
commercial visibility members with one account-root RTDB multi-location update.
The two phases are intentionally separate.

Phase B publishes together:

1. The `recorded -> executed` InvoiceReturn envelope.
2. One deterministic `sale_return` StockMovement envelope per Return line.
3. The terminal accepted commercial-command receipt.
4. The committed commercial-group marker.

No Phase B member is written before all preconditions and final checksums are
built. The allocation commit is not repeated inside the multi-location update.

## Preconditions

- Exact immutable allocation commit exists.
- Exact recorded InvoiceReturn baseline exists.
- Exact processing receipt and active lease exist.
- No publication marker exists, unless it is an exact completed retry.
- No deterministic movement ID already contains another payload.
- A valid `CanonicalDocumentNumberProof` is supplied.

The document-number proof is an interface only. V1-SYNC-007H does not allocate
or redesign human numbers.

## Identity

- `publicationId = commandId`
- Return command: `invoice-return-execute-{returnId}`
- Movement: `invoice-return-{returnId}-{returnLineId}`
- Movement idempotency: `invoice-return-execute-{returnId}-line-{returnLineId}`

Exact retry acknowledges existing matching publication. Divergent state under
the same identity conflicts. No member is overwritten and no physical delete is
used.

## Authority Boundary

This is an internal Functions foundation. It adds no callable, command handler,
runtime capability, browser transport, or Container registration. It performs
no deployment and does not enable InvoiceReturn execution from clients.
