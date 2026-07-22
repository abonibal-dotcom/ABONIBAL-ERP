# Idempotency and Lease Recovery

## Atomic Claim

The Firebase receipt repository uses one RTDB transaction at the account-scoped receipt path.

First request:

- creates `processing`;
- stores the server request checksum;
- assigns a random lease ID;
- sets a bounded lease expiry;
- sets `attemptCount` to 1.

Concurrent exact retry with an active lease returns the current processing receipt and does not run a second handler. The emulator transaction test produced exactly one acquired claim and one processing result.

Same command ID with another request checksum returns command conflict without overwriting the original receipt or creating another receipt.

## Lease Recovery

An exact retry after lease expiry can reacquire the receipt transactionally with a new lease and increments `attemptCount`. A different checksum cannot acquire the expired lease.

Completion requires the same account, command ID, request checksum, and active lease ID. A divergent completion is rejected as receipt-state conflict.

## Exact Retry

- Accepted retry returns the same accepted result and checksum.
- Rejected retry returns the same rejection.
- Conflict retry returns the same conflict.
- Active processing retry does not run another handler.
- Timeout after durable terminal completion is resolved by receipt lookup.

## Failure Recovery

| Scenario | Result |
| --- | --- |
| A. Failure before claim | No receipt |
| B. Failure after claim before handler completion | Processing receipt remains |
| C. Handler completes but final write fails | Same request can reclaim after expiry; synthetic idempotent effect remains one |
| D. Handler rejects | Receipt becomes rejected |
| E. Handler reports conflict | Receipt becomes conflict |
| F. Caller times out after accepted receipt | Lookup returns accepted result |
| G. Same command ID with changed target/payload | Conflict, no overwrite |

Foundation handlers must be idempotent by command ID. This mission does not claim allocation, publication, or commercial side-effect idempotency because no operational handler exists yet.
