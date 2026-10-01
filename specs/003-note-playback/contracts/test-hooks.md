# Contract: Test-only audio hooks

**Feature**: `003-note-playback` | Extends: [002 test-hooks](../../002-interactive-fretboard/contracts/test-hooks.md) (ADR 0004) | Research: R-16

## Availability

The hooks follow the same build-flag rule as `__fmFault`. They are read or written only when
`__FM_FAULT_INJECTION__` is `true` (`pnpm build:test`, `pnpm dev`), so they are dead-code-eliminated
from `pnpm build`. `scripts/check-no-fault-hook.mjs` adds `__fmAudioFault` and `__fmAudioLog` to
its needles, so production `build/` fails CI if either string appears.

## Interface (test builds only, declared in `src/app.d.ts`)

```ts
declare global {
  /** Forces an unlock failure: 'context' → AudioContext factory throws; 'synth' → loader rejects. */
  var __fmAudioFault: 'context' | 'synth' | undefined;
  /** Append-only log of engine decisions (data-model §8). Created on first write. */
  var __fmAudioLog: AudioLogEntry[] | undefined;
}
```

- `__fmAudioFault` is read once, when the engine is created (app start). Only a JS global can set
  it (Playwright `addInitScript`); no URL, storage, or message can.
- `__fmAudioLog` is written by the engine for `unlock`, `step`, `stop`, and `unavailable` events.
  It is never read by app code. Entries contain numbers and enum strings only.

## Examples (Playwright)

```ts
// US1-1 / SC-002: first gesture plays E2
await page.goto('/notes');
await page.getByRole('gridcell', { name: /string 6, open/i }).click();
await expect.poll(() => page.evaluate(() => globalThis.__fmAudioLog?.find((e) => e.type === 'step'))).toMatchObject({
  kind: 'note', pitches: [40]
});

// US5: unavailable
await page.addInitScript(() => { globalThis.__fmAudioFault = 'context'; });
await page.goto('/notes');
await page.getByRole('gridcell', { name: /string 6, open/i }).click();
await expect(page.getByRole('status').getByText('Sound is not available on this device right now')).toHaveCount(1);
```
