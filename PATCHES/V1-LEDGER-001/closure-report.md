# V1-LEDGER-001 Closure Report

## Mission Name

V1-LEDGER-001 - Basic Auditable Ledger Domain / Lifecycle Design Plan

## Classification

INF / Architecture and Requirements Design

## Base Tag

`v1-cash-007-cash-module-closure-audit`

## Branch

`v1/ledger-001-basic-auditable-ledger-domain-lifecycle-design-plan`

## Changed Files

- `PATCHES/V1-LEDGER-001/ledger-domain-contract.md`
- `PATCHES/V1-LEDGER-001/chart-of-accounts-contract.md`
- `PATCHES/V1-LEDGER-001/posting-integration-boundaries.md`
- `PATCHES/V1-LEDGER-001/decision-record.md`
- `PATCHES/V1-LEDGER-001/closure-report.md`

## Runtime Source Changes

NONE

## Documents And Modules Reviewed

- Engineering Constitution, Project Orientation, Roadmap, and Decisions.
- Payments domain and lifecycle.
- Expense contract and implemented lifecycle.
- Safe/Cash contracts and implemented movement ledger.
- Sales/Invoice issue, cancellation, and return lifecycle.
- Purchase lifecycle.
- Customers and Suppliers identity/snapshot boundaries.
- Inventory Stock Movement Ledger as an immutable quantity-ledger pattern.

## Architecture Findings

1. V1 requires a basic auditable ledger, while current decisions defer full double-entry accounting unless later approved.
2. Existing modules intentionally do not create Ledger entries.
3. Operational, cash, stock-quantity, and accounting sources of truth must remain separate.
4. Payments and Expenses do not currently prove allocation, settlement, or Safe impact.
5. Cash Movements require a counter-account and posting-owner policy before accounting integration.
6. Inventory is quantity-authoritative but lacks an approved accounting cost valuation method.
7. Separate localStorage keys cannot provide cross-module transaction atomicity.

## Recommended Ledger Contract

- Minimal account-scoped double-entry journal, subject to explicit Owner approval.
- Embedded two-or-more JournalLines per entry.
- `draft -> posted -> reversed` lifecycle.
- Equal debit/credit totals, one currency, posted immutability, linked reversal, and account-scoped idempotency.
- `ledgerEntries:{accountId}` as the proposed journal storage boundary.
- Derived balances only; no mutable account balance field.

## Recommended Chart Of Accounts Contract

- `ledgerAccounts:{accountId}`.
- Asset, liability, equity, revenue, and expense types.
- Unique codes, optional same-type hierarchy, active/inactive lifecycle, posting-account distinction, fixed currency, immutable posted identity, and no hard delete.
- Cash, Receivables, Inventory, Payables, Revenue, COGS, General Expenses, and Owner Equity are candidates only; no automatic provisioning or mapping.

## Posting Integration Boundaries

- No automatic Payment, Expense, Cash, Sales, Purchase, or Inventory posting in the Ledger baseline.
- One posting owner per source event.
- Stable `sourceType/sourceId/sourceEvent` and idempotency.
- Future cross-key failures require visible incomplete state, safe retry, and linked reversal compensation rather than deletion.
- COGS remains blocked until cost valuation is approved.

## Decisions Requiring Owner Approval

LEDGER-DEC-001 through LEDGER-DEC-018: all require explicit Owner approval.

The most important gate is LEDGER-DEC-001, which must clarify whether the minimal double-entry balancing invariant is approved despite the current deferral of full double-entry accounting.

## Deferred Implementation

- Ledger and Chart entities, repositories, validators, services, Container wiring, UI, route, reports, and runtime verification.
- Every source integration and default-account mapping.
- Payment allocation, Safe/account mapping, Expense recognition/settlement policy, Sales/Purchase mapping, inventory valuation, and COGS.
- Tax, multi-currency, reconciliation, closing, financial statements, sync, permissions, and import/export.

## Verification

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Runtime source scope: documentation only

## Final Result

READY FOR OWNER DECISION
