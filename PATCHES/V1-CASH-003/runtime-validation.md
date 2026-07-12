# V1-CASH-003 Runtime Validation

## Mission

V1-CASH-003 - Cash Movement Domain Baseline

## Environment

- Windows PowerShell, Node.js v24.18.0, pnpm Windows shim
- Vite production build
- Isolated headless Chrome/CDP service smoke
- Synthetic authenticated session with explicit matching account boundaries
- Temporary `safes:{accountId}` and `cashMovements:{accountId}` data removed after validation

## Files Added Or Modified

- `src/modules/cash/CashMovement.ts`
- `src/modules/cash/CashMovementStatus.ts`
- `src/modules/cash/CashMovementType.ts`
- `src/modules/cash/CashMovementReferenceType.ts`
- `src/modules/cash/persistence/CashMovementPersistenceKey.ts`
- `src/modules/cash/repositories/CashMovementRepository.ts`
- `src/modules/cash/validators/CashMovementValidator.ts`
- `src/modules/cash/services/CashMovementService.ts`
- `src/modules/cash/services/SafeService.ts`
- `src/core/Container.ts`
- `PATCHES/V1-CASH-003/runtime-validation.md`
- `PATCHES/V1-CASH-003/closure-report.md`

## Checklist

| Check | Result |
| --- | --- |
| Storage key is `cashMovements:{accountId}` | PASS |
| Global `cashMovements` key absent | PASS |
| Draft create and update | PASS |
| Draft has no balance effect | PASS |
| Post changes status and affects balance once | PASS |
| Posted update blocked | PASS |
| Duplicate post blocked | PASS |
| Duplicate idempotency key blocked | PASS |
| One posted opening balance per Safe | PASS |
| Positive amount validation | PASS |
| Negative balance prevention | PASS |
| Inactive Safe rejected | PASS |
| Safe currency change after posting blocked | PASS |
| Non-zero Safe deactivation blocked | PASS |
| Reversal creates linked posted opposite movement | PASS |
| Original movement preserved as reversed | PASS |
| Duplicate reversal blocked | PASS |
| Reversal pair restores balance correctly | PASS |
| Balance-at-date calculation | PASS |
| Container registration | PASS |
| No hard delete API | PASS |

## Balance Proof

- Opening balance draft: `0`
- Posted opening balance after draft update: `120`
- Posted cash out: `-20`, resulting balance `100`
- Reversal movement: `cash_in +20`, resulting balance `120`
- The reversed original remains included and the posted reversal offsets it. The original is not excluded, preventing double reversal.

## Safety Proof

- All records retained explicit authenticated `accountId`.
- `Safe.balance` does not exist.
- Payment, Expense, Purchase, Invoice, and Stock Movement keys were untouched.
- Manual creation/posting/reversal of half transfers is blocked pending V1-CASH-004.
- `.env`, `.firebase/`, and `outputs/` were untouched.

## Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
- Domain runtime smoke: PASS
- Console errors: 0
- Page exceptions: 0

## Tool Note

An initial assertion recomputed the negative-balance result after a later reversal and checked `Container` before explicit boot. The corrected isolated recheck booted `Container` and captured the balance immediately after the rejected post; both checks passed without source changes.

## Result

PASS
