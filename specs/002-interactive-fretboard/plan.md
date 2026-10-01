# Implementation Plan: Interactive Fretboard

**Branch**: `feature/002-interactive-fretboard` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-interactive-fretboard/spec.md`

## Summary

Build the shared fretboard that every study tool draws on: a 6-string, 22-fret, right-handed
guitar in standard tuning (E2 A2 D3 G3 B3 E4), highest string on top, with a narrowing-fret
layout, nut, inlays, fret numbers, string labels, function-coded markers in four emphasis levels,
note-name labels, tap/click and keyboard activation reported as `(string, fret)`, mouse hover
hints, horizontal scrolling that leaves vertical page scroll alone, auto-scroll to highlighted
positions, a text description in a polite live region, and a thumbnail mode used on the home
cards. Zone C of `/notes` and `/triads` shows the plain interactive board until tools 004/005
ship.

Technical approach (details in [research.md](./research.md)):

- **First real `src/lib` modules**: pure pitch arithmetic in `src/lib/theory/pitch.ts` (C4 = 60,
  TM-1/TM-3 table tests + fast-check properties, R-02); the `Instrument` shape and
  `STANDARD_GUITAR` in `src/lib/instrument` (spelled open strings, R-01); a minimal
  `src/lib/notation` (sharps default, ♯ ♭ 𝄪 𝄫 glyphs, catalog-driven spoken forms, R-03).
- **One SVG per board** with an ARIA grid made of SVG `row`/`gridcell` elements and a roving
  tab stop; all geometry via SVG attributes so the existing CSP (`style-src 'self'`, no inline
  styles) holds (R-04).
- **Pure geometry and interaction** (`geometry.ts`, `interaction.ts`): rem-token metrics resolved
  to px at runtime, fret columns 52 → 44 px, fill-container scaling, Euclidean nearest-position
  hit-testing with tie-breaks, a pointer gesture reducer (10 px threshold, multi-touch cancel),
  keyboard moves, auto-scroll/scroll-into-view targets, and an rAF scroll animation with an
  injectable clock (R-05, R-07–R-09).
- **Native scrolling** (`overflow-x: auto`, `overscroll-behavior-x: contain`, `touch-action:
  auto`) plus mouse drag-to-scroll; pinch and page zoom untouched (R-07).
- **Self-hosted accidentals font** — a ~2 KB subset of Noto Music loaded via `unicode-range`,
  finally delivering the font deferred by 001 (R-15).
- **Test-build fixture hook** (same build flag as 001's fault hook) to drive marker, label, and
  auto-scroll fixtures in Playwright without a user-facing demo route (R-14).

**Assumptions recorded** (spec silent or open; most defensible option chosen):

- A position whose marker is `hidden` is *not* announced with its function in its accessible
  name (only non-hidden markers add ", <function>"). Rejected: announcing the function of hidden
  markers, which would leak answers in the Notes tool's hidden mode (FR-4.8) and contradict
  "not drawn".
- Zone C's inline padding drops to 0 on all widths so the board uses the zone's full inner width;
  this is what makes 5–7 columns fit at 320 px (R-05: ≈5.2 at scroll 0, ≈6.4 at max). Rejected:
  shrinking column tokens below the spec's 52/44 px geometry.
- Initial render with highlighted positions counts as a "change" for auto-scroll (a tool opened on
  a high-fret view shows it). Rejected: never auto-scrolling on mount, which would hide the
  highlighted region on first open.
- Letters and digits keep the system UI font with `tabular-nums`; only accidentals come from the
  self-hosted subset (constitution 1.2.0 stack "Fonts" row, ADR 0006). Rejected: a full self-hosted UI family (+20–40 KB
  per weight for no legibility gain; common UI families also lack 𝄪 𝄫).
- Pitch is modelled as an integer with C4 = 60 (MIDI convention). Rejected: frequency floats and
  (pitch-class, octave) pairs (R-02).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) on Node.js 24.21.0 (build/test only, pinned in `mise.toml`); Svelte 5 (runes)

**Primary Dependencies**: Runtime (unchanged): `svelte` 5, `@sveltejs/kit` 2 (`adapter-static`), `@inlang/paraglide-js` 2. New dev-only: `fast-check` (MIT, property tests — mandated by the stack), `subset-font` (MIT, font subsetting script), `@fontsource/noto-music` (OFL-1.1 font source; only the generated subset file ships). Valibot still not needed (no untrusted input parsed in this slice).

**Storage**: N/A — the fretboard keeps per-instance focus/scroll state in memory only; nothing is written to `localStorage`, the URL, or the network.

**Testing**: Vitest (jsdom) for unit + component tests with fast-check properties and an injected clock; Playwright (`phone` 360 px, `desktop` 1280 px, new `phone-touch` 320 × 640 with `hasTouch`/`isMobile`, plus 001's firefox/webkit smoke and `nojs`) with `@axe-core/playwright`, grayscale screenshot baselines, and CDP scroll gestures; Lighthouse CI and `check-bundle-size.mjs`.

**Target Platform**: Last two major versions of evergreen browsers, desktop and mobile; static hosting on Cloudflare Pages.

**Project Type**: Static web application (SvelteKit, fully prerendered) — single project at the repository root.

**Performance Goals**: Tap/key → visible focus change < 100 ms (SC-007); control change → board update ≤ 100 ms; tool open/switch still ≤ 300 ms with the SVG in zone C; smooth native scroll on a 4× throttled phone (no long animation frame > 50 ms, SC-009); initial JS ≤ 80 KB gzip (fretboard + helpers estimated 9–13 KB gzip on top of 001's ≈ 30–40 KB); Lighthouse mobile ≥ 90.

**Constraints**: CSP `style-src 'self'` (no inline `style` attributes in prerendered HTML → geometry via SVG attributes, emphasis via classes); every visual value a token; every string in the catalog; no network after load (font is same-origin and `unicode-range`-gated); 320–2560 px and 200 % text zoom with only the board scrolling horizontally; WCAG 2.2 AA, zero axe violations; works prerendered without JS (board drawn, not interactive).

**Scale/Scope**: 1 board component (2 variants), 138 positions, 5 marker functions × 4 emphasis levels, 4 new `src/lib` modules (~10 source files), ~19 new catalog messages, ~30 new tokens, 2 ADRs, ~8 new unit suites + 2 e2e specs.

All Technical Context unknowns are resolved; every open point is resolved in research.md (R-01–R-18).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check (before Phase 0): **PASS**. Font scope and theory merge-gate scope are settled by
constitution amendment 1.2.0 (MINOR stack change + PATCH gate-scope clarification, made in this
slice's PR with ADR 0006), not by Complexity Tracking.
Post-design re-check (after Phase 1): **PASS** — data-model, contracts, and quickstart introduce
no new deviation; the CSP constraint discovered in design is satisfied by the SVG-attribute
approach (R-04) rather than relaxed.

### I. Musical Correctness (NON-NEGOTIABLE)

- [x] Every pitch shown matches `11-music-theory-reference.md`: positions = open string + fret
  (TM-1.2), octaves change at C (TM-1.3), sharps default exactly as the TM-3 table (R-02, R-03).
- [x] Spelling rule: explicit marker spellings (incl. 𝄪 𝄫) are rendered verbatim by notation; no
  triad spelling logic exists yet, so nothing can re-spell C–E–G♯ as A♭.
- [x] Shapes computed from configured tuning/strings/frets: the board draws from `Instrument`
  data (string count, fret count, open strings), never a fixed diagram (FR-001, data-model §2/§5).
- [x] Theory merge gate (constitution 1.2.0, Principle I "Scope"): this slice introduces only
  pitch arithmetic, so it adds and passes TM-1/TM-3 table tests and pitch fast-check properties;
  the TM-4.2/4.3/5.5/6/7 tables and NFR-9.3 shape properties are added by the triad/CAGED slices
  that introduce the code they test (005, 004-caged) and gate every theory change from then on.
- [x] Notes sounding at calculated pitch: N/A — no sound in this slice (001-mvp/003); the
  `positionPitch` value audio will consume is the one tested here.

### II. On-Device, Static, Private by Design

- [x] All drawing, geometry, and hit-testing run in the browser; server only serves static files.
- [x] No network after load: no new fetches; the accidentals font is same-origin, cached
  immutable, and only requested when an accidental is drawn (quickstart §5 verifies).
- [x] No accounts, identifiers, or personal data — nothing collected.
- [x] No third-party content: font subset is self-hosted; CSP unchanged (`default-src 'self'`).
- [x] No device permissions (no sensors, no vibration, no fullscreen).
- [x] Preferences: N/A — nothing stored (focus/scroll are in-memory per instance).
- [x] Anonymous measurement: N/A — not adopted, nothing added.

### III. Pure Core, Thin Shell

- [x] `src/lib/theory/pitch.ts` is pure; ESLint boundary extended to also forbid `instrument`
  and `notation` imports from theory, and new boundaries for `instrument`, `notation`, and
  shell/routes → theory (contracts/module-api.md).
- [x] One-way flow: tools will pass `DisplayModel` in and get `(string, fret)` out; this slice's
  screens pass none (plain board), fixtures pass static models.
- [x] Tools don't calculate theory or draw: zone C mounts `Fretboard` with `STANDARD_GUITAR`;
  pitch/labels are resolved inside `instrument`/`notation`, drawing inside `fretboard`.
- [x] Handedness/orientation read only in `src/lib/fretboard` (`screenOrder`, keyboard direction
  mapping, R-08); identity in this slice.
- [x] Events in musical terms only: `onactivate({ string, fret })`, no coordinates (contract §2).
- [x] View state outside tool components: no tool view state exists yet; the board's focus stop
  and gesture state are renderer-internal UI state, not tool state. `src/lib/state` arrives
  with 004 (Principle X).

### IV. Test-First for Logic, Tested Behavior for UI

- [x] Test-first modules in scope: theory (`pitch`), instrument, notation, plus fretboard pure
  helpers (geometry, interaction, description, scroll animation) — each suite is written and seen
  failing before its implementation (quickstart §3).
- [x] Every acceptance scenario is automated: US1 1–6, US2 1–5, US3 1–4, US4 1–5, US5 1–6
  (26 scenarios) map to Vitest/Playwright rows in quickstart §3–§4; edge cases (ties, clamping,
  non-primary button, second touch, reduced motion, thumbnail, empty board, 200 % zoom) included.
- [x] TM-9 screenshot fixtures: N/A — TM-9 samples are triad/CAGED views; this slice adds the
  grayscale marker baseline (SC-004) and plain-board baselines that TM-9 will build on.
- [x] Deterministic tests: scroll animation uses an injected `Clock`; touch/scroll via CDP
  synthetic gestures; SC-007 timing measured in-page with median of 5; no audio.
- [x] Bug fixes start with a failing test (standing rule; no bugs carried in).

### V. Accessible by Default (WCAG 2.2 AA)

- [x] Keyboard: single tab stop, arrows move between frets/strings, Enter/Space activate, no
  wrap, no trap, off-screen focus scrolled into view (R-08).
- [x] Focus always visible: explicit focus-ring element, drawn on hidden/unmarked cells and after
  taps (R-06).
- [x] No color-only information: function by shape + size + outline + label (third = filled
  circle with no outline; neutral = light filled circle with a solid outline ring, so the two
  medium circles differ geometrically, not only by fill), emphasis by opacity + size
  (+ elevation stroke); verified by a grayscale screenshot (SC-004). Comparison: N/A (no
  comparison in this slice).
- [x] Touch targets ≥ 44 × 44 CSS px at comfortable size (columns ≥ 44, rows 44; geometry tests).
- [x] Text description: polite live region (not on first render) + visible toggle; accessible
  names per cell (R-11).
- [x] `prefers-reduced-motion` → instant auto-scroll (duration token 0 s); `prefers-contrast:
  more` → contrast variants for wood/line/nut/markers/labels.
- [x] Sound-only information: N/A — no sound.
- [x] Accidentals spoken in full via catalog (`spokenNote`: "F sharp").
- [x] axe zero violations: board, expanded description, thumbnails, light/dark, phone/desktop
  (SC-008).

### VI. Performance Budgets Are Gates

- [x] Home ≤ 3 s + Lighthouse ≥ 90: rechecked with thumbnails (lhci); font not requested on home.
- [x] Tool open/switch ≤ 300 ms: `perf.spec.ts` re-run with the SVG board in zone C.
- [x] Control change → fretboard update ≤ 100 ms: SC-007 in-page timing; keyed rendering (R-17).
- [x] Instrument change ≤ 300 ms: N/A — instrument is fixed in this slice.
- [x] Tap → sound ≤ 100 ms: N/A — no sound.
- [x] Initial JS ≤ 80 KB gzip: `check-bundle-size.mjs`; estimate +9–13 KB.
- [x] Sound not blocking interactivity: N/A — no sound material.
- [x] Smooth scrolling: native compositor scroll + throttled trace check (SC-009); 7 strings/24
  frets/CAGED layers: N/A until those waves, geometry already parameterized.
- [x] Regressions fail the build; no budget raised.

### VII. Design System Fidelity

- [x] Fretboard is the protagonist: zone C, nothing overlaps it; no controls added.
- [x] Simplest state: plain board, no markers, label mode none.
- [x] Note-function code exactly per §3.3 (rounded square / circle / diamond / small outlined
  circle / light circle), sizes largest → smallest as specified.
- [x] Root/third/fifth colors are new reserved tokens used only by marker styles (unit test scans
  for other uses).
- [x] All visual values are tokens (geometry, marker sizes, emphasis factors, colors, durations);
  no literals in components.
- [x] Four emphasis levels only (highlighted, normal, dimmed, hidden).
- [x] Notices: N/A — no notices introduced.
- [x] No rewards, mascots, tutorials; fretboard is stylized (warm wood token, no photo texture).
- [x] 320–2560 px: only the board scrolls horizontally; width sweep + 200 % zoom tests.
- [x] Motion explains change: only auto-scroll animates, within the short token (≤ 300 ms).

### VIII. International From the First Line

- [x] Every new string in `messages/en.json` (19 keys, contract §6), including accessible names
  and description templates with placeholders so word order can change per language.
- [x] Note names only from `src/lib/notation` (labels, string labels, hint, names, description).
- [x] Accidentals as ♯ ♭ 𝄪 𝄫, never `#`/`b` (notation unit test over all 35 spellings).
- [x] Layout: board scrolls under 200 % text; toggle and description wrap; no truncation.
- [x] New language = new catalog file only (spoken-note templates are messages).

### IX. Untrusted Input, Versioned Formats

- [x] Share links / stored preferences: N/A — none parsed or produced in this slice.
- [x] Format versions and link fixtures: N/A — no format exists yet.
- [x] Input-derived content never rendered as HTML: the only new external input is the test-build
  fixture global, which selects from a static allow-list and is absent from production
  (contracts/test-hooks.md, `check-no-fault-hook.mjs`).

### X. Simplicity and Incremental Delivery

- [x] Second slice of wave 001-mvp, shippable alone: tool screens show a real, operable board.
- [x] No speculative abstractions: no `state` store, no tunings catalog, no left-handed code paths;
  `Instrument` is data because the constitution requires shapes from configuration; the one
  `Fretboard` component has two real uses (tool zone C, home thumbnails).
- [x] Runtime dependencies: none added; dev deps `fast-check`, `subset-font` (MIT),
  `@fontsource/noto-music` (OFL, dev-only source) justified in R-16.
- [x] Never blank: invalid/duplicate markers are ignored, taps outside the grid clamp, no
  throws into the UI; prerendered board visible without JS.

### Stack & Workflow gates

- [x] Stack matches the constitution: Inline SVG single shared component, Svelte 5 runes,
  Paraglide, plain CSS tokens, Vitest + fast-check, Playwright + axe, Lighthouse CI; fonts per
  the amended "Fonts" row (self-hosted accidentals subset + system UI stack with tabular numerals).
- [x] Stack change procedure: replacing the font mandate is done by ADR 0006 plus the MINOR
  constitution amendment 1.2.0 (T076), both in this slice's PR.
- [x] Tooling via `mise.toml` unchanged; new packages managed by pnpm (lockfile committed).
- [x] Merge gate: lint (with new boundaries), format, svelte-check, Vitest coverage (theory ≥ 95 %,
  overall ≥ 80 %), Playwright phone/desktop/phone-touch with axe, bundle size, Lighthouse.
- [x] ADRs: `0005-fretboard-as-single-svg-aria-grid.md`, `0006-accidentals-font-subset.md`;
  ADR 0004 amended for the fixture hook (R-18).
- [x] Conventional Commits; branch `feature/002-interactive-fretboard` via PR with preview deployment.

## Project Structure

### Documentation (this feature)

```text
specs/002-interactive-fretboard/
├── plan.md                       # This file
├── research.md                   # Phase 0 output (R-01 – R-18)
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output (validation guide)
├── contracts/                    # Phase 1 output
│   ├── fretboard-component.md    # Props, events, DOM/ARIA, catalog keys, tokens
│   ├── module-api.md             # theory / instrument / notation / fretboard helper APIs + lint boundaries
│   └── test-hooks.md             # Test-build fretboard fixture hook
├── checklists/
│   └── requirements.md           # From /speckit.specify
└── tasks.md                      # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

Existing paths are marked `(edit)`; everything else is new.

```text
package.json                         (edit) dev deps: fast-check, subset-font, @fontsource/noto-music
eslint.config.js                     (edit) boundaries for theory, instrument, notation, shell/routes
playwright.config.ts                 (edit) new `phone-touch` project (320×640, hasTouch, isMobile)
messages/en.json                     (edit) +19 fretboard/notation keys, −placeholder_fretboard
static/
├── _headers                         (edit) /fonts/* immutable caching
└── fonts/
    ├── fm-accidentals.woff2         # generated subset (♭ ♮ ♯ 𝄪 𝄫)
    └── OFL.txt
scripts/
├── subset-accidentals-font.mjs      # regenerates the font subset
└── check-no-fault-hook.mjs          (edit) also rejects fretboard fixture markers
src/
├── app.d.ts                         (edit) __fmFretboardFixture / __fmFretboardEvents globals
├── lib/
│   ├── theory/
│   │   └── pitch.ts
│   ├── instrument/
│   │   └── instrument.ts
│   ├── notation/
│   │   └── notation.ts
│   ├── fretboard/
│   │   ├── Fretboard.svelte         # interactive + thumbnail variants
│   │   ├── types.ts                 # DisplayModel, Marker, NoteFunction, Emphasis, LabelMode
│   │   ├── geometry.ts
│   │   ├── interaction.ts
│   │   ├── scroll-animation.ts
│   │   ├── description.ts
│   │   ├── metrics.ts               # reads rem tokens → FretboardMetrics (DOM side)
│   │   └── fixtures.ts              # test-build-only display models (allow-list)
│   ├── shell/
│   │   ├── ToolPlaceholder.svelte   (edit) zone C renders <Fretboard>; fixture hook (test builds)
│   │   └── ToolCard.svelte          (edit) thumbnail variant inside the card link
│   └── styles/
│       ├── tokens.css               (edit) fretboard geometry, marker, emphasis, color, motion, font tokens
│       └── global.css               (edit) @font-face 'FM Accidentals', .sr-only utility
tests/
└── unit/
    ├── theory/pitch.test.ts
    ├── instrument/instrument.test.ts
    ├── notation/notation.test.ts
    ├── fretboard/geometry.test.ts
    ├── fretboard/interaction.test.ts
    ├── fretboard/scroll-animation.test.ts
    ├── fretboard/description.test.ts
    ├── fretboard/fretboard.test.ts
    ├── reserved-colors.test.ts
    └── tool-layout.test.ts          (edit) zone C asserts the grid
e2e/
├── fretboard.spec.ts
├── fretboard-touch.spec.ts
├── fretboard.spec.ts-snapshots/     # grayscale + plain baselines (generated)
├── home.spec.ts                     (edit) thumbnails
└── nojs.spec.ts                     (edit) prerendered board present
docs/
└── adr/
    ├── 0004-test-only-fault-injection.md        (edit) fixture hook note
    ├── 0005-fretboard-as-single-svg-aria-grid.md
    └── 0006-accidentals-font-subset.md
```

**Structure Decision**: Single static web project at the repository root, continuing the layout
001 established (`src/`, `src/lib/shell`, `src/lib/styles`, `src/routes`, `messages/`, `tests/unit`,
`e2e/`, `scripts/`, `static/`, `docs/adr/` — all exist today). This slice creates the
constitution's `src/lib/theory`, `src/lib/instrument`, `src/lib/notation`, and `src/lib/fretboard`
modules for their first real use, and only those (`state`, `audio`, `link`, `prefs` still wait for
their slices, Principle X). No routes are added; `/notes` and `/triads` gain the board through the
shared `ToolPlaceholder` zone C, and `/` gains thumbnails through `ToolCard`. Unit tests are grouped
by module under `tests/unit/<module>/` (new subfolders), matching the existing `tests/unit` Vitest
include glob.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Zone C inline padding set to 0 (token `--zone-fretboard-padding-inline`), unlike zones B/D/E | Required to fit 5–7 columns at 320 px with the spec's 52/44 px column geometry (R-05 arithmetic: ≈5.2 at scroll 0 with padding 0, ≈4.5 with 001's 16 px padding). | Narrower column tokens: would contradict FR-018's stated geometry; hiding the string-label column: contradicts FR-004. |
