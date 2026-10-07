# Research: Themes, Motion, and Print

Phase 0 output for [plan.md](./plan.md). Every Technical Context unknown is resolved here. Each
item states the decision, why, and the alternatives considered. Facts about the current code
were read from the repository on 2026-10-06.

## Starting point (what ships today)

- `src/lib/styles/tokens.css` has a light `:root` block, a `@media (prefers-color-scheme: dark)`
  block, a `@media (prefers-contrast: more)` block that maps the board to the system `Canvas`
  colour, a one-line `forced-colors` block and a `prefers-reduced-motion` block that zeroes the
  four durations. There is no user pin and no print rule.
- The fretboard uses both board tokens (`--color-fretboard-wood`, `--color-fretboard-line`,
  `--color-nut`, `--color-inlay`, `--color-root|third|fifth`, …) **and** surface tokens
  (`--color-text`, `--color-text-muted`, `--color-surface-raised`) for numbering, comparison
  outlines, arrows, arrow labels, triad-layer outlines, the extra dot, octave badges, the
  highlight drop-shadow and `--connection-ring`. The light theme draws a light board.
- `src/lib/prefs/schema.ts` is the v1 record codec with the "stored only when non-default"
  pattern; `src/lib/state/preferences.svelte.ts` restores every store at `init` (hooks.client).
- Motion: `tokenDuration()` (`src/lib/fretboard/motion.ts`), `animateScroll()` with an
  injectable `Clock` (`scroll-animation.ts`), markers keyed by `pulse.id ?? mk.id ?? position`
  and moved by a CSS `transform` transition (ADR 0010), a staggered `appear` reveal for CAGED
  layers, comparison fades, and the `marker-pulse` keyframes (suppressed under reduced motion).
- Tests already provide WCAG contrast, Machado 2009 CVD matrices and CIEDE2000
  (`tests/unit/a11y/color.ts`), a CVD palette test that parses `tokens.css`
  (`palette-cvd.test.ts`) and a reserved-colour scan (`reserved-colors.test.ts`).
- CSP (`svelte.config.js`): hash mode, `script-src 'self'`, `style-src 'self'`; styles are
  inlined (`inlineStyleThreshold: Infinity`). Initial JS was 134.0 KB gzip of a 136 KB cap at
  the end of slice 025.

---

## R-01 Theme mechanism: one attribute, `color-scheme`, and `light-dark()`

- **Decision**: The effective theme is driven by `color-scheme` on `:root`:
  `:root { color-scheme: light dark }` (follow device), `:root[data-theme='light'] {
  color-scheme: light }`, `:root[data-theme='dark'] { color-scheme: dark }`. Every
  surface/chrome colour token is written once as `light-dark(<light>, <dark>)`. The
  `@media (prefers-color-scheme: dark)` block is removed. The pin is the single
  `data-theme` attribute on `<html>`, absent for Follow device.
- **Rationale**: One declaration per token (no duplicated dark block that can drift). The
  document's `color-scheme`, and therefore native controls and scrollbars, matches the
  effective theme by construction (FR-007). Following the device stays pure CSS, so it is live
  without JS (FR-002) and works with JavaScript off. `light-dark()` ships in every evergreen
  browser since Chrome 123, Firefox 120 and Safari 17.5. That meets "last two major versions".
- **Risk and check**: if the build's CSS minifier down-levels `light-dark()` into its
  `--lightningcss-light/dark` polyfill, the pin must still work. The e2e theme spec checks
  computed colours for *pinned dark on a light device* and the reverse against the production
  build, which catches a broken polyfill. Fallback if it fails: raise `build.cssTarget` so no
  polyfill is emitted, or, as a last resort, keep two blocks (`:root[data-theme='dark']` and
  `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`) and add a unit test
  that asserts they are identical.
- **Alternatives**: (a) duplicate dark blocks for the media query and the attribute. This works
  everywhere but two copies drift, so it is kept only as the fallback. (b) A JS-only class on
  `<html>`. It breaks no-JS and needs JS to follow live device changes. (c) Separate theme
  stylesheets. They would need extra requests and CSP entries.

## R-02 No flash on first paint without inline script

- **Decision**: Add a tiny classic script, `static/theme-boot.js` (served as `/theme-boot.js`,
  about 300 B), referenced from `src/app.html` with a plain `<script src>` in `<head>`, after
  `%sveltekit.head%`. It is parser-blocking, so it runs before first paint. It reads
  `localStorage['fretboard-master:prefs']` inside `try`, parses the JSON, and sets
  `document.documentElement.dataset.theme` only when `theme` is exactly `'light'` or `'dark'`.
  It never writes storage, and any error leaves the attribute absent (Follow device). It is
  ES2015 with no imports. `static/_headers` gives it `Cache-Control: no-cache`, because its
  name is not content-hashed.
- **Rationale**: `script-src 'self'` already allows a same-origin file, so the CSP is not
  relaxed and no inline hash is added (FR-007). Hydration happens later than first paint, so
  only a blocking script avoids the flash. The script is counted by
  `scripts/check-bundle-size.mjs`, which sums every `<script src>`, so the budget stays honest.
- **Contract test**: a unit test runs the file in a `node:vm` context with fake
  `localStorage` and `document`. It asserts the key equals `PREFS_KEY` and that the accepted
  values equal the schema's `THEMES`. It also checks the garbage, oversize and throwing-storage
  cases. This keeps the boot script in lockstep with the codec without importing it.
- **Alternatives**: (a) an inline script with a CSP hash, which the spec forbids. (b) a cookie
  plus server rendering, which the static host does not allow (Principle II). (c) applying the
  pin in `hooks.client` `init`, which runs after the prerendered HTML paints, so the flash
  would remain. (d) a Vite-hashed module: `app.html` cannot reference Vite assets, and a module
  script is deferred, so it would not block paint.

## R-03 Theme choice store and persistence

- **Decision**: Add `src/lib/state/theme.svelte.ts` with `choice: 'device' | 'light' | 'dark'`,
  plus `start(stored)`, `choose(choice)` and `restore(null)`. `choose` sets or removes `data-theme`
  on `document.documentElement` synchronously, then calls
  `preferences.remember({ theme: choice === 'device' ? null : choice })`. In the codec
  (`src/lib/prefs/schema.ts`), `theme: v.fallback(v.nullable(v.picklist(THEMES)), null)` is
  serialized last, after `cagedNote`, and only when non-null. `PREFS_VERSION` stays 1.
  `preferences.start()` calls `theme.start(p.theme)`, which only syncs the store with the
  attribute that the boot script already set. `preferences.erase()` calls
  `theme.restore(null)`, which removes the attribute.
- **Rationale**: This follows the language and notation pattern (ADR 0013, 0019, 0020).
  Records of users who never pin stay byte-identical. An invalid value falls back on its own
  without touching the other fields (Principle IX). When storage fails, `remember` is
  fire-and-forget and the attribute keeps the choice for the session (FR-005). Share links
  never read this store (FR-006).
- **Other tabs**: no `storage` event listener (spec default). A tab picks the pin up on its
  next load.
- **Alternatives**: (a) a separate storage key, which breaks the single-record design and
  Erase. (b) bumping the format version, which is not needed for an additive optional field.

## R-04 Theme choice UI placement

- **Decision**: Add a new `src/lib/shell/ThemeSelector.svelte`. It is a `<fieldset>` with a
  `<legend>` and three native radio inputs (Follow device, Light, Dark), the current one checked,
  all text from the catalog, and a 44 px minimum target. It is rendered:
  - inside `LanguagePanel.svelte` (zone-A disclosure on tool screens and About), after
    `NotationSelector`, which makes two activations;
  - in `HomeScreen.svelte`'s top zone beside `LanguageSelector`, which makes one activation.

  The catalog strings for the disclosure button and region are renamed in value (keys kept) to
  "Language and appearance" (en), "Idioma e aparência" (pt-BR) and "Idioma y apariencia" (es).
- **Rationale**: Native radios give arrow-key movement, the checked state and the group name
  for free (FR-003, US1-9). Reusing `src/lib/tools/ChoiceGroup.svelte` was considered: if its
  props fit (label, options, value, onchange) it is reused, otherwise the plain fieldset is
  smaller than adapting it. Either way no new abstraction is added.
- **Alternatives**: a `<select>` takes two activations on Home (open, choose). A toggle button
  cannot express three states.

## R-05 Shared fretboard palette (on-board tokens)

- **Decision**: Introduce fretboard-scoped tokens `--fb-color-*` in a dedicated `:root` block,
  "Fretboard palette — identical in light and dark", using literal hex values only:
  `wood`, `edge`, `line` (strings and frets), `nut`, `inlay`, `number`, `number-strong`,
  `root`, `third`, `fifth`, `neutral`, `neutral-stroke`, `degree-stroke`, `label`,
  `label-on-neutral`, `outline` (comparison dashes, triad-layer outline, arrows, extra dot,
  connection ring), `arrow-label-halo`, `note-highlight`, `note-highlight-label`,
  `octave-tone-1…7`, `region-band`, `elevation`. Every on-board rule in `Fretboard.svelte`, and
  the legend glyph in `MarkerSample.svelte`, switches to these tokens. Surface tokens
  (`--color-text`, `--color-text-muted`, `--color-surface-raised`) are no longer referenced
  inside the board SVG. The old `--color-root|third|fifth|fretboard-*|nut|inlay|…` names are
  removed rather than aliased, so a stray use fails the scan.
- **Values** (starting point; final values are whatever passes the automated checks in R-07):
  board `#2b2018` (warm, dark), edge `#a08a6c`, lines `#8c7a60` (about 3.5:1, below every
  marker), nut `#d8cdb8`, root `#ff8a80`, third `#80b8f2`, fifth `#8fe3b4`, labels `#14100c`,
  neutral fill `#2b2018` with stroke `#e8e0d2`.
  - Board boundary: the board tone itself is ≥ 3:1 against the light surface. Against the dark
    surface `#101317` the tones are too close, so a 1-unit `--fb-color-edge` outline on the
    wood rectangle gives the ≥ 3:1 boundary.
- **Dimmed markers**: with the board above, `--emph-dim-opacity: 0.4` composites the root
  marker to about 2.2:1, below the 3:1 floor. The dimmed opacity rises to about **0.6** (still
  below 1, and size stays at `--emph-dim-scale`), so dimmed shapes clear 3:1. Composite maths
  uses straight sRGB alpha blending, as browsers do.
- **Rationale**: Design §3.2 asks for "the same contrast in both themes". Identical literal
  values make SC-002 a token equality check. Removing surface tokens from the board is what
  makes "every on-board colour computes identically" true.
- **Alternatives**: keep two board palettes, which the spec rejects. Alias the old names to the
  new ones: it hides misuse and keeps dead names.

## R-06 Higher-contrast variant and forced colors

- **Decision**: `@media (prefers-contrast: more)` keeps adjusting surface tokens (with
  `light-dark()` for both themes) and gets its own `--fb-color-*` overrides, still literal hex
  and identical for both themes. The board deepens to about `#1c140e`, the markers and lines
  lighten to ≥ 4.5:1, labels are ≥ 7:1 against their fill, `--emph-dim-opacity` rises to about
  0.8, and strokes stay at least as wide as before (the existing 3 px and 4 px). The mapping
  to `Canvas` / `CanvasText` is removed from this block. `@media (forced-colors: active)` gets
  those system-colour mappings instead (board `Canvas`, lines, outlines and strokes
  `CanvasText`), so forced colours win (FR-016).
- **Rationale**: NFR-3.7 asks for a warm, dark board in both themes. System colours are
  reserved for forced colours (spec clarification).
- **Alternatives**: keep `Canvas`. The board would turn white in light high contrast and black
  in dark, which breaks "shared by both themes".

## R-07 Automated colour verification

- **Decision**: Extend the existing helpers. Add a small tokens parser,
  `tests/unit/a11y/tokens.ts`, that extracts the `--fb-color-*` literals from the shared,
  contrast-more and print blocks, and both arms of every `light-dark()` surface token. Tests:
  - `palette-contrast.test.ts` covers every FR-013 / FR-014 / FR-015 / FR-028 threshold. It
    includes "lines < min(normal marker)" and dimmed composites at the block's
    `--emph-dim-opacity`.
  - `palette-cvd.test.ts` is rewritten to cover the standard, contrast-more and print
    palettes, with every pair ΔE2000 ≥ 10 under full-severity protan, deutan and tritan.
  - `reserved-colors.test.ts` is updated to the new names: role tokens may appear only in the
    `Fretboard.svelte` marker-fill rules and in `MarkerSample.svelte`, and the error-red token
    must not appear in `Notice` or any normal notice.
  - `theme-tokens.test.ts` asserts that no `--fb-color-*` value contains `light-dark(`, `var(`
    or a system colour outside the forced-colors block.
  - e2e `theme.spec.ts` asserts computed fills of the board, lines, numbers, markers, labels,
    outlines, arrows, rings and the region band are equal in light and dark, on Notes, Triads
    (comparison on) and CAGED (layers on).
- **Rationale**: Token-level tests are deterministic and fast. The e2e equality check catches
  any remaining surface-token leak. axe in CI catches DOM text contrast.

## R-08 Motion: one renderer reconciliation driven by a change kind

- **Decision**:
  - Add a pure classifier per tool, `motionKind(prev, next)`, in the tool's `*-view.ts` module.
    It returns `'slide' | 'by-role' | 'cross-fade' | 'focus' | 'reveal' | 'none'`, and
    returns `'none'` whenever the instrument, labels, notation, language or fit mode changed,
    or when the view is newly opened. Tool stores attach it to the display model as
    `DisplayModel.motion?: MotionKind`.
  - Add a pure `reconcileMarkers(prevKeyed, nextMarkers, kind)` in
    `src/lib/fretboard/transition.ts`. It returns the keyed list that `Fretboard.svelte`
    iterates, plus a per-marker `enter`/`exit` mode:
    - `slide`: per string, old and new are sorted by fret and paired by index. A new marker
      inherits its partner's key, so the existing CSS transform transition slides it along its
      string. Unpaired markers fade in or out over `--duration-short`.
    - `by-role`: the key is the marker `id` (role-stable, ADR 0010). A role whose string
      changed gets a fresh key, so it fades out and in. An unchanged role keeps key and
      position, so nothing animates. Comparison markers are keyed so that they enter at the
      base note's position and transition to their own fret, with outlines and arrows fading.
    - `cross-fade`: every new key is fresh (generation suffix). The old set fades out and the
      new set fades in over `--duration-short`, concurrently, so both sets are partly visible
      at the midpoint.
    - `reveal`: the existing `appear` stagger. It ends by `--duration-short` because the delay
      is `appear × (short − fast)` plus `fast`. Turning a layer off fades its markers out
      together over `--duration-short`.
    - `focus`: emphasis changes through the existing opacity transition, which moves from
      `--duration-medium` to the marker group. The keyed auto-scroll uses `--duration-medium`
      and is skipped when the region is already fully in view.
    - `none`: keys are kept, and the SVG gets `data-motion="none"`, which sets
      `transition: none` on markers, so tool switch, instrument, tuning, handedness,
      orientation, language, notation, labels, fit and theme are instant (FR-027).
  - `data-motion` holds the latest change's kind, so the transition CSS always matches the
    most recent update. No timers are needed.
- **Mid-transition behaviour**: CSS transitions retarget from the current computed value, and
  Svelte intro/outro transitions reverse from their current `t`. A new change therefore starts
  from the drawn position with no jump and ends in the latest state (FR-023).
- **State first**: the model, description, focus and share link update synchronously. Only the
  drawn transform and opacity lag, so no state waits for an animation.
- **Reduced motion**: the tokens are already `0s`, and `tokenDuration()` returns 0. Svelte
  fades keep the existing 1 ms floor (the keyed-each workaround), which is visually instant.
  `animateScroll(…, 0)` jumps, so the region is still brought into view. The pulse keyframes
  are already off. The `highlighted` emphasis still comes from `applyPulses`, including when
  muted, which is verified by test (FR-025).
- **Rationale**: One reconciliation point keeps tools free of drawing (Principle III). The
  pairing rule is pure and table-testable. Reusing CSS transitions (ADR 0010) adds almost no
  JS.
- **Alternatives**: (a) per-tool marker ids encoding the pairing. Each tool would re-implement
  the rule, and ids would leak motion into theory-adjacent code. (b) a JS tween engine, which
  costs more bytes for the same result. (c) Web Animations API timelines, which give no
  benefit over CSS transitions here and are harder to test in jsdom.

## R-09 Motion verification with an injectable clock

- **Decision**: Unit-test `reconcileMarkers` and the `motionKind` tables in the node
  environment. Component tests (jsdom) assert keys, `data-motion` and transition parameters
  through the existing `Clock` seam for scroll. e2e (`motion.spec.ts`, desktop) samples
  `getComputedStyle(marker).transform` and `opacity` with `page.clock` to check the start
  state, the midpoint (cross-fade: both opacities strictly between 0 and 1) and the end state
  at or before the limit. A rerun with `reducedMotion: 'reduce'` asserts the final values on
  the next frame.
- **Rationale**: Principle IV requires determinism. `page.clock` controls rAF and timers, and
  CSS transitions are sampled at fixed instants.

## R-10 Print: stylesheet, palette and complete content

- **Decision**:
  - **Palette**: an `@media print` block in `tokens.css`, placed last so it beats the contrast
    and forced-colours blocks. It sets `:root { color-scheme: light }` (surfaces resolve to
    their light arms) and overrides every `--fb-color-*` with the print palette: board
    `#fbf8f2`, lines, nut and numbers about `#3d3428`, edge `#3d3428`, darker role hues (root
    about `#a3241c`, third `#0b4f96`, fifth `#146c3e`), white labels, neutral `#ffffff` with a
    `#3d3428` stroke, and `--emph-dim-opacity` high enough for dimmed ≥ 3:1. The svg gets
    `print-color-adjust: exact`. Board and markers are SVG fills, not CSS backgrounds, so they
    print with "background graphics" off.
  - **Omit**: chrome elements carry `data-print="omit"`: the nav bar and app-bar buttons
    (share, instrument, sound, stop, notation), the language/appearance disclosure, the
    zone-B controls, notices, the minimap, the instrument and sound panels and the landscape
    sliding panel. `global.css` hides them under `@media print`.
  - **Show**: the context description (today `.sr-only` inside the fretboard) and the legend
    carry `data-print="show"`, which `@media print` un-hides as visible text. Content that is
    not in the DOM on screen (a collapsed zone D on narrow, a closed legend) is rendered while
    `print.active` is true.
  - **Print store**: `src/lib/state/print.svelte.ts` holds `active`, set from
    `matchMedia('print')` change events and `beforeprint` / `afterprint`, and flushed
    synchronously so the print snapshot contains it.
- **Rationale**: These are the browser's own print and save-as-PDF paths (A-13). No dialog and
  no export (FR-033). A data attribute keeps the omit list declarative and testable. Chrome,
  Firefox and Safari all fire `beforeprint`. Playwright's `emulateMedia({ media: 'print' })`
  fires the `matchMedia` change, which makes the path testable.

## R-11 Print layout: the whole neck on one page, labels ≥ 7 pt

- **Decision**: While `print.active` is true, `Fretboard.svelte` lays out with
  `layoutFretboard(…, PRINT_INLINE_PX, …, 'whole')`. That ignores the screen's fit,
  container width and scroll. `PRINT_INLINE_PX` is read from a new token,
  `--print-board-inline: 190mm`, about 718 CSS px: A4 portrait printable width at default
  margins, the narrowest supported page. US Letter portrait (about 739 px) and both landscapes
  are wider.
  - The SVG prints at `inline-size: 100%`, `block-size: auto`,
    `max-block-size: var(--print-board-max-block)` (about 55vh, so heading, tuning,
    description and legend fit on one landscape page) and `break-inside: avoid`. The scroller
    becomes `overflow: visible`. The rendered scale is therefore ≥ 1 against the viewBox.
  - Under `@media print`, marker labels, string and fret numbers use
    `font-size: max(<screen size>, var(--print-text-min))` with `--print-text-min: 7pt`, in
    viewBox units. Because the scale is ≥ 1, printed text is ≥ 7 pt.
- **Feasibility** (7 strings, 24 frets, A4 portrait): the natural width is about 1,200 px. At
  718 px the column scale is about 0.58 and the narrowest column about 25.5 px, so
  `markerScale` is about 0.71 and the smallest marker about 17 px. A 9.33 px (7 pt) label of
  up to two graphemes fits. Rows stay 44 px, so the board is about 330 px tall and fits under
  heading, tuning, description and legend.
- **Alternatives**: (a) CSS-only scaling of the on-screen SVG. The print would depend on the
  screen fit mode and container width, which violates FR-028/FR-030 ("same whatever fit/layout").
  (b) A separate print-only fretboard instance always in the DOM, which doubles DOM cost on
  every view (Principle VI scrolling smoothness). (c) Forcing landscape with `@page { size }`,
  which the spec rejects.

## R-12 Notices and error red

- **Decision**: No new notice is added. The existing `Notice.svelte` already uses the
  `--color-notice-*` tokens, which are neutral and not error red. The reserved-colours test
  gains an assertion that no notice component references an error or danger token, and that
  no `--color-error` exists outside the failure view. `light-dark()` conversion keeps both
  values.
- **Rationale**: FR-011 is existing behaviour, verified rather than rebuilt.

## R-13 Bundle budget

- **Decision**: Measure first (`node scripts/check-bundle-size.mjs build`). Estimated
  additions:
  | Addition | Estimate |
  |---|---|
  | `theme-boot.js` | 0.3 KB |
  | theme store, selector and catalog keys | 0.8 KB |
  | `transition.ts` reconcile and `motionKind` | 1.0 KB |
  | print store and print layout branch | 0.3 KB |
  | **Total** | **≈ 2.4 KB** |

  The headroom is about 2 KB. Trim inside the slice before anything else:
  - write the radios as plain markup, not a new generic component;
  - share one `motionKind` helper that compares a list of field names;
  - delete code paths this slice replaces (the contrast-more `Canvas` branches in
    `Fretboard.svelte`'s `<style>` are CSS and cost nothing, but any JS left only for the old
    light board goes).

  CSS is inlined in HTML and does not count. If the build is still over 136 KB after trimming,
  the slice stops and records the gap. FR-033 forbids raising the cap within this spec, so the
  amendment would be a separate decision.
- **Rationale**: Principle VI is a gate, and the spec explicitly keeps 136 KB.

## R-14 Screenshot baselines and fixtures

- **Decision**: The light-theme board changes from light to dark, which is an intended visual
  change. Regenerate (never delete) the existing snapshots under `e2e/*-snapshots/`:
  `fretboard`, `notation`, `notes-tm9`, `triads-tm9`, `caged-tm9`, `playback`,
  `triads-compare` and `responsive-layout`. Regenerate them for the phone, phone-touch and
  desktop projects only, filtered with `-g` per the verification tiers. Add new snapshots for
  the dark theme, contrast-more and print (CAGED, Triads with comparison). Link-compatibility
  fixtures are untouched (no link change).
- **Rationale**: Principle IV keeps the TM-9 fixtures, and the spec requires regeneration, not
  removal.

## R-15 ADRs

- **Decision**: Two new ADRs written during implementation:
  - `docs/adr/0024-theme-pin-boot-script-and-shared-board-palette.md` covers R-01, R-02, R-05
    and R-06.
  - `docs/adr/0025-change-kind-motion-and-print-layout.md` covers R-08 and R-11.
- **Rationale**: These are cross-cutting decisions (a CSP-relevant static script, token
  architecture, renderer reconciliation), which the constitution requires to be recorded.
