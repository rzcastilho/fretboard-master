# Data Model: Modern Minimalist UI Refinement (029)

This feature has no runtime data, storage, preference keys or share-link fields. The
"entities" are the design tokens and control families the stylesheet exposes. Their names and
values are the model that components and tests depend on.

## Entity 1 — Design token (`src/lib/styles/tokens.css`)

| Field | Rule |
|---|---|
| name | `--<group>-<role>[-<step>]`, declared once in `:root` |
| value | colour: `light-dark(light, dark)`; length: `rem` (or `px` only for hairlines and strokes) |
| overrides | colour tokens that carry contrast are redeclared in `@media (prefers-contrast: more)` |
| frozen | `--fb-*`, `--marker-*`, `--emph-*`, `--minimap-*`, `--connection-*`, `--pulse-*`, `--print-*`: existing values MUST NOT change |

### Tokens added by this feature

| Token | Value | Contrast-more override | Used by |
|---|---|---|---|
| `--radius-sm` | `0.25rem` (= current 4px fallback) | — | Minimap frame, `.link-button` focus |
| `--radius-lg` | `0.75rem` | — | Tool cards, zone D, overlay panels |
| `--radius-pill` | `999px` | — | `.switch` track |
| `--font-weight-medium` | `600` | — | Default weight of `.btn`, `.option`, labels |
| `--color-border-subtle` | `light-dark(#e3e6ea, #262c34)` | `var(--color-text)` | Card edges, panel edges (zone C keeps `--color-border`, see contracts/ui.md §3) |
| `--color-surface-hover` | `light-dark(#e7eaee, #232931)` | `light-dark(#e1e4e8, #1a1f26)` | Hover on already-raised surfaces |
| `--color-shadow` | `light-dark(rgb(0 0 0 / 0.14), rgb(0 0 0 / 0.5))` | `transparent` | `--shadow-overlay` only |
| `--shadow-overlay` | `0 var(--space-2) var(--space-6) var(--color-shadow)` | — | Bottom sheet, side panel |
| `--switch-track-inline` | `2.25rem` | — | `.switch` |
| `--switch-track-block` | `1.25rem` | — | `.switch` |
| `--switch-thumb-inset` | `2px` | — | `.switch` |
| `--item-min-inline` | `12rem` | — | `flex-basis` in ContextZone, LegendPanel, ShareFallback |
| `--unit-px` | `1px` | — | SVG number → length `calc()` (Fretboard, MarkerSample) |
| `--fb-stroke-hairline` | `1px` | — | Fretboard hairline stroke (same as today) |
| `--fb-label-halo-width` | `3px` | — | Fretboard label halo (same as today) |
| `--fb-glyph-halo-width` | `2px` | — | Fretboard glyph halo (same as today) |

The forced-colours block needs no new entries: system colours override the surfaces, and
`--color-border-subtle` resolves through `--color-text`, which forced colours map to
CanvasText.

### Tokens removed from component use

`--touch-target-min` is replaced by `--target-min`. Literal `var()` fallbacks are dropped
everywhere. No token is deleted from `tokens.css`.

### Validation

- `tests/unit/a11y/palette-contrast.test.ts`: the new text and border colours that carry
  contrast pass. `--color-border-subtle` is decorative only and never the sole boundary of a
  control.
- `tests/unit/a11y/theme-tokens.test.ts`: every new colour token uses `light-dark()`.
- `tests/unit/reserved-colors.test.ts`: no chrome token references root, third or fifth.
- `tests/unit/style-tokens.test.ts` (new): see `contracts/style-lint.md`.

## Entity 2 — Control family (`src/lib/styles/controls.css`)

| Family | Class | Element / role | States (selector) |
|---|---|---|---|
| Action button | `.btn` | `<button>` | hover, `:focus-visible`, `:disabled`/`[aria-disabled='true']` |
| Segmented / exclusive option | `.option` (inside a `.controls-row` or group) | `<button>` with `role="radio"` + `aria-checked`, or `aria-pressed` | selected = `[aria-checked='true']`, `[aria-pressed='true']`, `[aria-selected='true']`; disabled |
| On/off switch row | `.switch` with child `.switch-track` › `.switch-thumb` | `<button role="switch" aria-checked>` or a `<label>` holding a checkbox | on = `[aria-checked='true']` / `:has(:checked)`; disabled |
| Stepper | `.stepper` with `.stepper-button` ×2 and `.stepper-value` | group with two `<button>`s and a live value | button disabled at the range ends |
| Link-button | `.link-button` | `<button>` or `<a>` styled as inline text | hover underline, focus ring, `[aria-current]` |

Shared properties per family (the values every instance computes to):

| Property | `.btn` | `.option` | `.switch` | `.stepper-button` | `.link-button` |
|---|---|---|---|---|---|
| min-block-size | `--target-min` | `--target-min` | `--target-min` | `--target-min` | `--target-min` |
| min-inline-size | `--target-min` | `--target-min` | `--target-min` | `--target-min` | — |
| padding | `--space-2 --space-4` | `--space-1 --space-3` (narrow: `--space-1 --space-2`) | `--space-1 --space-3` | `0 --space-3` | `0 --space-1` |
| border | `--border-width solid --color-border` | `--border-width solid --color-border` | none | `--border-width solid --color-border` | none |
| border-radius | `--radius-md` | `--radius-md` | `--radius-md` | `--radius-md` | `--radius-sm` |
| font-size | `--font-size-md` | `--font-size-md` | `--font-size-md` | `--font-size-md` | inherit |
| font-weight default / selected | medium / — | medium / bold | medium / bold state label | medium / — | normal / bold when `aria-current` |
| background default / selected | `--color-surface` / — | `--color-surface` / `--color-accent` | transparent / track `--color-accent` | `--color-surface` | transparent |

### Relationships

- A control family **uses** tokens only.
- A component **applies** exactly one family class per control and **MUST NOT** redeclare that
  family's properties (lint rule 5).
- The zone layout (`ToolLayout`, the tool `.b/.c/.d/.e` sections) **contains** controls. Zones
  own spacing and placement, and families own appearance.

### State transitions (per interactive control)

```text
rest ──hover (hover-capable pointer)──▶ hovered ──leave──▶ rest
rest ──Tab / focus──▶ focused (two-tone ring; combinable with any state)
rest ──activate──▶ selected/pressed (accent fill + bold + ARIA true) ──activate (toggles)──▶ rest
any  ──range end / impossible choice──▶ disabled (disabled tokens, still announced; never red)
```

Transitions animate only `background-color`, `color` and `border-color`, over
`--duration-fast` (0s under reduced motion).
