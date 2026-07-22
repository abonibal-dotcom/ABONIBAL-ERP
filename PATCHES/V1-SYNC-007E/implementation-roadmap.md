# Trusted Commercial Execution Implementation Roadmap

## Dependency Order

The minimum safe sequence is V1-SYNC-007F through V1-SYNC-007J. No implementation begins until TRUSTEXEC-DEC-001 through TRUSTEXEC-DEC-020 are approved by the owner.

## V1-SYNC-007F - Trusted Commercial Command and Receipt Foundation

Classification: Runtime / Firebase Functions Foundation / TEST First

Purpose:

- add an isolated Functions v2 package and Firebase Admin SDK;
- add callable request authentication and safe validation envelope;
- verify Firestore account mapping plus RTDB account membership;
- create trusted request/receipt schemas and deterministic command locking;
- keep all commercial execution capabilities disabled.

Required changes:

- Functions source/config;
- TEST-only Auth, Firestore, Functions, and Database emulator configuration;
- server-side safe logging and idempotency primitives;
- Rules for client request/read-only receipt boundaries;
- emulator concurrency, membership, revocation, and conflicting checksum tests.

No InvoiceReturn execution or commercial StockMovement publication occurs in this mission.

## V1-SYNC-007G - Canonical Return Allocation Transaction

Classification: Runtime / Trusted Business Transaction

Depends on: V1-SYNC-007F

Purpose:

- create immutable issued-Invoice allocation baselines;
- implement per-Invoice multi-line RTDB allocation transaction;
- reserve quantities by deterministic command ID;
- enforce cumulative quantity and exact retry/conflict behavior;
- add trusted recovery for processing reservations.

Required changes:

- Functions allocation service;
- server-owned allocation schema and Rules denial for clients;
- Database/Functions emulator tests with concurrent devices and fault injection;
- no final executed Return publication yet.

## V1-SYNC-007H - Atomic Commercial Group Publication and Visibility Gate

Classification: Runtime / Publication / Client Cache Integration

Depends on: V1-SYNC-007G

Purpose:

- implement trusted RTDB atomic multi-location publication;
- add `commercialGroupCommits` markers and member checksums;
- make pull/listeners buffer committed groups and apply cache-only;
- add bootstrap completeness gate;
- split ordinary StockMovement append authority from trusted commercial publication;
- align Invoice issue, cancellation, InvoiceReturn execution, and Product opening visibility before cutover.

Required changes:

- Functions publication service;
- client cache adapters and generic commit-aware pull foundation;
- Rules denying direct client commercial movements/commit writes;
- emulator crash, callback-order, bootstrap, and corruption tests.

Cloud publication is not considered atomic at application level until this mission passes.

## V1-SYNC-007I - Canonical Invoice and Return Number Allocation

Classification: Runtime / Trusted Numbering

Depends on: V1-SYNC-007F and publication receipt foundation

Purpose:

- add explicit account business timezone;
- allocate account/day/type numbers transactionally;
- bind command IDs to numbers for exact retry;
- preserve historical numbers and document gap policy;
- test concurrency and midnight boundaries.

Required changes:

- Functions number allocator;
- server-owned counters and allocation Rules;
- Invoice issue and Return execution command integration;
- emulator time, conflict, and retry tests.

No historical renumbering occurs.

## V1-SYNC-007J - InvoiceReturn Trusted Execution Integration

Classification: Runtime / Commercial Cutover Preparation

Depends on: V1-SYNC-007F, 007G, 007H, and 007I

Purpose:

- replace active-mode local-first execution with one trusted-first command request;
- keep disabled-mode local execution intact;
- publish executed Return, all `sale_return` movements, allocation commits, final number, receipt, and marker;
- pull the committed result cache-only;
- expose pending/rejected/conflict UI status;
- prove two-device over-return prevention.

The route `invoiceReturns:update:execute` must not be registered merely because this mission starts. Registration is allowed only after all trusted execution tests, Rules, exact routing, commercial movement authority, and publication completeness gates pass. Prefer a distinct trusted command route rather than reusing the old direct lifecycle transport semantics.

## Cutover Re-evaluation

After V1-SYNC-007J, perform a separate regression and architecture acceptance audit. V1-SYNC-009 remains responsible for non-destructive migration, count/ID/hash verification, derived inventory verification, numbering conflict audit, second-device bootstrap, and explicit owner-approved cutover.

## Execute Capability Gate

`invoiceReturns:update:execute` remains absent until all of the following are true:

- trusted runtime deployed to TEST;
- mapping and membership validation passes;
- cumulative allocation transaction passes concurrent tests;
- multi-line all-or-nothing passes;
- final publication and commit visibility pass;
- direct client executed Return is denied;
- direct client commercial movement is denied;
- exact retry and conflicting retry pass;
- canonical numbering passes;
- pull remains cache-only;
- migration/cutover is still separately controlled.

## Scope Matrix

| Mission | Docs | Client runtime | Functions/Admin | Rules | Emulator | Deployment |
| --- | --- | --- | --- | --- | --- | --- |
| 007F | yes | minimal callable client later if approved | yes | yes | Auth/Firestore/DB/Functions | TEST only after gates |
| 007G | yes | no command effect | yes | yes | concurrency/faults | TEST only after gates |
| 007H | yes | cache/pull visibility | yes | yes | publication/bootstrap | TEST only after gates |
| 007I | yes | provisional/final number display | yes | yes | counters/timezone | TEST only after gates |
| 007J | yes | trusted-first command and status | yes | yes | full two-device flow | TEST only after gates |

Production deployment, migration, and canonical cutover are not part of these implementation missions unless separately and explicitly approved.
