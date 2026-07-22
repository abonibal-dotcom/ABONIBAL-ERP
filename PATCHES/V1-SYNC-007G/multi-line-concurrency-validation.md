# V1-SYNC-007G Multi-Line and Concurrency Validation

## Environment

- Firebase project namespace: `abonibal-erp-test`
- Data backend: local RTDB Emulator on port `9001`
- Repository: `FirebaseReturnAllocationRepository`
- Transaction root: one `returnAllocations/{invoiceId}` subtree
- Live TEST writes: `0`

## Results

| Scenario | Result |
| --- | --- |
| Concurrent 6 + 6 against sold 10 | PASS: one `reserved`, one `RETURN_ALLOCATION_EXCEEDED`, aggregate `6` |
| Concurrent 4 + 6 against sold 10 | PASS: both reserved, aggregate `10` |
| Concurrent exact duplicate | PASS: one `reserved`, one `exactMatch`, one aggregate increment |
| Concurrent same command with different payload | PASS: one reserved, one conflict, one reservation |
| Multi-line request with one overflowing line | PASS: whole request rejected, no allocation root created |
| Distinct Invoice transactions | PASS: both isolated per Invoice |
| Retry after simulated post-transaction timeout | PASS: exact match, no second increment |
| Corrupt existing aggregate | PASS: conflict, original corrupt evidence left untouched |

The concurrency tests use real Admin RTDB transactions under Emulator
contention. They are not sequential-only simulations.

## Multi-Line Invariant

All requested lines are checked inside the same callback before state is
returned. For sold capacities `5` and `3`, a request for `2` and `4` is rejected
without reserving `2` on the first line. Aggregate duplicate increments observed:
`0`.
