# Contract: Test-only Fault Injection Hook

**Feature**: `001-walking-skeleton` | Requirements: FR-012, FR-013, FR-024 (D-10)

## Availability

| Build | Command | `__FM_FAULT_INJECTION__` | Hook present |
|---|---|---|---|
| Test / E2E | `pnpm build:test` (`vite build --mode test`) | `true` | Yes |
| Dev | `pnpm dev` (`mode = development`) | `true` | Yes |
| Production | `pnpm build` (`mode = production`) | `false` | **No** — dead-code-eliminated |

CI guard: `scripts/check-no-fault-hook.mjs` fails the production build if `build/` contains
`__fmFault` or `Injected fault`.

## Interface (test builds only)

```ts
// Set before the tool renders (Playwright addInitScript) or before clicking Reset tool (page.evaluate).
declare global {
  // Remaining number of renders that will throw, per tool id.
  var __fmFault: Partial<Record<'notes' | 'triads', number>> | undefined;
}
```

- On each render of a tool's zones B–E, `maybeFault(tool)` checks `globalThis.__fmFault?.[tool]`.
  If it is a positive number, it decrements it and throws `new Error('Injected fault: <tool>')`.
- `Infinity` → every render fails (tests "failure recurs after Reset tool").
- `1` → first render fails, Reset tool succeeds.
- Absent / `0` → no effect.

## Guarantees

- The hook reads only a JS global; no URL, query string, hash, storage value, or message can set it.
- The thrown error flows through the normal boundary path, so tests exercise the real failure
  view and `recordFailure` (console only).

## Example usage (Playwright)

```ts
await page.addInitScript(() => { globalThis.__fmFault = { triads: 1 }; });
await page.goto('/triads');
await expect(page.getByText('Something went wrong in this view')).toBeVisible();
await page.getByRole('button', { name: 'Reset tool' }).click();
await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
```
