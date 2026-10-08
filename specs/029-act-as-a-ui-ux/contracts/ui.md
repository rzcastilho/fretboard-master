# UI Contract: Control Families, Zones and Geometry (029)

This contract lists what markup, styles and tests depend on. Token values are in
`../data-model.md`.

## 1. Control family classes (`src/lib/styles/controls.css`)

| Class | Applies to | Contract |
|---|---|---|
| `.btn` | Every action `<button>` | Bordered, `--radius-md`, medium weight, ≥ 44×44, `--color-surface` background, hover `--color-surface-raised` (on a raised parent: `--color-surface-hover`) |
| `.option` | Every exclusive or toggle choice: `role="radio"` + `aria-checked`, or `aria-pressed` | Same box as `.btn` with tighter padding. Selected: `--color-accent` fill, `--color-accent-text`, bold |
| `.switch` / `.switch-track` / `.switch-thumb` | Every on/off row (`role="switch"` or checkbox label) | No border on the row. Pill track `--switch-track-inline × --switch-track-block`. On: accent track, thumb at the inline end, bold state label |
| `.stepper` / `.stepper-value` | The fret-count stepper | The − and + buttons use `.btn`, so the stepper is not a separate button style (Constitution X: the stepper has a single use). `.stepper-value` is a raised readout with tabular numerals and bold weight |
| `.link-button` | Quiet text actions: app-bar Instrument, Language and Share buttons; notice actions and dismiss; Triads guidance actions | No border, transparent, ≥ 44 px block size, accent text, hover underline, `[aria-current]` bold |

Rules:
- A component adds the class in markup. It MUST NOT redeclare `min-*-size`, `padding*`,
  `border*`, `font-size`, `font-weight`, `background*` or `color` for that element in its own
  `<style>`. This is enforced by `style-lint.md` rule 5.
- Selected state = ARIA attribute + accent fill + bold. No family relies on colour alone.
- Disabled = `--color-disabled-text` / `--color-disabled-border`, `cursor: not-allowed`, never
  `--color-error`-like red. `aria-disabled` controls stay focusable as today.
- Transitions: `background-color, color, border-color` over `--duration-fast`,
  `--ease-standard`. No transform, opacity or movement in chrome.
- Focus: the global `:focus-visible` two-tone ring, unchanged.
- `.sr-only` (global) replaces every per-component visually-hidden rule. Landscape heading and
  label clipping in `global.css` keep their own rules (they toggle by arrangement).

## 2. Family instance map (used by the computed-style e2e test)

The selector is the first match inside the named scope, in default state unless noted. The
selected state is reached by the listed action. A "—" cell means the family has no instance
there and the test skips that cell.

| Family | Notes (`/notes`) | Triads (`/triads`) | CAGED (`/caged`) | Shell panel |
|---|---|---|---|---|
| `.option` | Note selector button (`section.b`). Selected: click it | Root option (`section.b`, ChoiceGroup). Selected: the one with `aria-checked="true"` | Root option (`section.b`). Selected: the one with `aria-checked="true"` | Notation toggle (language panel). Selected: `aria-checked="true"` |
| `.btn` | NotesActions button (`section.e`) | TriadsSecondary action | CAGED `.actions .btn` | Instrument panel apply/close button |
| `.switch` | — | — | Connections switch | Sound control on/off (where `role="switch"`) |
| `.stepper` (`.btn` inside) | — | — | — | Fret-count stepper in the instrument panel. Its `.btn` metrics must equal the tools' `.btn` |
| `.link-button` | App-bar Instrument button | App-bar Instrument button | App-bar Instrument button | Notice dismiss (forced with an invalid share link) |

Properties compared: `min-block-size`, `padding-*` (four sides), `border-radius` (four
corners), `border-*-width`, `font-size`, `font-weight`. Default and selected values are
compared within the same family. Checks done in each family:
- default `font-weight` ≠ selected `font-weight`;
- default background ≠ selected background.

## 3. Zones (geometry contract)

| Zone | Element | Treatment |
|---|---|---|
| A | `header` (ToolLayout) | No box. Nav current item keeps `aria-current="page"` + bold + `--indicator-width` bar |
| B | `section.b` | No background, no border. Heading styled as a small muted label |
| C | `section.c` | **Geometry frozen** (padding, border width, gutters). Border colour stays `--color-border`: on phones the board overflows the frame, so its edge is inside the frozen `all-markers-grayscale` capture |
| D | `section.d` / `div.d` | `--color-surface-raised`, `--radius-lg`, no border (contrast-more: `--color-border-subtle` → text colour, full border returns) |
| E | `section.e` | No background, no border |

The DOM order, grid areas and arrangement tokens (`--tool-grid-*`, `[data-arrangement]`) are
unchanged.

Measured guarantees (e2e `ui-refinement.spec.ts`, at 320×568, 768×1024 and 1440×900, default
state, for `/notes`, `/triads` and `/caged`):
- **G-1 (SC-001)**: area(C) > area(X) for each X ∈ {A, B, D, E} that has a box (B is
  skipped at 320×568), and, at 768×1024 and 1440×900, `C.top < viewport.height`.
- **G-2 (SC-005)**: with no scroll and no panel opened, every focusable descendant of
  `section.b` has its box within `[0, 0, vw, vh]` at 768×1024 and 1440×900, and within
  `[0, vw]` horizontally at 320×568 (rows wrap; the controls are reached by vertical page
  scroll, never by a menu or a sideways strip).
- **G-3 (FR-008)**: `document.documentElement.scrollWidth <= innerWidth`.

## 4. Home screen cards

- Each `ToolCard` stays one `<a>`, which is one tab stop.
- Cards are drawn with `--color-surface-raised`, an `--color-border-subtle` edge and
  `--radius-lg`.
- Cards in the same row have equal block size: the grid uses `align-items: stretch` and the
  card has `block-size: 100%`. The gap between them is one spacing token.
- Hover: `--color-surface-hover`. Focus: the global ring.
- The `.continue` affordance drops its border and becomes accent text with bold weight.

## 5. Overlays

The bottom sheet (InstrumentPanel, narrow) and the side panel (SidePanels, landscape; sound
panel) are the only elements with `box-shadow: var(--shadow-overlay)`. The backdrop keeps
`--color-backdrop`.

## 6. Unchanged interfaces

The following do not change:
- message keys, and no new text;
- preference keys and the format version;
- share-link fields and the format version;
- routes;
- ARIA roles and names;
- keyboard shortcuts;
- print output;
- fretboard SVG markup and its tokens.
