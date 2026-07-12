# V1-LEDGER-001 Decision Record

## Status

OWNER APPROVAL REQUIRED

No decision below changes runtime behavior. Every item is a financial/accounting decision and requires explicit Owner approval before implementation.

| Decision ID | Question | Recommended option | Alternatives | Reason | Risk | Required owner approval |
| --- | --- | --- | --- | --- | --- | --- |
| LEDGER-DEC-001 | Double-entry or single-entry? | Minimal balanced double-entry journal | Single-entry event list; no Ledger | Detects one-sided effects and supports reliable balances, but explicitly needs approval because full double-entry is currently deferred | HIGH: changes the accounting foundation | YES |
| LEDGER-DEC-002 | What is the Ledger account model? | Account-scoped typed account with code, name, type, parent, posting flag, status, currency, and audit metadata | Flat strings; enum-only accounts; external chart | Provides stable references and controlled hierarchy without a full suite | HIGH: account identity drives every journal line | YES |
| LEDGER-DEC-003 | What is the Chart baseline? | Small editable tree under `ledgerAccounts:{accountId}` with no hard delete | Fixed chart; automatic full chart; no chart entity | Supports future mappings while preserving ownership and audit history | HIGH: chart design affects reports and integrations | YES |
| LEDGER-DEC-004 | What is the Journal lifecycle? | `draft -> posted -> reversed` | Posted-only; draft/posted/voided; mutable entries | Matches accepted financial lifecycle patterns and supports review plus correction | HIGH: lifecycle controls financial effect | YES |
| LEDGER-DEC-005 | Can posted entries be edited? | No; posted entries are immutable | Allow description edits; allow line edits; hard delete | Prevents historical balance and source-link corruption | HIGH | YES |
| LEDGER-DEC-006 | How are corrections made? | Linked posted reversal entry with opposite lines | Mutate original; exclude original; delete/recreate | Preserves complete history and nets the original effect exactly once | HIGH | YES |
| LEDGER-DEC-007 | What is the balance source of truth? | Sum valid posted/reversed history and reversal entries; no mutable balance | Persist mutable balances; derive from operational modules | Rebuildable and auditable; avoids drift | HIGH | YES |
| LEDGER-DEC-008 | What is the currency policy? | One explicit currency per entry, matching all accounts; one V1 base currency; no conversion | Mixed-currency lines; automatic FX; currencyless entries | Avoids unapproved rates and gain/loss accounting | HIGH | YES |
| LEDGER-DEC-009 | How is duplicate posting prevented? | Account-scoped idempotency plus unique sourceType/sourceId/sourceEvent | UI-only locking; sourceId only; no replay support | Handles retries and distinguishes lifecycle events | HIGH | YES |
| LEDGER-DEC-010 | Does Payment post automatically to Ledger? | No baseline auto-post; separate mapping/allocation integration | Auto Cash/A/R/A/P posting; Payment is Ledger | Current Payment lacks approved allocation, Safe, and counter-account semantics | HIGH: duplicate or incorrect settlement | YES |
| LEDGER-DEC-011 | Does Expense post automatically to Ledger? | No baseline auto-post; separately decide recognition versus settlement | Debit Expense/Credit Cash automatically; Expense is Ledger | `paymentMethod` is descriptive and does not prove settlement | HIGH | YES |
| LEDGER-DEC-012 | Does CashMovement post automatically to Ledger? | No baseline auto-post; require Safe-account/counter-account mapping and posting ownership | Every movement auto-posts; CashMovement equals JournalEntry | Prevents missing counter-account and Payment/Cash double-posting | HIGH | YES |
| LEDGER-DEC-013 | Does Sales issue automatically post? | Separate integration; proposed A/R debit and Sales Revenue credit after approval | Post Cash; post revenue only; no Sales accounting | Invoice issue is the likely recognition event, but tax, cancellation, and returns need mapping | HIGH | YES |
| LEDGER-DEC-014 | Does Purchase post automatically post? | Separate integration; proposed Inventory/Expense debit and A/P credit after approval | Credit Cash; Purchase is Expense; no purchase accounting | Product classification, receipt, and payable timing are not approved | HIGH | YES |
| LEDGER-DEC-015 | How do Inventory and COGS integrate? | Defer automatic entries until cost valuation and return-cost rules are approved | Use Product cost; use optional movement unitCost; quantity equals value | Current stock ledger is quantity-authoritative, not a proven valuation ledger | HIGH | YES |
| LEDGER-DEC-016 | How are cross-key failures handled? | Idempotent staged orchestration with visible incomplete state, retry, and reversal compensation only when needed | Assume atomic localStorage; delete on failure; silent retry | Separate keys are not transactional and silent partial accounting is unsafe | HIGH | YES |
| LEDGER-DEC-017 | Are default accounts created automatically? | Proposed roles only; Owner approves codes, currency, semantic mappings, and provisioning | Hard-coded automatic chart; user builds all accounts manually | Prevents invented financial policy while enabling a small future baseline | HIGH | YES |
| LEDGER-DEC-018 | What belongs in Ledger baseline implementation? | Accounts, balanced Journal model, scoped repositories/validators/services, draft/post/reverse/find/balance only; no UI or integrations | Include UI, reports, mappings, auto-posting, full accounting | Smallest testable journal engine consistent with current architecture | MEDIUM | YES |

## Required Owner Clarification

Approval of LEDGER-DEC-001 must explicitly clarify or amend the current decision that full double-entry accounting is deferred. The recommended interpretation is:

- Approve the double-entry balancing invariant and minimal journal engine for Basic Ledger.
- Continue deferring the full accounting suite and every automatic source integration.

## Implementation Gate

No Ledger entity, Chart runtime code, repository, service, Container registration, page, route, report, or source integration may begin until the relevant decisions above are approved or amended.
