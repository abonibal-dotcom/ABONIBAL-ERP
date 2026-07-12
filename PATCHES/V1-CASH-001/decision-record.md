# V1-CASH-001 Decision Record

## Status

OWNER APPROVAL REQUIRED

No recommendation below changes runtime behavior until explicitly approved and implemented in a later ECS.

| Decision ID | Question | Recommended option | Alternatives | Reason | Risk | Required owner approval |
| --- | --- | --- | --- | --- | --- | --- |
| CASH-DEC-001 | Safe model and multi-safe policy | Multiple account-scoped Safes; active/inactive; one optional default; no mutable balance | Single Safe only; archived status; mutable balance | Supports real operation while preserving history and explicit boundaries | HIGH | YES |
| CASH-DEC-002 | Balance source of truth | Sum CashMovement ledger; no authoritative `Safe.balance` | Mutable Safe balance; cached total as truth | Prevents silent drift and matches auditable ledger principles | HIGH | YES |
| CASH-DEC-003 | Opening balance policy | Separate posted `opening_balance` movement | Field on Safe; direct balance seed | Keeps all balance effects traceable and reversible | HIGH | YES |
| CASH-DEC-004 | Cash movement lifecycle | `draft -> posted -> reversed` | Posted-only append; draft/voided; hard delete draft | Separates editable input from immutable financial history | HIGH | YES |
| CASH-DEC-005 | Posted movement edit policy | Posted records immutable | Allow amount/date/reference edits | Prevents historical and balance reinterpretation | HIGH | YES |
| CASH-DEC-006 | Reversal policy | Append opposite posted movement, link pair, mark original reversed | Delete original; exclude original without offset; mutate amount to zero | Preserves audit history and nets correctly | HIGH | YES |
| CASH-DEC-007 | Negative balance policy | Prevent baseline outflow below zero | Always allow; per-Safe overdraft setting now | Conservative cash control; avoids unsupported overdraft semantics | HIGH | YES |
| CASH-DEC-008 | Currency policy | One immutable currency per Safe; no conversion; same-currency transfers only | Account-wide currency only; multi-currency conversion | Explicit, simple, and avoids invented FX rules | HIGH | YES |
| CASH-DEC-009 | Safe-to-safe transfer policy | Linked transfer_out/transfer_in pair persisted in one movement-array write | One signed transfer record; sequential separate writes | Supports per-Safe balance and avoids one-sided transfer | HIGH | YES |
| CASH-DEC-010 | Idempotency policy | Required account-unique idempotency key for posting, transfer, reversal, and integrations | Rely on movement id; best-effort duplicate checks | Prevents duplicate financial effects | HIGH | YES |
| CASH-DEC-011 | Payment integration boundary | Deferred to separate idempotent integration mission | Auto-create Cash Movement in baseline | Payments currently have no approved Safe selection/linkage contract | HIGH | YES |
| CASH-DEC-012 | Expense integration boundary | Deferred to separate idempotent integration mission | Expense post automatically changes cash | Expense payment method is descriptive only by approved contract | HIGH | YES |
| CASH-DEC-013 | Sales and Purchase integration timing | No direct integration; use future Payment/Cash contracts | Invoice/Purchase post directly changes Safe | Avoids double counting and undefined settlement rules | HIGH | YES |
| CASH-DEC-014 | Basic Ledger integration timing | Deferred until Cash Movement runtime is stable | Auto-create Ledger entry in baseline | Keeps cash source of truth separate from future accounting view | HIGH | YES |
| CASH-DEC-015 | Baseline scope | Separate Safe domain baseline, then Cash Movement ledger baseline; no UI/integrations initially | Build Safe, movement, UI, transfer, and integrations together | Minimizes blast radius and enables focused verification | MEDIUM | YES |

## Inherited Non-negotiable Rules

- `accountId` is the data boundary.
- No Firebase UID/providerUserId as accountId.
- No default account fallback.
- No hard delete of posted financial records.
- Full double-entry accounting is deferred.
- All effects must remain traceable.
- Integration missions must be separate and explicitly approved.

## Owner Decision Requested

Approve, reject, or amend CASH-DEC-001 through CASH-DEC-015 before any V1-CASH runtime source mission begins.
