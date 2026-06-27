# ABONIBAL ERP Decisions

This file records owner-approved product and engineering decisions that affect Version 1.0 planning.

## V1 Product Decisions

### DEC-001 - Multi-user V1

Decision:

V1 must support more than one user.

Impact:

Auth / Multi-user Foundation belongs in V1 before Products development continues deeply.

### DEC-002 - Product Images Optional In V1

Decision:

Product images are optional in V1.

Impact:

Products can be delivered without advanced image upload or sync as long as the owner-approved V1 product workflow remains stable.

### DEC-003 - Advanced Product Image Flow Deferred

Decision:

Advanced product image upload and sync are deferred to V2.

Impact:

Image infrastructure must not block V1 unless later approved by the owner or architect.

### DEC-004 - Prevent Selling Unavailable Stock

Decision:

V1 must prevent selling unavailable stock.

Impact:

Inventory and sales/invoice work must include stock availability checks before invoice confirmation.

### DEC-005 - Basic Discounts In V1

Decision:

V1 supports basic discounts.

Impact:

Sales and invoice totals must account for basic discount rules.

### DEC-006 - Tax Rules Deferred

Decision:

Tax rules are deferred unless legally or business required.

Impact:

Tax implementation must not block V1 unless the owner or legal/business requirements make it mandatory.

### DEC-007 - Basic Auditable Ledger In V1

Decision:

V1 includes a basic auditable ledger.

Impact:

Sales, expenses, safes, and cash movement must produce traceable records.

### DEC-008 - Full Double-entry Accounting Deferred

Decision:

Full double-entry accounting is deferred unless later approved.

Impact:

V1 ledger must be auditable and consistent, but not a full accounting suite.

### DEC-009 - Sync Data Safety In V1

Decision:

V1 sync scope is data safety and no silent overwrite.

Impact:

Advanced sync must not overwrite user data silently. V1 must prefer safe interruption over hidden data loss.

### DEC-010 - Advanced Conflict Resolution Deferred

Decision:

Advanced conflict resolution is V2.

Impact:

V1 sync should avoid silent overwrite and preserve data safety, but does not need automated advanced conflict merging.

### DEC-011 - Basic Reports In V1

Decision:

V1 reports are basic only.

Impact:

Dashboard and reports should be built on stable source modules and must not include advanced analytics before V1 core business correctness is proven.

## Engineering Decisions

### DEC-012 - Product Engineering And Infrastructure Separation

Decision:

Application source changes belong in ECS. Tooling, environment, repository governance, and planning belong in INF, ENV, or TOOL missions.

Impact:

Product commits must not be mixed with infrastructure/tooling commits unless explicitly approved.
