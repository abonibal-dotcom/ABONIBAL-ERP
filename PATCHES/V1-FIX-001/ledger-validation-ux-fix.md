# Ledger Draft Validation UX Fix

## Root cause

The ledger page had the required service invariants, but the UI rendered zero
values in both amount fields, allowed both to be filled, retained fully empty
rows in validation, and disabled the draft-save action without explaining why.

## Fix

- Entering a positive debit clears credit in the same row; entering a positive
  credit clears debit.
- Empty amount inputs render blank rather than as paired zeros.
- Fully empty rows are excluded from the submission payload and the page states
  this visibly. Partially completed rows remain visible and block submission
  with an explanation.
- The page presents direct validation feedback for missing posting accounts,
  missing amounts, debit/credit conflicts, insufficient valid lines, and
  unbalanced totals.
- The existing active posting-account filter and JournalEntryService
  invariants remain unchanged. Draft entries still have no balance effect.

## Required owner Preview retest

1. Create two active posting accounts with the same currency.
2. Create a valid two-line `10 / 10` draft, reload, post it, and reverse it.
3. Confirm an inactive or aggregation account cannot be selected.
4. Confirm missing account, both-side amount, unbalanced, one-line, and extra
   blank-line scenarios show a visible explanation.
5. Confirm posted and reversed entries remain immutable.

## Validation

- TypeScript: PASS
- Production touched: NO
- TEST live deployment: NO
- Browser interaction validation: pending owner Preview retest.
