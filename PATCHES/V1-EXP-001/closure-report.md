# V1-EXP-001 Closure Report

## Mission Name

V1-EXP-001 - Expense Domain & Lifecycle Design Plan

## Classification

INF / Architecture and Requirements Design

## Base Tag

`v1-pur-004-purchase-module-closure-audit`

## Branch

`v1/exp-001-expense-domain-lifecycle-design-plan`

## Changed Files

- `PATCHES/V1-EXP-001/expense-domain-contract.md`
- `PATCHES/V1-EXP-001/decision-record.md`
- `PATCHES/V1-EXP-001/closure-report.md`

## Runtime Source Changes

NONE

## Architecture Findings

- Expenses are required by the official V1 Roadmap before Safes/Cash, Basic Ledger, and Basic Reports.
- The repository previously defined only a capability gap, not an implementation contract.
- Existing Payments and Purchases establish account-scoped draft/post/void-or-cancel patterns.
- Customer and Supplier snapshots establish a safe historical display pattern.
- Inventory establishes that operational source-of-truth ledgers must be additive and auditable.
- Expense cannot safely create Payment, Safe, or Ledger effects before those integration contracts exist.
- Full double-entry accounting remains deferred, while basic auditability is required.

## Recommended Contract Summary

- Independent account-scoped Expense records under `expenses:{accountId}`.
- Lifecycle: `draft -> posted -> voided`, with optional direct draft voiding.
- Draft-only editing; posted and voided records immutable.
- No hard delete.
- Stable category and payee snapshots.
- Positive finite amount and valid calendar date.
- Descriptive payment method only.
- Complete creation, update, posting, and void audit metadata.
- No automatic Payment, Safe movement, Ledger entry, balance, or report effect.
- Future financial integrations must be separate, idempotent, and reversal-safe.

## Decisions Requiring Owner Approval

OWNER APPROVAL REQUIRED:

- EXP-DEC-001 - Expense lifecycle.
- EXP-DEC-002 - Category policy.
- EXP-DEC-003 - Payee policy.
- EXP-DEC-004 - Expense versus Payment boundary.
- EXP-DEC-005 - Safe integration timing.
- EXP-DEC-006 - Ledger integration timing.
- EXP-DEC-007 - Posted record edit policy.
- EXP-DEC-008 - Void policy.
- EXP-DEC-009 - Financial source of truth.
- EXP-DEC-010 - Baseline module scope.

## Deferred Implementation

- Expense model, persistence, repository, validator, and service.
- Expense page, route, and navigation.
- Category module.
- Customer/Supplier selection.
- Payment linkage.
- Safe/Cash integration.
- Basic Ledger integration.
- Balances, statements, reports, profit computation, attachments, and import/export.

## Verification

- `git diff --check`: PASS.
- `pnpm exec tsc --noEmit`: PASS.
- `pnpm run build`: PASS.
- Runtime source files changed: NO.

## Final Result

READY FOR OWNER DECISION
