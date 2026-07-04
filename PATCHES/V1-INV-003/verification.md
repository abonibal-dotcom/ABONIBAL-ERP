# V1-INV-003 Verification

## Mission

`V1-INV-003 - Stock Movement Ledger Persistence Baseline`

## Classification

ECS.

## Baseline

- Branch: `v1/inv-003-stock-movement-ledger-persistence-baseline`.
- Baseline tag: `v1-inv-002-stock-movement-ledger-design-plan`.
- Baseline commit: `4d4a0d73961cc808bb7e8756ef9076b77f69e3e5`.
- `.env` tracked by Git: no.
- Product regression accepted: yes, through ECS-011.
- Existing Inventory implementation before this mission: no.
- Existing invoice implementation before this mission: no.

## Verification Environment

- Runtime: Vite dev server.
- Browser: Chrome headless with isolated temporary profile.
- Verification Tool: Chrome DevTools Protocol direct WebSocket client stored under `outputs/V1-INV-003/`.
- Reason for Selection: CDP is the established repository runtime verifier and does not require adding project test dependencies.
- Known Limitations: Runtime evidence is collected from an isolated browser profile. Tool invocation failures are classified separately and are not treated as application failures.

## Tool Attempts

Early runtime attempts failed before valid evidence collection because of verifier/tool invocation issues:

- `pnpm.cmd` could not be spawned with `shell: false` on Windows.
- A Vite invocation included an extra literal `--`.
- Vite attempted to watch a Chrome profile under `outputs/` and failed with `EBUSY`.
- A verifier timing race waited for Products UI after Login page navigation settled elsewhere.

These attempts were Tool verification issues. They were not used as PASS evidence and did not require source changes.

## TypeScript Verification

Command:

```bash
pnpm exec tsc --noEmit
```

Result: PASS.

## Build Verification

Command:

```bash
pnpm run build
```

Result: PASS.

## Runtime Verification

Command:

```bash
node outputs/V1-INV-003/verify-runtime.mjs
```

Result: PASS.

## Runtime Evidence Files

```text
outputs/V1-INV-003/runtime.json
outputs/V1-INV-003/dom.json
outputs/V1-INV-003/console.log
outputs/V1-INV-003/storage-snapshot-sanitized.json
outputs/V1-INV-003/screenshot.png
outputs/V1-INV-003/ledger-summary.json
```

## Runtime Gates

| Gate | Result |
| --- | --- |
| Login succeeds | PASS |
| AuthSession exists | PASS |
| AuthSession.accountId exists | PASS |
| accountId is not Firebase UID | PASS |
| accountId is not providerUserId | PASS |
| Route Guard remains active | PASS |
| Scoped stock key is `stockMovements:{accountId}` | PASS |
| No global `stockMovements` key is used | PASS |
| Opening balance writes to scoped key | PASS |
| Manual adjustment writes to scoped key | PASS |
| Movement records include accountId | PASS |
| Movement records include productId | PASS |
| Movement records include createdBy | PASS |
| Current quantity equals non-voided delta sum | PASS |
| Voiding preserves movement record | PASS |
| Voided movement excluded from current quantity | PASS |
| Movement count does not decrease after void | PASS |
| Reload preserves ledger and computed quantity | PASS |
| `products:{accountId}` hash unchanged | PASS |
| `localStorage.products` hash unchanged | PASS |
| No Inventory UI added | PASS |
| No invoice implementation added | PASS |
| Console errors = 0 | PASS |
| Page exceptions = 0 | PASS |
| `.env` remains untracked | PASS |

## Ledger Measurements

- Sanitized accountId: `abonibal...3627edde0203`.
- Stock movement scoped key: `stockMovements:{accountId}`.
- Product id used for movement test: `v1-inv-003-runtime-product`.
- Movement count before: 0.
- Movement count after add: 2.
- Movement count after void: 2.
- Current quantity before add: 0.
- Current quantity before void: 7.
- Current quantity after void: 10.
- Opening balance movement write: PASS.
- Manual adjustment movement write: PASS.
- Void movement write: PASS.
- Product scoped hash before/after: unchanged.
- Legacy Product hash before/after: unchanged.

## Scope Confirmation

- No Product files changed.
- No Product records mutated.
- `Product.quantity` remains non-authoritative.
- No Product quantity migration.
- No Product legacy key mutation.
- No Inventory UI.
- No Inventory route.
- No invoice implementation.
- No Route Guard weakening.
- No Auth behavior change.
- No Firebase UID as accountId.
- No providerUserId as accountId.
- No default account fallback.
- No credentials printed or committed.

## Result

V1-INV-003 verification PASS.
