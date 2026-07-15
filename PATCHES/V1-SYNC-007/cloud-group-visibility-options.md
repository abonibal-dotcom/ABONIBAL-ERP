# V1-SYNC-007 Cloud Group Visibility Options

## Scope

This document evaluates cloud publication models for the two commercial mutation groups identified by the audit:

- Invoice issue or cancellation plus N StockMovements;
- InvoiceReturn execution plus N StockMovements.

It does not implement a transport, command endpoint, Firebase rule, migration, or cutover.

## Required Property

A second device must not observe an inventory effect without the commercial record that explains it, or a commercial lifecycle transition without all of its inventory effects. Exact retries must return the same canonical result, while the same identity with a different payload must fail as a conflict.

## Options

| Option | Strength | Main limitation | Cutover assessment |
| --- | --- | --- | --- |
| A. Ordered member processing | Deterministic retry order and partial acknowledgement recovery | Other devices can observe intermediate members | Rejected as the sole cutover boundary |
| B. RTDB atomic multi-location update | All listed paths become visible together | A blind update cannot safely calculate inventory availability, cumulative returns, numbering, and revision races | Useful only after trusted validation has produced a complete canonical write set |
| C. Visibility/commit marker | Readers can ignore groups without a final marker | Every reader and query must filter correctly; orphaned staged records need recovery | Possible, but more error-prone than atomic publication for current V1 scope |
| D. Staged records plus published-group marker | Strong explicit publication state and auditability | Adds staging schema, cleanup/recovery rules, reader complexity, and another lifecycle | Viable later if group size or server workflow outgrows one atomic update |
| E. Bootstrap completeness gate | Prevents a new device from entering an incomplete canonical state | Does not make an individual commercial command atomic | Required as a supplementary cutover gate, not a command solution |

## V1-SYNC-006D Assessment

The durable mutation group foundation is suitable for local intent capture, deterministic member ordering, transport capability checks, and partial acknowledgement recovery. It can represent arbitrary module members, including one Invoice or InvoiceReturn and N StockMovements.

It does not currently provide atomic cloud visibility. Cloud members are dispatched individually, so it is not by itself sufficient for Invoice or InvoiceReturn cutover.

## Recommended Commit Model

Use a trusted account-scoped commercial command boundary for issue, cancellation, and return execution. The command must:

1. authenticate the Firebase user and resolve explicit membership without treating UID as accountId;
2. load the canonical account-scoped Invoice, InvoiceReturn, and StockMovement state;
3. validate expected revision and legal lifecycle transition;
4. validate canonical stock availability or cumulative return allocation;
5. allocate the final document number when required;
6. derive deterministic member IDs and canonical checksums;
7. reject a divergent retry and return the original result for an exact retry;
8. publish the commercial record, all StockMovements, and an idempotency/group receipt in one RTDB atomic multi-location update.

The client durable group remains the recoverable command intent. The trusted command turns that intent into one canonical cloud result. Pull applies the resulting records to cache only.

## Where Atomic Multi-Path Update Fits

Atomic multi-path update is appropriate when the complete validated write set is already known, including:

- the final Invoice or InvoiceReturn envelope;
- all deterministic StockMovement envelopes;
- the idempotency/group receipt;
- any trusted numbering receipt or counter result bound to the same command.

It is not sufficient as a blind client operation for:

- draft revision races;
- canonical stock sufficiency;
- cumulative return allocation across records;
- account-wide document numbering;
- arbitrary cross-record arithmetic;
- recovery from a different payload using the same identity.

## RTDB Rules Boundary

Rules can enforce:

- authenticated account membership;
- accountId/path consistency;
- immutable IDs and ownership fields;
- create-only StockMovement paths;
- revision increment and simple lifecycle transitions;
- issued/executed field immutability;
- draft tombstone shape and delete denial;
- denial of client writes to trusted receipts/counters if those paths are server-owned.

Rules alone should not be claimed to enforce:

- canonical stock sufficiency across the ledger;
- cumulative return quantity across multiple Return records;
- exact invoice totals across collections;
- account-wide sequential number allocation;
- complete group membership and checksum agreement;
- complex command idempotency and conflict recovery.

Those invariants require the trusted transaction/application boundary.

## Cutover Gate

Commercial synchronization may not become canonical until:

- all required transports are present;
- trusted command and atomic publication tests pass;
- group completeness is proven after retry and interrupted delivery;
- pull remains cache-only;
- bootstrap rejects incomplete commercial/inventory state;
- migration counts, IDs, hashes, numbering conflicts, and derived inventory are verified;
- the owner explicitly approves cutover.
