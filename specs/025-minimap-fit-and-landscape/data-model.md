# Data Model: Minimap, Fit to Screen, and Landscape (025)

Phase 1 output for [plan.md](./plan.md). All entities are client-side, in memory, and
session-scoped. **Nothing is persisted and no share-link or preference field changes**
(Principle IX untouched).

## 1. FitMode and the fit store (`src/lib/state/fit.svelte.ts`)

```ts
type FitMode = 'comfortable' | 'whole';

interface FitState {
  mode: FitMode;              // session choice; initial 'comfortable' (FR-009)
  available: boolean;         // true ⇔ comfortable neck wider than the fretboard zone (FR-008)
  notice: { position: Position } | null;  // small-fret notice (FR-011)
  noticeDismissed: boolean;   // true after Dismiss, until the next mode change
  anchor: Position | null;    // one-shot: centre this position after the next switch (R-07)
}
// derived
effective: FitMode = available ? mode : 'comfortable'
```

| Operation | Precondition | Effect |
|---|---|---|
| `toggle()` | `available` | `mode` flips; `notice = null`; `noticeDismissed = false` |
| `request(mode)` (pinch) | `available && mode !== this.mode` | as `toggle()`; otherwise no-op |
| `setOverflow(v)` | — | `available = v`; `mode` kept (reapplies when the neck stops fitting) |
| `smallTap(p)` | `effective === 'whole'` and `!noticeDismissed` | `notice = { position: p }` |
| `acceptNotice()` | `notice !== null` | `anchor = notice.position`; `mode = 'comfortable'`; `notice = null` |
| `dismissNotice()` | — | `notice = null`; `noticeDismissed = true` |
| `takeAnchor()` | — | returns and clears `anchor` (consumed by the Fretboard) |

Invariants: `notice !== null ⇒ effective === 'whole'` (cleared on every mode or availability
change that makes `effective` comfortable). Reload ⇒ initial state.

`FitEvent` (renderer → store, Principle III: no screen coordinates):

```ts
type FitEvent =
  | { kind: 'overflow'; value: boolean }
  | { kind: 'request'; mode: FitMode }          // pinch in → 'whole', out → 'comfortable'
  | { kind: 'small-tap'; position: Position };
```

## 2. FretboardLayout additions (`src/lib/fretboard/geometry.ts`)

| Field | Type | Meaning |
|---|---|---|
| `naturalWidth` | `number` | Comfortable-size width (label column + open column + Σ fret widths) for the instrument's fret count; independent of `containerWidth` and of fit mode |
| `markerScale` | `number` | `min(1, narrowestColumn / metrics.markerRoot)`; 1 in comfortable mode |

New parameter `fit: FitMode = 'comfortable'` on `layoutFretboard`. In `'whole'` with
`naturalWidth > containerWidth`: `scale = (containerWidth − labelCol) / columnsNatural`,
`scrolls = false`. Validation: `fit` ignored for `thumbnail`/`preview`.

## 3. Visible stretch and minimap geometry (`src/lib/fretboard/minimap.ts`)

```ts
interface ScrollViewport { scrollLeft: number; width: number }   // existing (interaction.ts)
interface FretRange { first: number; last: number; count: number } // 1 ≤ first ≤ last ≤ count
interface MinimapWindow { x: number; width: number }             // minimap px
```

- `visibleFretRange(layout, viewport)`: frets ≥ 1 whose column centre lies in
  `[scrollLeft, scrollLeft + width]`; if none (viewport inside the open column) → the nearest
  fret 1. `count = layout.columns.length − 1`.
- `minimapWindow(layout, viewport, k)`: `{ x: scrollLeft·k, width: width·k }`, clamped to the
  minimap.
- `minimapTapScroll(layout, x, k, viewportWidth)`: `clamp(x/k − viewportWidth/2, 0,
  layout.width − viewportWidth)`. Tapping the far end ⇒ max scroll ⇒ last fret visible
  (mirrored: far end is x = 0 ⇒ scroll 0 ⇒ last fret visible).
- `minimapKeyScroll(layout, key, viewport)`: `ArrowRight` → `+width`, `ArrowLeft` → `−width`
  (visual), `Home` → nut end, `End` → last-fret end; clamped; `null` for other keys.

`k = minimapWidth / layout.width` (minimap spans the fretboard zone width).

Highlighted dots: `{ string, fret }` for model markers with `emphasis === 'highlighted'` that
are valid positions; drawn at `(columns[fret].center·k, minimapRow(string))`.

## 4. Pinch gesture (`src/lib/fretboard/pinch.ts`)

```ts
type PinchState =
  | { kind: 'idle' }
  | { kind: 'tracking'; start: number }   // start finger distance (px)
  | { kind: 'done' };                     // switched once; wait for all touches to lift
type PinchEvent = { type: 'touches'; points: readonly { x: number; y: number }[] };
type PinchEffect = { kind: 'none' } | { kind: 'pinch'; direction: 'in' | 'out' };
```

Transitions: `idle` + 2 points → `tracking(distance)`; `tracking` + 2 points → ratio ≤ 0.8 ⇒
`done` + `in`, ratio ≥ 1.25 ⇒ `done` + `out`, else stay; any state + ≠ 2 points (0, 1 or 3+)
→ `idle` (from `done` only when 0 points). One-finger input never leaves `idle`.

## 5. Viewport and arrangement (`src/lib/state/viewport.svelte.ts`, `src/lib/shell/layout.ts`)

```ts
interface Viewport { width: number; height: number; rootPx: number }  // CSS px
type Arrangement = 'narrow' | 'medium' | 'wide-side' | 'wide-stacked' | 'landscape';
interface LayoutChrome { mainPadding: number; gap: number; zoneBorder: number } // px, from tokens
```

`arrangementFor({ width, height, neckWidth, chrome })`:

1. `height ≤ 499 && width > height` → `landscape` (any width).
2. `width < 600` → `narrow`; `width < 1024` → `medium`.
3. `leftColumn = (width − 2·mainPadding − gap)·3/4 − 2·zoneBorder`;
   `neckWidth ≤ leftColumn` → `wide-side`, else `wide-stacked`.

`neckWidth` = `layoutFretboard(instrument, readMetrics(), 0, 'interactive').naturalWidth` for
the active instrument (fret count, string marks off). Re-derived on resize, fret-count change
and `rootPx` change; never from fit mode or measured fretboard size.

Expected table (16 px root, standard tokens): 1440/24 → wide-stacked; 1440/12 → wide-side;
2560/24 → wide-side; 1024/24 → wide-stacked; 844×390 → landscape; 1024×768 → wide-stacked;
390×844 → narrow; 800×1280 → medium; 1440/24 at 32 px root → neck 2,440 → wide-stacked (and
Fit to screen shows, since the full-width zone ≈ 1,374 < 2,440).

## 6. Sliding panel (`src/lib/tools/SidePanels.svelte`)

| State | Meaning |
|---|---|
| `open: boolean` | component-local; forced `false` on entering landscape |
| `returnFocus` | opener element; focus target on close |

Transitions: `open()` → content shown, focus to the panel's close button; `close(reason:
'escape' | 'close-button' | 'opener')` → `open = false`, focus → opener; arrangement leaves
`landscape` while `open` → `open = false`, focus → first focusable in zone E if
`document.activeElement` was inside. Not modal; no trap; `hidden` on the panel when closed.

## 7. Context panel (`src/lib/state/context-panel.svelte.ts`, `src/lib/tools/ContextZone.svelte`)

```ts
interface ContextPanelState { expanded: boolean }  // session; default false; shared across tools
```

Effective visibility: `arrangement === 'narrow' ? expanded : true`. Summary string per tool
(FR-016) is a field on each tool's display object:

| Tool | Field | Format (en example) |
|---|---|---|
| Triads | `display.summary` | `{chord} · {inversion} · {n1} – {n2} – {n3}` → "A major · 1st inversion · C♯ – E – A" |
| CAGED | `display.summary` | `{chord} · {shape A \| all shapes} · {notes}` → "C major · shape A · C – E – G" |
| Notes | `display.summary` | `{notes} · {count} positions` or `{notes} · {position name}`; empty → "No notes selected" |

Separators (" · ", " – ") are catalog messages (`summary_separator`, `summary_note_separator`).

## 8. Message catalog additions (`messages/{en,pt-BR,es}.json`)

| Key | en | Params |
|---|---|---|
| `fit_to_screen` | Fit to screen | — |
| `minimap_label` | Fretboard overview | — |
| `minimap_value` | Frets {first} to {last} of {count} | first, last, count |
| `fit_small_notice` | These frets are small. Switch to comfortable size? | — |
| `fit_use_comfortable` | Use comfortable size | — |
| `panels_open` | Panels | — |
| `panels_close` | Close panels | — |
| `panels_region` | Actions and details | — |
| `context_show` | Show details | — |
| `context_hide` | Hide details | — |
| `summary_separator` | " · " | — |
| `summary_note_separator` | " – " | — |
| `summary_all_shapes` | all shapes | — |
| `summary_shape` | shape {shape} | shape |
| `summary_positions` | {count} positions (plural forms) | count |
| `summary_no_notes` | No notes selected | — |

pt-BR and es values are added in the same commit; `tests/unit/i18n/catalogs.test.ts` enforces
parity.
