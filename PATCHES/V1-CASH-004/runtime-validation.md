# V1-CASH-004 Runtime Validation

## Mission

V1-CASH-004 - Safe Transfer Baseline

## Environment

- Windows PowerShell, Node.js v24.18.0, pnpm Windows shim
- Vite build and isolated headless Chrome/CDP service smoke
- Synthetic authenticated account; temporary scoped storage removed afterward

## Files Changed

- `src/modules/cash/CashMovement.ts`
- `src/modules/cash/repositories/CashMovementRepository.ts`
- `src/modules/cash/services/CashMovementService.ts`
- `PATCHES/V1-CASH-004/runtime-validation.md`
- `PATCHES/V1-CASH-004/closure-report.md`

## Transfer Checklist

| Check | Result |
| --- | --- |
| Source and destination must differ | PASS |
| Both Safes must be active | PASS |
| Same currency required | PASS |
| Positive amount required | PASS |
| Negative source balance prevented | PASS |
| Linked `transfer_out` and `transfer_in` created | PASS |
| Shared `transferId` | PASS |
| Shared business idempotency key | PASS |
| Pair persisted with one repository array write | PASS |
| Simulated write failure persisted neither side | PASS |
| Equivalent replay returned existing pair | PASS |
| Same key with changed payload rejected | PASS |
| Full transfer reversal | PASS |
| Half-transfer reversal unavailable | PASS |
| Duplicate reversal returned existing pair | PASS |
| Reload-compatible linked records | PASS |

## Balance Proof

- Source before transfer: `200`
- Destination before transfer: `50`
- Transfer amount: `60`
- Source after transfer: `140`
- Destination after transfer: `110`
- Source after full reversal: `200`
- Destination after full reversal: `50`

The original pair remains stored as `reversed`; a new posted opposite transfer pair restores both balances. Final movement count was six: two opening balances, two original transfer records, and two reversal records.

## Atomicity And Idempotency

- Both transfer sides are appended to the existing account array and written once to `cashMovements:{accountId}`.
- A simulated repository write exception returned failure and left movement count unchanged.
- Equivalent idempotent replay did not increase movement count.
- A changed payload using the same key was rejected.
- Every observed transfer ID had exactly two records.

## Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Runtime domain smoke: PASS
- Console errors: 0
- Page exceptions: 0
- Global `cashMovements` key absent: PASS

## Scope Exclusions

- No UI, route, or navigation
- No direct balance mutation
- No Payment, Expense, Sales, Purchase, Ledger, Product, or Inventory integration
- `.env`, `.firebase/`, and `outputs/` untouched

## Result

PASS
