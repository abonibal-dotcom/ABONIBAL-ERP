# V1-SYNC-006 Cloud Partial-State Recovery

## Tested Failure Sequence

The synthetic transport test executes this ordered group:

1. Product sequence 1 succeeds and is acknowledged.
2. Opening StockMovement sequence 2 fails transiently.
3. The durable group retains Product acknowledgement and pending movement state.
4. Coordinator processing is stopped and recreated.
5. Processing resumes at the movement member.
6. The movement succeeds and the completed group is cleaned up.

## Verified Results

- Product logical cloud create count: 1.
- Opening movement logical cloud create count: 1.
- Product acknowledgement survives movement failure: PASS.
- Failed movement remains retryable: PASS.
- Restart resumes the movement member: PASS.
- Restart does not recreate Product: PASS.
- Product failure prevents movement dispatch: PASS.
- Final cleanup occurs only after required acknowledgements: PASS.
- No destructive rollback: PASS.
- No duplicate inventory effect: PASS.

## Other Recovery Gates

- Crash after outbox persistence before cache apply recovers once.
- Crash after cache apply before applied marker recognizes the existing record.
- Identical cloud movement returns idempotent match.
- Same movement ID with divergent immutable payload returns conflict.
- A group conflict/failure blocks later members according to the durable group contract.

The recovery guarantee is ordered completion, not cloud transaction atomicity.
