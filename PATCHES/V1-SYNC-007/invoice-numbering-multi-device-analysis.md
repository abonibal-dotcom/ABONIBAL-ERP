# V1-SYNC-007 Invoice Numbering Multi-Device Analysis

## Current Strategy

Invoice draft creation assigns `INV-YYYYMMDD-NNNN`. InvoiceReturn creation assigns `RET-YYYYMMDD-NNNN`.

Both algorithms:

1. read the current local account array;
2. filter same-day numbers;
3. take the largest numeric suffix;
4. increment until locally unused.

There is no cloud counter, uniqueness index, transaction, lease, device prefix, or server assignment.

## Risks

- Two devices can create the same number from the same stale maximum.
- Offline creation cannot coordinate uniqueness.
- A retry can allocate a new number if the original command identity is lost.
- Draft deletion can make local sequences appear reusable on stale devices.
- Account-wide uniqueness is not enforced.
- InvoiceReturn numbering has the same defect.
- Assigning the final Invoice number at draft creation reserves business numbers for drafts that may never issue.

Current numbering is a blocker for multi-device cutover.

## Options

| Option | Benefit | Cost/Risk | Recommendation |
| --- | --- | --- | --- |
| UUID record ID plus separate human number | Separates technical identity from document numbering | Still needs final-number allocator | Required foundation |
| RTDB transactional counter | Account-scoped uniqueness | Counter and record can separate unless committed together; gaps policy needed | Accept only inside trusted commit contract |
| Device-prefixed number | Offline uniqueness | User-facing numbers change and remain non-sequential | Not preferred for V1 accounting documents |
| Server-assigned number | Strong central uniqueness and validation | Requires trusted service/online issue | Preferred |
| Deterministic hash-derived number | Retry-safe | Poor human usability and does not provide expected sequence | Not preferred as display number |

## Recommended Contract

- Keep the UUID Invoice ID as the stable record identity.
- A draft uses a provisional label or UUID-derived draft reference, not the final legal/business Invoice number.
- Allocate the final immutable Invoice number only when issue is accepted.
- Allocate the final Return number only when return execution is accepted, or reserve it transactionally when recorded if the owner explicitly requires recorded documents to have final numbers.
- Allocation is account-scoped and performed by a trusted transaction/server boundary.
- Number allocation, lifecycle transition, movement creation, and group receipt must be one canonical commit or one transactionally bound process.
- Exact command retry returns the same assigned number.
- Duplicate number claims fail explicitly.
- Number reuse is forbidden.
- Gaps are allowed and documented if an allocated canonical command is later rejected/voided; silent renumbering is forbidden.

## Why Client CAS Is Not Enough

A client-side read of the counter followed by a multi-path update races with another client. A standalone counter transaction followed by a separate Invoice write preserves uniqueness but can leave gaps or an allocated number without an Invoice after a crash.

For issue and return execution, the preferred boundary is a trusted transactional command that validates the lifecycle/inventory/return invariants and publishes the number with the complete commercial group.

## Draft Compatibility

Existing local drafts already contain numbers. No rewrite, migration, or upload occurs in V1-SYNC-007. V1-SYNC-009 must define how historical numbers are preserved, validated, or conflicted during migration. Existing IDs and numbers must never be silently changed.
