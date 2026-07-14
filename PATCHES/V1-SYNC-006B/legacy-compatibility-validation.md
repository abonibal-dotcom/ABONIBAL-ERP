# V1-SYNC-006B Legacy Compatibility Validation

## Method

The focused smoke suite uses an in-memory implementation of the existing
`Driver` contract. It seeds exact legacy-shaped records directly under the
account-scoped `stockMovements:{accountId}` key, resets its write counter, and
then runs current repository/service reads and reversal attempts.

No real localStorage, Firebase project, or user data is read or changed.

Command:

```text
pnpm dlx tsx scripts/v1-sync-006b-stock-movement-reversal-smoke.ts
```

Result: PASS, 14/14 total focused checks.

## Legacy Record Matrix

| Case | Expected | Result |
| --- | --- | --- |
| Legacy normal record | readable; quantity effect preserved | PASS |
| Legacy voided record | readable; zero effect preserved | PASS |
| Legacy void fields | remain byte/domain-equivalent | PASS |
| Read and derive quantity | zero persistence writes | PASS |
| Legacy voided reverse request | rejected | PASS |
| Synthetic reversal creation | zero | PASS |
| Existing legacy record rewrite | zero | PASS |
| Existing IDs | unchanged | PASS |

## Byte-Stability Evidence

The suite serializes the seeded local array before reads, executes `getAll()`,
`getCurrentQuantity()`, and the rejected legacy reversal path, then compares the
stored array afterward.

- storage writes after read-only derivation: `0`;
- storage writes after rejected legacy reversal: `0`;
- before/after serialized legacy data: identical;
- legacy void fields preserved: PASS;
- automatic V2 marker insertion into old records: `0`.

## Derived Quantity Evidence

### Legacy-only ledger

```text
legacy normal: +10
legacy voided: +5, zero effect under accepted legacy semantics
expected: 10
actual: 10
```

### Mixed ledger

```text
legacy normal: +10
legacy voided: +5, zero effect
V2 correction: -3
V2 reversal: +3
expected: 10
actual getCurrentQuantity: 10
actual getCurrentQuantities: 10
```

The mixed ledger was also byte-stable across both calculations.

## Safety Conclusions

- historical balances remain unchanged by the code upgrade;
- old records are not rewritten on startup or read;
- legacy `voidedAt` continues to neutralize only a legacy record;
- a legacy-voided record cannot receive a new reversal in baseline;
- no migration, backfill, synthetic reversal, ID rewrite, or local delete ran;
- V1-SYNC-009 remains the migration owner.
