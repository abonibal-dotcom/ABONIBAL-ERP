# Crash Recovery Validation

Focused command: `pnpm.cmd dlx tsx scripts/v1-sync-007b-sales-commercial-group-smoke.ts`

Result: PASS `31/31`.

## Failure Matrix

| Scenario | Issue | Cancellation | Return execution |
| --- | --- | --- | --- |
| Complete group persisted before first mutation | PASS | PASS | PASS |
| Initial outbox write failure leaves zero local effects | PASS | PASS | PASS |
| Commercial member fails before movement apply | PASS | PASS | PASS |
| Commercial state applied, later movement pending | PASS | PASS | PASS |
| Partial multi-member movement recovery | PASS | PASS | PASS |
| Cache applied before applied marker | PASS | PASS | PASS |
| Exact retry | PASS | PASS | PASS |
| Conflicting retry/state | PASS | PASS | PASS |
| Same movement ID, divergent payload | PASS | PASS | PASS |
| Whole group blocked without commercial transport | PASS | PASS | PASS |

## Measured Invariants

- Initial `enqueueBatchAtomic()` calls per newly captured group: `1`.
- Duplicate `sale_deduction`: `0`.
- Duplicate `sale_return`: `0`.
- Business command replay from appliers: `0`.
- Commercial movement cloud leak: `0`.
- Customer balance / Payment / Cash / Ledger coupling: `0 / 0 / 0 / 0`.
- Existing records auto-enqueued: `0`.
- Migration/backfill: `NONE`.
- `Product.quantity` authoritative: `NO`.

Recovery uses the accepted bounded `LocalMutationReconciler`; it inspects stable
IDs/checksums and applies only pending members in group order.
