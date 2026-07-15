# V1-SYNC-007 Commercial and Inventory Consistency Map

## Current Command Dependency Map

| Command | Records created/changed | Current local order | Current sync state |
| --- | --- | --- | --- |
| Create draft Invoice | 1 Invoice | Invoice only | Invoice local-only |
| Update draft Invoice | 1 Invoice | Replace draft | Invoice local-only |
| Delete draft Invoice | 1 Invoice removed | Physical local removal | No cloud tombstone |
| Issue Invoice with N lines | N `sale_deduction` movements + 1 Invoice update | Movements first, Invoice issued last | Movements sync-aware; Invoice local-only |
| Cancel Invoice with N lines | N `sale_return` movements + 1 Invoice update | Movements first, Invoice cancelled last | Movements sync-aware; Invoice local-only |
| Create InvoiceReturn | 1 recorded InvoiceReturn | Return only | Return local-only |
| Execute InvoiceReturn with N lines | N `sale_return` movements + 1 Return update | Movements first, Return executed last | Movements sync-aware; Return local-only |

The current active-mode consistency risk is explicit: another device can receive inventory movements without the corresponding Invoice or InvoiceReturn.

## Coupling Audit

| Module | Current coupling |
| --- | --- |
| Products | Invoice UI reads active Products and stores line snapshots. Product records are not mutated. |
| StockMovements | Issue, cancellation, and return execution append inventory effects. This is the only operational side effect. |
| Customers | Invoice UI reads Customers and stores `customerId` plus snapshot. No Customer record or balance is changed. |
| Payments | No current coupling. |
| Safes/CashMovements | No current coupling. |
| LedgerEntries | No current coupling. |
| Purchases/Expenses | No current coupling. |

No automatic accounting or payment integration may be added by the future Sales sync implementation.

## Current Identity Map

| Record | Identity today | Multi-device suitability |
| --- | --- | --- |
| Invoice | Random UUID created before draft persistence | Stable after creation |
| Invoice line | Random UUID regenerated when supplied draft lines are updated | Not stable across draft edits |
| Invoice number | Local daily sequence | Unsafe |
| Issue deduction | Random UUID | Unsafe for interrupted exact retry |
| Cancellation movement | Random UUID plus metadata lookup | Partially recoverable, not deterministic |
| InvoiceReturn | Random UUID persisted before execution | Stable after creation |
| Return line | Random UUID persisted before execution | Stable after creation |
| Return number | Local daily sequence | Unsafe |
| Return movement | Random UUID | Unsafe for interrupted exact retry |

## V1-SYNC-006D Suitability

The durable group foundation can represent arbitrary modules, stable checksums, expected revision fields, ordered members, account isolation, atomic local outbox batch persistence, local reconciliation, capability gates, and partial acknowledgement recovery.

It is suitable as the local durable intent foundation for Sales commands.

It is not sufficient by itself because cloud dispatch is member-by-member. Commercial cutover requires a group-level cloud commit that makes the commercial record and all inventory movements visible atomically or behind a mandatory committed-group visibility gate.

## Recommended Issue Group

Before the first local mutation, persist one complete group containing:

- N deterministic `sale_deduction` StockMovement appends;
- one Invoice draft revision to issued/frozen state;
- final Invoice number allocation/claim metadata when required;
- one stable group/command identity and checksum.

Recommended local sequence:

1. Apply all deduction movements through raw cache appliers.
2. Apply the Invoice issued lifecycle transition last.

This avoids exposing an issued local Invoice before its inventory effects exist. Recovery may temporarily show inventory effects before issued status, but the durable group can complete it. Cloud visibility must not expose this order; it should commit the complete group atomically.

## Recommended Cancellation Group

- N deterministic positive `sale_return` cancellation movements;
- one Invoice issued-to-cancelled lifecycle update;
- cancellation reason/audit metadata;
- original deductions preserved.

Apply movements locally before cancelled status; commit all cloud paths atomically.

## Recommended Return Execution Group

- N deterministic `sale_return` movements;
- one InvoiceReturn recorded-to-executed lifecycle update;
- accepted return allocation/transaction result;
- one stable group/command identity.

The trusted cloud transaction must validate cumulative return quantities before any group member becomes canonical.

## Capability Gate

Every commercial group must remain cloud-blocked until all required capabilities exist:

- `invoices/create|update` or lifecycle-specific equivalent;
- `invoiceReturns/create|update` or lifecycle-specific equivalent;
- `stockMovements/append`;
- group-level atomic commit/transaction capability;
- document-number allocation capability when assigning final numbers.

Registration alone is insufficient. All members must be locally applied, conflict-free, and part of one complete validated group.

## Canonical Commit Invariants

The cloud commit layer, not a pull adapter, must guarantee:

- one account-scoped Invoice/Return identity;
- expected revision is current;
- lifecycle transition is legal;
- all movement IDs are absent or exact matches;
- no divergent overwrite;
- invoice number is unique within the account;
- issue has sufficient canonical inventory;
- cumulative accepted returns do not exceed sold quantity;
- all final records become visible together;
- a stable receipt makes retries idempotent.

RTDB rules can enforce simple path/revision/immutability constraints, but canonical stock sufficiency and cumulative return arithmetic require a trusted transaction/application layer.

## Pull Contract

Invoice and InvoiceReturn pull only validates and applies authoritative cloud records to raw local caches. StockMovements arrive independently through StockMovement sync.

Pull must never call issue, cancellation, return execution, InventoryService commands, Payment, CashMovement, or JournalEntry commands. It must not generate movement IDs or replay side effects.
