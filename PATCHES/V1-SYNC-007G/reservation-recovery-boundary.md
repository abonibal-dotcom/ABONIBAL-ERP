# V1-SYNC-007G Reservation Recovery Boundary

## Durable Processing Reservation

After a successful transaction, the processing reservation and its aggregate
effect remain canonical even if the caller times out or the trusted process
stops. An exact retry with the same command, checksum, Return revision/checksum,
and line payload returns the existing reservation and changes neither aggregate
nor revision.

Failure behavior was validated as follows:

- Invalid input before canonical reads: no reads and no allocation write.
- Canonical read failure: no allocation transaction.
- Failure after reads/before transaction commit: no allocation state.
- Capacity abort: no partial line aggregate.
- RTDB contention/retry: deterministic single accepted capacity result.
- Success followed by caller timeout/crash: exact retry recovers the same state.
- Corrupt subtree: conflict with no automatic overwrite.

## Deliberately Deferred

V1-SYNC-007G does not expire or release abandoned reservations. It also does not
commit allocations, publish an executed InvoiceReturn, create a StockMovement,
or complete an operational command receipt. A later trusted recovery/publication
mission must revalidate the source Return before commit and decide explicit
commit/release evidence. Clients must never release a processing reservation.

The pre-read of Invoice/Return and the per-Invoice allocation transaction are
separate RTDB operations by the approved architecture. The reservation stores
the exact source revision/checksum so a future publication step can reject stale
source state rather than silently publish it.
