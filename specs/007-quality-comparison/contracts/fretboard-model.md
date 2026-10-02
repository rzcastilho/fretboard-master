# Contract delta: Fretboard display model

**Feature**: `007-quality-comparison` | Base: [006 fretboard-model](../../006-full-neck-and-all-notes/contracts/fretboard-model.md) | Data: [data-model §5](../data-model.md) | ADR: `docs/adr/0010-fretboard-arrows-and-marker-identity.md` (new)

Component: `src/lib/fretboard/Fretboard.svelte` (the single shared renderer). Types:
`src/lib/fretboard/types.ts`. All additions are optional, so the Notes tool and existing
fixtures render exactly as before.

## 1. `Marker.id` — motion identity (R-07)

| # | Rule |
|---|---|
| F1 | The keyed marker loop uses `mk.pulse?.id ?? mk.id ?? positionKey`. Markers without an `id` behave as today |
| F2 | A marker's screen position is set through CSS `transform: translate(…)` with `transition: transform var(--duration-short) var(--ease-standard)`. If the same `id` moves from fret a to fret b, the same DOM node slides there |
| F3 | A marker whose `id`, position and function are unchanged keeps its DOM node, and its transform does not change (Vitest checks node identity) |
| F4 | Under `prefers-reduced-motion` the token is `0s`, so the change is instant (tokens.css already does this) |
| F5 | Comparison markers (`variant`) and arrows fade in and out with Svelte `fade`. The duration comes from `tokenDuration('--duration-short')` (0 when reduced motion is on). Arrows for a *moved* comparison fade in after a delay equal to that duration (C15) |

## 2. `Marker.variant = 'comparison'` (R-09)

| # | Rule |
|---|---|
| F6 | Same glyph shape and function fill as a plain marker. The glyph stroke uses `stroke-dasharray: var(--marker-dash) var(--marker-dash-gap)` and `stroke: var(--color-text)` |
| F7 | `prefers-contrast: more` → `--marker-stroke` (3px) and `CanvasText` stroke, as other markers already do |
| F8 | Cell accessible names (`positionName`) for a comparison marker add the catalog suffix `fretboard_comparison_note` ("comparison"), so the grid cell says what the outline says |

## 3. `DisplayModel.arrows` (R-08)

| # | Rule |
|---|---|
| F9 | `kind: 'move'`: a line from the centre of the `(string, fromFret)` cell toward the `(string, toFret)` cell, shortened by the marker radius at both ends, with an arrowhead at the `toFret` end and a `label` text centred above it. If `|toFret − fromFret| = 1` (adjacent cells), the arrow is drawn above the markers, inside the string's row band |
| F10 | `kind: 'off-board'`: a line from the `fromFret` marker to the board edge of that string, past the nut for `edge: 'nut'` and past the last fret column for `edge: 'end'`, with an arrowhead at the edge and the `label` (note name) beside it |
| F11 | All x positions come from `layout.columns`, so orientation and handedness come from `geometry.screenOrder` alone. Mirroring the layout mirrors every arrowhead (FR-2.6) |
| F12 | Arrows sit in an `aria-hidden` `<g class="arrows">` above markers and below the focus ring. They are never announced; the model description covers them |
| F13 | Colours and sizes come only from tokens: `--color-text` and `--marker-stroke` for strokes, and the existing marker-label type tokens for labels. The root, third and fifth colours are never used (checked by `reserved-colors.test.ts`) |
| F14 | Arrows that reference an invalid string, or a `move` with an invalid fret, are dropped without throwing |
| F15 | The thumbnail variant ignores `arrows` |

## 4. New tokens (`src/lib/styles/tokens.css`)

| Token | Purpose |
|---|---|
| `--marker-dash` | Dash length of the comparison outline |
| `--marker-dash-gap` | Gap length of the comparison outline |
| `--arrow-head-size` | Arrowhead length |
| `--panel-column-min` | Minimum column width before the composition columns stack (R-13) |

Exact values are design-system tokens that belong in `tasks`. No component may contain
literals for them.
