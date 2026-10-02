# Contract: `Fretboard.svelte` — props, events, DOM/ARIA, CSS

**Feature**: `002-interactive-fretboard` | Requirements: FR-001–FR-023 | Types: [data-model.md](../data-model.md)

This is the one interface every tool (004 Notes, 005 Triads, later CAGED) uses to draw and receive
input. Tools pass musical data in and receive musical events out; they never see coordinates,
handedness, or orientation.

## 1. Import and props

```ts
import Fretboard from '$lib/fretboard/Fretboard.svelte';

interface FretboardProps {
  instrument: Instrument;                 // required; STANDARD_GUITAR in this slice
  model?: DisplayModel;                   // default { markers: [], labelMode: 'none' }
  variant?: 'interactive' | 'thumbnail';  // default 'interactive'
  onactivate?: (position: Position) => void;  // ignored in thumbnail variant
}
```

- Props are read reactively (`$props()`); changing `model` re-renders markers within one frame
  (budget: control change → fretboard update ≤ 100 ms).
- The component never mutates `model` or `instrument`.
- Invalid or duplicate markers are ignored (first per position wins); the component never throws
  on model content.

## 2. Events (output)

| Trigger | Payload | Notes |
|---|---|---|
| Tap/click release within 10 px of `pointerdown` (primary button, single pointer) | `{ string, fret }` of the nearest position center | Every release, including repeats and hidden/unmarked positions. Focus moves to the cell first. |
| Enter or Space on a focused cell | `{ string, fret }` of that cell | Same callback as a tap. |
| Arrow keys | none | Move focus only. |
| Drag ≥ 10 px, multi-touch, non-primary button, `pointercancel` | none | Counted as scroll / cancelled. |

No other events, no DOM events re-dispatched, no screen coordinates in any payload.

## 3. DOM and ARIA structure (interactive variant)

```html
<div class="fretboard" data-variant="interactive">
  <div class="scroller">                         <!-- overflow-x:auto; overscroll-behavior-x:contain -->
    <svg role="grid" aria-label="Fretboard" width=… height=… viewBox=…>
      <g aria-hidden="true" class="drawing"> wood, inlays, frets, nut, strings, string labels, fret numbers </g>
      <g aria-hidden="true" class="markers"> one <g class="marker {function} {emphasis}"> per drawn marker </g>
      <g role="row" data-string="1">
        <rect role="gridcell" data-string="1" data-fret="0" tabindex="0|-1"
              aria-label="E, string 1, open" … />
        … 23 cells per row …
      </g>
      … 6 rows …
      <rect class="focus-ring" aria-hidden="true" />   <!-- only while focus is inside -->
      <g class="hover-hint" aria-hidden="true" />      <!-- mouse hover only -->
    </svg>
  </div>
  <div class="sr-only" aria-live="polite" aria-atomic="true"><!-- description after first change --></div>
  <button type="button" aria-expanded="false" aria-controls="{id}-description">Show text description</button>
  <p id="{id}-description" hidden>{description}</p>
</div>
```

Stable selectors for tests (Playwright/Testing Library):

| Need | Selector |
|---|---|
| The board | `getByRole('grid', { name: 'Fretboard' })` |
| A position | `getByRole('gridcell', { name: 'C, string 2, fret 1' })` or `[data-string="2"][data-fret="1"]` |
| Tab stop | `[role="gridcell"][tabindex="0"]` (exactly one) |
| Focus ring | `.focus-ring` (present iff focus inside) |
| Marker for a position | `.marker[data-key="2:1"]` with classes `root|third|fifth|degree|neutral` and `highlighted|normal|dimmed` |
| Description toggle | `getByRole('button', { name: 'Show text description' })` |
| Live region | `[aria-live="polite"]` within `.fretboard` |

Accessible names (catalog, see §6):

- Cell: `"<spoken note>, string <N>, fret <F>"`; fret 0 → `"<spoken note>, string <N>, open"`;
  plus `", <function>"` when a non-hidden marker is present (e.g. `"F sharp, string 1, fret 2, third"`).
- Note in names is spoken (`"F sharp"`, `"B double flat"`), never glyphs.

## 4. Thumbnail variant

```html
<svg class="fretboard-thumbnail" aria-hidden="true" focusable="false" …> drawing only, frets 0–12 </svg>
```

- No grid, rows, cells, text, markers, live region, toggle, or listeners; `pointer-events: none`.
- Used inside `ToolCard`'s `<a>`; the link's `aria-label` is unchanged, and the card keeps a single
  tab stop.

## 5. Behavior guarantees

| Area | Guarantee | Spec |
|---|---|---|
| Layout | 6 rows (string 1 top), open column before a thick light nut, 22 frets narrowing 52 → 44 px at 100 % text, inlays 3/5/7/9/15/17/19/21 + double 12, fret numbers 1–22 below (inlay frets bold), string number + open note left of the nut | FR-001–FR-005, FR-018 |
| Fill | Container wider than natural width → columns scale up, no scrolling | FR-013 |
| Scroll | Native horizontal scroll (touch, pen, wheel); mouse drag-to-scroll; vertical pan passes to page; pinch untouched | FR-013 |
| Auto-scroll | Once per change of the highlighted set; minimal or align-start; ≤ 300 ms; instant under reduced motion | FR-014 |
| Keyboard | Roving tab stop; arrows move (no wrap); Enter/Space activate; off-screen focus scrolled into view | FR-015 |
| Hover | Mouse-only note hint (`.hover-hint`), any position | FR-016 |
| Targets | Each cell ≥ 44 × 44 CSS px at 100 % text | FR-017 |
| Description | Polite live region (not on first render) + collapsible visible text | FR-020 |

## 6. Message catalog additions (`messages/en.json`)

| Key | English |
|---|---|
| `fretboard_label` | `Fretboard` |
| `fretboard_position_name` | `{note}, string {string}, fret {fret}` |
| `fretboard_position_name_open` | `{note}, string {string}, open` |
| `fretboard_position_function` | `{name}, {function}` |
| `fretboard_function_root` | `root` |
| `fretboard_function_third` | `third` |
| `fretboard_function_fifth` | `fifth` |
| `fretboard_function_degree` | `scale degree` |
| `fretboard_function_neutral` | `note` |
| `fretboard_description_entry` | `string {string}, fret {fret}, {note}, {function}` |
| `fretboard_description_entry_open` | `string {string}, open, {note}, {function}` |
| `fretboard_description_empty` | `No positions marked.` |
| `fretboard_description_show` | `Show text description` |
| `fretboard_description_hide` | `Hide text description` |
| `note_spoken_natural` | `{letter}` |
| `note_spoken_sharp` | `{letter} sharp` |
| `note_spoken_flat` | `{letter} flat` |
| `note_spoken_double_sharp` | `{letter} double sharp` |
| `note_spoken_double_flat` | `{letter} double flat` |

Removed: `placeholder_fretboard` (zone C now shows the board). The raw-text scan
(`tests/unit/no-raw-text.test.ts`) must keep passing: SVG `<text>` content comes only from
expressions (numbers, `noteLabel(...)`).

## 7. Design tokens added (`src/lib/styles/tokens.css`)

Geometry (rem): `--fb-row`, `--fb-label-col`, `--fb-open-col`, `--fb-fret-first`, `--fb-fret-last`,
`--fb-numbers-row`, `--fb-nut-width`, `--fb-string-width-1` … `--fb-string-width-6`,
`--fb-thumb-row`, `--fb-thumb-open-col`, `--fb-thumb-fret`, `--zone-fretboard-padding-inline`.
Markers: `--marker-root`, `--marker-medium`, `--marker-small`, `--marker-radius`,
`--marker-stroke`, `--marker-neutral-stroke-width`, `--marker-elevation-stroke`, `--marker-label-size`, `--marker-label-min-size`.
Emphasis: `--emph-highlight-scale`, `--emph-dim-scale`, `--emph-dim-opacity`.
Color (light, dark, and `prefers-contrast: more` variants): `--color-fretboard-wood`,
`--color-fretboard-line`, `--color-nut`, `--color-inlay`, `--color-root`, `--color-third`,
`--color-fifth`, `--color-neutral-note`, `--color-neutral-note-stroke`, `--color-degree-stroke`, `--color-marker-label`,
`--color-hint-surface`, `--color-hint-text`.
Motion: `--duration-short` (300 ms; 0 s under reduced motion).
Type: `--font-family-notes` (`'FM Accidentals', var(--font-family-ui)`), numerals via
`font-variant-numeric: tabular-nums`.

`--color-root`, `--color-third`, `--color-fifth` are referenced only by marker classes in
`Fretboard.svelte` (enforced by a unit test scanning `src/**/*.{svelte,css}` for other uses).
