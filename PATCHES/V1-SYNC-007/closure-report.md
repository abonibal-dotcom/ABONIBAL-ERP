# V1-SYNC-007 Closure Report

## Mission

V1-SYNC-007 - Sales Commercial Records Sync Architecture Audit and Plan (Invoices / Invoice Returns / Inventory Coupling)

Classification: Architecture / Commercial Record Consistency / Sync Planning

Base tag: `v1-sync-006-inventory-ledger-stock-movement-sync`

Branch: `v1/sync-007-sales-commercial-records-sync-architecture-audit-plan`

## Scope Result

The mission completed a read-only source and architecture audit. It did not implement Invoice sync, InvoiceReturn sync, a trusted command service, Firebase rules, deployment, migration, backfill, or operational cloud writes.

## Sources Inspected

- Invoice and InvoiceReturn models, statuses, validators, repositories, services, and Invoice page.
- Product, Customer, and StockMovement domain/service boundaries used by Sales.
- Invoice and InvoiceReturn persistence keys.
- InventoryService issue/cancellation/return movement paths.
- Container sync capabilities and transports.
- Sync module registry, mutation capture, durable mutation group foundation, cloud dispatch, and pull behavior.
- TEST RTDB rule coverage and account-scoped path model.

## Files Changed

- `PATCHES/V1-SYNC-007/invoice-domain-sync-audit.md`
- `PATCHES/V1-SYNC-007/invoice-return-sync-audit.md`
- `PATCHES/V1-SYNC-007/commercial-inventory-consistency-map.md`
- `PATCHES/V1-SYNC-007/invoice-numbering-multi-device-analysis.md`
- `PATCHES/V1-SYNC-007/cloud-group-visibility-options.md`
- `PATCHES/V1-SYNC-007/implementation-roadmap.md`
- `PATCHES/V1-SYNC-007/decision-record.md`
- `PATCHES/V1-SYNC-007/closure-report.md`

Runtime source changes: NONE

Firebase changes: NONE

## Current Domain Findings

Invoice lifecycle is `draft -> issued -> cancelled`. Drafts can be created, updated, and physically removed locally. Issue creates N negative sale_deduction movements before updating the Invoice. Cancellation preserves original deductions, appends N positive sale_return movements, and then marks the Invoice cancelled.

InvoiceReturn lifecycle is `recorded -> executed`. Partial and multiple Returns are supported by local cumulative quantity calculation. Execution appends N positive sale_return movements before marking the Return executed. No Return hard delete or implemented void lifecycle exists.

Issued Invoice snapshots preserve Customer and Product display/history fields and are read-only in accepted UI/service behavior. Products are not mutated and Product.quantity remains non-authoritative.

## Blocking Sync Findings

- Drafts and recorded Returns have no revision/CAS contract.
- Invoice line IDs can change during a draft edit.
- Issue and Return movement IDs are random rather than deterministic.
- Local daily Invoice and Return numbering is not multi-device safe.
- Issue can leave movements without an issued Invoice after partial failure.
- Return retry does not adopt an exact movement left by partial execution.
- Concurrent devices can over-return because validation is local and stale.
- V1-SYNC-006D provides durable local grouping and ordered recovery, but not atomic cloud visibility.
- StockMovements are sync-aware while Invoices and InvoiceReturns are local-only, so another device can observe inventory effects without commercial explanations.
- Current TEST rules and Container transports do not include Invoice or InvoiceReturn paths.

## Dependency and Coupling Result

Invoice issue creates one Invoice lifecycle update and one sale_deduction StockMovement per line. Invoice cancellation creates one Invoice lifecycle update and one sale_return per line. InvoiceReturn execution creates one Return lifecycle update and one sale_return per Return line.

Current Sales coupling is limited to read-only Product/Customer snapshots and StockMovement inventory effects. No Customer balance, Payment, CashMovement, Safe, JournalEntry, or automatic accounting coupling exists.

## Architecture Recommendation

Use UUID record identity, revisioned mutable drafts, frozen issued/executed snapshots, draft tombstones, deterministic command/member identities, trusted account-scoped numbering and business validation, and one atomic RTDB multi-location publication per complete commercial/inventory group.

RTDB rules should enforce membership, path/account consistency, simple revision/lifecycle transitions, immutable identities, append-only StockMovements, tombstone shape, and protected trusted paths. Canonical inventory sufficiency, cumulative Return arithmetic, numbering, complete-group checksums, and complex idempotency require a trusted transaction/application layer.

Cloud pull remains cache-only and never replays issue, cancellation, Return execution, or inventory/financial side effects.

## Existing Data Boundary

Existing Invoice records uploaded: 0

Existing InvoiceReturn records uploaded: 0

Migration/backfill: NONE

ID rewrite: NONE

Numbering rewrite: NONE

Historical repair: NONE

V1-SYNC-009 remains the separate non-destructive migration and explicit owner-approved cutover phase.

## Validation

- `git diff --check`: PASS.
- TypeScript (`pnpm exec tsc --noEmit`): PASS.
- Build (`pnpm run build`): PASS.
- Build note: the existing Vite chunk-size warning remains non-blocking; the production bundle completed successfully.
- Runtime source changes: NONE.
- Firebase deployment: NO.
- Operational RTDB writes: 0.
- Production touched: NO.

## Decisions and Next Work

SALESYNC-DEC-001 through SALESYNC-DEC-020 contain recommendations only. Every decision is OWNER APPROVAL REQUIRED.

Recommended sequence after approval: V1-SYNC-007A domain alignment, V1-SYNC-007B trusted commercial transaction/atomic group foundation, V1-SYNC-007C Invoice sync, V1-SYNC-007D InvoiceReturn sync, and V1-SYNC-007E combined regression/cutover gate. Do not start implementation from this mission.

## Final Result

Architecture audit and implementation-ready decision package complete. Repository validation passed; implementation remains pending Architect / Owner decisions.
