# V1-SYNC-006E - Group Cloud Readiness Gate

## Risk

V1-SYNC-005 has Product cloud transport. V1-SYNC-006E deliberately does not
have StockMovement cloud transport. Dispatching sequence 1 before discovering
that sequence 2 is unsupported would expose a cloud Product without its
opening-stock intent.

## Gate

`SyncCloudCapabilityRegistry` records exact module/operation capabilities.
Runtime registration currently includes create/update for Products, Customers,
and Suppliers. It intentionally excludes `stockMovements/append`.

For a grouped operation, cloud eligibility now requires:

1. valid complete group;
2. every required member locally applied;
3. no local/cloud conflict or failure;
4. every required member supported by a registered cloud capability;
5. every earlier sequence acknowledged.

Both `PersistentOutboxRepository.getPending()` and `markSyncing()` enforce the
same predicate. The coordinator therefore receives neither member of the
Product/opening group, and silent transport failure is not the safety
mechanism.

## Current Result

| Operation | Capability | Cloud result |
| --- | --- | --- |
| grouped Product create | registered individually | BLOCKED by unsupported required sibling |
| grouped opening movement append | not registered | BLOCKED |
| ungrouped zero-opening Product create | existing behavior | ELIGIBLE |

Focused tests proved zero transport calls for a locally complete group and
proved that direct `markSyncing()` attempts for both members are rejected.

## Future Boundary

Registering a StockMovement transport capability is owned by a later accepted
mission. This mission adds no transport, RTDB rule, listener, database deploy,
or operational Firebase write. A capability registration alone must not be
treated as approval for cloud cutover or second-device visibility.
