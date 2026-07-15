# Commercial Group Cloud Capability Boundary

## Current Capabilities

| Module | Local applier | Cloud transport/capability |
| --- | --- | --- |
| Invoice | Present, lifecycle-state only | Absent |
| InvoiceReturn | Present, lifecycle-state only | Absent |
| StockMovement append | Present | Present |

The existing group eligibility rule requires every required group member to be
cloud-capable before any member may dispatch. It also preserves group sequence.

## Measured Result

For locally complete issue, cancellation, and return-execution groups:

- `getPending(...)` returned zero members.
- `markSyncing(...)` rejected every commercial group member.
- Commercial cloud dispatch count: `0`.
- Isolated `sale_deduction`/`sale_return` cloud leak count: `0`.

No Invoice or InvoiceReturn transport/capability was registered. No Firebase
rules changed. Operational live RTDB writes/listeners were `0 / 0`.

## Future Capability Transition

Future missions may register Invoice and InvoiceReturn transports. Until every
required member of a group is supported, the whole group remains blocked.
Current ordering metadata is preparation only; cloud atomic publication is not
guaranteed and cutover is not approved.
