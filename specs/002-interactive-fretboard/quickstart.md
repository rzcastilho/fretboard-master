# Quickstart: Validate the Interactive Fretboard

**Feature**: `002-interactive-fretboard` | **Plan**: [plan.md](./plan.md) |
Contracts: [fretboard-component](./contracts/fretboard-component.md), [module-api](./contracts/module-api.md),
[test-hooks](./contracts/test-hooks.md) | Types: [data-model.md](./data-model.md)

This is a run-and-verify guide. It lists commands and expected outcomes; implementation belongs in
`tasks.md`.

## 1. Prerequisites

```bash
mise install                      # node + pnpm from mise.toml (no global installs)
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
```

## 2. Static gates

```bash
pnpm lint            # incl. new import boundaries (theory/instrument/notation/shell)
pnpm format:check
pnpm check           # svelte-check, --fail-on-warnings
```

Expected: zero errors. A deliberate `import … from '$lib/theory/pitch'` inside
`src/lib/shell/ToolCard.svelte` must fail lint (boundary sanity check; revert after).

## 3. Unit and component tests (Vitest)

```bash
pnpm test:unit --coverage
```

Expected:

| Suite | Proves |
|---|---|
| `tests/unit/theory/pitch.test.ts` | TM-1.3 anchors (E2 = 40, C4 = 60, E4 = 64), B♯/C♭ octave crossing, fast-check octave/pitch-class properties |
| `tests/unit/instrument/instrument.test.ts` | Full TM-3 table (6 × 13), frets 13–22 = 1–10 + octave, string 2 fret 1 = C4, string 6 open = E2 (US1-1…3, SC-001) |
| `tests/unit/notation/notation.test.ts` | Sharps default; ♯ ♭ 𝄪 𝄫 glyphs; spoken "F sharp", "B double flat"; no `#`/`b` |
| `tests/unit/fretboard/geometry.test.ts` | Columns ≥ 44, fret 1 widest/22 narrowest, inlays, fill scale, `nearestPosition` incl. ties and clamping (US3-2), `visibleColumnCount` at 286 px ∈ [5,7] |
| `tests/unit/fretboard/interaction.test.ts` | Gesture reducer (10 px threshold, second pointer, non-primary), keyboard moves/edges (US5-1, US5-2), auto-scroll targets (US4-4) |
| `tests/unit/fretboard/scroll-animation.test.ts` | Injected clock: ≤ 300 ms, 0 ms → instant, cancel |
| `tests/unit/fretboard/description.test.ts` | Order 6→1 then fret, dimmed/hidden omitted, "No positions marked.", open wording, summary prefix |
| `tests/unit/fretboard/fretboard.test.ts` | 138 gridcells, one `tabindex="0"`, names, marker classes per fixture, label mode, Enter/Space → `onactivate`, live region empty on first render, thumbnail `aria-hidden` with no cells (US1-5, US2, US5-3…6) |
| `tests/unit/tool-layout.test.ts` (updated) | Zone C contains the fretboard grid; other zones keep placeholders |
| `tests/unit/reserved-colors.test.ts` | `--color-root/third/fifth` used only by marker styles |

Coverage: `src/lib/theory/**` ≥ 95 % lines and branches; overall ≥ 80 %.

## 4. Browser tests (Playwright)

```bash
pnpm build:test:skew   # test build (fixture + fault hooks enabled) + N+1 build for 001's skew test
pnpm test:e2e
```

Projects: `phone` (360 px), `desktop` (1280 px), new `phone-touch` (320 × 640, `hasTouch`,
`isMobile`), plus 001's `firefox`/`webkit` smoke and `nojs`.

| Spec | Scenario → expected |
|---|---|
| `e2e/fretboard.spec.ts` | `/notes` zone C shows grid "Fretboard" with 138 cells; string 2 fret 1 cell named "C, string 2, fret 1"; inlays and fret numbers 1–22 visible, bold inlay numbers (US1) |
|  | Click every cell center → `__fmFretboardEvents` matches all 138 `(string, fret)` in order (SC-006); click midpoint between two cells → lower fret; click left of open column → fret 0 (US3-2) |
|  | Mouse down + move 12 px + up → no event, `scrollLeft` changed (US3-3); hover shows `.hover-hint` with note name, gone on leave (US3-4) |
|  | Tab from the h1 lands on string 1 open; ArrowRight/Left/Up/Down from string 3 fret 5 → fret 6 / 4 / string 2 / string 4; edges stay; Enter and Space emit; focus ring visible on unmarked cell; key → ring < 100 ms (US5, SC-003, SC-007) |
|  | Fixture `all-markers`: grayscale screenshot matches baseline (US2-1…4, SC-004); `labels-spelled`: labels "E♯", "B𝄫" render with the accidentals font loaded (`document.fonts.check`) (US2-5) |
|  | Fixtures `highlight-far` / `highlight-split` → one auto-scroll to the expected `scrollLeft`; with `emulateMedia({ reducedMotion: 'reduce' })` the target is reached in the first frame (US4-4) |
|  | Desktop at 2560 px: board fills zone C, `scrollWidth == clientWidth` (US4-5) |
|  | Toggle "Show text description" → `aria-expanded="true"`, text "No positions marked." on plain board |
|  | axe: zero violations on `/notes`, `/triads`, home (thumbnails), description expanded, light + dark (SC-008) |
|  | Width sweep 320–2560 and 200 % text zoom: no page horizontal scroll, no overlap; only `.scroller` scrolls |
| `e2e/fretboard-touch.spec.ts` (`phone-touch`) | CDP `Input.synthesizeScrollGesture` horizontal on the board → board `scrollLeft` > 0, `window.scrollX` = 0 (US4-1, SC-002); vertical → `window.scrollY` > 0 (US4-2); `visibleColumnCount` ∈ [5, 7] at scroll 0, 25/50/75 %, max (US4-3, SC-005); touch tap → event; two-finger tap → none |
|  | 4× CPU throttle trace while scrolling: no long animation frame > 50 ms (SC-009) |
| `e2e/home.spec.ts` (extended) | Each card contains an `svg.fretboard-thumbnail[aria-hidden="true"]`; Tab order unchanged (one stop per card) (US1-5) |
| `e2e/nojs.spec.ts` (updated) | Prerendered `/notes` shows the drawn board (SVG present) without JS |

## 5. Production-build gates

```bash
pnpm build
node scripts/check-no-fault-hook.mjs build     # also rejects __fmFretboardFixture / __fmFretboardEvents
node scripts/check-bundle-size.mjs build       # initial JS ≤ 80 KB gzip
pnpm lhci                                      # mobile perf ≥ 90, home ≤ 3 s
```

Expected: all pass; `build/fonts/fm-accidentals.woff2` exists and is not requested on `/` or on a
plain `/notes` (no accidentals drawn) — verified in `e2e/fretboard.spec.ts` via request tracking.

## 6. Manual spot check (optional, dev server)

```bash
pnpm dev
```

Open `/notes` on a phone-sized window: drag the board sideways (page stays), drag vertically (page
scrolls), Tab in and use arrows; open `/` and see the two card thumbnails.
