# Research: Interactive Fretboard

**Feature**: `002-interactive-fretboard` | **Date**: 2026-09-30 | **Plan**: [plan.md](./plan.md)

Every unknown in the plan's Technical Context is resolved here. Each item states the decision, why,
and what was rejected. IDs continue the per-feature numbering style of 001 (R-xx is local to this
feature).

---

## R-01 Module split: where pitch, instrument, notation, and drawing live (FR-006, FR-009, FR-022; constitution III)

- **Decision**: Four new `src/lib` modules, each the smallest that serves this slice:
  - `src/lib/theory/pitch.ts` — pure pitch arithmetic: `Letter`, `Accidental` (−2…+2),
    `Spelling`, `Pitch` (MIDI-style integer, C4 = 60), `pitchClass`, `octaveOf`, `transpose`,
    `pitchOfSpelling(spelling, octave)`, `pitchClassOfSpelling`. No UI, DOM, i18n.
  - `src/lib/instrument/instrument.ts` — the `Instrument` data shape (DM-5) and the constant
    `STANDARD_GUITAR` (6 strings, 22 frets, open strings spelled E2 A2 D3 G3 B3 E4, right-handed,
    highest string on top), plus `positionPitch(instrument, position)` and `isValidPosition`.
  - `src/lib/notation/notation.ts` — resolves a spelling or a pitch class to display text
    (`noteLabel`: "F♯", "B𝄫") and to spoken text (`spokenNote`: "F sharp", via the catalog);
    `defaultSpelling(pitchClass)` applies the sharps-by-default policy.
  - `src/lib/fretboard/` — `geometry.ts` (pure layout and hit-testing), `interaction.ts` (pure
    gesture state machine, keyboard moves, auto-scroll targets), `description.ts` (text description
    and accessible names), `scroll-animation.ts` (rAF animation with injectable clock),
    `Fretboard.svelte` (the only component that draws).
- **Rationale**: ARCH-2/3/5 separate theory, instrument, and drawing; the constitution requires
  `theory` to be pure and lint-guarded, notation to be the only note-name formatter (VIII), and
  handedness/orientation to live only in the renderer (III). Keeping geometry and interaction as
  pure TypeScript makes FR-011/FR-014/FR-015/FR-018 unit-testable without a browser.
- **Alternatives considered**:
  - Pitch math inside the fretboard: rejected — ARCH-5 says the fretboard "contains no musical
    rule"; TM-1 belongs to the theory engine.
  - A `src/lib/state` view-state store now: rejected (Principle X) — no tool produces a display
    model yet; the instrument cannot change in this slice, so a constant suffices. State arrives
    with 004 (Notes tool).

## R-02 Pitch representation and octave numbering (FR-006, SC-001; TM-1)

- **Decision**: `Pitch` is an integer semitone number with C4 = 60 (MIDI convention, C−1 = 0).
  `octaveOf(p) = floor(p / 12) − 1`, `pitchClass(p) = ((p mod 12) + 12) mod 12` with C = 0.
  A position's pitch = open-string pitch + fret. Open strings are stored as *spelled* pitches
  (`{ letter, accidental, octave }`) because TM-2 fixes the spelling of preset tunings
  (AF-2 uses flats, AF-9 uses F♯); the semitone value is derived via `pitchOfSpelling`, which
  handles B♯/C♭ octave crossings (B♯3 = C4 = 60, C♭4 = B3 = 59).
- **Rationale**: Integer arithmetic makes "open + fret" trivially exact and makes octave changes at
  C (TM-1.3) fall out of `floor(p/12)`. Storing spelled open strings now avoids a format change in
  wave 003 at no cost (the six standard strings have no accidentals).
- **Alternatives considered**: frequency floats (rounding risk, no octave semantics); storing
  pitch classes + octave pairs (two fields to keep consistent, more error-prone at B/C).
- **Tests (test-first, constitution IV)**: table test reproducing the full TM-3 table (6 strings ×
  frets 0–12, sharps) plus fret 13–22 = fret 1–10 one octave up; TM-1.3 anchors (string 6 open E2,
  string 1 open E4, string 2 fret 1 C4); TM-1.4 unison property; fast-check properties:
  `pitchClass(transpose(p, 12)) == pitchClass(p)`, `octaveOf(transpose(p,12)) == octaveOf(p)+1`,
  `pitchOfSpelling` round-trips with `pitchClassOfSpelling` for all 7 letters × 5 accidentals.

## R-03 Notation: display glyphs and spoken form (FR-009, FR-020, NFR-3.9; constitution VIII)

- **Decision**: `noteLabel(spelling)` returns letter + one of `♯ ♭ 𝄪 𝄫` (U+266F, U+266D, U+1D12A,
  U+1D12B) or nothing for naturals. `defaultSpelling(pc)` maps the 12 pitch classes to
  C C♯ D D♯ E F F♯ G G♯ A A♯ B (TM-3 table). `spokenNote(spelling)` builds the spoken form from
  catalog messages: `note_spoken_natural` "{letter}", `note_spoken_sharp` "{letter} sharp",
  `note_spoken_flat`, `note_spoken_double_sharp`, `note_spoken_double_flat`. Letters stay
  Latin letters in English; solfège arrives with 005-languages-and-notation.
- **Rationale**: One formatter for every surface (marker labels, string labels, hover hints,
  accessible names, description). Spoken templates in the catalog let pt/es reorder words later
  with no logic change.
- **Alternatives considered**: `Intl`-based or hand-concatenated strings in components (forbidden
  by VIII); using `#`/`b` (forbidden); relying on screen readers to voice "♯" (they say "sharp
  sign" or nothing — fails NFR-3.9).

## R-04 Rendering technology and accessibility structure (FR-001–FR-005, FR-015, FR-020; ARCH-5)

- **Decision**: One inline `<svg>` per fretboard. Drawing layers (wood, inlays, frets, nut,
  strings, string labels, fret numbers, markers) are `aria-hidden` groups. The interactive layer is
  an ARIA grid built from SVG elements: the `<svg>` carries `role="grid"` and the catalog label
  "Fretboard"; each string is a `<g role="row">`; each position is a transparent
  `<rect role="gridcell" tabindex="-1|0" aria-label="…">` covering its full hit cell. Exactly one
  cell has `tabindex="0"` (roving tab stop).
- **Rationale**:
  - All geometry is set via SVG attributes (`x`, `y`, `width`, `cx`, `d`), which the site's
    CSP (`style-src 'self'`, hash mode, no `unsafe-inline`) allows; an HTML overlay of positioned
    buttons would need inline `style` attributes, which the prerendered pages would have blocked
    (see 001 contracts/http-delivery.md).
  - `role="grid"` puts screen readers into focus mode inside the board, so arrow keys reach our
    handler (APG grid pattern: arrows move, Enter/Space act). A flat group of buttons would leave
    NVDA/JAWS in browse mode, swallowing arrows.
  - One SVG keeps handedness/orientation a single coordinate transform inside the renderer (wave
    003) — tools never see it.
- **Alternatives considered**: Canvas (no DOM focus targets, no accessible names); HTML/CSS grid
  of buttons (CSP inline-style problem, two layout systems to keep in sync); one SVG per string
  (row alignment drift, more DOM).
- **Risk + fallback**: if axe flags `role="grid"` on `<svg>` in some engine, wrap the SVG in a
  `<div role="grid">`, set `role="none"` on the `<svg>`, and keep rows/cells unchanged. The e2e axe
  run on phone and desktop decides; no API change either way.

## R-05 Geometry: comfortable size, narrowing frets, fill-container (FR-002, FR-017, FR-018, FR-013, SC-005)

- **Decision**:
  - New rem-based tokens in `src/lib/styles/tokens.css`: `--fb-row` 2.75rem (44 px),
    `--fb-label-col` 1.75rem (28 px), `--fb-open-col` 2.75rem (44 px), `--fb-fret-first`
    3.25rem (52 px), `--fb-fret-last` 2.75rem (44 px), `--fb-numbers-row` 1.5rem,
    `--fb-nut-width` 0.375rem, plus thumbnail tokens (`--fb-thumb-row`, `--fb-thumb-fret`,
    `--fb-thumb-open-col`).
  - `Fretboard.svelte` reads these tokens once on mount and on resize (computed custom-property
    value in rem × the root font size in px) and passes plain numbers to the pure
    `layoutFretboard(instrument, metrics, containerWidth)`, which returns column edges and centers
    in CSS px. Fret *n* (1…fretCount) width interpolates linearly from `fretFirst` to `fretLast`
    over frets 1…22 (`w(n) = first − (first − last)·(n−1)/21`, clamped at `last` for frets > 22).
  - Natural width = label column + open column + Σ fret widths. If the container is wider, every
    column scales by `container / natural` (columns widen, markers keep base size) and the board
    does not scroll; otherwise the board keeps natural width inside an `overflow-x: auto` scroller.
  - Server-rendered (prerendered) markup uses the same function with default metrics at a 16 px
    root and natural width, so the no-JS page shows a correct board; hydration re-measures.
  - Phone fit: zone C's inline padding becomes 0 for the fretboard (token `--zone-fretboard-
    padding-inline`) so the board gets the zone's full inner width. At a 320 px viewport the
    scroller is 320 − 2·16 (main padding) − 2·1 (zone border) = 286 px. Visible columns at scroll
    0: (286 − 28 label) over 44 + 52 + 51.6 + 51.2 + 50.9 + … ≈ **5.2** columns; at full scroll
    286 / ≈44.4 ≈ **6.4** columns. Both inside 5–7 (SC-005).
- **Rationale**: Tokens remain the single source (VII) while JS gets exact numbers for hit-testing;
  rem units make 200 % text zoom enlarge the board (it then scrolls; no overlap). Linear narrowing
  is the simplest rule satisfying FR-3.6/A-9 with every column ≥ 44 px.
- **Alternatives considered**: true rule-of-18 fret spacing (fret 22 would be ~35 % of fret 1,
  violating 44 px or making fret 1 huge); `preserveAspectRatio="none"` stretching (distorts marker
  shapes); CSS-only layout (cannot hit-test or animate scroll targets without the same numbers).
- **Visible-column metric (test definition)**: Σ over columns (open + frets; the label column
  excluded) of the fraction of the column's width inside the scroller's visible box. Measured at
  scroll positions 0, every 25 % of max, and max.

## R-06 Markers, emphasis, labels, focus ring — visuals without color dependence (FR-007–FR-009, SC-004; constitution V, VII)

- **Decision**:
  - Shapes: root `<rect rx>` (size token `--marker-root` 1.75rem), third `<circle>`, fifth
    `<path>` diamond, neutral `<circle>` with light fill plus a solid outline ring (stroke
    `--color-neutral-note-stroke`, width `--marker-neutral-stroke-width`; the third circle has no
    outline, so third vs neutral differs by geometry, not only fill) (all `--marker-medium` 1.5rem), scale
    degree outlined `<circle>` (`--marker-small` 1rem, fill none, stroke `--marker-stroke`).
  - Colors: new reserved tokens `--color-root`, `--color-third`, `--color-fifth` (used nowhere
    else; CVD-checked palette — candidate light/dark values recorded in the token file and
    validated by the axe/contrast e2e and a grayscale screenshot), `--color-neutral-note`,
    `--color-fretboard-wood`, `--color-fretboard-line`, `--color-nut`, `--color-inlay`,
    `--color-marker-label`, each with dark and `prefers-contrast: more` variants.
  - Emphasis via CSS classes, never color: `.highlighted` → `transform: scale(var(--emph-
    highlight-scale))` (1.15) + elevation outline stroke `--marker-elevation-stroke`; `.normal` →
    base; `.dimmed` → `opacity: var(--emph-dim-opacity)` (0.4) + `scale(var(--emph-dim-scale))`
    (0.85), label suppressed; `.hidden`/unmarked → not rendered. `transform-box: fill-box;
    transform-origin: center` keeps scaling centered.
  - Labels: `<text>` with `font-size: var(--marker-label-size)`; if the measured label width
    (`getComputedTextLength`) exceeds the marker's inner box, the class `.label-min` switches to
    `--marker-label-min-size` (EC-3.2). English labels are ≤ 2 glyphs, so this is a guard, not a
    common path.
  - Focus ring: an explicit `<rect class="focus-ring">` drawn at the focused position whenever DOM
    focus is inside the grid (tracked via `focusin`/`focusout`), stroke `--color-focus-ring`,
    width `--focus-ring-width`. Drawn independently of markers, so hidden/unmarked positions show it,
    and it shows after a tap as well as after keys (CSS `:focus-visible` would hide it after a tap
    in some engines, and outlines on SVG children are inconsistent in WebKit).
- **Rationale**: Shape + size + opacity carry function and emphasis (NFR-3.3); color tokens are
  exclusive (VII); CSS classes keep every factor a token and avoid inline styles (CSP, R-04).
- **Verification**: Playwright screenshot of a fixture with every function × emphasis, rendered
  under `filter: grayscale(1)`, compared to a committed baseline; plus a unit test that each
  function/emphasis pair yields a distinct (shape, outline, size class, opacity class) tuple, so no
  two functions differ by color alone.

## R-07 Pointer input: tap vs drag, nearest position, multi-touch (FR-010–FR-013, SC-006)

- **Decision**: A pure gesture reducer in `interaction.ts` driven by pointer events on the scroller:
  - `pointerdown` (primary button / first pointer only; `event.button !== 0` ignored) → `pending`
    with origin.
  - `pointermove`: if Euclidean travel ≥ 10 CSS px → `scrolling` (no activation). For
    `pointerType === 'mouse'`, the component then drags `scrollLeft` itself (pointer capture);
    for touch/pen, the browser's native pan scrolls and typically fires `pointercancel`.
  - Second `pointerdown` while pending → `cancelled` (multi-touch / pinch: no activation).
  - `pointercancel` → `cancelled`.
  - `pointerup` while `pending` → activation: convert `clientX/Y` to board-local px via the SVG's
    `getBoundingClientRect()`, then `nearestPosition(layout, x, y)`.
  - `nearestPosition`: clamp x into [open-column center, last-fret center] and y into
    [string-1 row center, last-string row center], compute Euclidean distance to the candidate
    centers in the two nearest columns × two nearest rows; exact ties → lower fret, then lower
    string number. Taps on the label column or fret-number row clamp the same way.
  - After activation: focus the cell's element (`preventScroll: true`), set it as the roving
    stop, call `onactivate({ string, fret })`. Repeat taps report again.
- **Scrolling CSS**: scroller has `overflow-x: auto; overflow-y: hidden; overscroll-behavior-x:
  contain; touch-action: auto` — native horizontal pan of the board, vertical pan bubbles to the
  page, pinch-zoom untouched (FR-013, WCAG 1.4.4). `user-select: none` on the SVG only.
- **Rationale**: One pipeline for mouse, touch, and pen; the reducer is unit-testable with
  synthetic events; native scrolling gives smooth, compositor-driven touch scroll (SC-009).
- **Alternatives considered**: per-cell `click` handlers (cannot resolve "between" taps, fires
  after drags on some engines, and duplicates keyboard `click` on Enter); `touch-action: pan-y`
  with JS horizontal scrolling for touch (janky, re-implements momentum); native `click` events
  (no movement threshold control).

## R-08 Keyboard model and roving focus (FR-015, SC-003, SC-007)

- **Decision**: `keydown` on the grid: ArrowRight → fret+1, ArrowLeft → fret−1, ArrowUp →
  string−1, ArrowDown → string+1, all clamped (no wrap) with `preventDefault` to stop page
  scrolling; Enter/Space → activate (`preventDefault` on Space). Home/End/PageUp/PageDown are not
  bound (not required; avoids surprising grid semantics). The roving stop (`tabindex="0"`) is the
  last focused cell of this instance, initially string 1 fret 0; Tab/Shift+Tab leave naturally
  because only one cell is tabbable. After a move, if the new cell is outside the visible box,
  `scrollIntoViewTarget()` (pure) computes a minimal `scrollLeft` and the scroller jumps instantly.
- **Rationale**: Mirrors FR-3.17 and the clarified mapping; the right-handed, highest-on-top
  orientation is applied in one mapping function (`screenDirectionToMove`) inside the renderer so
  left-handed/orientation flips in wave 003 change only that function.
- **Alternatives considered**: native `scrollIntoView()` on SVG rects (inconsistent in WebKit and
  scrolls the page vertically); wrapping at edges (spec forbids).

## R-09 Auto-scroll on highlighted-set change (FR-014)

- **Decision**: The component derives `highlightKey` = sorted `"s:f"` list of highlighted markers.
  A `$effect` compares it with the previous key; only on change does it call the pure
  `autoScrollTarget(layout, highlightedFrets, { scrollLeft, width })`:
  - all highlighted columns fully visible → `null` (no scroll);
  - span [min fret column start, max fret column end] fits the width → minimal scroll that shows
    it;
  - otherwise → align the min fret column's start with the visible start.
  The scroll animates with `animateScroll(el, from, to, durationMs, clock)` using an easing curve
  over `--duration-short` (300 ms, token; 0 s under reduced motion → immediate jump). A user
  pointerdown or wheel during the animation cancels it. Initial render with a non-empty highlight
  set counts as a change (so a tool opened on a high position shows it), but unrelated re-renders
  (label mode, emphasis of non-highlighted markers, resize) do not.
- **Rationale**: Deterministic, testable with an injected clock (constitution IV); browser
  `behavior: 'smooth'` has no duration control and can exceed 300 ms.
- **Alternatives considered**: CSS `scroll-behavior: smooth` (duration not controllable, also
  affects keyboard jumps); scroll-snap (fights free scrolling).

## R-10 Hover hint (FR-016)

- **Decision**: `pointermove` with `pointerType === 'mouse'` and not dragging → nearest position →
  a `<g class="hover-hint" aria-hidden="true">` inside the SVG (rounded rect + `<text>`) above the
  position (below for string 1 to avoid clipping); hidden on `pointerleave` or when a drag starts.
  Text = marker spelling if present, else `defaultSpelling`. No hint for touch/pen.
- **Rationale**: SVG-internal hint needs no inline styles (CSP) and is positioned by attributes;
  `aria-hidden` because the cell's accessible name already carries the note.
- **Alternatives considered**: `title` attributes (delayed, unstyled, also fire for touch long-press
  on some engines); HTML tooltip (inline `style` for position — CSP).

## R-11 Text description and live region (FR-020, NFR-3.4)

- **Decision**: `describeView(instrument, model)` (pure, takes the message functions) returns
  `summary? + positions sentence | "No positions marked."`, listing highlighted and normal markers
  ordered string 6→1 then fret ascending, each "string N, fret F, <spoken note>, <function>" with
  fret 0 → "open". Rendered twice from the same derived value: (1) a visually hidden
  `<div aria-live="polite">` whose text is set only after the first render and only when the
  description string changes; (2) a disclosure: `<button aria-expanded aria-controls>` "Show text
  description" / "Hide text description" below the board revealing a `<p>` with the same text
  (collapsed by default). Cell accessible names come from `positionName()` in the same module.
- **Rationale**: One source for both channels; "not on first render" avoids an announcement storm
  on page open.
- **Alternatives considered**: `role="status"` (implicitly polite + atomic, fine, but `aria-live`
  plus explicit `aria-atomic="true"` is clearer and identical in behavior; either passes axe);
  `aria-describedby` on the grid (announced on every focus entry — noisy).

## R-12 Thumbnail mode (FR-019)

- **Decision**: `Fretboard` prop `variant: 'interactive' | 'thumbnail'`. Thumbnail renders only the
  drawing layers for frets 0–12 with thumbnail tokens, no text, no markers, no grid/rows/cells,
  `aria-hidden="true"` and `focusable="false"` on the `<svg>`, `pointer-events: none`, no event
  listeners, no live region, no toggle. `ToolCard` renders it inside the link, after the question.
- **Rationale**: Same component, same geometry function (FR-019), no second drawing code path.
  The card's `aria-label` already names the link; the SVG adds nothing to the accessible tree.

## R-13 Tool screens before 004/005 (FR-023)

- **Decision**: `ToolPlaceholder.svelte` zone C replaces its placeholder paragraph with
  `<Fretboard instrument={STANDARD_GUITAR} />` (no model → no markers, label mode none, no
  `onactivate`). The zone keeps its `h2` "Fretboard" and region name, so 001's e2e region checks
  continue to pass. The `placeholder_fretboard` message is removed from the catalog, and
  `tests/unit/tool-layout.test.ts` is updated to assert the fretboard grid in zone C.
  Fixtures for markers/emphasis/labels/auto-scroll are exercised in Vitest component tests and,
  in e2e, through the test-build-only fixture hook (R-14), never a user-facing route.

## R-14 Test strategy and harness (constitution IV; SC-001–SC-009)

- **Decision**:
  - **Vitest unit (test-first)**: `tests/unit/theory/pitch.test.ts` (+ fast-check properties),
    `tests/unit/instrument/instrument.test.ts`, `tests/unit/notation/notation.test.ts`,
    `tests/unit/fretboard/geometry.test.ts`, `interaction.test.ts`, `description.test.ts`,
    `scroll-animation.test.ts` (injected clock).
  - **Vitest component (jsdom)**: `tests/unit/fretboard/fretboard.test.ts` — renders 138 cells,
    roving tabindex, arrow/Enter/Space behavior, `onactivate` payloads, marker shapes/classes per
    fixture, label mode, description text, live region not populated on first render, thumbnail
    has no cells and is `aria-hidden`.
  - **Playwright e2e** (`e2e/fretboard.spec.ts`, phone + desktop): taps on all 138 cells via
    computed centers (SC-006), between-cell taps, drag ≥ 10 px does not activate, mouse hover hint,
    keyboard flow from Tab, axe on board + expanded description, 200 % text zoom no overlap,
    320–2560 width sweep with only the board scrolling horizontally.
  - **New Playwright project `phone-touch`** (Chromium, 320×640, `hasTouch`, `isMobile`) for
    `e2e/fretboard-touch.spec.ts`: horizontal drag via CDP `Input.synthesizeScrollGesture` scrolls
    only the board (page `scrollX` stays 0), vertical gesture scrolls the page (`scrollY` grows),
    visible-column metric 5–7 at sampled scroll positions (SC-002, SC-005).
  - **Harness (test builds only)**: reuse 001's build-flag pattern (ADR 0004). In `--mode test`
    and dev builds, zone C of `/notes` reads `globalThis.__fmFretboardFixture` (set by Playwright
    `page.addInitScript`) and, when it names an entry of a fixed allow-list in
    `src/lib/fretboard/fixtures.ts` (`all-markers`, `labels-spelled`, `highlight-far`,
    `highlight-split`, `empty`), passes that display model to the fretboard and records
    activations on `globalThis.__fmFretboardEvents`. The read is guarded by the compile-time
    constant `__FM_FAULT_INJECTION__`, so production builds eliminate it; `scripts/
    check-no-fault-hook.mjs` gains the markers `__fmFretboardFixture` / `__fmFretboardEvents`.
    Unknown fixture names are ignored (plain board); nothing from the hook is rendered as HTML.
  - **Screenshots**: `fretboard-grayscale` (all functions × emphasis in grayscale) and
    `fretboard-plain` on phone and desktop, Chromium only, committed baselines.
  - **Timing (SC-007)**: e2e measures key press → `focus-ring` attribute change via
    `requestAnimationFrame` timestamps inside the page; asserts < 100 ms (median of 5).
  - **Smoothness (SC-009)**: Chromium trace during a synthesized horizontal scroll gesture on
    `phone-touch` with 4× CPU throttle; assert no frame > 50 ms (long-animation-frame entries).
- **Rationale**: Covers every acceptance scenario (plan Constitution Check IV maps them) with
  deterministic tools; the fixture hook reuses 001's build-flag pattern (ADR 0004) so nothing
  test-only ships.
- **Alternatives considered**: a test-only route (adapter-static has no clean per-mode route
  exclusion; a prerendered route would ship test code); Storybook (new heavy dev dependency, not in the stack); a public
  demo route (spec forbids); jsdom-only checks for scrolling (jsdom has no layout).

## R-15 Self-hosted font for accidentals and tabular numerals (constitution stack: Fonts; design §3.4; 001 Complexity Tracking)

- **Decision**: Ship a self-hosted **accidentals face**: a subset of *Noto Music* (SIL OFL 1.1)
  containing only U+266D ♭, U+266E ♮, U+266F ♯, U+1D12A 𝄪, U+1D12B 𝄫, committed as
  `static/fonts/fm-accidentals.woff2` (~2 KB) with `static/fonts/OFL.txt`. Declared in
  `global.css` with `@font-face { font-family: 'FM Accidentals'; unicode-range: U+266D-266F,
  U+1D12A-1D12B; font-display: swap; }` and placed first in a new `--font-family-notes` token
  (`'FM Accidentals', var(--font-family-ui)`), so letters and digits keep the system UI face while
  accidental glyphs always come from our file. Numerals use `font-variant-numeric: tabular-nums`
  (supported by SF Pro, Segoe UI, Roboto). The subset is generated by
  `scripts/subset-accidentals-font.mjs` using the dev dependency `subset-font` (MIT,
  harfbuzz-wasm, no Python) from `@fontsource/noto-music` (OFL, dev dependency only; the font file
  is copied, not imported at runtime). Font-src is same-origin (CSP `default-src 'self'` covers it);
  `static/_headers` gets `/fonts/*` immutable caching.
- **Rationale**: System UI fonts do not reliably include ♯ ♭ and almost never 𝄪 𝄫; `unicode-range`
  means the file loads only when an accidental is drawn (none on a plain fretboard in standard
  tuning), so it costs nothing on the home screen budget. Honors 001's promise that fonts land
  with the first slice rendering note names.
- **Alternatives considered**: self-hosting a full UI family (Inter/Noto Sans: +20–40 KB per weight
  on every page for letters the system font already renders well; and Inter lacks 𝄪 𝄫 anyway);
  drawing accidentals as SVG paths (works inside the board but not in HTML text such as the hover
  hint in later tools and the 005 controls; two rendering paths).
- **Constitution**: letters and numerals on the system stack is the stack "Fonts" row as amended
  in constitution 1.2.0 (MINOR), recorded with ADR 0006.

## R-16 Dependencies (constitution X)

- **Decision**: No new runtime dependency. New dev dependencies: `fast-check` (MIT; mandated by the
  stack for property tests, first theory code), `subset-font` (MIT; font build script only),
  `@fontsource/noto-music` (OFL-1.1 font source; dev only, nothing imported at runtime). Bundle
  impact estimate: fretboard + geometry + interaction + notation + pitch ≈ 9–13 KB gzip, inside the
  80 KB initial-JS budget (`check-bundle-size.mjs` enforces; 001 measured ≈ 30–40 KB).
- **Alternatives considered**: d3-scale/gesture libraries (size, unnecessary for linear math and
  three pointer states).

## R-17 Performance (constitution VI; SC-007, SC-009)

- **Decision**: 138 cells + ≤ 138 markers render from keyed `{#each}` blocks; markers are derived
  via a `Map` keyed `"s:f"` (O(n)). Geometry recomputes only on resize/token change. Pointer
  handlers do no layout reads during moves except the cached SVG rect (refreshed on
  `pointerdown`). Scroll stays native/compositor-driven for touch. Lighthouse and the 300 ms
  tool-open budget (`perf.spec.ts`) are rechecked now that zone C draws an SVG.
- **Rationale**: Keeps control→render ≤ 100 ms and smooth scroll on throttled phones.

## R-18 ADRs to record

- `docs/adr/0005-fretboard-as-single-svg-aria-grid.md` — R-04 (SVG + ARIA grid, CSP-driven, no
  HTML overlay).
- `docs/adr/0006-accidentals-font-subset.md` — R-15 (self-hosted accidentals subset, system UI
  face for letters/numerals).
- ADR 0004 (test-only fault injection) is amended in place with a note that the fretboard
  fixture hook follows the same build-flag rule; no new ADR.
