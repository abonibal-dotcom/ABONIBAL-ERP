# V1-CASH-002 Runtime Validation

## Mission

V1-CASH-002 - Safe Domain Baseline

## Test Environment

- Windows PowerShell
- Node.js v24.18.0
- pnpm command shim: `pnpm.cmd`
- Vite production build and isolated headless Chrome/CDP domain smoke
- Synthetic authenticated session with matching explicit account and user account IDs
- Temporary account-scoped storage removed after verification

## Files Added Or Modified

- `src/modules/cash/Safe.ts`
- `src/modules/cash/SafeStatus.ts`
- `src/modules/cash/persistence/SafePersistenceKey.ts`
- `src/modules/cash/repositories/SafeRepository.ts`
- `src/modules/cash/validators/SafeValidator.ts`
- `src/modules/cash/services/SafeService.ts`
- `src/core/Container.ts`
- `PATCHES/V1-CASH-002/runtime-validation.md`
- `PATCHES/V1-CASH-002/closure-report.md`

## Safe Domain Checklist

| Check | Result |
| --- | --- |
| Safe entity and active/inactive status exist | PASS |
| Draft and update inputs exist | PASS |
| Create two Safes | PASS |
| Update Safe | PASS |
| Find and getAll are account-scoped | PASS |
| At most one default Safe | PASS |
| setDefaultSafe rejects inactive Safe | PASS |
| Deactivate preserves the record | PASS |
| Deactivating default Safe does not choose a fallback | PASS |
| No hard delete API | PASS |
| No mutable `Safe.balance` field | PASS |
| Container registration | PASS |

## Storage Boundary

- Required key: `safes:{accountId}` - PASS
- Verified smoke key: `safes:cash-002-account`
- Global `safes` key absent - PASS
- Every stored record retained the authenticated explicit account ID - PASS

## Lifecycle Notes

- A Safe starts active.
- Default selection is explicit; creating or selecting a default clears the flag from all other Safes in the same account.
- Deactivation is non-destructive and clears `isDefault` without silently selecting another Safe.
- Currency is normalized to an uppercase three-letter code. The posted-movement currency lock becomes enforceable when the Cash Movement domain is introduced in V1-CASH-003; no posted Cash Movement can exist in this baseline.

## Technical Validation

- `git diff --check`: PASS
- `pnpm exec tsc --noEmit`: PASS using the Windows `pnpm.cmd` shim
- `pnpm run build`: PASS using the Windows `pnpm.cmd` shim
- Domain smoke: PASS
- Console errors: 0
- Page exceptions: 0

## Scope Exclusions

- CashMovement: not added
- Opening balance in Safe: not added
- Payment, Expense, Sales, Purchase integration: not added
- Basic Ledger: not added
- Page, route, navigation: not added
- Firebase UID/providerUserId account fallback: not added
- `.env`, `.firebase/`, and `outputs/`: untouched

## Result

PASS
