# Contract: Test-only Fretboard Fixture Hook

**Feature**: `002-interactive-fretboard` | Extends: [001 test-hooks](../../001-walking-skeleton/contracts/test-hooks.md) (ADR 0004)

## Availability

Same build-flag rule as the fault hook: present only when `__FM_FAULT_INJECTION__` is `true`
(`pnpm build:test`, `pnpm dev`); dead-code-eliminated in `pnpm build`.
`scripts/check-no-fault-hook.mjs` additionally fails if `build/` contains `__fmFretboardFixture`
or `__fmFretboardEvents`.

## Interface (test builds only)

```ts
declare global {
  var __fmFretboardFixture:
    | 'all-markers' | 'labels-spelled' | 'highlight-far' | 'highlight-split' | 'empty'
    | undefined;
  var __fmFretboardEvents: { string: number; fret: number }[] | undefined;
}
```

- Read once when zone C of `/notes` mounts. A known name selects a fixed `DisplayModel` from
  `src/lib/fretboard/fixtures.ts`; anything else → plain board.
- Each activation appends `{ string, fret }` to `__fmFretboardEvents` (created if absent).
- Settable only from a JS global (Playwright `addInitScript`); no URL, storage, or message can
  set it; fixture content is static and never rendered as HTML.

## Fixtures

| Name | Content | Used by |
|---|---|---|
| `all-markers` | Every function × emphasis (5 × 4) on distinct positions, `labelMode: 'note'` | US2-1…US2-4, SC-004 grayscale screenshot |
| `labels-spelled` | Markers with explicit spellings E♯, B𝄫, F𝄪, C♭ + default-spelled ones, `labelMode: 'note'` | US2-5, accidental font |
| `highlight-far` | Three highlighted markers at frets 15–17 | US4-4 (span fits → minimal scroll) |
| `highlight-split` | Highlighted at frets 2 and 20 | US4-4 (span does not fit → align lowest) |
| `empty` | `{ markers: [], labelMode: 'note' }` | "No positions marked." |

## Example (Playwright)

```ts
await page.addInitScript(() => { globalThis.__fmFretboardFixture = 'highlight-far'; });
await page.goto('/notes');
const scroller = page.locator('.fretboard .scroller');
await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
```
