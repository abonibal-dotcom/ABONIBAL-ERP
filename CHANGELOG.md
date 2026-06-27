# Changelog

## V1-FND-001 - Foundation Verification Baseline

- Verified the post-governance foundation runtime baseline.
- Confirmed TypeScript and build verification passed.
- Confirmed application startup, default route rendering, registered route sweep, navigation alignment, refresh behavior, and clean runtime baseline before invalid-route observation.
- Documented invalid-route behavior without changing application source code.
- Confirmed no files under `src/` were changed.

## V1-INF-002 - Governance Baseline Review & Integration

- Integrated the V1-INF-001 governance baseline into the active baseline branch.
- Updated current mission and project status documentation for V1-INF-002.
- Confirmed ECS-006 remains blocked pending Architect / Owner approval.

## V1-INF-001 - Repository Governance & Baseline Lock

- Added the approved complete Engineering Constitution v1.0.
- Added repository governance documents for project orientation, project status, current mission, V1 roadmap, and owner decisions.
- Marked the active mission as INF documentation/governance only.
- Confirmed ECS-006 remains blocked until governance baseline approval.
- Updated release documentation to avoid stale PATCH-000 status ambiguity.

## PATCH-000 - Project Stabilization

### PATCH-000-ECS-001 - Route Registry Stabilization

- Stabilized the Sidebar route surface by deriving visible navigation items from the registered route list.
- Removed Sidebar entries that pointed to unregistered routes.
- Verified that navigation to visible routes completes without browser console errors or page exceptions.

### PATCH-000-ECS-002 - Product Page Listener Lifecycle Stabilization

- Stabilized the product page dialog listener lifecycle.
- Replaced anonymous dialog button listeners with retained callback references.
- Added `onLeave()` cleanup for `create-product`, `cancel-product`, and `close-product-dialog`.
- Verified listener stability over 50 navigation/dialog cycles.

### PATCH-000-ECS-003A - Dashboard Copy Stabilization

- Removed internal implementation/progress copy from the Dashboard page.
- Kept the Dashboard route, layout ownership, and user-facing welcome copy unchanged.
- Verified the Dashboard with DOM-based runtime evidence, clean browser console, and no page exceptions.

### PATCH-000-ECS-004 - Dashboard Text Encoding Investigation

- Investigated the Dashboard text encoding hypothesis with runtime evidence.
- Rejected the hypothesis because the Dashboard rendered valid Arabic text at runtime.
- Closed ECS-004 without source-code changes.

### PATCH-000-ECS-005 - LocalStorage Read Resilience

- Contained malformed JSON failures inside `LocalStorageDriver.read<T>()`.
- Preserved existing successful JSON read behavior.
- Returned the existing contract-compatible safe default `null` for invalid JSON.
- Verified TypeScript, build, and runtime behavior with clean console and no page exceptions.
