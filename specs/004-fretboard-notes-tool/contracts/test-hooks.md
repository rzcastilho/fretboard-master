# Contract: Test-only instrument harness (TM-9 fixtures)

**Feature**: `004-fretboard-notes-tool` | Extends: [003 test-hooks](../../003-note-playback/contracts/test-hooks.md) (ADR 0004) | Research: R-09

## Availability

Same build-flag rule as `__fmFault`: read only when `__FM_FAULT_INJECTION__` is `true`
(`pnpm build:test`, `pnpm dev`), dead-code-eliminated from `pnpm build`.
`scripts/check-no-fault-hook.mjs` adds `__fmInstrument` to its needles; the instrument fixture
names (`'AF-7'`, `'AF-21'`) live only in `src/lib/instrument/fixtures.ts`, imported only inside
an `if (__FM_FAULT_INJECTION__)` branch.

## Interface (declared in `src/app.d.ts`)

```ts
declare global {
  /** Test-only: allow-listed instrument the Notes tool uses instead of the default. */
  var __fmInstrument: 'AF-7' | 'AF-21' | undefined;
}
```

- Read once when the Notes tool mounts; unknown values → default instrument (allow-list lookup,
  `Object.hasOwn`, never throws).
- Applied through `notes.useInstrument(fixture)`, the same path the future instrument panel will
  use, so re-validation (FR-019) is exercised by e2e as well.

| Name | Strings (1 → n) | Frets | Source |
|---|---|---|---|
| `AF-7` | D4 A3 G3 D3 A2 D2 | 22 | TM-2 DADGAD |
| `AF-21` | E4 B3 G3 D3 A2 E2 B1 | 22 | TM-2 7-string standard |

## TM-9 screenshot fixtures (`e2e/notes-tm9.spec.ts`)

Each view is reached through product UI after the harness sets the instrument. Screenshots per
Playwright project (phone, phone-touch, desktop), named `tm9-view-N`.

| View | Instrument | Steps | Must show |
|---|---|---|---|
| 1 | default | select F♯ | every F♯ position (11 on 22 frets) in octave tones with octave numbers |
| 2 | default | region steppers 0–12 | naturals normal inside 0–12, dimmed unlabeled beyond, lit band |
| 3 | default | activate string 3 fret 2 | card A3 with unisons s4f7, s5f12, s6f17 highlighted |
| 4 | `AF-21` | Show: all; region 0–5 | 7 strings, every note labeled in frets 0–5 |
| 5 | `AF-7` | select D | every D in DADGAD with octave tones |

Each test also asserts the semantic facts (counts, card text, description) so a screenshot
never carries the only assertion.

## Example

```ts
await page.addInitScript(() => { globalThis.__fmInstrument = 'AF-21'; });
await page.goto('/notes');
await page.getByRole('radio', { name: 'All notes' }).click();
const end = page.getByRole('spinbutton', { name: 'End fret' });
await end.focus();
await end.press('Home');                       // end → 0 (start pushed to 0)
for (let i = 0; i < 5; i++) await end.press('ArrowUp'); // end → 5
await expect(page.locator('.string-7')).toHaveCount(1);
await expect(page).toHaveScreenshot('tm9-view-4.png');
```
