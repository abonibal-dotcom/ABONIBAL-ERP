# V1-SYNC-006D - Group Reconciliation Contract

## Initial Capture

`DurableMutationGroupCapture` validates the complete generic group and confirms
that every member has an approved cache-only `LocalMutationApplier`. It then:

1. persists every member through `enqueueBatchAtomic()`;
2. reloads the durable group;
3. processes members in deterministic one-based sequence;
4. reuses `DurableMutationCapture.applyPersistedOperation()`;
5. inspects, applies when absent, verifies, and durably marks each member;
6. stops on conflict, failure, or missing applier;
7. derives completion only from durable member state.

The service never replays a Product, Inventory, Invoice, or other business
command.

## Startup Recovery

`LocalMutationReconciler` discovers grouped members from the existing outbox.
Before each member it reloads and validates the group, checks the active
logical account, enforces earlier-member completion, and resolves the
registered cache-only applier.

If a member conflicts or fails, later members in that group do not run during
the reconciliation cycle. Other independent operations remain recoverable.
Logout or account switch stops before the next member and leaves the complete
group durable.

## Crash Scenarios

| Scenario | Verified recovery |
| --- | --- |
| A. Crash before batch persistence | No group members and no local mutation. |
| B. Complete group persisted before apply | All members reconcile once in sequence. |
| C. Member 1 cache write already matches | Member 1 is marked without duplicate; member 2 applies once. |
| D. Member 2 cache write exists before marker | Exact state is recognized and only the marker is repaired. |
| E. All members already applied | Group derives `applied`; exact retry has no new effect. |
| F. Member 1 diverges | Conflict is retained; later members remain blocked. |
| G. Member 2 stable ID has different payload | Conflict is retained; no overwrite or alternate record. |

## Conflict And Failure Policy

- No silent overwrite.
- No physical or safe-delete rollback.
- No alternate record identity.
- No business-command replay.
- No later blind apply after ambiguous divergence.
- Exact cache state is treated as already applied.
- Technical failure remains durable for bounded or explicit recovery under the
  existing V1-SYNC-004A contract.

## Account Boundary

Group capture, lookup, reconciliation, state marking, and cleanup are scoped
to `syncOutbox:{accountId}`. Mixed-account batches and cross-account capture
are rejected. Firebase provider identity is never substituted for logical
`accountId`.
