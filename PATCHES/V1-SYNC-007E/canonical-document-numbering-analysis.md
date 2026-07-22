# Canonical Commercial Document Numbering Analysis

## Current Behavior

Invoices and Returns currently derive daily human numbers from records visible in local account storage:

- `INV-YYYYMMDD-NNNN`
- `RET-YYYYMMDD-NNNN`

The stable record UUID remains separate and is the correct primary identity. The local sequence is not safe for multi-device uniqueness because two devices can compute the same next value.

## Options

| Option | Uniqueness | Retry behavior | Offline behavior | Audit and compatibility | Assessment |
| --- | --- | --- | --- | --- | --- |
| Account/day/type transactional counter | Strong under trusted transaction | Command-to-number binding returns the same number | Final number requires online trusted authority | Preserves current format and supports clear audit | Recommended |
| One global account sequence | Strong and less daily contention | Strong | Online required | Changes current business format or embeds date only decoratively | Safe but less compatible |
| Device-prefixed numbers | Reduces collisions without central authority | Strong locally | Good | Changes format and does not create one canonical sequence | Rejected for final commercial numbers |
| Server timestamp plus sequence/random suffix | Strong identity but less human-friendly | Strong | Online required | Large format change | Rejected for current V1 contract |
| Client local sequence with conflict repair | Weak | Conflict after user has seen number | Offline-friendly | Requires renumbering or duplicates | Rejected |

## Recommended Counter Model

Use trusted account-scoped counters by document type and business date:

`accounts/{accountId}/documentNumberCounters/{documentType}/{businessDate}`

Bind every allocation to the command ID:

`accounts/{accountId}/documentNumberAllocations/{commandId}`

The allocation transaction:

1. returns an existing assignment for the same command ID and checksum;
2. conflicts on the same command ID with a different checksum;
3. increments the applicable counter once;
4. stores sequence, formatted number, document type, business date, command ID, and audit metadata;
5. never exposes counter write authority to ordinary clients.

## Invoice Policy

- UUID is assigned at draft creation and remains the record identity.
- A draft number generated locally is provisional/display-only in future active mode.
- Final `INV-YYYYMMDD-NNNN` is assigned by trusted authority when issue is canonically accepted.
- Exact issue retry returns the same final number.
- Rejected issue does not allocate a final number if rejection occurs before number allocation.

## InvoiceReturn Policy

- UUID is assigned when recorded and remains the record identity.
- A recorded Return's local number is provisional in future active mode.
- Final `RET-YYYYMMDD-NNNN` is assigned by trusted authority when execution allocation is accepted.
- Exact execute retry returns the same final number.

## Gaps Policy

Uniqueness and immutable command binding are more important than gaplessness. A number allocated to an accepted processing command is never reused. Recovery should complete the command with the same number. If an operator later terminates an unrecoverable accepted reservation through an audited repair workflow, the gap remains documented.

Rejected commands before allocation consume no number. No attempt is made to recycle a number after a trusted allocation.

## Business Timezone and Date

Device timezone is forbidden for canonical numbering. Each account must have an explicit IANA business timezone configured and validated before canonical numbering is enabled.

The trusted executor derives `businessDate` from trusted server time converted to the account timezone. It persists that date in the processing receipt before number allocation.

Retry on another calendar day reuses the originally stored business date and number. Requests near midnight are classified once by the trusted executor; browser clock and reconnect time do not change the result.

If account business timezone is missing, trusted issue/execute is blocked rather than falling back to device timezone or silently using UTC.

## Number Assignment and Publication

Number allocation is a separate compact trusted transaction after canonical business validation/reservation and before final publication. The assigned number is written into:

- the canonical commercial record;
- the accepted command receipt;
- the document number allocation record;
- the commit marker descriptor/checksum.

The final commercial record and accepted receipt are published atomically. The counter transaction itself is recoverable through command binding rather than claimed as part of one distributed transaction.

## Existing Documents

No existing number is changed automatically.

- Historical issued/executed records keep current numbers.
- Historical drafts/recorded Returns keep their current values until an explicitly approved migration/cutover policy handles provisional numbering.
- Potential duplicate historical human numbers are detected and reported, not overwritten.
- Existing UUIDs remain unchanged.
- Counter initialization occurs only after V1-SYNC-009 verifies historical maxima, duplicates, IDs, and hashes.
- Legacy and canonical numbers may require an audit flag or numbering-era metadata; they do not require ID rewrites.

## Current State

- Human numbering changed by V1-SYNC-007E: NO.
- Canonical allocator implemented: NO.
- Multi-device numbering solved in runtime: NO.
