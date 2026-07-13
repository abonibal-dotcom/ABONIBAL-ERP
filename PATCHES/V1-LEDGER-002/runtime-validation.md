# V1-LEDGER-002 Runtime Validation

## Mission

V1-LEDGER-002 - Basic Ledger Domain Baseline

## Environment

- Windows PowerShell, Node.js v24.18.0, pnpm Windows shim
- Vite build and isolated headless Chrome/CDP domain smoke
- Synthetic authenticated account with temporary scoped data removed afterward

## Files Added Or Modified

- Ledger account, journal entry, journal line, status/type/source models under `src/modules/ledger/`
- Account-scoped persistence helpers, repositories, validators, and services
- `src/core/Container.ts`
- `PATCHES/V1-LEDGER-002/runtime-validation.md`
- `PATCHES/V1-LEDGER-002/closure-report.md`

## Ledger Account Checklist

| Check | Result |
| --- | --- |
| Create posting and aggregation accounts | PASS |
| Update unused account | PASS |
| Unique account code | PASS |
| Parent relationship | PASS |
| Self/cycle prevention | PASS |
| Deactivate unused zero-balance account | PASS |
| Inactive account rejected by Journal | PASS |
| Aggregation account rejected by Journal | PASS |
| Used account identity locked | PASS |
| Used account display name remains editable with snapshots preserved | PASS |
| No hard delete | PASS |

## Journal Checklist

| Check | Result |
| --- | --- |
| Balanced draft create | PASS |
| Draft has no balance effect | PASS |
| Fewer than two lines rejected | PASS |
| Unbalanced entry rejected | PASS |
| Debit and credit on one line rejected | PASS |
| Draft update | PASS |
| Post draft | PASS |
| Posted effect applied once | PASS |
| Posted update blocked | PASS |
| Idempotency duplicate blocked | PASS |
| Source lookup | PASS |
| Reversal creates linked opposite posted entry | PASS |
| Original remains stored as reversed | PASS |
| Reversed update blocked | PASS |
| Duplicate reversal blocked | PASS |
| Current account balance | PASS |
| Balance at business date | PASS |
| No hard delete | PASS |

## Balance Proof

- Cash asset draft balance: `0`
- Cash asset after post: `120`
- Revenue credit-normal balance after post: `120`
- Cash and Revenue after linked reversal: `0`
- Cash balance at `2026-07-01`: `120`

The reversed original remains balance-affecting and the posted opposite entry offsets it exactly once.

## Storage And Safety

- `ledgerAccounts:{accountId}`: PASS
- `ledgerEntries:{accountId}`: PASS
- Global Ledger keys absent: PASS
- All records retain explicit authenticated `accountId`: PASS
- No mutable LedgerAccount balance field: PASS
- Payment, Expense, Cash, Sales, Purchase, Inventory, and Product storage unchanged: PASS
- No automatic accounts or source integrations: PASS
- Container registration: PASS
- Console errors: 0
- Page exceptions: 0

## Technical Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Domain runtime smoke: PASS

## Tool Note

The first smoke execution completed its domain operations but failed while assembling the result object because of a verification-variable typo. The corrected fresh-profile rerun passed without source changes.

## Scope Exclusions

- UI, route, navigation, default accounts, auto-posting, COGS, reports, profit/loss, balance sheet, and multi-currency conversion
- `.env`, `.firebase/`, and `outputs/` untouched

## Result

PASS
