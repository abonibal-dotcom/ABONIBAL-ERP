# V1-SYNC-007H Publication Crash Recovery

## Failure Matrix

| Failure point | Durable result | Retry behavior |
| --- | --- | --- |
| Before allocation commit | Reservation only | Commit and publish may retry |
| During allocation transaction | No partial aggregate/commit | Transaction retries or conflicts |
| After allocation commit, before Phase B | Immutable commit; no Phase B member | Exact commit match, then publish once |
| Before account-root update | No Phase B member | Full preflight repeats |
| RTDB multi-location update failure | No partial Phase B member | Full update remains retryable |
| After successful update, before response | All members and marker exist | Exact retry returns `exactMatch` |
| Marker exists but a member differs/misses | Conflict evidence | No silent repair or overwrite |
| Deterministic movement ID has other data | Conflict evidence | Existing movement preserved |

## Concurrency

The receipt processing lease is the distributed command-serialization gate.
The Firebase repository additionally serializes same-publication calls in one
process so concurrent exact retries result in one physical Phase B update.
Arbitrary callers cannot bypass receipt identity and lease checks through this
internal service contract.

Emulator validation proved one logical marker, one movement per Return line,
no duplicate allocation commit, and recovery after a synthetic pre-update
crash.
