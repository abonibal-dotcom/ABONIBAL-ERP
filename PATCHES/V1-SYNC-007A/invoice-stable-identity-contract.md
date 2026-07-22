# V1-SYNC-007A Invoice Stable Identity Contract

## Current Baseline

- Invoice records already use a UUID that is separate from the human Invoice number.
- Invoice lines already contain an `id`, but draft updates currently regenerate it.
- Issue currently creates random StockMovement IDs.
- Issue retry is rejected after success and cannot safely adopt movements left by a partial local failure.

## Approved Alignment

- A new Invoice receives one UUID before persistence; it is never derived from the document number.
- Every new Invoice line receives one stable UUID before issue.
- Draft input may carry a line ID. An ID belonging to the current draft is preserved across edits and reordering.
- A missing ID on an explicitly saved legacy draft is assigned once on that save. No startup or background rewrite occurs.
- Issue command identity is `invoice-issue-{invoiceId}`.
- A sale deduction identity is derived only from stable Invoice and line IDs:
  - movement ID: `sale-{invoiceId}-{lineId}`;
  - idempotency key: `invoice-issue-{invoiceId}-line-{lineId}`.
- Cancellation command identity is `invoice-cancel-{invoiceId}`.
- A cancellation movement identity is:
  - movement ID: `invoice-cancel-return-{invoiceId}-{lineId}`;
  - idempotency key: `invoice-cancel-{invoiceId}-line-{lineId}`.

All components must be key-safe. A legacy record with an unsafe or missing identity remains readable but cannot execute a new commercial side effect until an allowed explicit draft save provides stable line identity.

## Retry and Conflict Contract

- Exact issue retry returns the existing issued Invoice after verifying command identity, every movement reference, and every deterministic movement payload.
- Exact cancellation retry returns the existing cancelled Invoice after verifying command identity, reason, references, and movement payloads.
- A deterministic movement ID with different Product, quantity, type, reference, metadata, or idempotency key is a conflict.
- No retry generates a fresh side-effect ID.
- The original sale deduction is immutable; cancellation only appends a sale return.

## Boundary

This prepares identity and local retry behavior only. Complete durable intent before first mutation and atomic cloud publication remain V1-SYNC-007B responsibilities.
