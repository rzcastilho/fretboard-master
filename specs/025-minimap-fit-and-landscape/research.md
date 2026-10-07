# Research: Minimap, Fit to Screen, and Landscape (025)

Phase 0 output for [plan.md](./plan.md). Every unknown from the Technical Context is resolved
here. Each entry gives the **Decision**, the **Rationale** and the **Alternatives rejected**.
Code references are to the tree at commit `ca3f3d3` (after slice 024).

## Starting point (measured in the code)

- `src/lib/fretboard/geometry.ts` `layoutFretboard()` already computes a comfortable-size
  natural width (`labelCol + openCol + Σ fretWidth(f)`, fret widths 52 → 44 px, rows 44 px at a
  16 px root) and sets `scrolls = naturalWidth > containerWidth`. When the container is wider
  it stretches columns (`scale > 1`); it never compresses (`scale < 1` is impossible today).
- `src/lib/fretboard/metrics.ts` `readMetrics()` resolves the rem tokens through the root font
  size, so browser text zoom already scales the comfortable metrics (FR-008 "live, not a
  breakpoint" comes for free once metrics are re-read on text-zoom change).
- `Fretboard.svelte` (1,384 lines) owns the scroller, measures `containerWidth` with a
  `ResizeObserver`, owns auto-scroll (`autoScrollTarget`, `groupScrollTarget`,
  `centerScrollTarget`), the nut-offset anchor used on width/handedness change, and the
  pointer gesture reducer (`interaction.ts reduceGesture`). A second pointer moves the reducer
  to `cancelled`; nothing handles pinch today.
- `ToolLayout.svelte` renders the bar (zone A, `<header>`) and a `.grid` whose areas come from
  `--tool-grid-*` tokens in `tokens.css` (narrow/medium: `b c e d` stacked; ≥ 1024: `b d / c d /
  e d`, columns 3fr/1fr). Each tool renders its own zones B, C, D, E as sibling sections with
  `grid-area`. DOM order differs per tool (Notes/Triads: C, D, E; CAGED: C, E, D).
- `src/lib/state/rotate-hint.ts` + `CagedTool.svelte` already implement the rotate hint
  (portrait phone = width ≤ 599 and height > width). An 844×390 viewport is not portrait, so
  the hint is already absent in landscape; it only needs a regression test.
- Bundle: slice 024 closed at **127.9 KB of 128 KB** initial JS gzip (024 research R-15),
  headroom ≈ 0.1 KB. CSS is inlined into the HTML (`inlineStyleThreshold: Infinity`) and is not
  counted by `scripts/check-bundle-size.mjs`, which counts JS only.

## R-01 Fit mode lives in a session store, not in prefs or links

**Decision**: New `src/lib/state/fit.svelte.ts` exports a module-level runes store `fit` with
`mode: 'comfortable' | 'whole'` (initial `'comfortable'`), `available: boolean`, and the
small-fret notice state (R-08). Module state survives client-side navigation between tools
(SPA, ADR 0002), so the choice persists across tools, resize and rotation for the session and
resets on reload (FR-009). It is not written to `src/lib/prefs` and not encoded in
`src/lib/link` (no format change, Principle IX untouched).

**Rationale**: Spec FR-009 says session-only; the existing `instrument.svelte.ts` /
`notation.svelte.ts` stores already establish module-level runes state as the pattern.

**Alternatives rejected**: a preference field (spec says not stored; adds a schema version
bump); `sessionStorage` (survives reload, which the spec rejects: "each session starts
comfortable" means each page load); per-tool state (the spec requires persistence across
tools).

## R-02 "Fits" is measured by the fretboard, reported as an event

**Decision**: `Fretboard.svelte` (interactive variant only) already knows `naturalWidth`
(comfortable, independent of fit mode) and the measured scroller `containerWidth`
(independent of content, because the C track is `minmax(0, 1fr)`). It calls a new optional
prop `onfit({ kind: 'overflow', value })` whenever `naturalWidth > containerWidth` changes.
Tools pass `onfit={fit.handle}`. `fit.available` drives both the Fit to screen button and the
minimap; the effective mode is `available ? fit.mode : 'comfortable'` (FR-009: the session
choice is kept while hidden and reapplies when the neck stops fitting).

`layoutFretboard` exposes `naturalWidth` on `FretboardLayout` so the renderer does not repeat
the sum.

**Rationale**: The real fretboard zone width depends on borders, padding, the scrollbar and the
active arrangement; measuring it in one place avoids a formula drifting from CSS. No feedback
loop: neither input depends on the fit mode or on the minimap (the minimap sits below the
scroller, not beside it). Reporting a measurement upward follows Principle III's "the
fretboard reports events" (the event carries no screen coordinates, only a boolean).

**Alternatives rejected**: computing availability from the viewport with a CSS-mirroring
formula (a 1–2 px mismatch would show a scrolling board without a minimap); having the
Fretboard import the store directly (couples the shared renderer to app state; thumbnails and
previews must never report).

## R-03 Whole mode compresses columns in the pure layout

**Decision**: `layoutFretboard(instrument, metrics, containerWidth, variant, marked, fit =
'comfortable')`. With `fit === 'whole'` and `naturalWidth > containerWidth`, `scale =
(containerWidth − labelCol) / columnsNatural` (< 1) and `scrolls = false`. Rows stay
`metrics.row` tall (only width narrows, FR-014 "frets narrower"). Comfortable mode and the
thumbnail/preview variants are unchanged byte for byte (existing geometry tests stay green).
Markers are drawn at `markerScale = min(1, narrowestColumn / markerRoot)` so glyphs never
overlap neighbours; labels follow the existing label-fit rule and are omitted when
`markerScale < 0.75` (the marker shape still carries the note function, Principle V; the text
description is unchanged).

**Rationale**: Keeps handedness and orientation inside the renderer (geometry already mirrors
the scaled columns), and `nearestPosition` already resolves any point to the nearest cell, so
taps in narrow frets never hit a dead gap (NFR-3.5).

**Alternatives rejected**: CSS `transform: scale()` on the SVG (scales row height and label
text, breaks the hit-testing math in `toLayout`); a separate "overview" component (duplicates
the renderer, against "one shared component").

## R-04 Minimap is a child component of the fretboard

**Decision**: New `src/lib/fretboard/Minimap.svelte`, rendered by `Fretboard.svelte` directly
under the scroller when `variant === 'interactive' && layout.scrolls`. It receives the
`layout`, the highlighted positions (markers at emphasis `highlighted` only, FR-002), the
viewport `{ scrollLeft, width }` and callbacks to scroll. Rendering is one inline SVG:
`viewBox = 0 0 layout.width h`, `preserveAspectRatio="none"` is **not** used; instead x is
mapped with `k = minimapWidth / layout.width` so dots stay round. Height `max(44 px, rows ×
--minimap-row)` (new token, 0.375rem); one row of dots per string in the layout's row order, so
orientation and handedness come from the layout (FR-006 for free). Dots: filled circles
`--minimap-dot` (0.375rem) in `--color-text`; the window: a rectangle with a 2 px outline
(`--color-focus-ring-outer`) and translucent fill — distinguishable by shape and size, not
colour (constitution V).

Pure helpers live in new `src/lib/fretboard/minimap.ts` (test-first):
`minimapWindow(layout, viewport, k)`, `minimapTapScroll(layout, minimapX, k, viewportWidth)`
(centre and clamp to `[0, layout.width − viewportWidth]`), `visibleFretRange(layout,
viewport)` (frets ≥ 1 whose column centre lies in the viewport → `{ first, last }`), and
`minimapKeyScroll(layout, key, viewport)` for ArrowLeft/ArrowRight (± one viewport width,
visual direction, clamped) and Home/End (nut end via `scrollForNutOffset(…, 0, …)`, far end via
`trailingEdgeScroll`).

**Rationale**: The minimap needs the scroller, layout and model the Fretboard already owns; a
child component keeps `Fretboard.svelte` from growing by ~200 lines (it is already 1,384).
Mapping through layout x makes mirroring, fret count and text zoom automatic.

**Alternatives rejected**: rendering the minimap from tools (tools must not draw the fretboard,
Principle III); a canvas (no prerender, harder a11y); drawing every marker (spec: highlighted
only).

## R-05 Minimap accessibility: one slider

**Decision**: The minimap root is `<div role="slider" tabindex="0" aria-label={m.minimap_label()}
aria-valuemin="1" aria-valuemax={fretCount} aria-valuenow={first}
aria-valuetext={m.minimap_value({ first, last, count })}>` wrapping the decorative SVG
(`aria-hidden="true"`). Keys per R-04; other keys pass through. Focusing it never moves the
fretboard's roving focus. "Enter/Space" are not bound (arrows act immediately). The open
column is not a fret, so the range starts at 1 ("Frets 1 to 7 of 24"). `aria-valuetext`
updates on scroll but is not a live region (screen readers read slider value changes on key
use).

**Rationale**: Spec clarification "role=slider", constitution V keyboard operability. A slider
whose value is the first visible fret maps naturally to the window position.

**Alternatives rejected**: a list of buttons per fret (24 tab stops, noisy); `role="scrollbar"`
(requires `aria-controls` semantics and is not meant to be focusable by default).

## R-06 Pinch uses touch events on the scroller

**Decision**: New pure reducer `src/lib/fretboard/pinch.ts` `reducePinch(state, event)`:
`idle → tracking` when exactly two touches are down (records the start distance); each move
computes `ratio = distance / start`; at `ratio ≤ 0.8` it emits `{ kind: 'pinch', direction:
'in' }`, at `ratio ≥ 1.25` (≡ ≥ 20% apart from the start, symmetric in log space; the spec's
"≥ 20% change" is met in both directions) `direction: 'out'`, then enters `done` until all
touches lift (one switch per gesture, FR-010). A third touch or touch cancel resets.
`Fretboard.svelte` attaches passive `touchstart/touchmove/touchend/touchcancel` listeners on the
scroller and maps the effect to `onfit({ kind: 'request', mode: in ? 'whole' : 'comfortable' })`;
the store ignores requests while unavailable or when the mode already matches. The scroller's
CSS changes from `touch-action: auto` to `touch-action: pan-x pan-y` so the browser does not
zoom the page over the fretboard; the viewport meta is untouched (no `user-scalable=no`), so
page zoom works everywhere else. Trackpad pinch (`ctrl+wheel`) is not listened to.

Touch events, not pointer events: with `pan-x pan-y`, a two-finger move may start a browser pan
and fire `pointercancel`, which would lose the gesture; touch events keep firing (passive) for
the life of the touch. The existing pointer reducer is unchanged: its `cancelled` state already
suppresses a tap when a second finger lands.

**Rationale**: Smallest change that meets EC-3.5, keeps one-finger scrolling native, and makes
"no free zoom" structural.

**Alternatives rejected**: pointer events (cancel risk above); `gesturechange` (Safari only);
`touch-action: none` (kills native one-finger scrolling smoothness, Principle VI).

## R-07 Scroll position across mode switches, resize and rotation

**Decision**: One anchor rule in the Fretboard, applied after any layout change (mode switch,
container width change, arrangement change, text zoom), instant (no animation for layout
changes; existing behaviour):

1. If the model has highlighted positions or an `autoScroll` group (the CAGED shape in focus
   uses `autoScroll`), scroll so they are visible using the existing `groupScrollTarget` /
   `autoScrollTarget` (they return `null` when already visible).
2. Otherwise keep the **nut offset** (existing `nutOffset` / `scrollForNutOffset`), now also for
   right-handed boards whose width changed (today right-handed boards keep the browser's raw
   `scrollLeft`, which drifts when column widths scale).
3. Leaving whole mode with a pending anchor fret (notice accept, R-08) centres that fret with
   `centerScrollTarget`, clamped.

User-initiated jumps (minimap tap/keys) animate with `--duration-short`, which the tokens zero
under `prefers-reduced-motion` (existing `animateScroll` + `tokenDuration`).

**Rationale**: FR-013 and US2.2 ("previously visible area is still in view"): in whole mode
everything is visible, so the meaningful anchor is the highlighted region; without one, the
nut-side start is what "keeps its start" means in the spec.

**Alternatives rejected**: remembering the comfortable `scrollLeft` from before entering whole
mode (stale after a resize or fret-count change while in whole mode).

## R-08 Small-fret notice

**Decision**: When `onactivate` fires in effective whole mode and the narrowest column is
under `--target-min` (44 px), the Fretboard emits `onfit({ kind: 'small-tap', position })`.
The store sets `notice = { position }` unless `noticeDismissed` is true for the current
whole-mode session. The notice is rendered by the shared `src/lib/tools/FitNotice.svelte`
(not by the renderer) placed in each tool's zone C, above the fretboard,
reusing `src/lib/shell/Notice.svelte` with one action **Use comfortable size** and Dismiss.
Accept → `fit.setMode('comfortable', { anchor: position })` (R-07 step 3). Any mode change
clears the notice and resets `noticeDismissed` (a new whole-mode session may show it again).
The tap itself still selects the nearest position (no change to `onactivate`).

**Rationale**: Reuses the Notice component (non-blocking, dismissible, ≤ 2 lines, Principle
VII); placement next to the board matches existing tool notices (Notes empty guidance, CAGED
fit note).

**Alternatives rejected**: auto-switching to comfortable (spec forbids); a toast in the bar
(far from the cause; covers nothing but is easy to miss).

## R-09 Layout arrangement is computed once, in pure code, from the viewport

**Decision**: New pure module `src/lib/shell/layout.ts`:

```ts
type Arrangement = 'narrow' | 'medium' | 'wide-side' | 'wide-stacked' | 'landscape';
isPhoneLandscape(width, height): boolean      // height ≤ 499 && width > height
arrangementFor({ width, height, neckWidth, chrome }): Arrangement
```

`neckWidth` is the comfortable natural width for the current fret count (from
`layoutFretboard(..., 0, 'interactive').naturalWidth` with `readMetrics()`), so it follows text
zoom and fret count but never the fit mode or rendered size (FR-018, no feedback loop).
`chrome` holds token-derived px values (main padding, grid gap, zone border) read once per
text-zoom change. Wide-side ⇔ `width ≥ 1024 && neckWidth ≤ leftColumn` where `leftColumn =
(width − 2·mainPadding − gap) × 3/4 − 2·border` (the `3fr 1fr` split). Expected (16 px root):
24 frets → neck 1,220 px; 1440 → left column ≈ 1,008 → wide-stacked, full-width zone ≈ 1,374 ≥
1,220 so the whole neck fits (no Fit to screen, no minimap); 12 frets → 644 → wide-side; 2560 →
≈ 1,848 → wide-side; 1024 → wide-stacked, zone ≈ 958 < 1,220 → Fit to screen and minimap shown.
Landscape is checked first and overrides the width class.

A new store `src/lib/state/viewport.svelte.ts` tracks `innerWidth`, `innerHeight` and the root
font size (a `ResizeObserver` on a hidden `1rem` probe catches browser text-size changes, which
fire no `resize`). `ToolLayout.svelte` derives the arrangement and writes it as
`data-arrangement` on `.grid` (and `data-landscape` on the header). CSS in `tokens.css` maps
each `[data-arrangement]` to `--tool-grid-*` values; the existing `@media (min-width)` rules
remain as the no-JS / prerender fallback (narrow, medium, wide-stacked), so `e2e/nojs.spec.ts`
keeps passing and the first paint has no layout jump for the default 24-fret neck below 2,000 px.

Grid areas per arrangement (design §5.1, operator answer round 1):

| Arrangement | Areas | Columns |
|---|---|---|
| narrow (320–599) | `b` `c` `e` `d` | `1fr` |
| medium (600–1023) | `b b` `c c` `e d` | `1fr 1fr` |
| wide-side | `b d` `c d` `e d` | `3fr 1fr` |
| wide-stacked | `b b` `c c` `e d` | `1fr 1fr` |
| landscape | `b p` `c c` | `1fr auto` (p = Panels opener) |

**Rationale**: The arrangement must depend on fret count and text zoom, which CSS cannot read;
computing it once in pure code is testable with tables (1440/24, 1440/12, 2560/24, 1024/24,
844×390, 1024×768, 390×844).

**Alternatives rejected**: container queries (cannot depend on fret count); measuring the
rendered grid (feedback loop when the arrangement changes the zone width).

## R-10 Zones E and D move without remounting

**Decision**: New `src/lib/tools/SidePanels.svelte` wraps each tool's zone E then zone D (fixes
DOM order to bar, controls, fretboard, actions, context panel for every tool, FR-014). Outside
landscape its wrapper is `display: contents`, so E and D stay grid items placed by area. In
landscape the wrapper becomes the sliding panel: `position: fixed`, trailing edge, `inline-size:
min(50vw, var(--side-panel-max))`, full height under the bar, scrollable, transformed off-screen
when closed with the `hidden` attribute applied after the close transition (so closed content
is neither focusable nor read). It carries `role="region"` and `aria-label` only in landscape.
The opener (**Panels**, `aria-expanded`, `aria-controls`) is rendered by `SidePanels` just
before the panel and placed in grid area `p` beside the strip; it is `hidden` outside
landscape. Escape (keydown on the panel), its close button or the opener close it; focus
returns to the opener. The panel is non-modal: no backdrop, no `inert` on the page, no focus
trap; the uncovered fretboard stays interactive. Entering landscape always starts closed;
leaving landscape while open closes it and, if focus was inside, moves focus to the first
focusable control in zone E (FR-020). Components inside stay mounted throughout, so tool
state, selection and focus targets survive (FR-013).

**Rationale**: No DOM moves (moving nodes would remount Svelte components and drop local
state); one component serves three tools (Principle X: three real uses).

**Alternatives rejected**: rendering E/D twice (duplicate IDs, double state); portal/teleport
(remount risk, focus loss); a modal dialog (forbidden for normal situations, Principle VII).

## R-11 Collapsible context panel on narrow

**Decision**: New `src/lib/tools/ContextZone.svelte` wraps zone D content. Props: `summary:
string`, `labelledby`. On `narrow` (from the arrangement store) it renders a header row with the
one-line summary (`<p>`, wraps at 200% text, never truncated) and a toggle button
(`aria-expanded`, `aria-controls`, catalog "Show details" / "Hide details"); the content below
is `hidden` while collapsed but stays mounted. Collapsed by default; the user's choice is held
in the `fit`-style session store `src/lib/state/context-panel.svelte.ts` (`expanded: boolean`,
default false), shared across tools, not persisted. On medium/wide the toggle and summary are
not rendered and the content always shows; in landscape the panel is inside the sliding panel
and always expanded.

Summary strings (FR-016) come from each tool's display model, built by a pure helper
`src/lib/state/context-summary.ts` `joinSummary(parts)` (" · ") and `joinNotes(names)`
(" – "), both separators from the catalog so a language can change them. Note names come only
from `src/lib/notation` (Principle VIII). Per tool:

- Triads (`triads-view.ts`): chord name · inversion name · spelled notes in bass-to-top order
  of the shown shape → "A major · 1st inversion · C♯ – E – A".
- CAGED (`caged-view.ts`): chord name · "shape A" or "all shapes" · chord notes.
- Notes (`notes-view.ts`): selected note names (" – ") · "{count} positions" — or the selected
  position's name when a position card is open; "No notes selected" when empty.

**Rationale**: Display-model strings are already where descriptions live (024); reusing the
same notation context keeps the summary consistent with the board.

**Alternatives rejected**: `<details>/<summary>` (cannot be forced open on medium/wide without
JS, and summary text styling for 200% wrap is awkward); persisting the choice (spec: session).

## R-12 Narrow zone B rows and the landscape strip are CSS only

**Decision**: Each tool's zone B content is grouped into two `.controls-row` containers
(Notes: the existing note selector is already a 6+6 grid at 320, so one row container each;
Triads: root / quality + inversion + string set; CAGED: key / quality + shape). Global CSS in
`global.css`: `.controls-row { display: flex; flex-wrap: nowrap; overflow-x: auto;
scroll-snap-type: x proximity; }` with an edge-fade mask (`mask-image` linear gradient, token
width) applied only when the row overflows — the overflow flag is a `data-overflow` attribute
set by a tiny shared action `src/lib/tools/overflow.ts` (`ResizeObserver`, one boolean). In
landscape, `[data-arrangement='landscape'] .b .controls-row { display: contents }` and `.b`
itself becomes the single scroll strip, one row tall; zone headings (`h2`) and the tool `h1`
become visually hidden (still in the accessibility tree; `h1` keeps its focus role).

Because these scrollers live inside zone B, the page itself still never scrolls horizontally
(FR-022); a dedicated e2e check asserts `document.scrollingElement.scrollWidth ≤ innerWidth` at
every target width.

**Rationale**: Arrangement-only change, no new controls, no menus (Principle VII). CSS is not
counted in the JS budget.

**Alternatives rejected**: an overflow "More" menu (spec forbids); wrapping into a third row
(spec forbids).

## R-13 Icon-only bar in landscape

**Decision**: Bar buttons and nav links keep their text in a `<span class="bar-label">`. In
landscape (`header[data-landscape]`) the label becomes visually hidden (the existing `.sr-only`
recipe) and re-appears as a tooltip on `:hover` and `:focus-visible` (positioned absolutely,
tokens only, no JS). Each item gains a decorative inline SVG icon (`aria-hidden="true"`,
`--icon-size`): home, notes, triads, CAGED, about, share, instrument, notation, language.
Sound and Stop already have icons. Accessible names are unchanged (the visually hidden label is
still the name), so existing role-based e2e selectors keep working.

**Rationale**: Design §5.3; no information lost; zero JS logic.

**Alternatives rejected**: `title` attributes (no keyboard tooltip, inconsistent on touch);
`aria-label` duplication (two sources of truth for the name).

## R-14 Bundle budget: measure, trim, then amend

**Decision**: T001 of the slice measures the baseline (`pnpm build && node
scripts/check-bundle-size.mjs build`). The slice is designed JS-light: layout, strip, panel
motion, tooltips and fades are CSS; logic is in four small pure modules. Estimated JS gzip
added: minimap component + helpers ≈ 1.5 KB, pinch ≈ 0.3 KB, fit store + toggle + notice ≈
0.7 KB, layout + viewport stores ≈ 0.7 KB, SidePanels + ContextZone + overflow action ≈ 0.9 KB,
summaries ≈ 0.5 KB, icons ≈ 0.9 KB, catalog strings × 3 locales ≈ 0.6 KB → ≈ 6–7 KB, against
≈ 0.1 KB headroom. A Principle VI amendment is therefore expected: constitution **1.9.0 →
1.10.0**, initial JS ≤ **136 KB** gzip, with the Sync Impact Report, `scripts/check-bundle-size.mjs`
limit/messages and ADR 0002 cap history updated in the same PR (the procedure slices 015, 016,
017 and 023 followed). The amendment task runs only after the measured number is known and
after trimming candidates are applied (icons as a shared `<symbol>` sprite in `app.html`, which
is HTML not JS; summaries built lazily from existing display data). Recorded in Complexity
Tracking.

**Measured baseline (T001, 2026-10-06)**: `pnpm build && node scripts/check-bundle-size.mjs build`
→ initial JS gzip **127.9 KB** against the 128 KB limit (Principle VI 1.9.0), i.e. ≈ 0.1 KB
headroom. Matches the estimate above; the 1.10.0 amendment (≤ 136 KB) stays expected.

**Rationale**: ADR 0002 forbids lazy chunks (version continuity), so the only levers are
trimming and the budget. The behaviour is spec-required (FR-001–FR-024); it cannot be cut.

**Alternatives rejected**: code-splitting the minimap (breaks ADR 0002's version-skew
guarantee); dropping icons (FR-019 requires icon-only bar buttons).

## R-15 Rotate hint stays as is

**Decision**: No change to `rotate-hint.ts` or its CagedTool effect. Add a regression check to
the landscape e2e: at 844×390 the hint never shows; at 390×844 it shows once (existing test
already covers portrait).

**Rationale**: Spec clarification: slice 016 ships it; this slice must keep it working.

## R-16 Test strategy

**Decision**:

- **Vitest (node, pure, test-first)**: `geometry` whole-mode scale and `naturalWidth`;
  `minimap.ts` (window, tap clamp incl. far end → last fret, key moves, visible range,
  mirrored); `pinch.ts` (thresholds, one switch per gesture, third finger reset); `layout.ts`
  (arrangement table incl. all spec examples and 200% root size); `context-summary.ts` and the
  three tools' summary strings in en/pt/es and letters/solfège; `fit.svelte.ts` store
  transitions (availability, pinch request rules, notice dismissal lifecycle).
- **Vitest (jsdom, components)**: `Minimap` ARIA and keys; `FitToggle` (`aria-pressed`,
  hidden when unavailable); `SidePanels` (Escape, focus return, `hidden` when closed,
  `display: contents` outside landscape via class); `ContextZone` (`aria-expanded`,
  collapsed default on narrow, no toggle on medium); `no-raw-text` covers new components.
- **Playwright** (new `e2e/minimap-fit.spec.ts`, `e2e/responsive-layout.spec.ts`,
  `e2e/landscape.spec.ts`, `e2e/text-zoom.spec.ts`; edits to `fretboard-touch.spec.ts` for pinch
  on the `phone-touch` project, `a11y-audit.spec.ts` for new targets): every acceptance
  scenario US1–US5 (see [quickstart.md](./quickstart.md) §3). Pinch is driven through CDP
  `Input.dispatchTouchEvent` in Chromium projects; text zoom is emulated by setting the root
  font size to 200% before load (`page.addInitScript`), which is what browser text-size settings
  change. Layout checks use bounding boxes, not screenshots, except one screenshot per
  arrangement (narrow, medium, wide-side, wide-stacked, landscape) for the phone/desktop
  owners.
- Reduced motion: an e2e with `reducedMotion: 'reduce'` asserts a minimap tap lands in one
  frame.

**Rationale**: Principle IV (every acceptance scenario automated; logic test-first) and the
verification tiers in `CLAUDE.md`.
