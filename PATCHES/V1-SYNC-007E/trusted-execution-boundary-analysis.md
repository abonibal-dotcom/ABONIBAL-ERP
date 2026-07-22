# Trusted Commercial Execution Boundary Analysis

## Mission Boundary

V1-SYNC-007E is an architecture-only decision plan. It does not add a trusted runtime, register `invoiceReturns:update:execute`, alter runtime source or Firebase Rules, deploy Firebase resources, migrate records, or change local data.

## Current Capability Audit

| Area | Observed repository state | Consequence |
| --- | --- | --- |
| Runtime | Vite browser application only | The browser is not a trusted commercial authority. |
| Firebase client SDK | `firebase` Web SDK is installed | Client Auth, Firestore mapping, RTDB transactions, reads, writes, and listeners are available. |
| Firebase Functions | No functions source directory, package, or `firebase.json` functions target | No versioned trusted executor exists in this repository. |
| Firebase Admin SDK | Not installed or imported | No repository-owned privileged RTDB runtime exists. |
| TEST emulator config | Realtime Database emulator only | Current rules and RTDB behavior are testable; Functions/Auth/Firestore integration is not yet configured. |
| Authentication | Firebase Auth plus Firestore account mapping | Firebase UID identifies membership/authentication only; logical `accountId` is resolved separately. |
| RTDB authorization | `accountMembers/{accountId}/{firebaseUid}` | Membership is rules-readable and client self-provisioning is denied. |
| Sync coordinator | Durable outbox, receipts, conflicts, retry, exact route resolution | Suitable for client intent and cache synchronization, not trusted business validation. |
| Durable groups | Complete local intent is captured atomically before local application | Strong local recovery exists, but cloud members are dispatched sequentially. |
| Invoice cloud | Draft/lifecycle transport exists | Issue/cancellation groups are ordered and recoverable, not atomically visible. |
| InvoiceReturn cloud | Recorded create/update transports exist | Execute capability and transport are intentionally absent. |
| StockMovement cloud | Append-only client transport exists | Current rules do not distinguish trusted commercial movements from ordinary member-created movements. |
| Numbering | Local daily sequence from local records | Duplicate human numbers are possible across devices. |
| Return allocation | Sum of Return records visible in the local cache | Two stale devices can both approve quantities that exceed the sold quantity. |

`firebase functions:list --project abonibal-erp-test` could not enumerate the remote function inventory during this audit. Therefore this plan makes no claim about an unversioned remote function. For architecture and release purposes, the project has no usable trusted backend capability until one is added, reviewed, emulated, and deployed from this repository.

## Root Safety Gap

Example:

- Issued quantity: 10.
- Device A sees returned quantity 0 and requests 6.
- Device B sees returned quantity 0 and requests 6.
- Each local validation passes.
- Canonical total would become 12.

The following controls are individually insufficient:

- Local validation sees only one device's cache.
- CAS on one InvoiceReturn protects only that Return record.
- RTDB Rules on one Return record cannot safely aggregate all sibling Returns as a trusted allocation decision.
- Durable group ordering controls sequence, not concurrent business acceptance.
- Mutation-specific routes prevent transport substitution, not cumulative over-return.
- Append-only StockMovement protects history after creation, not authority to create a commercial movement.

The missing primitive is one trusted canonical allocation decision across every accepted Return for the same immutable Invoice line.

## Trusted Boundary Options

| Option | Authentication and membership | Canonical multi-line validation | Malicious-client resistance | Offline behavior | Recovery and audit | Complexity | Assessment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A. Callable/HTTPS Cloud Function with Admin SDK | Strong when Auth token, Firestore mapping, and RTDB membership are revalidated | Strong; server can transact on canonical control data and publish a complete write set | Strong if direct client result paths are denied | Requests wait locally until online | Strong receipts, deterministic retries, emulator coverage | Adds Functions/Admin runtime and operations | Recommended authority |
| B. Independent trusted backend | Strong with explicit token verification and service identity | Strong | Strong | Requests wait locally until online | Strong, but requires separate hosting/operations | Highest operational burden for current project | Valid later, not the conservative V1 choice |
| C. Client RTDB transaction plus Rules | Authenticated but client remains untrusted | Possible only with a carefully colocated schema; complex cross-record and publication invariants remain exposed | Weaker; client controls request and transaction proposal | Client can queue writes, but canonical acceptance still requires connectivity | Audit and command recovery are harder | Rules and schema complexity become high | Rejected as final authority |
| D. Client request plus trusted validator/executor plus canonical publication | Strong | Strong | Strong | Clean pending request without false local inventory | Strong receipts and recoverable publication | Moderate and incremental | Recommended end-to-end model |
| E. Background trigger on a client-written request | Membership can be enforced on request path | Strong in the trigger | Strong result paths, but request lifecycle and duplicate trigger handling require care | RTDB request may queue while connected; browser persistence remains limited | Good with durable request/receipt design | Similar backend burden, less immediate response control | Acceptable alternative, not preferred over callable for the first implementation |

## Recommended Execution Authority

Use a Firebase callable Cloud Function in the TEST project as the first trusted executor, backed by the Firebase Admin SDK. The ordinary client submits a deterministic command request; it never directly writes executed Return state, allocation state, canonical numbering state, trusted receipts, or execution-generated `sale_return` movements.

The callable boundary is recommended because Firebase client SDKs automatically attach available Auth and App Check tokens, while the function can perform explicit business validation. The function must still validate every boundary itself because Admin SDK access can bypass ordinary RTDB Rules.

The trusted executor must:

1. require authenticated Firebase context;
2. resolve the Firebase provider identity through the existing Firestore account mapping;
3. require the requested logical `accountId` to match the mapping;
4. require `accountMembers/{accountId}/{firebaseUid} === true`;
5. never derive `accountId` from UID;
6. validate Return ID, expected revision, stable line identities, Invoice status, immutable Invoice line snapshots, and request checksum;
7. reserve cumulative quantities canonically;
8. allocate the final human number when required;
9. publish the accepted commercial group atomically;
10. persist an immutable accepted/rejected/conflict receipt.

## Client Direct Execution Policy

Client direct execute in future active multi-device mode: **NO**.

The current V1-SYNC-007B active flow locally applies `executed` Return state and `sale_return` movements before cloud acceptance. That is safe as a local/default-disabled behavior, but unsafe as the final active-mode contract because a trusted server may later reject an over-return.

Recommended active-mode refactor:

- replace the local side-effect group with one durable trusted execution request;
- do not apply `executed` or StockMovement state locally before canonical acceptance;
- retain the deterministic command ID and line/movement identities;
- after accepted publication, pull applies the complete committed canonical group to cache only;
- rejected/conflicting commands retain the Return as `recorded` and show durable evidence.

## Pending State Recommendation

Do not add `execution_pending` to the commercial InvoiceReturn lifecycle. Keep the accepted lifecycle `recorded -> executed` and store request progress outside the Return in local outbox status and trusted command receipt state.

While waiting, the UI should show a command-level pending state such as "execution pending" without changing inventory authority or the Return's commercial status.

## Offline Execution Policy

| Mode | Policy |
| --- | --- |
| Default `disabled` / local-only | Preserve current local execution contract and deterministic StockMovements. It is explicitly not multi-device canonical. |
| Future `active` multi-device | Allow creation of a durable pending execution request while offline, but do not apply executed state or inventory effects. Submit when online and wait for trusted acceptance. |

Optimistic local execution is rejected because it creates temporary false inventory authority and may require destructive rollback after canonical rejection.

## Relationship to Existing Durable Groups

V1-SYNC-006D groups remain valuable for complete local intent, checksums, deterministic identities, conflict evidence, and disabled-mode recovery. They must not become a second commercial authority in active mode.

Recommended relationship:

- disabled mode: retain the current local commercial group behavior;
- active mode: capture one trusted command request instead of locally applying the commercial member group;
- trusted executor: builds and publishes the canonical commercial group;
- client pull: applies committed members to raw cache only;
- old active-mode groups present before cutover: migration audit must resolve or quarantine them before enabling canonical mode.

This design preserves existing deterministic identities while eliminating command replay and duplicate movement generation.
