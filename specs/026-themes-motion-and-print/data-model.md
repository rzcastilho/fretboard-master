# Data Model: Themes, Motion, and Print

Phase 1 output for [plan.md](./plan.md). Decisions are referenced as R-nn from
[research.md](./research.md). Nothing here is a share-link field. The only persisted addition
is §1.

## 1. Theme choice (persisted preference)

| Field | Type | Values | Default | Stored as |
|---|---|---|---|---|
| `Preferences.theme` | `Theme \| null` | `'light'`, `'dark'`, `null` (Follow device) | `null` | `theme` key of the v1 record, **only when non-null**, serialized last (after `cagedNote`) |

- `export const THEMES = ['light', 'dark'] as const; export type Theme = (typeof THEMES)[number];`
  lives in `src/lib/prefs/schema.ts`.
- Validation: `v.fallback(v.nullable(v.picklist(THEMES)), null)`. Any other value (number,
  `'system'`, `'DARK'`, object) reads as `null`, and the other fields keep their own parse.
- A record without `theme` (every record written before this slice) reads as `null`.
- `PREFS_VERSION` stays `1` (additive optional field).
- Serialization: `serializePreferences({ ...DEFAULT_PREFERENCES })` is byte-identical to
  today, which an existing snapshot test asserts.
- `PreferencesPatch` gains `theme?: Theme | null`.
- Erase: `eraseAll` already removes the whole record, and `theme.restore(null)` resets the
  live state.
- Never read by `src/lib/link/*` and never part of `TriadsView`, `CagedView` or `NotesView`.

## 2. Theme store (runtime, `src/lib/state/theme.svelte.ts`)

| Member | Type | Notes |
|---|---|---|
| `choice` | `ThemeChoice = 'device' \| Theme` (`$state`) | What the selector shows checked |
| `start(stored: Theme \| null)` | `void` | Called by `preferences.start()`. Sets `choice` and makes sure `data-theme` matches, since the boot script normally set it already |
| `choose(c: ThemeChoice)` | `void` | Sets or removes `document.documentElement.dataset.theme` synchronously, then `preferences.remember({ theme })` (fire-and-forget) |
| `restore(null)` | `void` | Erase path: `choice = 'device'` and the attribute is removed |

- **State transitions**: `device ⇄ light ⇄ dark`, and any of them goes to `device` on Erase.
  There are no other inputs. Share links and other tabs never change it.
- **Effective theme** (derived by CSS, never stored or computed in JS): it is `choice` when
  pinned. Otherwise it is the device `prefers-color-scheme`, and `light` when the device gives
  no setting (the initial value of `color-scheme: light dark` resolves to light).

## 3. Boot attribute (DOM contract shared by script, store and CSS)

| Attribute | Element | Values | Writer |
|---|---|---|---|
| `data-theme` | `<html>` | absent, `light` or `dark` | `static/theme-boot.js` (before first paint), `theme.choose` / `theme.restore` |
| `data-motion` | fretboard `<svg>` | `MotionKind` | `Fretboard.svelte` from `model.motion ?? 'none'` |
| `data-print` | any element | `omit` or `show` | Components (static markup) |

## 4. Device-driven variants (derived, never stored)

| Variant | Source | Effect |
|---|---|---|
| Contrast variant | `@media (prefers-contrast: more)` | Surface tokens and a second `--fb-color-*` set (R-06) |
| Forced colours | `@media (forced-colors: active)` | System colours for board, lines, outlines and strokes. Wins over the above |
| Motion mode | `@media (prefers-reduced-motion: reduce)` | Four duration tokens = `0s`. `tokenDuration()` returns 0 |
| Print | `@media print` + `print.active` | Print palette (§6), print layout (§8), omit/show |

All are live: CSS media queries re-evaluate without reload, and `tokenDuration` reads
`matchMedia` at each transition.

## 5. Fretboard palette (tokens, `src/lib/styles/tokens.css`)

The block is titled "Fretboard palette — identical in light and dark". Each value is a literal
hex (or hex with alpha for `region-band`); `--fb-edge-width` is a unitless number. There are three sets: **standard** (`:root`),
**contrast-more** (`@media (prefers-contrast: more) :root`) and **print** (`@media print :root`).

| Token | Role | Constraint (standard / contrast-more / print) |
|---|---|---|
| `--fb-color-wood` | Board | Warm and dark / warm and darker / white or very light warm |
| `--fb-color-edge` | Board outline | `max(contrast(wood, surface), contrast(edge, surface)) ≥ 3` for both surfaces. Print: dark edge line |
| `--fb-edge-width` | Board outline width (viewBox units, unitless) | `1` / ≥ standard / ≥ standard. Set in all three sets |
| `--fb-color-line` | Strings and frets | ≥ 3 / ≥ 4.5 / ≥ 3 vs wood, and **<** min(normal marker vs wood) |
| `--fb-color-nut` | Nut | Same as line |
| `--fb-color-inlay` | Inlays | Decorative and quiet, < line contrast |
| `--fb-color-number`, `--fb-color-number-strong` | Fret and string numbers | Text: ≥ 4.5 / ≥ 7 / ≥ 4.5 vs the background they sit on |
| `--fb-color-root`, `-third`, `-fifth` | Role fills (**reserved**) | ≥ 3 / ≥ 4.5 / ≥ 3 vs wood. Pairwise ΔE2000 ≥ 10 under protan, deutan and tritan |
| `--fb-color-label` | Label on role fills | ≥ 4.5 / ≥ 7 / ≥ 4.5 vs each role fill |
| `--fb-color-neutral`, `--fb-color-neutral-stroke` | Neutral note | Stroke ≥ 3 / ≥ 4.5 / ≥ 3 vs wood |
| `--fb-color-degree-stroke` | Degree outline | Same as neutral stroke |
| `--fb-color-label-on-neutral` | Label on a neutral or degree marker | Text vs neutral fill |
| `--fb-color-outline` | Comparison dashes, arrows, triad-layer outline, extra dot, connection ring | ≥ 3 / ≥ 4.5 / ≥ 3 vs wood |
| `--fb-color-arrow-halo` | Arrow-label paint-order halo | Arrow label text ≥ 4.5 / ≥ 7 vs halo |
| `--fb-color-note-highlight`, `-note-highlight-label` | Notes highlight | Marker ≥ 3 vs wood, label ≥ 4.5 vs fill |
| `--fb-octave-tone-1…7` | Notes octave ramp | Each ≥ 3 vs wood, `note-highlight-label` ≥ 4.5 on each |
| `--fb-region-band` | Notes region band | Translucent. Lines and markers stay above thresholds over it |
| `--fb-color-elevation` | Highlight drop-shadow | Decorative |
| `--emph-dim-opacity` | Dimmed opacity (per set) | Composite(role, wood, α) ≥ 3 / ≥ 4.5 / ≥ 3 vs wood, and α < 1 |

Removed names: `--color-fretboard-wood`, `--color-fretboard-line`, `--color-nut`,
`--color-inlay`, `--color-root`, `--color-third`, `--color-fifth`, `--color-neutral-note`,
`--color-neutral-note-stroke`, `--color-degree-stroke`, `--color-marker-label`,
`--color-note-highlight`, `--color-note-highlight-label`, `--octave-tone-*`, `--region-band`,
`--connection-ring`. The connection ring width and gap tokens stay.

**Surface tokens** (`--color-surface`, `-surface-raised`, `-text`, `-text-muted`, `-accent`,
`-accent-text`, `-border`, `-disabled-*`, `-focus-ring*`, `-notice-*`, `-hint-*`): each is
written once as `light-dark(light, dark)`. The values are today's light and dark values, so
there is no visual change off the board.

## 6. Print palette and print tokens

| Token | Value (start) | Purpose |
|---|---|---|
| `--print-board-inline` | `190mm` | Nominal print layout width (R-11) |
| `--print-board-max-block` | `55vh` | Keeps the board, heading, description and legend on one page |
| `--print-text-min` | `7pt` | Floor for labels and numbering in viewBox units |
| `--fb-color-*` (print set) | See R-10 | Light board, dark lines and edge, darker roles, white labels |

## 7. Motion

```ts
type MotionKind = 'slide' | 'by-role' | 'cross-fade' | 'focus' | 'reveal' | 'none';
// DisplayModel gains:   readonly motion?: MotionKind;   (absent ≡ 'none')
```

**Classifier tables** (`motionKind(prev, next)` per tool view; `prev === null` gives `'none'`).
Any instrument, label, notation, language or fit difference wins and gives `'none'`.

| Tool | Changed field(s) | Kind |
|---|---|---|
| Triads | root | `slide` |
| Triads | quality only | `by-role` |
| Triads | comparison on or off | `by-role` (comparison enter or exit) |
| Triads | inversion or string set (stacking) | `cross-fade` |
| Triads | anything else (tool open, link open, mode) | `none` |
| CAGED | key (root) | `slide` |
| CAGED | focus set, changed or cleared | `focus` |
| CAGED | layer on or off | `reveal` |
| CAGED | anything else | `none` |
| Notes | selected note | `slide` |
| Notes | anything else | `none` |

When several fields change at once, the earliest row in the table wins. Example: a link opening
changes root and quality, so it is classified as tool or link open and gives `none`.

**Reconciliation** (`reconcileMarkers`, pure, `src/lib/fretboard/transition.ts`):

| Input | Type |
|---|---|
| `prev` | `readonly KeyedMarker[]` (last drawn list) |
| `next` | `readonly DrawnMarker[]` (after `applyPulses`) |
| `kind` | `MotionKind` |
| `generation` | `number` (incremented per model update; used for fresh keys) |

Output: `readonly KeyedMarker[]`, where
`KeyedMarker = { key: string; mk: DrawnMarker; enter: 'instant' | 'fade' | 'reveal'; exit:
'instant' | 'fade'; from?: { string: number; fret: number } }`.

Rules:

- `slide`: group by string. Sort `prev` and `next` by fret and pair by index. A pair shares
  `key`. Unpaired markers get `enter`/`exit` `'fade'`. Keys never cross strings.
- `by-role`: key is `mk.id` (fall back to the position key). A different string under the same
  `id` gives a fresh key with `'fade'`. Comparison markers get `from` = the base marker's
  position, which they start at before sliding.
- `cross-fade`: all next keys are fresh (`${generation}:…`), and every enter and exit is
  `'fade'`.
- `reveal`: keys stay stable. Markers new in this update get `enter: 'reveal'` (uses `appear`),
  and removed ones get `exit: 'fade'`.
- `focus` and `none`: keys stay stable (`id ?? position`), with enter and exit `'instant'`.
- Pulsed markers keep `pulse.id` as their key in every kind (playback unchanged).

Invariants (property-tested): the output contains exactly `next`, in order. Keys are unique.
In `slide` mode, every shared key joins two markers on the same string. Under `none`, no
marker has a `'fade'` mode.

**Reveal order** (existing `appear` in `caged-model.ts`): `appear = index / count`, with the
index from ascending pitch and ties ordered from the lowest-pitched string. A unit test pins
this order.

**Durations**: slide, by-role, cross-fade, reveal and layer-off use `--duration-short`; focus
dim and scroll use `--duration-medium`; pulse uses the note duration. Reduced motion makes all
of them 0.

## 8. Print state and print view

| Member | Type | Notes |
|---|---|---|
| `print.active` | `boolean` (`$state`) | True between `beforeprint` and `afterprint`, or while `matchMedia('print').matches` |
| `print.start()` | `void` | Registers the listeners once (layout mount). No-op without `window` |

The print view is derived from the same display model. While `print.active` is true:

- `Fretboard.svelte` lays out with `fit = 'whole'` and `containerWidth = px(--print-board-inline)`.
- There is no minimap and no scroll.
- The description and legend are rendered visibly (`data-print="show"`).

## 9. Catalog keys (messages/en.json, pt-BR.json, es.json)

| Key | en | pt-BR | es |
|---|---|---|---|
| `theme_label` | Theme | Tema | Tema |
| `theme_device` | Follow device | Seguir o dispositivo | Seguir el dispositivo |
| `theme_light` | Light | Claro | Claro |
| `theme_dark` | Dark | Escuro | Oscuro |
| `language_button` (value change) | Language and appearance | Idioma e aparência | Idioma y apariencia |
| `language_panel_label` (value change) | Language and appearance | Idioma e aparência | Idioma y apariencia |

The actual key names of the button and region strings are taken from `LanguageButton.svelte`
and `LanguagePanel.svelte`; only their values change.
