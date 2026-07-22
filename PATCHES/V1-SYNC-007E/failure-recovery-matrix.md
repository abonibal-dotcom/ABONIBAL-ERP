# Trusted Commercial Failure and Recovery Matrix

| # | Scenario | Durable evidence | Retry / conflict behavior | Visibility and duplicate prevention |
| --- | --- | --- | --- | --- |
| 1 | Two devices execute Returns concurrently | Two request identities; one transactionally updated per-Invoice allocation subtree | Both may succeed only if total remains within sold quantity; otherwise excess request is rejected | Rejected command publishes no Return or movement |
| 2 | Same execution command sent twice | One command receipt/reservation keyed by deterministic command ID | Exact checksum returns or resumes the same result | One allocation and one movement set |
| 3 | Same command ID with different payload | Existing request checksum and conflict receipt | Hard conflict; no overwrite or second group | Existing accepted/processing group remains authoritative |
| 4 | Executor crashes before allocation | Trusted request/processing receipt may exist; no allocation event | Retry adopts processing identity and starts validation | No commercial publication exists |
| 5 | Executor crashes after allocation before publication | Reserved allocation events, assigned command identity, processing receipt; number mapping if already allocated | Retry reuses reservation and number, then resumes final publication | Quantity cannot be allocated again; no final member visible yet |
| 6 | Executor crashes during final publication | RTDB atomic update either commits all listed paths or none | Read commit/receipt; if absent, retry exact write set | No partial committed group |
| 7 | Client times out after trusted success | Accepted receipt and commit marker | Retry returns same accepted result and number | No reallocation or duplicate movement |
| 8 | Receipt exists but publication missing | `processing` receipt is valid; `accepted` receipt without commit is invalid | Processing resumes; accepted-without-commit is quarantined for trusted repair | Client does not expose group without commit |
| 9 | Publication exists but receipt incomplete | Commit marker and all members should include receipt in same atomic write | Treat as corruption, quarantine, and reconcile from commit evidence | No business command replay |
| 10 | One Return line conflicts | Allocation transaction rejects before mutation | Whole command rejected with line-safe reason | Zero lines, movements, and executed state published |
| 11 | Number allocation succeeds then command publication fails | Command-to-number mapping plus processing receipt | Retry reuses number; never increment again | Number may be reserved but no partial commercial group appears |
| 12 | Account membership revoked during execution | Membership checks at entry and before final publication; processing evidence | Stop publication; retain blocked processing evidence for trusted resolution | Admin must not publish after failed revalidation; no client fallback |
| 13 | Malicious client writes executed Return | Rules deny recorded-to-executed client write | Request fails; conflict/security event may be logged safely | Canonical Return unchanged |
| 14 | Malicious client creates commercial `sale_return` | Future rules deny ordinary-client commercial movement source/type | Request denied; no trusted receipt | Append-only collection gains no unauthorized commercial movement |
| 15 | Pull receives member before commit callback | Member carries publication ID and is buffered | Wait for marker and all checksums; timeout becomes incomplete-group conflict | Member is not used by UI or derived inventory |
| 16 | Bootstrap starts during publication | Atomic database state plus commit/member completeness scan | Bootstrap sees either pre-commit or complete commit; mismatches block readiness | No partial group becomes canonical |

## Rejection Codes

Trusted responses should use stable safe codes such as:

- `RETURN_ALLOCATION_EXCEEDED`
- `RETURN_REVISION_STALE`
- `INVOICE_NOT_ISSUED`
- `INVOICE_BASELINE_MISSING`
- `REQUEST_CHECKSUM_CONFLICT`
- `RETURN_LINE_IDENTITY_INVALID`
- `ACCOUNT_MEMBERSHIP_DENIED`
- `PUBLICATION_INCOMPLETE`

Messages shown to the user must be actionable but must not expose raw UIDs, tokens, internal account IDs, service credentials, or full commercial payloads.

## Recovery Principles

- Never roll back an accepted client-side inventory effect because active mode does not apply that effect before acceptance.
- Never release a trusted allocation reservation solely by timeout.
- Never regenerate command, Return, line, movement, publication, or number identities on retry.
- Never repair by replaying the business command from pull.
- Never overwrite divergent immutable records.
- Operator repair is explicit, trusted, audited, and separate from normal retry.
