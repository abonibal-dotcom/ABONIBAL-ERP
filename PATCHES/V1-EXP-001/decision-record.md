# V1-EXP-001 Decision Record

## Status

OWNER APPROVAL REQUIRED

No decision in this document changes runtime behavior until explicitly approved and implemented through a later ECS.

| Decision ID | Question | Recommended option | Alternatives | Reason | Risk | Required owner approval |
| --- | --- | --- | --- | --- | --- | --- |
| EXP-DEC-001 | What is the Expense lifecycle? | `draft -> posted -> voided`, with optional direct `draft -> voided` preservation | Draft/posted only; posted/cancelled; hard delete drafts | Matches Payments, preserves audit history, and separates editable from immutable states | MEDIUM: lifecycle affects future integration semantics | YES |
| EXP-DEC-002 | How are categories represented in the baseline? | Required textual `categorySnapshot.displayName`; optional `categoryId` deferred | Free string field; Category entity required now; enum | Avoids an unapproved Category module while preserving historical display | MEDIUM: text variants can fragment reports | YES |
| EXP-DEC-003 | How is the payee represented? | Required `payeeType`, optional account-scoped `payeeId`, optional stable `payeeSnapshot` | Required registered party; free text only; no payee data | Supports manual baseline and future Customer/Supplier integration without historical drift | MEDIUM: party semantics affect future statements | YES |
| EXP-DEC-004 | Does Expense create or prove a Payment? | No. Expense and Payment remain independent until a separate linkage mission | Auto-create Payment; embed payment fields as settlement truth | Prevents duplicate financial effects and respects the closed Payments boundary | HIGH: wrong linkage can double-count money | YES |
| EXP-DEC-005 | When does Safe integration begin? | Only after approved Safe/Cash architecture and a separate integration mission | Update a Safe on Expense post; treat paymentMethod as cash movement | Current repository has no Safe source of truth or reversal contract | HIGH: premature integration can corrupt cash balances | YES |
| EXP-DEC-006 | When does Ledger integration begin? | Only after approved Basic Ledger architecture and a separate integration mission | Auto-create Ledger entry on post; use Expense storage as Ledger | Keeps baseline operational and avoids inventing accounting semantics | HIGH: ledger rules affect financial correctness | YES |
| EXP-DEC-007 | Can posted Expenses be edited? | No. Void and recreate for corrections | Allow field edits; allow amount-only edit | Preserves audit history and prevents silent financial reinterpretation | HIGH: editing posted records can invalidate linked effects | YES |
| EXP-DEC-008 | How does void work? | Preserve record, require audit metadata, require reason for posted records, no automatic reversal before integration | Hard delete; mark voided without reason; mutate amount to zero | Retains traceability and leaves reversal design to integration missions | HIGH: void behavior controls future reversal safety | YES |
| EXP-DEC-009 | What is the financial source of truth? | Expense is truth only for expense existence/lifecycle; Payment, Safe, and Ledger remain separate future truths | Expense alone drives cash/profit/balances; Payment alone represents Expense | Avoids false financial reports before source modules are integrated | HIGH: incorrect source selection causes double counting or omissions | YES |
| EXP-DEC-010 | What belongs in Expense Baseline? | Model, enums, scoped key, repository, validator, authenticated service, create/update/post/void/find/getAll only | Include UI; include categories; include Payment/Safe/Ledger integration | Smallest stable contract consistent with existing module patterns | MEDIUM: broader baseline increases coupling and regression risk | YES |

## Inherited Non-negotiable Rules

These are already imposed by the Engineering Constitution and approved V1 decisions:

- Storage must be account-scoped.
- No Firebase UID/providerUserId as `accountId`.
- No default account fallback.
- No hard delete of posted financial records.
- Audit metadata must be preserved.
- Full double-entry accounting is deferred.
- Financial integrations require separate approved missions.

## Owner Decision Requested

Approve, reject, or amend EXP-DEC-001 through EXP-DEC-010 before V1-EXP-002 begins.
