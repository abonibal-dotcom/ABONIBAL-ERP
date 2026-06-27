# PATCH-000

# ECS-005 Root Cause Confirmation

## Current Git Status

- Branch: `patch/000-ecs-004-dashboard-text-encoding`
- Commit: `7aa7e38`
- Tag: `patch-000-ecs-004`
- Git Clean: Yes

## Goal

Determine the real root cause that makes the product persistence read path fail when `localStorage.products` contains invalid JSON.

## Baseline Evidence Used

- `baseline-runtime.json`
- `baseline-dom.json`
- `baseline-console.log`
- `baseline-screenshot.png`

## Runtime Reproduction

Baseline injected this malformed value:

```text
localStorage.products = {malformed-products-json
```

The Products route loaded, then the product read path was invoked in browser runtime.

Runtime result:

- Product read path attempted: true.
- Product read path failed: true.
- Exception type: `SyntaxError`.
- Exception message: `Expected property name or '}' in JSON at position 1 (line 1 column 2)`.
- Browser console errors: 0.
- Page exceptions: 0.
- Network errors: 0.

## Execution Path

Observed runtime stack:

```text
JSON.parse (<anonymous>)
LocalStorageDriver.read (http://127.0.0.1:5173/src/core/persistence/LocalStorageDriver.ts:7:15)
ProductRepository.all (http://127.0.0.1:5173/src/core/repositories/Repository.ts:9:22)
ProductService.getAll (http://127.0.0.1:5173/src/modules/products/services/ProductService.ts:11:26)
```

Source path:

1. `localStorage.getItem(key)` reads the malformed value.
2. `LocalStorageDriver.read()` passes the malformed value directly to `JSON.parse`.
3. `JSON.parse` throws `SyntaxError`.
4. `Repository.all()` does not catch the exception from `driver.read`.
5. `ProductService.getAll()` does not catch the exception from `repository.all`.
6. The current `ProductListPage` renders the Products page but does not call `ProductService.getAll()` during `render()` or `onEnter()`.

## First Failure Point

File:

- `src/core/persistence/LocalStorageDriver.ts`

Function:

- `LocalStorageDriver.read<T>(key: string)`

Responsible source snippet:

```ts
const json = localStorage.getItem(key);

if (!json) {
    return null;
}

return JSON.parse(json) as T;
```

Actual source line:

- `src/core/persistence/LocalStorageDriver.ts:13`

Runtime transformed stack location:

- `src/core/persistence/LocalStorageDriver.ts:7:15`

## Why The Exception Is Not Contained

There is no local exception boundary around `JSON.parse` in `LocalStorageDriver.read()`.

There is also no exception boundary in the downstream callers:

- `Repository.all()` directly returns `this.driver.read<T[]>(this.key) ?? []`.
- `ProductService.getAll()` directly returns `this.repository.all()`.

Therefore, malformed persisted JSON propagates as an uncaught `SyntaxError` through the product read path.

## Layer Assessment

### localStorage

`localStorage` contains the malformed value as injected by baseline. It is the input source, not the code-level failure point.

### LocalStorageDriver

Confirmed as the first code-level failure point because it directly calls `JSON.parse(json)` without containing parse errors.

### Repository

Excluded as first failure point. It delegates to `driver.read()` and receives the thrown exception after the driver fails.

### Service

Excluded as first failure point. It delegates to `repository.all()` and receives the thrown exception after repository delegation.

### Page

Excluded as first failure point. Runtime evidence shows Products page DOM loaded. Current `ProductListPage` does not call the product service read path during `render()` or `onEnter()`.

## Regression Risk Known

Low to medium for a minimal fix.

The expected fix surface is the read-path behavior for malformed persisted JSON. Risk is primarily around preserving current behavior for valid JSON and empty storage while containing only invalid JSON parsing failures.

## Decision

Root Cause Confirmed.

## Minimal Fix Gate

Minimal Fix may proceed only after approval.

The minimal scope candidate is `src/core/persistence/LocalStorageDriver.ts`, but no source-code modification has been made in this phase.
