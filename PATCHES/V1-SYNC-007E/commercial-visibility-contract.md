# Commercial Visibility Contract

## Visibility Invariant

A device must never treat any of the following as authoritative by itself:

- executed InvoiceReturn without every required `sale_return` movement;
- execution `sale_return` movement without its committed InvoiceReturn;
- issued Invoice without every required `sale_deduction` movement;
- cancelled Invoice without every required cancellation `sale_return` movement;
- Product opening state without its opening StockMovement when the command requires both.

## Committed Group Contract

Every member of a multi-record authoritative command carries the same immutable `publicationId`. One commit marker under `commercialGroupCommits/{publicationId}` contains:

- account ID;
- command and group type;
- command/request checksum;
- ordered required member descriptors;
- member module, path, ID, revision, and checksum;
- accepted receipt ID;
- committed timestamp;
- schema version.

The marker and all final members are written in one trusted atomic multi-location update.

## Pull and Listener Behavior

Future pull/listener/cache contracts must:

1. validate account and path identity;
2. detect a member's publication ID;
3. buffer the member if its commit marker has not been observed;
4. load or wait for the marker;
5. verify all required member descriptors and checksums;
6. apply the complete group to raw cache/state without replaying commands;
7. mark the local publication applied only after every cache member succeeds;
8. retain conflict evidence on any mismatch;
9. never synthesize a missing StockMovement from an Invoice or Return;
10. never expose staged/incomplete members to derived inventory calculations.

For a final atomic update, marker and members exist in one committed database state even if callbacks arrive separately. The buffering contract prevents UI/cache timing from becoming a false partial state.

## Bootstrap Completeness Gate

Second-device bootstrap must not declare canonical readiness until:

- every committed group marker has all required member paths present;
- member revisions and checksums match the marker;
- no member references a missing commit;
- no commit references a missing member;
- derived inventory from committed StockMovements matches verified source data;
- unresolved publication conflicts are zero.

Incomplete groups are quarantined and block cutover/readiness. They are not repaired by replaying business commands.

## Scope Recommendation

The visibility model should apply before cutover to every multi-record command that crosses authoritative records:

1. Invoice issue plus sale deductions.
2. Invoice cancellation plus sale returns.
3. InvoiceReturn execution plus sale returns.
4. Product creation plus opening StockMovement.

Commercial groups are the first mandatory implementation target. Product opening should adopt the same generic publication marker before full multi-device cutover so a Product and its opening inventory effect cannot be split across devices.

## Current Invoice Alignment

V1-SYNC-007C currently acknowledges the Invoice transition before later StockMovements. This provides ordered recovery but permits transient partial visibility. A later trusted publication mission must replace client member-by-member cloud publication for issue and cancellation before cutover.

## No Command Replay

Pull and bootstrap apply committed records only. They never call:

- issue Invoice;
- cancel Invoice;
- execute InvoiceReturn;
- add inventory movement through a business service;
- create Payment, CashMovement, or LedgerEntry.

## Corruption States

- Member without commit: quarantine.
- Commit without member: quarantine and trusted repair.
- Same publication ID with different member checksum: hard conflict.
- Accepted receipt without commit: invalid; accepted must be written in the final atomic update.
- Processing receipt without commit: valid recoverable intermediate state.

## Current State

- Atomic commercial visibility implemented: NO.
- Commit-marker-aware pull implemented: NO.
- Bootstrap completeness gate implemented: NO.
- Cutover ready: NO.
