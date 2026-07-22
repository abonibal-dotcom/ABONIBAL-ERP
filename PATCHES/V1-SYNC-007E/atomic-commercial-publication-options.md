# Atomic Commercial Publication Options

## Required Published Unit

An accepted InvoiceReturn execution must make the following one commercial unit:

- InvoiceReturn `recorded -> executed` envelope;
- one deterministic `sale_return` StockMovement per Return line;
- allocation events advanced from `reserved` to `committed`;
- trusted accepted receipt;
- final Return number assignment reference;
- publication/commit marker.

No accepted lifecycle currently permits partial line execution.

## Options

| Option | Strength | Failure mode | Assessment |
| --- | --- | --- | --- |
| Ordered member dispatch | Durable retry order | Other devices can observe commercial state before all movements | Insufficient for cutover |
| RTDB atomic multi-location update only | Database commits all listed paths together | Independent client listeners can still render separate callbacks without a group contract | Necessary but not sufficient alone |
| Staged business records then commit marker | Explicit visibility state | Adds staged-record cleanup and broad reader complexity | Viable, but unnecessary if final records are written only at commit |
| Atomic update plus commit marker | Atomic database state plus explicit application visibility | Requires pull/listener buffering by commit ID | Recommended |
| Bootstrap completeness gate only | Protects initial second-device load | Does not make an individual command atomic | Required supplement, not a publication mechanism |

## Recommended Publication Model

Use a two-phase recoverable trusted process:

1. **Reserve:** trusted transaction reserves all line allocations and stores/reuses command identity evidence.
2. **Publish:** one RTDB atomic multi-location `update()` writes every final commercial member, advances allocation events to committed, writes the accepted receipt, and writes the commit marker.

Each published member carries `publicationId` or equivalent immutable commit reference. The commit record lists member paths, record IDs, revisions, and canonical checksums.

Recommended marker path:

`accounts/{accountId}/commercialGroupCommits/{groupId}`

The group ID is deterministic and derived from the stable command identity.

## Why Both Atomic Update and Marker

RTDB multi-location update provides an all-success/all-fail database write. The marker adds an application-level contract for independent module listeners and bootstrap:

- a cache adapter does not expose a member as authoritative until the commit marker exists;
- it verifies every required member ID/revision/checksum from the marker;
- callbacks arriving in any order are buffered safely;
- bootstrap rejects or quarantines an incomplete group;
- reconciliation has one durable completeness record.

The marker is written in the same atomic update as all final members. There is no separate "mark committed" write after publication.

## Retry Contract

- No reservation: run canonical validation transaction.
- Exact reserved command: reuse reservation and assigned number.
- Exact committed command: return the accepted receipt without writing again.
- Same identity with different checksum: conflict.
- Some final member already exists without the matching commit: quarantine and trusted recovery; never overwrite silently.
- Final atomic update reports failure: no final member or accepted receipt is considered committed; retry the exact update.
- Client timeout after successful update: read commit and receipt, then return the original result.

## Number Assignment Boundary

Number allocation occurs after business validation and is bound durably to command ID before publication. The final atomic update writes the assigned number into the commercial record and the accepted receipt. Exact retry reuses it.

## Cloud Atomicity Claim

The recommended model can claim atomic final database publication only after the full multi-location update and commit-marker verification are implemented and tested. It does not claim that the earlier allocation and number reservations are one distributed transaction; their crash windows are handled by durable processing evidence and idempotent recovery.

## Current State

Current Invoice issue/cancellation cloud behavior is ordered and recoverable but not atomically visible. InvoiceReturn execution is cloud-blocked. No publication model described here is implemented by V1-SYNC-007E.
