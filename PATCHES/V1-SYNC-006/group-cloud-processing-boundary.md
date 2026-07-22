# V1-SYNC-006 Group Cloud Processing Boundary

## Capability Transition

The Product plus opening-stock group contains:

1. Product create, sequence 1.
2. Opening StockMovement append, sequence 2.

Before `stockMovements/append` capability registration, the complete group is cloud-blocked. After registration, the group becomes cloud-capable but is eligible only when all members are locally applied, no member is failed or conflicted, and ordering prerequisites are satisfied.

The transition was tested explicitly:

- Before StockMovement capability: blocked.
- After StockMovement capability: Product sequence 1 eligible.
- Movement sequence 2 cannot overtake Product.

## Capture Boundary

V1-SYNC-006E already creates the opening movement as group member 2. V1-SYNC-006 does not enqueue a second operation for that movement. The grouped product application service continues to use the raw StockMovement cache repository because the durable group already owns capture.

Zero-opening Product creation remains the ungrouped single Product operation. Ordinary Product create/update behavior remains V1-SYNC-005 behavior.

## Cloud Ordering

The coordinator sends Product first. The opening movement is dispatched only after Product acknowledgement. A Product failure blocks movement dispatch. A retained Product acknowledgement is not destructively replayed when movement delivery is retried.

## Visibility Limitation

Cloud behavior is ordered and recoverable, not atomically visible as one all-or-nothing unit. A transient cloud state may expose the Product after sequence 1 acknowledgement and before sequence 2 movement acknowledgement.

This limitation is accepted only for the TEST foundation. Before multi-device cutover, architecture review must decide whether an atomic multi-location write, visibility gate, bootstrap completeness gate, or equivalent mechanism is required.

V1-SYNC-006 is not a migration, bootstrap, or cutover approval.
