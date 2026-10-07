# Contract: UI, DOM and ARIA (025)

What users, assistive technology and e2e tests can rely on. Selectors below are the stable
hooks e2e specs use (roles and names first, `data-*` only where no role fits).

## 1. Fretboard props (`src/lib/fretboard/Fretboard.svelte`, edit)

```ts
interface FretboardProps {
  // …existing…
  fit?: FitMode;                       // default 'comfortable'
  onfit?: (event: FitEvent) => void;   // interactive variant only; never fired by thumbnail/preview
}
```

- Emits `{ kind: 'overflow', value }` once on mount and on every change of `naturalWidth >
  containerWidth`.
- Emits `{ kind: 'request', mode }` on a completed pinch (R-06).
- Emits `{ kind: 'small-tap', position }` after `onactivate` when `fit === 'whole'` and the
  narrowest column < `--target-min`.
- Scroller CSS: `touch-action: pan-x pan-y`. Only this element may scroll horizontally on the
  page (besides zone B control rows, which are inside the page width).

## 2. Minimap (`src/lib/fretboard/Minimap.svelte`, new)

Rendered directly under the scroller iff `variant === 'interactive' && layout.scrolls`.

```html
<div class="minimap" role="slider" tabindex="0"
     aria-label="Fretboard overview"
     aria-valuemin="1" aria-valuemax="24" aria-valuenow="1"
     aria-valuetext="Frets 1 to 5 of 24"
     aria-orientation="horizontal">
  <svg aria-hidden="true" focusable="false">…window rect, dots…</svg>
</div>
```

- Block size ≥ 44 px; inline size = fretboard zone width.
- Pointer: `pointerup` without a drag (reuse `DRAG_THRESHOLD_PX`) at x → scroll per
  `minimapTapScroll`, animated `--duration-short` (0 under reduced motion).
- Keys: ArrowLeft/ArrowRight (one visible stretch, visual direction), Home/End (nut end / last
  fret end); `preventDefault` only for these.
- Window updates on scroller `scroll` (rAF-throttled; transform/attribute only, no layout read
  in the scroll handler besides `scrollLeft`).
- Dots: highlighted positions only; none → window only.
- Mirrored layout ⇒ mirrored drawing (from layout x); taps resolve to the same frets.
- Focus ring: existing two-tone focus tokens.

## 3. Fit to screen toggle (`src/lib/tools/FitToggle.svelte`, new)

Placed first in each tool's zone E.

```html
<button type="button" aria-pressed="false">Fit to screen</button>   <!-- pressed = whole -->
```

- Not rendered when `fit.available === false` (FR-008).
- Click → `fit.toggle()`; focus stays on the button.

## 4. Small-fret notice (`src/lib/tools/FitNotice.svelte`, new)

Placed in zone C above the fretboard; wraps `src/lib/shell/Notice.svelte`:

- `role="status"`, message `fit_small_notice`, action `fit_use_comfortable`, Dismiss.
- Shown iff `fit.notice !== null`. Accept → comfortable mode, tapped position centred; focus →
  the fretboard cell of that position. Dismiss → not shown again until the mode changes.

## 5. Tool layout (`src/lib/shell/ToolLayout.svelte`, edit)

- `<div class="grid" data-arrangement="narrow|medium|wide-side|wide-stacked|landscape">` set
  after mount from the viewport store; absent during prerender (media-query fallback).
- `<header data-landscape>` present iff arrangement is `landscape`.
- DOM order inside `.grid` for every tool: zone B, zone C, Panels opener, panel wrapper (zone E,
  zone D).
- Horizontal page scroll: `document.scrollingElement.scrollWidth ≤ window.innerWidth` at every
  width 320–2560 and in landscape (FR-022).

Visual placement by arrangement:

| Arrangement | Placement (top → bottom, left → right) |
|---|---|
| narrow | B / C / E / D, one column |
| medium | B / C (full width) / E · D side by side |
| wide-side | left column: B, C, E; right column: D |
| wide-stacked | B / C (full width) / E · D side by side |
| landscape | strip B + Panels button / C fills the rest; E, D in the sliding panel |

## 6. Zone B rows (`.controls-row`, each tool's controls component, edit)

- Narrow: exactly two `.controls-row` elements in zone B (Notes 6+6 selector; Triads root /
  quality + inversion + string set; CAGED key / quality + shape).
- A row whose content overflows has `data-overflow` and an edge-fade cue; it scrolls
  horizontally on its own. No menu buttons are introduced.
- Landscape: B is one horizontally scrollable strip one control row tall; zone headings and
  the tool `h1` are visually hidden but remain in the accessibility tree.

## 7. Sliding panel (`src/lib/tools/SidePanels.svelte`, new)

```html
<button type="button" class="panels-opener" aria-expanded="false" aria-controls="tool-panels"
        hidden={!landscape}>Panels</button>
<div id="tool-panels" class="panels"
     role={landscape ? 'region' : undefined}
     aria-label={landscape ? 'Actions and details' : undefined}
     hidden={landscape && !open}>
  {#if landscape}<button type="button">Close panels</button>{/if}
  {@render actions()}   <!-- zone E -->
  {@render details()}   <!-- zone D -->
</div>
```

- Outside landscape: `.panels { display: contents }`; opener hidden.
- Landscape: trailing edge, `inline-size ≤ 50vw`, below the bar, own vertical scroll, slide
  transition `--duration-short` (none under reduced motion). No backdrop, no `inert`, no focus
  trap; the uncovered fretboard stays operable.
- Escape inside the panel, the close button, or the opener close it; focus returns to the
  opener.
- Entering landscape: closed. Leaving landscape while open: closed, content back in the grid,
  focus → first focusable in zone E if focus was inside the panel.

## 8. Context zone (`src/lib/tools/ContextZone.svelte`, new)

Wraps zone D content of each tool.

```html
<!-- narrow only -->
<div class="summary-row">
  <p class="summary">A major · 1st inversion · C♯ – E – A</p>
  <button type="button" aria-expanded="false" aria-controls="{id}-content">Show details</button>
</div>
<div id="{id}-content" hidden={narrow && !expanded}>…existing D content…</div>
```

- Narrow: collapsed by default; choice kept across tools for the session; summary wraps (never
  truncated) at 200% text.
- Medium, wide, landscape: no summary row, content always visible.

## 9. Bar in landscape (`AppNav.svelte`, `ShareButton.svelte`, `InstrumentButton.svelte`, `NotationToggle.svelte`, `LanguagePanel.svelte`, edit)

- Each item: decorative `<svg aria-hidden="true">` icon + `<span class="bar-label">` text.
- `header[data-landscape] .bar-label`: visually hidden; shown as a tooltip on `:hover` and
  `:focus-visible`. Accessible names unchanged.

## 10. Rotate hint (unchanged)

- 844×390 (landscape): never shown. 390×844: shown once (slice 016 behaviour).

## 11. Accessibility gates

- axe: zero violations for each tool at narrow (collapsed and expanded), medium, wide-side,
  wide-stacked, landscape (panel closed and open), whole mode with notice, minimap focused.
- Keyboard: every new control reachable in DOM order; no traps; Escape closes the panel.
- 200% text: no element's text is clipped (`scrollWidth ≤ clientWidth` for labels/summary),
  no overlapping bounding boxes among zone children, all controls reachable.
