# V1-SYNC-007 Decision Record

All decisions in this document are recommendations only. Every item is **OWNER APPROVAL REQUIRED** before implementation.

## SALESYNC-DEC-001 - Invoice Lifecycle Cloud Contract

Recommendation: keep the current `draft -> issued -> cancelled` lifecycle. Treat issue and cancellation as explicit revision-checked transitions; do not invent an additional posted/voided state in this mission line.

Status: OWNER APPROVAL REQUIRED
## SALESYNC-DEC-002 - Draft Mutability

Recommendation: allow draft create/update only with revision/CAS. A stale draft write must conflict and must never silently overwrite another device.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-003 - Issued Invoice Immutability

Recommendation: freeze commercial fields after issue, including number, customer snapshot, lines, quantities, prices, discounts, tax, totals, account identity, issued audit, and original movement references. Only the explicit cancellation lifecycle and its audit references may advance.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-004 - Draft Deletion Policy

Recommendation: retain current draft-only deletion semantics locally, but represent synchronized deletion as an account-scoped tombstone. Deny physical cloud delete and deny deletion after issue.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-005 - Invoice Line Snapshot Policy

Recommendation: preserve stable Product and Customer history in the Invoice: Product ID, stable line ID, name/SKU/barcode/unit snapshots, quantity, price, discount, tax, line totals, and customer identity/display snapshot. Later master-data edits must not rewrite issued history.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-006 - Invoice Number Identity and Uniqueness

Recommendation: keep UUID as stable record identity and assign the final human Invoice number at issue through a trusted account-scoped transaction. Exact retry returns the same number; numbers are unique, never reused, and may have documented gaps. Apply the analogous policy to the final Return number at accepted execution unless the owner explicitly approves allocation at recording.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-007 - Invoice Issue Durable Group Membership

Recommendation: one issue command contains the Invoice lifecycle transition/final snapshot, one deterministic `sale_deduction` StockMovement per line, final number allocation, and one idempotency/group receipt. No Payment, CashMovement, Customer balance, or JournalEntry member exists under the current domain.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-008 - Invoice-to-StockMovement Ordering

Recommendation: persist the complete durable intent before local mutation; apply local StockMovements before the final issued Invoice state; publish the complete cloud group atomically. Ordered member dispatch alone is insufficient for cutover.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-009 - Invoice Issue Exact Retry and Idempotency

Recommendation: use a stable command ID and deterministic movement IDs derived from approved Invoice and line identities. Exact identity plus exact checksum returns the original result; the same identity with a different payload is a hard conflict.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-010 - Invoice Cancellation Policy

Recommendation: preserve the original Invoice and sale_deduction movements. Cancellation advances `issued -> cancelled` and appends one deterministic positive `sale_return` per original line in one trusted atomic group. No hard delete or direct void of original movements.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-011 - InvoiceReturn Lifecycle

Recommendation: retain `recorded -> executed`. A recorded Return may be revisioned while not executed; an executed Return is immutable. Do not infer a void lifecycle merely from currently unused optional fields.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-012 - Return Durable Group Membership

Recommendation: one execute command contains the InvoiceReturn transition/final snapshot, one deterministic positive `sale_return` StockMovement per Return line, the accepted cumulative allocation result, final number allocation when applicable, and one idempotency/group receipt.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-013 - Partial and Multiple Return Policy

Recommendation: continue supporting partial and multiple Returns while requiring the cumulative accepted quantity per original Invoice line to remain less than or equal to the sold quantity.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-014 - Concurrent Over-Return Prevention

Recommendation: validate and reserve cumulative Return quantity inside a trusted canonical transaction. Offline clients may prepare a recorded Return, but execution requires an online canonical commit. Concurrent excess attempts receive an explicit conflict and create no movements.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-015 - InvoiceReturn-to-StockMovement Ordering

Recommendation: persist complete durable intent first; apply local StockMovements before marking the Return executed; publish the Return and all StockMovements atomically in cloud. Retry must adopt exact existing members rather than fail after a partial local success.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-016 - Pull Cache-Only Policy

Recommendation: Invoice and InvoiceReturn pull validates and applies canonical envelopes directly to cache/state only. It must never call issue, cancellation, Return execution, InventoryService, Payment, CashMovement, or JournalEntry commands.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-017 - Commercial Record Hard-Delete Policy

Recommendation: deny hard delete for issued/cancelled Invoices and recorded/executed Returns. A draft Invoice deletion is represented by tombstone after synchronization. Correction uses existing lifecycle, cancellation, reversal, or Return records.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-018 - Cloud Group Visibility Before Cutover

Recommendation: require trusted validation plus one RTDB atomic multi-location publication for each complete commercial/inventory group. A group receipt and bootstrap completeness gate are also required; sequential member visibility is not acceptable for cutover.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-019 - Customer, Payment, Cash, and Ledger Coupling Boundary

Recommendation: preserve the current boundary. Invoice UI reads Product and Customer data to create snapshots; only StockMovements are operational side effects. There is no current Customer balance, Payment, CashMovement, or JournalEntry coupling, and none should be added implicitly by sync work.

Status: OWNER APPROVAL REQUIRED

## SALESYNC-DEC-020 - Implementation Sequence

Recommendation: execute the minimum safe sequence: V1-SYNC-007A domain lifecycle alignment; V1-SYNC-007B trusted commercial transaction and atomic group foundation; V1-SYNC-007C Invoice sync; V1-SYNC-007D InvoiceReturn sync; V1-SYNC-007E regression/cutover gate. Keep V1-SYNC-009 as the separate non-destructive migration and owner-approved cutover mission.

Status: OWNER APPROVAL REQUIRED
