# V1-SYNC-006C - Crash Recovery Matrix

## Recovery Preconditions

The matrix assumes the recommended future implementation:

- complete members captured by one account-outbox write;
- stable Product, movement, group, operation, and idempotency identities;
- Product and StockMovement cache-only appliers;
- immutable member payload checksums;
- group-aware local reconciliation;
- no business-command replay.

## Scenarios A-G

| Scenario | Durable state at crash | Cache state | Required recovery | Duplicate effects |
| --- | --- | --- | --- | --- |
| A. Before group persistence | no group members | no Product, no movement | caller may retry the same command identity; first successful batch capture creates the group | 0 |
| B. After group persistence, before any local apply | complete group, both members pending | no Product, no movement | reconciler applies Product once, then movement once, marks both applied | 0 |
| C. After Product local apply, before opening movement local apply | complete group; Product member may be pending marker or applied; movement pending | Product only | inspect Product; matching payload is already applied; apply movement once; mark group locally complete | 0 |
| D. After movement local apply, before movement applied marker | complete group; movement marker pending | Product and movement present | deterministic movement ID/checksum reports already applied; mark movement applied; complete group | 0 |
| E. After both local applies, before group completion/caller success | complete group; both records match | Product and movement present | derive all-members-applied, persist any missing markers, return/recover exact result | 0 |
| F. Product diverges from intended payload | complete group | conflicting Product; movement may be absent | mark group conflict; do not overwrite Product and do not apply missing movement blindly | 0 new effects |
| G. Opening movement ID exists with different payload | complete group | Product may match; divergent movement exists | mark group conflict; do not overwrite, append alternate movement, or delete Product | 0 new effects |

## Marker Failures

A cache write can succeed before its member marker write. The applier's
`inspect()` must compare canonical intended payload with the stable local
record. Exact equality produces `already_applied`; divergence produces
`conflict`. A technical inspection failure remains `failed` and is retried only
under the bounded V1-SYNC-004A policy.

Group local completion is derived from member markers, so a crash before a
separate group-complete marker cannot lose intent. No additional mutable group
marker is required.

## Cloud Crash Recovery

Cloud processing begins only after all local members are applied.

| Cloud scenario | Required behavior |
| --- | --- |
| Crash before first cloud member | both remain pending |
| Product acknowledged, movement not started | Product receipt retained; group is cloud-partial; movement remains pending |
| Write succeeds but local receipt persistence is interrupted | transport recovers by exact cloud receipt/record identity; no second write effect |
| Movement exact record already exists | acknowledge only when canonical payload/checksum matches |
| Movement ID exists with divergent payload | conflict; original cloud record remains immutable |
| Both receipts durable before cleanup | remove all grouped outbox members in one outbox write |

No scenario replays Product creation, opening-stock commands, invoice commands,
or inventory commands during pull or reconciliation.

## Account Switch And Logout

Reconciliation validates the active logical account before every member. A
logout or account switch stops before the next member and leaves the complete
group durable. Starting the correct account later resumes from member
inspection. No member from account A can be applied under account B.

## Legacy Boundary

Existing Products and StockMovements have no group manifest and remain
unchanged. Startup must not scan them to invent groups or opening movements.
Only future commands captured after the later integration mission use this
matrix.
