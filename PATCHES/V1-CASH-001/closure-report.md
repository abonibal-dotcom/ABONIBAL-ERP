# V1-CASH-001 Closure Report

## Mission

V1-CASH-001 - Safe / Cash Movement Domain & Lifecycle Design Plan

## Classification

INF / Architecture and Requirements Design

## Base Tag

`v1-exp-005-expense-module-closure-audit`

## Branch

`v1/cash-001-safe-cash-movement-domain-lifecycle-design-plan`

## Changed Files

- `PATCHES/V1-CASH-001/safe-domain-contract.md`
- `PATCHES/V1-CASH-001/cash-movement-contract.md`
- `PATCHES/V1-CASH-001/decision-record.md`
- `PATCHES/V1-CASH-001/closure-report.md`

## Runtime Source Changes

NONE

## Architecture Findings

- Safes / Cash Movement is the next official V1 Roadmap area after Expenses.
- Existing Payment, Expense, Sales, and Purchase modules intentionally have no approved cash integration.
- The Inventory Stock Movement ledger provides a useful append/audit pattern, but cash remains a separate financial domain.
- A mutable Safe balance would conflict with the V1 auditability requirement.
- Transfer and reversal require linked, idempotent records and must avoid one-sided writes.
- Basic Ledger integration must wait until the Cash Movement source is stable.

## Recommended Safe Contract

- Multiple account-scoped Safes under `safes:{accountId}`.
- Active/inactive lifecycle.
- One optional active default for UI convenience, never silent command fallback.
- One immutable currency per Safe; no conversion.
- No authoritative balance field.
- Opening balance recorded as Cash Movement.
- No hard delete; inactivation preserves history.

## Recommended CashMovement Contract

- Account-scoped ledger under `cashMovements:{accountId}`.
- Positive amounts with direction derived from movement type.
- Lifecycle `draft -> posted -> reversed`.
- Posted records immutable.
- Corrections through linked opposite reversal movement.
- Transfer represented by linked transfer_out/transfer_in pair in one array write.
- Current and historical balances derived from movement ledger.
- Required idempotency boundaries.
- Recommended negative-balance prevention.

## Decisions Requiring Owner Approval

OWNER APPROVAL REQUIRED:

- CASH-DEC-001 through CASH-DEC-015.
- Especially balance source, opening balance, reversal, negative balance, currency, transfer atomicity, idempotency, and integration timing.

## Deferred Implementation

- Safe entity/repository/validator/service.
- CashMovement entity/repository/validator/service.
- Balance computation.
- Page, route, and navigation.
- Transfers and reversals.
- Payment, Expense, Sales, Purchase, and Basic Ledger integration.
- Reconciliation, reports, statements, import/export, and sync.

## Proposed Future Mission Sequence

1. `V1-CASH-002 - Safe Domain Baseline`
2. `V1-CASH-003 - Cash Movement Ledger Baseline`
3. `V1-CASH-004 - Safe / Cash Movement Page Baseline`
4. `V1-CASH-005 - Safe / Cash Runtime Validation Audit`
5. `V1-CASH-006 - Safe / Cash Module Closure Audit`
6. Separate Owner-approved integration missions.

## Verification

- `git diff --check`: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Runtime source changes: NONE.

## Final Result

READY FOR OWNER DECISION
