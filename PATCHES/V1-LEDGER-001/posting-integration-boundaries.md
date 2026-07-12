# V1-LEDGER-001 Posting Integration Boundaries

## Status

OWNER APPROVAL REQUIRED

This document describes future boundaries only. V1-LEDGER-001 creates no automatic JournalEntry and changes no module.

## 1. Source-of-truth Separation

| Concern | Current/future authoritative source |
| --- | --- |
| Sales lifecycle and customer invoice amount | `invoices:{accountId}` |
| Invoice returns | `invoiceReturns:{accountId}` |
| Purchase lifecycle and supplier document amount | `purchases:{accountId}` |
| Expense existence/lifecycle | `expenses:{accountId}` |
| Payment settlement record | `payments:{accountId}` |
| Cash balance and cash transfer history | `cashMovements:{accountId}` |
| Stock quantity | `stockMovements:{accountId}` |
| Accounting debit/credit balances | Future `ledgerEntries:{accountId}` |

An operational record is not a JournalEntry. A CashMovement is not automatically a JournalEntry. A Payment is not proof that a specific invoice, Expense, or Purchase has been settled unless an approved allocation exists.

## 2. One Source Event, One Posting Owner

Every future integration must appoint one orchestrator for each source lifecycle event. That orchestrator may create operational, cash, and accounting effects using separate stable idempotency keys.

Example risk to prohibit:

1. Payment post creates a CashMovement and a JournalEntry.
2. CashMovement post also creates another JournalEntry for the same Payment.

The result would double-post cash. Therefore externally sourced CashMovements must carry provenance, and Cash-to-Ledger integration must skip or reconcile events already owned by another integration.

## 3. Payment Posted

Possible future mappings:

- Customer receipt allocated to receivable: Debit Cash/Bank, Credit Accounts Receivable.
- Supplier payment allocated to payable: Debit Accounts Payable, Credit Cash/Bank.
- Other incoming/outgoing Payments require an explicit counter-account mapping.

Recommendation: no automatic Ledger posting in the baseline. Payment currently has party snapshots and direction but no approved invoice allocation, Safe selection, or accounting counter-account. Posting it automatically would guess settlement and cash location.

Payment void would require a linked reversal JournalEntry only after the original posting integration exists.

## 4. Expense Posted

Possible future mappings:

- Unpaid recognized Expense: Debit General Expense, Credit Accounts Payable/Accrued Expense.
- Immediately paid Expense: Debit General Expense, Credit Cash/Bank.

The current Expense `paymentMethod` is descriptive and does not prove payment or Safe movement. Recommendation: no automatic entry until the Owner decides recognition versus settlement timing and whether Payment/Cash records are required. Expense void must reverse only the accounting entry actually created by its integration.

## 5. CashMovement Posted

CashMovement remains the cash-balance source. Possible future mappings:

- Opening balance: Debit Cash, Credit Owner Equity / Opening Balance.
- Safe transfer: Debit destination Cash account, Credit source Cash account.
- Manual cash in/out and adjustments require an explicit counter-account.

Recommendation: no automatic Cash-to-Ledger posting in the baseline. A CashMovement lacks a universally valid counter-account, and Payment-owned CashMovements could otherwise double-post. Each Safe also needs an approved LedgerAccount mapping before integration.

## 6. Sales Invoice Issued

Proposed recognition entry, pending approval:

- Debit Accounts Receivable.
- Credit Sales Revenue.

Tax lines are excluded until tax policy exists. Cash is not affected by invoice issue; settlement belongs to Payment/Cash integration.

A cancelled issued invoice should reverse the original JournalEntry rather than mutate it. An invoice return may use a reversal/contra-revenue mapping, but Sales Returns versus direct Sales Revenue reversal is an Owner accounting-policy decision.

## 7. Invoice Return

Possible revenue-side entry:

- Debit Sales Returns or Sales Revenue.
- Credit Accounts Receivable or refund payable/cash, depending on settlement policy.

Possible inventory-side entry, only with approved cost valuation:

- Debit Inventory.
- Credit Cost of Goods Sold.

Current return execution restores stock quantity, not accounting value. No JournalEntry may be inferred without approved invoice allocation, refund, and cost-basis rules.

## 8. Purchase Posted

Possible future mapping:

- Inventory purchase: Debit Inventory, Credit Accounts Payable.
- Non-inventory purchase: Debit approved Expense/Asset account, Credit Accounts Payable.

Current Purchase lines can have optional Product ids and manual snapshots. Product classification, receipt status, payable recognition, and stock receipt integration are not approved. Recommendation: no automatic posting until those boundaries are defined.

Purchase cancellation should create a reversal entry linked to the original, not edit or delete it.

## 9. Inventory And COGS

The Stock Movement Ledger is authoritative for quantity, not necessarily value. Although movements may contain optional unit/total cost, there is no approved valuation method such as FIFO, weighted average, or specific identification.

Possible future sale-cost entry:

- Debit Cost of Goods Sold.
- Credit Inventory.

Possible return-cost entry:

- Debit Inventory.
- Credit Cost of Goods Sold.

Recommendation: block automatic Inventory/COGS JournalEntries until the Owner approves cost valuation, rounding, purchase receipt integration, and return cost restoration. Quantity changes must never be mistaken for accounting value.

## 10. Double-posting Prevention

Future integrations require:

- One posting owner per `sourceType/sourceId/sourceEvent`.
- Stable idempotency keys.
- One approved source-to-account mapping version.
- Provenance linking JournalEntry, operational source, CashMovement, and StockMovement where relevant.
- Equivalent replay returns existing effects.
- Conflicting replay fails and creates no partial effect.
- A source reversal targets only the JournalEntry created for that source event.

## 11. Integration Timing

All automatic posting belongs in separate Owner-approved integration missions after:

1. Ledger and Chart contracts are approved and implemented.
2. Default/role account mappings are approved.
3. Source event and reversal semantics are approved.
4. Runtime tests prove idempotency and failure recovery.

No current module should import LedgerService in the Ledger baseline.

## 12. Failure And Atomicity Policy

localStorage cannot atomically update separate source, Cash, Stock, and Ledger keys. Recommended future strategy:

1. Validate the complete source event and all target commands before mutation.
2. Assign stable source and idempotency identity.
3. Keep an explicit integration state or posting intent approved by the integration mission.
4. Apply effects in a documented order.
5. If the source succeeds and Ledger creation fails, keep the source's valid operational state, mark accounting integration incomplete, block claims of complete accounting, and retry with the same idempotency key.
6. If Ledger creation succeeds but acknowledgment fails, retry resolves the existing idempotent entry and completes the linkage without duplication.
7. Never silently roll back by deleting posted source or Journal records.
8. Compensation uses a linked reversal only when an accounting effect actually exists.

The exact posting-intent storage and retry UX are deferred to each integration design. They must not be invented inside the Ledger domain baseline.

## 13. Conservative Design Assessment

Advantages:

- Preserves each current module's source of truth.
- Avoids duplicated cash, expense, revenue, payable, and inventory effects.
- Allows integrations to be added and verified independently.
- Makes incomplete accounting visible rather than silently inconsistent.

Risks:

- Financial reports remain incomplete until mappings are implemented.
- Cross-key failure handling adds state and retry complexity.
- Users may misunderstand posted operational records as accounted or settled.

Mitigation:

- No auto-posting in the baseline.
- Explicit integration status and audit references in later missions.
- Stable idempotency and one posting owner.
- Reports must declare incomplete integration boundaries.

## Recommendation

Keep every module independent in the Ledger baseline. Approve and implement each source integration separately, beginning only after the Owner approves account roles, journal mappings, reversal behavior, and failure policy.
