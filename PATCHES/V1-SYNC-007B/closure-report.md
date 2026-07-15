# V1-SYNC-007B Closure Report

## Mission

- Mission: V1-SYNC-007B - Sales Commercial Durable Mutation Group Integration
- Classification: Application Flow Integration / Durable Multi-Record Commercial Commands / Sync Preparation
- Base tag: `v1-sync-007a-sales-domain-stable-identity-lifecycle-alignment`
- Branch: `v1/sync-007b-sales-commercial-durable-group-integration`
- Firebase deployment: no
- Production touched: no

## Changed Files

- `src/modules/sales/services/IssueInvoiceDurableCommandService.ts`
- `src/modules/sales/services/CancelInvoiceDurableCommandService.ts`
- `src/modules/sales/services/ExecuteInvoiceReturnDurableCommandService.ts`
- `src/modules/sales/services/SalesCommercialCommandSupport.ts`
- `src/modules/sales/sync/SalesCommercialSyncOperation.ts`
- `src/modules/sales/sync/InvoiceLocalMutationApplier.ts`
- `src/modules/sales/sync/InvoiceReturnLocalMutationApplier.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/core/Container.ts`
- `scripts/v1-sync-007b-sales-commercial-group-smoke.ts`
- `PATCHES/V1-SYNC-007B/**`

## Implementation Summary

The Invoice page now invokes one application boundary for issue, cancellation,
and return execution. In active mode each boundary validates and builds the
commercial transition plus all deterministic StockMovements, then captures the
complete ordered group before the first local mutation. In disabled mode it
preserves accepted local behavior with zero outbox/Firebase activity.

Restricted Invoice and InvoiceReturn appliers are account-scoped,
revision/pre-state aware, cache/state-only, and idempotent. They call only raw
repositories and never replay business commands or create side effects. The
existing StockMovement raw append-only applier handles movement members.

## Group Contracts

- Issue: `invoice-issue-{invoiceId}`, Invoice first, then one
  `sale-{invoiceId}-{lineId}` per line.
- Cancellation: `invoice-cancel-{invoiceId}`, cancelled Invoice first, then one
  `invoice-cancel-return-{invoiceId}-{lineId}` per line.
- Return execution: `invoice-return-execute-{returnId}`, executed InvoiceReturn
  first, then one `invoice-return-{returnId}-{returnLineId}` per line.
- Initial complete group persistence: one `enqueueBatchAtomic()` call.
- Exact retry: idempotent.
- Conflicting retry/divergent payload: conflict, no overwrite.
- Duplicate `sale_deduction` / `sale_return`: `0 / 0`.

## Cloud Capability Boundary

StockMovement append transport is present. Invoice and InvoiceReturn transports
remain absent. The accepted all-required-members capability gate blocks issue,
cancellation, and return-execution groups as a whole. Commercial movement cloud
leak and dispatch counts are both `0`.

## Unresolved Boundaries

- Concurrent stale-device cumulative return validation: not solved.
- Trusted canonical return allocation/atomic publication: deferred.
- Multi-device human document numbering: not solved.
- Invoice and InvoiceReturn cloud transport/rules: deferred.
- Migration/backfill/cutover: none in this mission.
- Customer balance, Payment, Cash/Safe, and Ledger coupling: none.

## Validation

- Focused V1-SYNC-007B: PASS `31/31`.
- V1-SYNC-004: PASS `18/18`.
- V1-SYNC-004A: PASS `26/26`.
- V1-SYNC-005: PASS `31/31`; rules PASS `36/36`.
- V1-SYNC-006B: PASS `14/14`.
- V1-SYNC-006D: PASS `24/24`.
- V1-SYNC-006E: PASS `39/39`.
- V1-SYNC-006: PASS `41/41`; rules PASS `17/17`.
- V1-SYNC-007A: PASS `6/6`.
- TypeScript: PASS.
- Build: PASS, known non-blocking chunk warning.
- Runtime HTTP entry: PASS `200`.
- Authenticated browser metrics: TOOL LIMITATION / not measured.
- Operational live RTDB writes/listeners: `0 / 0`.
- Existing records auto-enqueued/uploaded: `0`.
- Migration/backfill: `NONE`.
- Default `SyncMode`: `disabled`.
- `Product.quantity` authoritative: `NO`.

## Final Result

ACCEPTED locally. Ready for architecture/owner review. V1-SYNC-007C was not
started, and V1-SYNC-007B was not pushed.
