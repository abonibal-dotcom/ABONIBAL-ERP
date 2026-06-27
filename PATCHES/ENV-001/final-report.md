# PATCH-000

# ENV-001

Status: CLOSED

## Classification

External Tool Limitation

## Evidence

- `pnpm.cmd` launches successfully from the clean PowerShell environment.
- `pnpm --version` returns `11.7.0`.
- `where node` resolves after the runtime-level `node.cmd` shim was created in:

```text
C:\Users\aboni\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\node.cmd
```

- The expected pnpm behavior is that `pnpm exec` runs commands in the project context. The local pnpm help output for version `11.7.0` describes `exec` as:

```text
Run a shell command in the context of a project.
```

- Outside the sandbox/tool restriction, the same clean PowerShell verification shows `pnpm exec` adding the project binary path:

```text
Path=./node_modules/.bin;...
```

- Outside the sandbox/tool restriction, the standard ECS commands pass:

```text
pnpm exec tsc --version -> ExitCode 0
pnpm exec tsc --noEmit -> ExitCode 0
pnpm run build -> ExitCode 0
```

- Inside the sandbox/tool restriction, `pnpm exec` does not expose `node_modules/.bin` and dependency files under `node_modules\.pnpm\typescript@6.0.3` can fail with `EPERM` even though the same files exist and verification passes outside the restriction.

## Engineering Decision

The failed verification was not caused by PATCH-000 source code, ECS-005 source code, TypeScript, `tsc.CMD`, `pnpm.cmd`, or missing `node.exe`.

The remaining failure mode is limited to the current verification tool/sandbox boundary. Therefore ENV-001 is closed as an External Tool Limitation.

## Required Answers

- Is PATCH-000 source code affected? No.
- Is ECS-005 source code valid? Yes.
- Can standard ECS verification continue? Yes.

## Next Step

Resume ECS-005 from Verification only:

```text
pnpm exec tsc --noEmit
pnpm run build
Runtime Verification
Commit
Tag
Push
```
