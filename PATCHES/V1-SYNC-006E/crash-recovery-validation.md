# V1-SYNC-006E - Crash Recovery Validation

The focused harness uses real Product and StockMovement repositories, the real
Product codec/applier, the new raw StockMovement applier, the accepted durable
group capture, and the accepted reconciler.

| Scenario | Injected boundary | Result |
| --- | --- | --- |
| A | batch write fails before group persistence | no group member, Product, or movement |
| B | complete group persisted; Product apply fails before cache write | group retained; restart reconciliation applies Product once then movement once |
| C | Product applied and marked; movement apply fails | Product retained once; reconciliation appends movement once |
| D | movement cache write succeeds; applied-marker write fails | matching movement detected on retry; marker repaired; no duplicate effect |
| E | both members applied; caller retries after lost success | same group and members returned; no Product or movement duplicate |
| F | stable Product ID already contains divergent Product payload | Product member conflicts; movement is not blindly applied |
| G | stable opening movement ID already contains divergent payload | movement member conflicts; no alternate movement; cloud group blocked |

## Exact Retry

- Product count: `1`.
- Opening StockMovement count: `1`.
- Logical group count: `1`.
- Durable members: `2`.
- Product ID, movement ID, operation IDs, member checksums, and group checksum:
  unchanged.
- Derived quantity after quantity `+10` retry: `10`, not `20`.

## Failure Semantics

Batch persistence failure performs zero operational cache writes. A local
apply failure retains the complete durable group. Recovery performs raw cache
inspection/application only and replays zero Product, Inventory, Invoice, or
reversal business commands.

Focused result: **PASS (`39/39`)**, including scenarios A-G.
