# V1-SYNC-007A Closure Report

## Mission

V1-SYNC-007A - Sales Domain Stable Identity and Lifecycle Alignment

Classification: Domain Refactor / Commercial Record Determinism / Sync Preparation

Base tag: `v1-sync-007-sales-commercial-records-sync-architecture-audit-plan`

Branch: `v1/sync-007a-sales-domain-stable-identity-lifecycle-alignment`

## Changed Files

Domain and runtime:

- `src/modules/sales/SalesIdentity.ts`
- `src/modules/sales/Invoice.ts`
- `src/modules/sales/InvoiceReturn.ts`
- `src/modules/sales/repositories/InvoiceRepository.ts`
- `src/modules/sales/repositories/InvoiceReturnRepository.ts`
- `src/modules/sales/services/InvoiceService.ts`
- `src/modules/sales/services/InvoiceReturnService.ts`
- `src/modules/sales/validators/InvoiceValidator.ts`
- `src/modules/sales/validators/InvoiceReturnValidator.ts`
- `src/modules/sales/pages/InvoiceDraftPage.ts`
- `src/modules/inventory/StockMovement.ts`
- `src/modules/inventory/services/InventoryService.ts`
- `src/modules/inventory/validators/StockMovementValidator.ts`

Validation:

- `scripts/v1-sync-007a-sales-identity-smoke.ts`

Documentation:

- `PATCHES/V1-SYNC-007A/invoice-stable-identity-contract.md`
- `PATCHES/V1-SYNC-007A/invoice-lifecycle-alignment.md`
- `PATCHES/V1-SYNC-007A/invoice-return-stable-identity-contract.md`
- `PATCHES/V1-SYNC-007A/legacy-commercial-record-compatibility.md`
- `PATCHES/V1-SYNC-007A/runtime-validation.md`
- `PATCHES/V1-SYNC-007A/closure-report.md`

## Invoice Alignment

- Lifecycle remains `draft -> issued -> cancelled`.
- Record identity remains UUID-based and independent of the document number.
- New line IDs are assigned once and preserved when an explicit draft edit supplies the current ID, including line reordering.
- New drafts start at revision 0; update requires expected revision and increments once.
- Issue identity is stable and each line has one deterministic sale_deduction identity.
- Exact issue retry validates and returns the existing result without creating a movement.
- Partial local issue can adopt exact deterministic movements left before Invoice persistence; complete intent-before-mutation remains deferred to V1-SYNC-007B.
- Repository guards reject illegal revision/status transitions, issued destructive edits, and non-draft deletion.
- Issued Product/Customer snapshots, prices, quantities, taxes, totals, identifiers, and original movement references are immutable.

## Cancellation Alignment

- Cancellation command and per-line movement identities are deterministic.
- Original sale_deduction movements remain immutable.
- Cancellation appends positive sale_return movements and then advances the Invoice lifecycle.
- Exact retry with the same reason returns the existing cancellation and creates zero duplicate movements.
- A different command or reason conflicts.
- Cancelled Invoices cannot return to draft or be hard-deleted through the scoped repository/service path.

## InvoiceReturn Alignment

- Lifecycle remains `recorded -> executed`.
- Return UUID remains separate from the human Return number.
- Return line IDs are deterministic from Return ID plus source Invoice line ID.
- Execution command and per-line sale_return identities are deterministic.
- Partial execution retry adopts exact existing movements and rejects divergent payloads.
- Executed Returns are immutable through repository guards and have no hard-delete API.
- Partial and multiple Returns remain supported.
- Local cumulative over-return protection remains active.
- Concurrent cross-device over-return is not solved and remains assigned to the trusted canonical transaction mission.

## Human Number and Legacy Boundaries

- Invoice/Return numbering algorithm changed: NO.
- Multi-device numbering solved: NO.
- Record, command, line, and movement identity never derive from the human number.
- Legacy reads perform zero writes.
- Legacy final records are not rewritten.
- Legacy draft line identity can be assigned only by explicit user edit/save.
- Legacy IDs, StockMovement IDs, snapshots, and document numbers changed: 0.
- Migration/backfill/upload: NONE.

## Side-Effect and Integration Boundaries

- Product.quantity authoritative: NO.
- Customer balance coupling: NONE.
- Payment coupling: NONE.
- Cash/Safe coupling: NONE.
- Ledger coupling: NONE.
- Invoice Firebase transport: NOT REGISTERED.
- InvoiceReturn Firebase transport: NOT REGISTERED.
- Firebase rules changed: NO.
- Operational RTDB writes/listeners: 0/0.
- Default SyncMode: disabled.
- Production touched: NO.

## Validation Results

- Sales identity smoke: PASS 6/6.
- StockMovement reversal regression: PASS 14/14.
- Durable mutation group regression: PASS 24/24.
- Inventory sync regression: PASS 41/41.
- Duplicate sale_deduction on retry: 0.
- Duplicate sale_return on retry: 0.
- Startup legacy rewrite: 0.
- `git diff --check`: PASS.
- TypeScript: PASS.
- Build: PASS with the existing non-blocking Vite chunk-size warning.

## Final Result

The local Sales domain now has stable commercial/member identities, revision-aware draft editing, deterministic inventory side effects, idempotent exact retries, explicit conflicts, and guarded immutable final records. It does not claim durable intent-before-mutation or cloud atomicity, and no sync integration was added.

V1-SYNC-007A READY FOR ARCHITECT REVIEW
