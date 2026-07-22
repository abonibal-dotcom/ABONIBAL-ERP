# V1-SYNC-007 Recommended Implementation Roadmap

## Guiding Constraints

- Default SyncMode remains `disabled`.
- Existing local Invoice and InvoiceReturn records are not scanned, uploaded, renumbered, or rewritten during implementation missions.
- Firebase UID remains authentication and membership identity only, never accountId.
- Pull applies canonical records to raw cache/state only and never invokes business commands.
- Issued, cancelled, and executed commercial history is never hard-deleted.
- StockMovement remains the inventory source of truth; Product.quantity remains non-authoritative.
- Production and unrelated Firebase projects remain untouched.

## V1-SYNC-007A - Invoice and InvoiceReturn Domain Lifecycle Alignment

Purpose: remove domain blockers before adding a cloud transport.

Minimum work:

- add revision/expectedRevision contracts for mutable drafts and recorded returns;
- preserve stable Invoice/Return line IDs across edits;
- introduce stable command IDs and deterministic movement identities;
- align InvoiceReturn authenticated account validation with InvoiceService;
- define draft tombstones without changing issued history;
- make issue, cancellation, and return execution retry-adopt existing exact members and reject divergent members;
- define the final-number assignment boundary without rewriting existing numbers;
- preserve current Product and Customer snapshots.

Acceptance gates:

- stale mutable updates conflict;
- exact command retry is idempotent;
- same identity with different payload conflicts;
- partial local failure can resume without duplicate movements;
- no historical upload or migration occurs.

## V1-SYNC-007B - Commercial Transaction and Atomic Group Foundation

Purpose: add only the shared boundary that V1-SYNC-006D does not provide.

Minimum work:

- define trusted account-scoped command envelopes and receipts;
- validate membership without deriving accountId from UID;
- implement trusted numbering and canonical business validation;
- bind complete Invoice or Return groups to one atomic RTDB publication;
- enforce server-owned receipt/counter paths and commercial immutability rules;
- retain the existing local durable group for intent and recovery.

Acceptance gates:

- interrupted/retried commands publish one canonical group;
- no device observes a partial commercial/inventory group;
- exact retry returns the original receipt;
- divergent retry fails without overwrite;
- no client can bypass trusted issue/return invariants.

## V1-SYNC-007C - Invoice Repository Sync Integration

Purpose: integrate Invoice drafts and lifecycle records after 007A/007B pass.

Minimum work:

- add Invoice cloud envelope, capability, transport, and constrained cache applier;
- support revisioned draft create/update and draft tombstone;
- route issue/cancellation through complete durable groups and trusted commands;
- apply cloud pull without invoking InvoiceService or InventoryService commands;
- add account/path/schema/checksum validation and conflict evidence.

Acceptance gates:

- draft conflicts are explicit;
- issued snapshots are immutable;
- issue/cancellation groups are atomic and idempotent;
- multi-device number uniqueness passes;
- inventory and Invoice explanations are jointly visible.

## V1-SYNC-007D - InvoiceReturn Repository Sync Integration

Purpose: integrate Return recording/execution after Invoice sync is stable.

Minimum work:

- add InvoiceReturn envelope, capability, transport, and constrained cache applier;
- support recorded Return revision/CAS behavior;
- route execution through trusted cumulative allocation and atomic group publication;
- preserve deterministic sale_return references and exact retry behavior;
- keep pull cache-only.

Acceptance gates:

- partial and multiple returns remain supported;
- concurrent over-return has one winner and one explicit conflict;
- executed Return plus all movements appear atomically;
- exact retry does not duplicate inventory;
- Invoice records remain unchanged by Return pull.

## V1-SYNC-007E - Commercial Sync Regression and Cutover Gate

Purpose: prove the combined commercial and inventory system before any migration or canonical cutover.

Required proof:

- two-device draft, issue, cancellation, recorded Return, and executed Return scenarios;
- offline/retry/stale-revision/conflict/partial-ack recovery;
- final-number uniqueness and exact-retry retention;
- complete Invoice/Return and StockMovement visibility;
- derived inventory equality on both devices;
- account isolation, immutable history, and zero command replay on pull;
- Default SyncMode remains disabled;
- no existing record upload.

## V1-SYNC-009 - Migration and Owner-Approved Cutover

Migration remains separate. It must be non-destructive and idempotent, preserve IDs and accepted historical numbers, stop on conflicts, compare counts/IDs/hashes and derived inventory, retain local data, and require explicit owner approval before Firebase becomes canonical.

## Stop Condition

Do not begin any implementation mission until SALESYNC-DEC-001 through SALESYNC-DEC-020 are approved. A rejected or materially changed decision requires updating this architecture before implementation.
