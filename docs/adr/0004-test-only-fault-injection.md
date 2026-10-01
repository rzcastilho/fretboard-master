# ADR 0004: Test-only fault injection

- **Status**: Accepted
- **Source**: research R-06 (spec 001-walking-skeleton)

## Context

Every acceptance scenario must be automated, including "a tool fails and the app recovers". That
needs a way to make a tool throw on demand, without giving users or crafted addresses a way to
trigger it in production.

## Decision

- Vite `define` sets the build-time boolean `__FM_FAULT_INJECTION__` to `true` only for
  `--mode test` (and `development`), `false` otherwise.
- `src/lib/shell/fault.ts` exports `maybeFault(tool)`. When enabled it reads a remaining count
  from `globalThis.__fmFault`, decrements it, and throws `Injected fault: <tool>`. When disabled
  the body is dead code and is removed from the bundle. Only a global is read, so addresses and
  query strings never reach the hook.
- `ToolPlaceholder` calls `maybeFault(tool)` during render. Playwright sets the global with
  `addInitScript` (see `injectFault` in `e2e/support/helpers.ts`).
- `scripts/check-no-fault-hook.mjs` greps the production `build/` for `__fmFault` and
  `Injected fault`, and fails CI if either is found.

## Consequences

- E2E tests run against the `--mode test` build and exercise real boundary and reset behavior.
- Production shipping the hook is caught by a CI gate, not by convention.

## Alternatives considered

- Query-string trigger (`?fault=triads`): an address could trigger it if accidentally shipped.
- Runtime `import.meta.env.DEV` check only: would not cover the e2e build, which is a
  production-mode build.
