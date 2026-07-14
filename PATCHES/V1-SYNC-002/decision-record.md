# V1-SYNC-002 Decision Record

## Decision Status

Every decision below is a recommendation only and requires explicit owner
approval before implementation. V1-SYNC-002 does not approve any decision on
the owner's behalf.

| Decision ID | Question | Recommended option | Alternatives | Reason | Risk | Approval |
| --- | --- | --- | --- | --- | --- | --- |
| SYNC-DEC-001 | Cloud source after migration | RTDB canonical after verified account/module cutover | Permanent local-only; peer merge | Shared multi-device state with controlled rollback | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-002 | RTDB account root | `accounts/{accountId}` | UID-rooted data; module-first global roots | Preserves accepted ERP account boundary | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-003 | UID versus accountId | UID is Auth/membership only; never accountId | UID fallback | Preserves explicit account mapping and multi-user account | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-004 | Account membership authorization | Admin-provisioned RTDB membership mirror for TEST; trusted service long-term | Custom claims only; client writes | Rules can enforce membership without Firestore access | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-005 | LocalStorage after cutover | Account cache, offline cache, outbox, receipts | Remove local cache; dual canonical | Offline support without split authority | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-006 | Runtime architecture | One shared SyncCoordinator plus module policies | Thirteen independent sync stacks | Consistent security/retry/listener behavior | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-007 | Offline queue | Persistent account-scoped outbox written before cache apply | In-memory queue; fire-and-forget | Restart safety and no silent loss | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-008 | Listener strategy | Initial per-module pull then module-scoped child listeners | Account/root listener; polling only | Bounded payload and lifecycle control | MEDIUM | OWNER APPROVAL REQUIRED |
| SYNC-DEC-009 | Concurrency model | Integer revision plus expectedRevision CAS | Timestamp last-write-wins | Detects stale writes deterministically | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-010 | Master-data conflicts | Block and require latest/manual retry or merge | Automatic field merge; last-write-wins | Matches V1 no-silent-overwrite policy | MEDIUM | OWNER APPROVAL REQUIRED |
| SYNC-DEC-011 | Draft conflicts | Block stale update; preserve local pending draft | Newest timestamp wins | Prevents one device erasing another | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-012 | Immutable financial records | Reject arbitrary edits; allow only guarded lifecycle units | Mutable posted records | Preserves audit and domain contracts | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-013 | Append-only ledgers | Create once; preserve originals; corrections by accepted void/reversal | Destructive merge/delete | Preserves inventory/cash/ledger truth | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-014 | Idempotency | Stable operation ID/key, atomic receipt, checksum, record IDs | Retry blind writes | Prevents duplicate financial effects | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-015 | Pull behavior | Apply validated records directly to cache; never replay commands | Call domain mutation service on pull | Prevents duplicate side effects | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-016 | Migration IDs | Preserve every existing record ID | Generate cloud IDs | Keeps references and audit links valid | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-017 | Migration comparison | CREATE/MATCH/CONFLICT/SKIP dry-run and upload policy | Blind upsert | Makes differences explicit | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-018 | Initial cloud deletes | No deletes or destructive overwrite | Clear target then upload | Preserves unexpected/partial data | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-019 | Verification gate | Canonical counts, IDs, hashes, references, and derived totals | Counts only | Detects subtle audit corruption | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-020 | Second-device bootstrap | Membership, per-module pull, cache populate, count/hash validation before listeners | Empty local start with listeners only | Establishes a deterministic baseline | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-021 | Offline writes | Allow only after successful bootstrap; durable outbox and bounded retry | Untracked local writes; disable all offline work | Preserves usability and recoverability | HIGH | OWNER APPROVAL REQUIRED |
| SYNC-DEC-022 | Conflict visibility | Explicit module/record/revision conflict state and manual action | Hidden logs; automatic overwrite | V1 requires safe interruption | MEDIUM | OWNER APPROVAL REQUIRED |
| SYNC-DEC-023 | Environment boundary | Implement and validate on `abonibal-erp-test` with explicit project flag | Default Firebase alias; production preview | Prevents production contact | CRITICAL | OWNER APPROVAL REQUIRED |
| SYNC-DEC-024 | Production migration | Deferred; separate future design, approval, backup, and deployment mission | Reuse TEST cutover directly | Production is frozen and carries older live data | CRITICAL | OWNER APPROVAL REQUIRED |

## Additional Decision Notes

### Financial multi-record atomicity

SYNC-DEC-012 and SYNC-DEC-014 require each invoice issue/cancel/return, Safe
transfer/reversal, and similar multi-record effect to be one atomic write set.
If client-side RTDB cannot prove the required compare-and-set behavior, the
implementation mission must stop for a trusted backend transaction decision.

### Advanced merge remains deferred

Manual conflict review is the recommended V1 response. This decision record
does not introduce automated semantic merge, CRDTs, or advanced multi-master
resolution.

### Draft deletion

SYNC-DEC-018 implies a cloud tombstone for approved draft deletion rather than
RTDB removal. This prevents a stale device from recreating a deleted draft.

## Owner Decision Gate

Implementation may start only after the owner explicitly approves or amends all
twenty-four decisions. Any amendment must be reflected in the architecture,
schema, security, conflict, migration, and roadmap documents before V1-SYNC-003.
