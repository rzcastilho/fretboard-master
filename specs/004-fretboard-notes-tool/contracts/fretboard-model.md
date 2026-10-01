# Contract: Fretboard display-model extensions

**Feature**: `004-fretboard-notes-tool` | Extends: 002 `Fretboard` props, 003 `pulses` prop | Research: R-03, R-04

The shared renderer `src/lib/fretboard/Fretboard.svelte` stays the only code that draws the
fretboard (ADR 0005). This feature adds optional fields only; omitting them gives exactly the
002/003 behavior. Types live in `src/lib/fretboard/types.ts` (see data-model §7).

## 1. Labels

| `labelMode` | Text of a labeled marker |
|---|---|
| `'note'` | `noteLabel(spelling)` — e.g. `G`, `C♯` (unchanged) |
| `'octave'` (new) | `pitchLabel(spelling, octaveOf(positionPitch))` from `src/lib/notation` — e.g. `A3`, `C♯5` |
| `'none'` | no label |

A marker is labeled when `labelMode !== 'none'` and:

- `marker.label === true`, or
- `marker.label === undefined` and `emphasis ∈ {highlighted, normal}` (unchanged default).

`marker.label === false` never labels. Hidden markers are never drawn.

`marker.octaveBadge === true` with `labelMode === 'note'` draws a second `<text
class="octave-badge">` (the octave number) offset to the upper right of the marker at
`--marker-badge-size`. It is ignored in other label modes.

## 2. Tones and highlight color

- Neutral `highlighted` markers fill with `var(--color-note-highlight)`.
- `marker.tone = N` adds class `tone-N`; its fill is `var(--octave-tone-N)`, which overrides the
  highlight fill. Tones apply only to `highlighted` markers; the renderer ignores `tone` on other
  emphasis levels.
- Tokens `--color-note-highlight`, `--octave-tone-1…7`, `--color-note-highlight-label`,
  `--region-band` are defined in `tokens.css` for light, dark, and `prefers-contrast: more`. None
  may equal or reference `--color-root|third|fifth` (`reserved-colors.test.ts` gains this check).
- Pulses (003) still override emphasis to `highlighted` for drawing; a pulsing marker keeps its
  tone class.

## 3. Region band

`model.region = { start, end }` draws one `<rect class="region-band">` in the `drawing` layer,
from `layout.columns[start].start` to `layout.columns[end].end`, full board height, below
strings and markers, `fill: var(--region-band)`, `aria-hidden`. Absent → no band. Invalid
values are clamped to `0..fretCount`.

When `region` changes (compared by `start:end`, not on first render), the renderer scrolls with
`autoScrollTarget(layout, [{string:1,fret:start},{string:1,fret:end}], viewport)` and the
existing `animateScroll` (reduced motion → instant). User scroll or pointer cancels it, as today.

## 4. Hover hint

`model.hoverHint === false` → the hover hint is never rendered. Default (`undefined`/`true`)
unchanged.

## 5. Text description

`model.description` (string) → the live description and the "Show description" text use it
verbatim; `summary` and the computed entry list are ignored. Absent → `describeView` unchanged.
The polite live-region rule (announce only on change, never on first render) is unchanged.

## 6. Component export

```ts
/** Focus the cell for p (roving tabindex moves with it) and scroll it into view. No-op if invalid. */
export function focusPosition(p: Position): void;
```

Hosts call it via `bind:this`. Used by the position card to return focus on Close/Escape.

## 7. Invariants (unit-tested)

- Every existing fretboard test passes unmodified.
- Events stay in musical terms (`onactivate(position)`); no coordinates leak.
- Handedness/orientation apply to the band and badges exactly as to markers.
- The cell accessible name (`positionName`) is unchanged by these fields.
