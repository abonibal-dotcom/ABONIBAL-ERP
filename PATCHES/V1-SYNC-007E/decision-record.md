# V1-SYNC-007E Decision Record

All recommendations below are **OWNER APPROVAL REQUIRED**. No recommendation is implemented by V1-SYNC-007E.

## TRUSTEXEC-DEC-001 - Trusted Execution Authority

Recommendation: use a TEST-first Firebase callable Cloud Function v2 with Admin SDK as the trusted commercial executor. Do not treat browser code or an RTDB client transaction as trusted merely because Rules validate its shape.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-002 - Client Direct Execution Policy

Recommendation: deny ordinary clients direct `recorded -> executed` cloud writes and deny direct publication of execution-generated `sale_return` movements.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-003 - Offline Execution Policy

Recommendation: in active mode, permit a durable pending request while offline but apply no executed state or inventory effect until trusted online acceptance. Preserve current local execution only in explicit disabled/local-only mode.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-004 - Active-Mode Local-Apply Policy

Recommendation: refactor active mode from local-first commercial side effects to trusted-first request/receipt. Pull applies the accepted committed result to raw cache only.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-005 - Canonical Return Allocation Model

Recommendation: store immutable per-command allocation events plus a transactionally maintained per-Invoice-line aggregate under the logical account root.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-006 - Sold Quantity Source

Recommendation: use the immutable issued Invoice line snapshot and verified issue checksum as the sole sold-quantity source. Never use Product or mutable catalog data.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-007 - Multi-Line Transaction Boundary

Recommendation: validate and reserve all lines of one Return in one RTDB transaction on the per-Invoice allocation subtree. Any line failure rejects the entire command.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-008 - Execution Request Identity

Recommendation: retain deterministic identity `invoice-return-execute-{returnId}` and bind it to one request checksum. Exact retry adopts the same command; divergent payload conflicts.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-009 - Execution Receipt Model

Recommendation: use trusted account-scoped command receipts with `processing`, `accepted`, `rejected`, or `conflict` result states. Accepted receipts are written atomically with final publication.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-010 - Atomic Publication Scope

Recommendation: one final RTDB atomic multi-location update publishes the executed Return, all deterministic movements, committed allocation events, accepted receipt, final number reference, and commit marker.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-011 - Commercial Visibility and Commit Model

Recommendation: add a deterministic `commercialGroupCommits/{groupId}` marker in the same atomic update. Pull, listeners, and bootstrap expose only groups whose marker and all member checksums are complete.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-012 - Invoice Issue and Cancellation Visibility Alignment

Recommendation: migrate Invoice issue and cancellation from sequential member visibility to the same trusted atomic publication model before cutover. Extend the generic visibility gate to Product opening before full multi-device readiness.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-013 - StockMovement Trusted-Write Boundary

Recommendation: deny ordinary clients creation of trusted commercial `sale_deduction`/`sale_return` effects. Publish them only through trusted Admin atomic publication while preserving append-only immutability and deterministic IDs.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-014 - Durable Group Integration Strategy

Recommendation: keep current groups for disabled-mode local intent/recovery, but replace active-mode local side-effect groups with one trusted command request. Do not maintain two commercial authorities.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-015 - Rejection and Conflict Handling

Recommendation: rejection/conflict publishes no executed Return or movement, preserves the recorded Return, stores safe durable evidence, refreshes canonical state, and performs no destructive rollback.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-016 - Canonical Invoice Numbering

Recommendation: allocate final account/day Invoice numbers transactionally at trusted issue acceptance; UUID remains identity and exact retry reuses the assignment.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-017 - Canonical Return Numbering

Recommendation: allocate final account/day Return numbers transactionally after trusted allocation acceptance and before final publication; recorded local numbers are provisional in future active mode.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-018 - Business Timezone and Date Policy

Recommendation: require an explicit account IANA business timezone. Derive business date from trusted server time in that timezone and persist it so retries across midnight keep the same date/number.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-019 - Legacy and Migration Boundary

Recommendation: do not rewrite historical IDs or numbers. V1-SYNC-009 audits duplicates, seeds counters after verification, preserves legacy records, and stops on conflict before owner-approved cutover.

Status: OWNER APPROVAL REQUIRED

## TRUSTEXEC-DEC-020 - Implementation Sequence and Cutover Gates

Recommendation: implement V1-SYNC-007F trusted command/receipt foundation, 007G allocation transaction, 007H atomic publication/visibility, 007I numbering, and 007J trusted Return execution in order. Re-evaluate cutover only after all gates and V1-SYNC-009 migration evidence pass.

Status: OWNER APPROVAL REQUIRED
