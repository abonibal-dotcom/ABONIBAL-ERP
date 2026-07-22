# V1-SYNC-007A Invoice Lifecycle Alignment

## Current Lifecycle

The accepted lifecycle is:

`draft -> issued -> cancelled`

Current local draft deletion is physical. This compatibility behavior remains draft-only. Future cloud deletion must use a tombstone and is not implemented here.

## Revision Contract

- New drafts start at revision `0`.
- A draft update requires the caller's expected revision.
- A successful draft update increments revision once.
- Issue and cancellation each increment revision once.
- Legacy records without revision are read as revision `0` for an explicit allowed transition; storage is not rewritten on read.
- A stale expected revision is rejected.

## Repository Guard

The repository must reject account/ID changes, duplicate IDs, invalid revision progression, illegal status transitions, issued/cancelled destructive updates, and removal of any non-draft Invoice.

Allowed persisted transitions are:

- `draft -> draft` for explicit draft edit;
- `draft -> issued` with unchanged commercial snapshot and deterministic deduction references;
- `issued -> cancelled` with unchanged issued commercial snapshot and deterministic reversal references.

No `issued -> draft`, `cancelled -> draft`, `cancelled -> issued`, issued same-status update, or cancelled same-status update is permitted.

## Issued Snapshot Immutability

Invoice ID, accountId, document number, customer ID/snapshot, Product line snapshots, quantities, prices, discounts, taxes, totals, notes, creation audit, issued audit, and original deduction references remain unchanged after issue. Cancellation may only add cancellation audit, cancellation command identity, and reversal references.

## Human Number Boundary

The current local number remains unchanged for local compatibility. It is display/business identity only and is not used as the stable record, command, line, or movement identity. Trusted account-scoped numbering remains unresolved until the later canonical transaction mission.
