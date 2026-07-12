# V1-LEDGER-001 Chart Of Accounts Contract

## Status

OWNER APPROVAL REQUIRED

This is a proposed contract only. It creates no accounts and approves no account mapping automatically.

## 1. Proposed LedgerAccount Model

```ts
interface LedgerAccount {
    id: string;
    accountId: string;
    code: string;
    displayName: string;
    type: "asset" | "liability" | "equity" | "revenue" | "expense";
    parentAccountId?: string;
    isPostingAccount: boolean;
    status: "active" | "inactive";
    currency: string;
    systemKey?: LedgerSystemAccountKey;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    inactivatedAt?: string;
    inactivatedBy?: string;
    inactivationReason?: string;
}
```

`systemKey` is an optional stable semantic role used only after Owner-approved mapping. Journal integrations must not infer roles from mutable display names or hard-coded account codes.

## 2. Account Types

- `asset`: cash, receivables, inventory, and other controlled resources.
- `liability`: payables and obligations.
- `equity`: owner capital and retained results.
- `revenue`: sales and other earned income.
- `expense`: operating expenses and cost of goods sold.

The baseline does not introduce contra-account types. Contra behavior may use an account with the related parent and normal balance interpretation only after an approved reporting policy.

## 3. Code And Name Policy

- `code` is required and unique within the authenticated account.
- Recommended codes are strings so hierarchical formats and leading zeros remain stable.
- Code is immutable after posted journal usage.
- `displayName` is required and may be renamed; posted JournalLine snapshots remain unchanged.
- Names need not be globally unique, but duplicate normalized names should warn or fail within one parent to reduce operator error.

## 4. Simple Account Tree

- `parentAccountId` is optional.
- Parent and child must belong to the same account.
- Self-parenting and cycles are invalid.
- A child's type should match its parent type in the V1 baseline.
- A non-posting parent groups accounts and cannot appear on JournalLines.
- A posting account should not have children in the conservative baseline.
- Inactivating a parent with active children is rejected.

## 5. Posting Account Policy

Only active accounts with `isPostingAccount: true` may be used on JournalLines. Existing posted entries remain readable through snapshots after an account is inactivated.

Changing `type`, `currency`, `code`, or posting/group classification after posted usage is forbidden. Corrections require a new account plus explicit future reclassification entries; historical JournalLines are never rewritten.

## 6. Lifecycle And Deletion

- Active accounts may be selected according to posting/group rules.
- Inactive accounts remain in the chart and history but reject new posting.
- No hard delete for an account that has been used.
- Conservative baseline recommends no hard delete at all; unused mistakes are inactivated with reason.
- Inactivation should require zero derived balance and no active child accounts unless a separately approved migration/reclassification plan exists.

## 7. Proposed Default Accounts

These are candidates only, not automatically approved or created:

| Proposed semantic role | Type | Suggested purpose |
| --- | --- | --- |
| Cash | asset | Safe/cash accounting control |
| Accounts Receivable | asset | Issued customer invoice control |
| Inventory | asset | Accounted inventory value |
| Accounts Payable | liability | Supplier purchase control |
| Sales Revenue | revenue | Issued sales revenue |
| Cost of Goods Sold | expense | Cost recognized on fulfilled sales |
| General Expenses | expense | Operating expense recognition |
| Owner Equity / Opening Balance | equity | Approved opening counterpart |

Possible future roles such as Sales Returns, Tax Payable, Suspense, Bank, Card Clearing, and Retained Earnings are not silently invented in the baseline.

## 8. Default Account Edit Policy

Recommended policy:

- Owner must approve which defaults exist and their semantic `systemKey` mappings.
- Display name may change while history remains snapshot-stable.
- Code, type, currency, and semantic role become immutable after posted use.
- Default accounts may be inactivated only after remapping future posting and reaching zero balance.
- Deleting or silently replacing an approved default is forbidden.

## 9. Currency Policy

- Every LedgerAccount has one fixed uppercase currency.
- The baseline recommends one account/workspace base currency applied to all initial LedgerAccounts.
- JournalEntry currency must match every referenced account.
- No currency conversion or mixed-currency entry.
- Account currency becomes immutable after posted usage.

The source for the workspace base currency is not currently approved and requires an Owner decision before account provisioning.

## 10. Audit Metadata

Creation, update, and inactivation metadata are required. Actors come from the authenticated user. `accountId` is explicit and never inferred from provider identity. Historical account snapshots on JournalLines remain immutable.

## 11. Storage Boundary

```text
ledgerAccounts:{accountId}
```

- Account-scoped reads and writes only.
- No global chart key or default-account fallback.
- Duplicate codes, cross-account parents, and cross-account JournalLine references are rejected.

## 12. Out Of Scope

- Automatic chart provisioning.
- Owner-specific code numbering without approval.
- Contra accounts, control-account subledgers, cost centers, departments, projects, budgets, tax accounts, bank reconciliation, retained-earnings closing, and consolidation.
- Multi-currency conversion.
- UI, import/export, sync, reports, and permissions.

## Recommendation

Approve a small editable account tree with immutable posted identity, explicit semantic mappings, one currency, no hard delete, and no automatic default-account creation until the Owner approves codes and mappings.
