# Changelog

## V1-AUTH-001 - Auth / Multi-user Foundation Baseline

- Verified Auth / multi-user foundation baseline without source-code changes.
- Confirmed no Auth dependency, Auth module, user identity model, session model, route guard, or user-scoped persistence exists.
- Confirmed Dashboard and Products routes are accessible without login.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors and zero page exceptions.
- Recorded Auth foundation as a confirmed V1 architecture gap before product-module expansion.

## V1-PER-002 - Storage Wrapper Read Resilience

- Contained malformed JSON failures inside `Storage.get<T>()`.
- Preserved existing valid JSON parsing behavior.
- Preserved existing missing-key behavior by returning `null`.
- Preserved malformed raw stored values without deletion, migration, or overwrite.
- Verified `LocalStorageDriver` read behavior remained unchanged.
- Confirmed TypeScript, build, and runtime verification passed with zero console errors and zero page exceptions.

## V1-PER-001 - Persistence Safety Baseline

- Verified persistence safety behavior with isolated runtime localStorage keys.
- Confirmed TypeScript and build verification passed.
- Confirmed `LocalStorageDriver.read<T>()` handles missing and malformed JSON safely.
- Confirmed repository missing collection behavior returns an empty array through the existing repository contract.
- Observed non-silent write failure behavior for simulated `setItem` and circular JSON failures.
- Confirmed `src/core/Storage.ts` has a malformed JSON read-path safety issue in `Storage.get<T>()`.
- Confirmed no files under `src/` were changed.

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
