---

description: "Task list for 025 Minimap, Fit to Screen, and Landscape"
---

# Tasks: Minimap, Fit to Screen, and Landscape

**Input**: Design documents from `/specs/025-minimap-fit-and-landscape/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pure-api.md, contracts/ui.md, quickstart.md

**Tests**: INCLUDED. Constitution IV (test-first) and plan.md require pure modules and stores built test-first and every acceptance scenario mapped to a Vitest or Playwright test (quickstart.md §3).

**Organization**: Grouped by user story. US1/US2 are P1, US3/US4 are P2, US5 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5; none for Setup, Foundational, Polish
- Paths are repo-root relative (single SvelteKit project)

## Verification (CLAUDE.md tiers — keep local runs targeted)

- Per task: `pnpm vitest run <touched test paths>`. Component tests start with `// @vitest-environment jsdom`.
- E2E per checkpoint: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files>` (desktop only).
- New/changed screenshots: `pnpm playwright test <spec> -g "<name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`.
- End of slice, once: `pnpm verify`. Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.
- No `@media (orientation: …)` in `src/` (breaks `presentation-boundary.test.ts`); landscape is JS (`isPhoneLandscape`).

---

## Phase 1: Setup

**Purpose**: Baseline, catalog keys, tokens

- [X] T001 Measure bundle baseline: `pnpm build && node scripts/check-bundle-size.mjs build`; record the gzip size and headroom in specs/025-minimap-fit-and-landscape/research.md under R-14
- [X] T002 [P] Add the 16 catalog keys of data-model.md §8 (`fit_to_screen`, `minimap_label`, `minimap_value`, `fit_small_notice`, `fit_use_comfortable`, `panels_open`, `panels_close`, `panels_region`, `context_show`, `context_hide`, `summary_separator`, `summary_note_separator`, `summary_all_shapes`, `summary_shape`, `summary_positions` with plural forms, `summary_no_notes`) to messages/en.json, messages/pt-BR.json and messages/es.json in the same change; verify with `pnpm vitest run tests/unit/i18n/catalogs.test.ts`
- [X] T003 [P] Add tokens (`--minimap-row`, `--minimap-dot`, `--side-panel-max`, edge-fade width) to src/lib/styles/tokens.css; keep existing media-query grid rules as no-JS fallback

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure modules and stores every story uses. Test-first: write each test, see it fail, then implement.

**⚠️ CRITICAL**: No user story starts until this phase is complete

- [X] T004 [P] Write failing tests for `layoutFretboard` `fit` param, `naturalWidth`, `markerScale` using the fixtures in contracts/pure-api.md (24 frets/320 comfortable → 1220, scale 1, scrolls; whole → scale ≈ 0.2475, scrolls false; 24/1400 whole stretches; 12/1008 → 644 ± 1; `fit` ignored for thumbnail/preview) in tests/unit/fretboard/geometry.test.ts
- [X] T005 Implement `FitMode`, `fit` parameter (default `'comfortable'`), `naturalWidth` (independent of container and fit) and `markerScale = min(1, narrowestColumn / metrics.markerRoot)` in src/lib/fretboard/geometry.ts; keep handedness inside geometry only (depends on T004)
- [X] T006 [P] Write failing tests for `visibleFretRange`, `minimapWindow`, `minimapTapScroll`, `minimapKeyScroll` with the required cases of contracts/pure-api.md (far-end tap → `layout.width − viewportWidth`; mirrored tap at x = 0 → 0; middle tap centres; edge clamps; ArrowRight at max no overshoot; mirrored Home → max; 24 frets/320 at scroll 0 → `{first:1,last:≈5,count:24}`; max scroll → last 24) in tests/unit/fretboard/minimap.test.ts
- [X] T007 Implement src/lib/fretboard/minimap.ts exporting `FretRange`, `MinimapWindow`, `MinimapKey` and the four pure functions per data-model.md §3 (depends on T005, T006)
- [X] T008 [P] Write failing tests for `reducePinch` (1 finger never emits; 2 fingers to 79% → one `in`; continue to 40% → nothing; lift all then 126% → one `out`; 2→3 fingers resets; 90% then 100% → nothing) in tests/unit/fretboard/pinch.test.ts
- [X] T009 Implement src/lib/fretboard/pinch.ts: `PINCH_IN_RATIO = 0.8`, `PINCH_OUT_RATIO = 1.25`, `PinchState`, `PinchEvent`, `PinchEffect`, `reducePinch` per data-model.md §4 (depends on T008)
- [X] T010 [P] Write failing tests for `isPhoneLandscape` ((844,390) true, (1024,768) false, (390,844) false, (500,499) true, (499,499) false) and the `arrangementFor` table of data-model.md §5 (1440/24 → wide-stacked; 1440/12 → wide-side; 2560/24 → wide-side; 1024/24 → wide-stacked; 844×390 → landscape; 1024×768 → wide-stacked; 390×844 → narrow; 800×1280 → medium; 1440/24 at 32 px root → wide-stacked) in tests/unit/layout.test.ts
- [X] T011 Implement src/lib/shell/layout.ts: `NARROW_MAX = 599`, `MEDIUM_MAX = 1023`, `LANDSCAPE_MAX_HEIGHT = 499`, `Arrangement`, `LayoutChrome`, `isPhoneLandscape`, `wideLeftColumn`, `arrangementFor` (depends on T010)
- [X] T012 [P] Add `FitEvent` (`overflow` | `request` | `small-tap`) and `FretboardProps.fit` / `onfit` to src/lib/fretboard/types.ts (no screen coordinates in events)
- [X] T013 [P] Write failing tests for the fit store transitions of data-model.md §1 (default comfortable; `toggle` only when available; `request` no-op when unavailable or same mode; `setOverflow` keeps mode; `effective`; `smallTap` blocked after dismissal; `acceptNotice` sets anchor and comfortable; `takeAnchor` clears; notice cleared when effective becomes comfortable; `resetFitForTests`) in tests/unit/state/fit.test.ts
- [X] T014 Implement runes store src/lib/state/fit.svelte.ts per contracts/pure-api.md (`mode`, `available`, `effective`, `notice`, `toggle`, `handle`, `acceptNotice`, `dismissNotice`, `takeAnchor`, `resetFitForTests`); no storage, no share-link field (depends on T012, T013)
- [X] T015 [P] Implement src/lib/state/viewport.svelte.ts (`width`, `height`, `rootPx`, derived `arrangement` from `arrangementFor` with `neckWidth` from `layoutFretboard(instrument, readMetrics(), 0, 'interactive').naturalWidth`; chrome from tokens; prerender default `{0,0,16}` yields no arrangement; updates on resize, fret-count change, root font size change) (depends on T011)

**Checkpoint**: `pnpm vitest run tests/unit/fretboard/geometry.test.ts tests/unit/fretboard/minimap.test.ts tests/unit/fretboard/pinch.test.ts tests/unit/layout.test.ts tests/unit/state/fit.test.ts` all green

---

## Phase 3: User Story 1 - Know where you are on a long neck (Priority: P1) 🎯 MVP

**Goal**: A scrolling neck shows a minimap (window, highlighted dots, tap/keys to jump), mirrored in left-handed mode.

**Independent Test**: 320 px, 7 strings, 24 frets → comfortable mode, minimap visible; tap far end → fret 24 visible; no minimap where the neck fits.

### Tests for User Story 1 ⚠️ write first, must fail

- [X] T016 [P] [US1] Component test (`// @vitest-environment jsdom`) for Minimap: `role="slider"`, `aria-label`, `aria-valuetext` "Frets {first} to {last} of {count}", dots only for highlighted positions, window rect, no dots when none, ≥ 44 px block size, arrow/Home/End scroll the scroller, mirrored layout in tests/unit/fretboard/minimap-component.test.ts
- [X] T017 [P] [US1] Extend tests/unit/fretboard/fretboard.test.ts: emits `{kind:'overflow', value}` on mount and on change of `naturalWidth > containerWidth`; never emits for thumbnail/preview; Minimap rendered iff interactive and `layout.scrolls`
- [X] T018 [P] [US1] E2E in e2e/minimap-fit.spec.ts: "minimap at 320 with 7 strings", "tap far end shows last fret", dot count equals highlighted count, "window follows scroll", "left-handed mirror" (same fret as right-handed), "keyboard" (arrow moves window, valuetext updates), "reduced motion" (instant jump), no minimap when neck fits (1440 / 12 frets)

### Implementation for User Story 1

- [X] T019 [US1] Create src/lib/fretboard/Minimap.svelte per contracts/ui.md §2: slider div + `aria-hidden` SVG (window rect and dots differ by shape and size, not color alone), tap via `pointerup` without drag (`DRAG_THRESHOLD_PX`) using `minimapTapScroll`, keys via `minimapKeyScroll` (`preventDefault` only for the four keys), window updated on rAF-throttled scroller `scroll`, jump animated `--duration-short` and instant under reduced motion; text from catalog (`minimap_label`, `minimap_value`); tokens only
- [X] T020 [US1] Edit src/lib/fretboard/Fretboard.svelte: render `<Minimap>` directly under the scroller iff `variant === 'interactive' && layout.scrolls`; emit `overflow` events via `onfit`; expose scroller `scrollLeft` to the minimap; focusing the minimap must not move fretboard focus (depends on T012, T019)
- [X] T021 [P] [US1] Wire `onfit={fit.handle}` on the fretboard in src/lib/tools/notes/NotesTool.svelte
- [X] T022 [P] [US1] Wire `onfit={fit.handle}` on the fretboard in src/lib/tools/triads/TriadsTool.svelte
- [X] T023 [P] [US1] Wire `onfit={fit.handle}` on the fretboard in src/lib/tools/caged/CagedTool.svelte

**Checkpoint**: `pnpm vitest run tests/unit/fretboard` then `pnpm build:test && pnpm test:e2e:fast e2e/minimap-fit.spec.ts`; US1 works alone

---

## Phase 4: User Story 2 - Switch between whole neck and comfortable size (Priority: P1)

**Goal**: Fit to screen button and pinch toggle whole ↔ comfortable; small-fret notice in whole mode.

**Independent Test**: 320 px: button and pinch flip the mode each time; 1440/24: button absent and pinch does nothing.

### Tests for User Story 2 ⚠️ write first, must fail

- [X] T024 [P] [US2] Component test for FitToggle (`aria-pressed` pressed = whole, absent when `fit.available === false`, click toggles, focus stays) in tests/unit/fit-toggle.test.ts
- [X] T025 [P] [US2] Extend tests/unit/fretboard/fretboard.test.ts: whole mode compresses columns with rows kept 44 px and marker scale applied (labels omitted below 75% scale); `request` emitted on completed pinch (touch events); `small-tap` after `onactivate` only when `fit==='whole'` and narrowest column < `--target-min`; scroller `touch-action: pan-x pan-y`
- [X] T026 [P] [US2] E2E in e2e/minimap-fit.spec.ts: "fit to screen" (whole visible, minimap gone, button pressed), "return keeps highlighted region", "small-fret notice" (nearest position selected, one-line dismissible notice), "accept notice centres tap", "dismissed notice not repeated until mode change", "mode persists across tools and resize"
- [X] T027 [P] [US2] E2E pinch in e2e/fretboard-touch.spec.ts ("pinch toggles fit", phone-touch project, CDP touch; CI only, no-op at 1440/24; one-finger scroll never toggles)

### Implementation for User Story 2

- [X] T028 [US2] Edit src/lib/fretboard/Fretboard.svelte: pass `fit` to `layoutFretboard`; scale markers by `markerScale`; omit marker labels when scale < 0.75 (description unchanged); passive touch listeners feeding `reducePinch` and emitting `request` (in → `whole`, out → `comfortable`); emit `small-tap` after `onactivate`; set `touch-action: pan-x pan-y` on the scroller; nearest-position tap resolution in narrow frets (depends on T009, T014, T020)
- [X] T029 [US2] Scroll anchor rule in src/lib/fretboard/Fretboard.svelte: after any layout change keep highlighted (or CAGED-focus) groups visible, else keep the nut offset; consume `fit.takeAnchor()` to centre the accepted position, clamped (FR-013)
- [X] T030 [P] [US2] Create src/lib/tools/FitToggle.svelte per contracts/ui.md §3 (button, `aria-pressed`, text `fit_to_screen`, not rendered when unavailable)
- [X] T031 [P] [US2] Create src/lib/tools/FitNotice.svelte wrapping src/lib/shell/Notice.svelte: `role="status"`, `fit_small_notice`, action `fit_use_comfortable`, Dismiss; accept focuses the fretboard cell of the tapped position
- [X] T032 [P] [US2] Pass `fit={fit.effective}` and place `<FitToggle>` first in zone E and `<FitNotice>` in zone C above the fretboard in src/lib/tools/notes/NotesTool.svelte
- [X] T033 [P] [US2] Same wiring (fit prop, FitToggle in zone E, FitNotice in zone C) in src/lib/tools/triads/TriadsTool.svelte
- [X] T034 [P] [US2] Same wiring (fit prop, FitToggle in zone E, FitNotice in zone C) in src/lib/tools/caged/CagedTool.svelte

**Checkpoint**: `pnpm vitest run tests/unit/fit-toggle.test.ts tests/unit/fretboard` and `pnpm build:test && pnpm test:e2e:fast e2e/minimap-fit.spec.ts`; US1 and US2 both pass

---

## Phase 5: User Story 3 - Finish the responsive layouts (Priority: P2)

**Goal**: Narrow, medium, wide-side, wide-stacked arrangements; two-row zone B; collapsed one-line context summary.

**Independent Test**: Element order and placement at 320, 800, 1440 (12 and 24 frets), 2560; no page horizontal scroll.

### Tests for User Story 3 ⚠️ write first, must fail

- [X] T035 [P] [US3] Tests for `joinSummary` / `joinNotes` (catalog separators, empty parts dropped, pt-BR and es) in tests/unit/state/context-summary.test.ts
- [X] T036 [P] [US3] Extend tests/unit/triads, tests/unit/caged, tests/unit/notes view tests with `display.summary` expectations ("A major · 1st inversion · C♯ – E – A" with sharps, solfège variant, "C major · shape A · C – E – G", "all shapes", Notes count / selected position / "No notes selected")
- [X] T037 [P] [US3] Component tests for ContextZone (narrow: summary row + `aria-expanded` button, collapsed default, state shared across tools for the session; medium/wide: no summary, content visible) in tests/unit/context-zone.test.ts
- [X] T038 [P] [US3] Component tests for SidePanels in non-landscape mode (`display: contents`, DOM order E then D, opener hidden) in tests/unit/side-panels.test.ts, and extend tests/unit/tool-layout.test.ts for `data-arrangement` (absent at prerender)
- [X] T039 [P] [US3] E2E in e2e/responsive-layout.spec.ts: "narrow order" (bounding boxes B/C/E/D), "narrow zone B rows" (exactly two rows per tool at 320, strip with cue, no menu), "context summary" (collapse/expand), "medium", "1440 / 24 frets" (wide-stacked, no Fit to screen, no minimap, pinch no-op), "1440 / 12" and "2560 / 24" (wide-side), "1024 / 24" (wide-stacked, minimap shown), "wide threshold keeps state", "no page horizontal scroll" at 320, 600, 1024, 1280, 2560; add "arrangement screenshot" cases

### Implementation for User Story 3

- [X] T040 [P] [US3] Implement src/lib/state/context-summary.ts (`joinSummary`, `joinNotes` using catalog separators)
- [X] T041 [P] [US3] Add `display.summary` (note names only from src/lib/notation) in src/lib/state/triads-view.ts
- [X] T042 [P] [US3] Add `display.summary` in src/lib/state/caged-view.ts
- [X] T043 [P] [US3] Add `display.summary` in src/lib/state/notes-view.ts
- [X] T044 [P] [US3] Create src/lib/state/context-panel.svelte.ts (`expanded`, default false, session only, shared across tools)
- [X] T045 [US3] Create src/lib/tools/ContextZone.svelte per contracts/ui.md §8 (narrow summary row wrapping at 200%, button `aria-expanded`/`aria-controls`, `context_show`/`context_hide`; always expanded elsewhere) (depends on T044)
- [X] T046 [US3] Create src/lib/tools/SidePanels.svelte with non-landscape behaviour per contracts/ui.md §7 (`.panels { display: contents }`, zone E then D in one wrapper, opener hidden); landscape behaviour added in US4 (depends on T038)
- [X] T047 [US3] Edit src/lib/shell/ToolLayout.svelte: write `data-arrangement` from the viewport store after mount; DOM order B, C, Panels opener, panel wrapper (E, D) (depends on T015, T046)
- [X] T048 [US3] Edit src/lib/styles/tokens.css: `[data-arrangement]` grid rules for narrow, medium, wide-side, wide-stacked (table in contracts/ui.md §5); keep the media-query rules as the no-JS fallback
- [X] T049 [P] [US3] Create src/lib/tools/overflow.ts (Svelte action setting `data-overflow` on a row that scrolls) and add `.controls-row` styles with edge-fade cue to src/lib/styles/global.css
- [X] T050 [P] [US3] Split NoteSelector into two `.controls-row` groups of six in src/lib/tools/NoteSelector.svelte
- [X] T051 [P] [US3] Two `.controls-row` groups (root / quality, inversion, string set) in src/lib/tools/triads/TriadsControls.svelte
- [X] T052 [P] [US3] Two `.controls-row` groups (key / quality, shape) in src/lib/tools/caged/CagedControls.svelte
- [X] T053 [US3] Wrap zones E and D in `<SidePanels>` and zone D content in `<ContextZone>` in src/lib/tools/notes/NotesTool.svelte, src/lib/tools/triads/TriadsTool.svelte and src/lib/tools/caged/CagedTool.svelte (normalises CAGED's E-before-D order); update e2e specs that depend on old zone order (e2e/caged.spec.ts, e2e/nojs.spec.ts) (depends on T045, T046, T047)

**Checkpoint**: `pnpm vitest run tests/unit` (touched) and `pnpm build:test && pnpm test:e2e:fast e2e/responsive-layout.spec.ts e2e/caged.spec.ts e2e/nojs.spec.ts`; screenshots updated per CLAUDE.md

---

## Phase 6: User Story 4 - Use the whole screen in landscape (Priority: P2)

**Goal**: Phone landscape arrangement: icon-only bar, one-row strip, fretboard fills the rest, non-modal sliding panel (E then D).

**Independent Test**: CAGED with shape in focus at 844×390: focus unchanged, every portrait function reachable, rotate hint absent.

### Tests for User Story 4 ⚠️ write first, must fail

- [X] T054 [P] [US4] Extend tests/unit/side-panels.test.ts for landscape: closed on entering landscape; opener `aria-expanded`/`aria-controls`; open focuses close button; Escape, close button and opener each close and return focus to opener; no backdrop, no `inert`, no focus trap; leaving landscape while open closes it and moves focus to first focusable in zone E if focus was inside
- [X] T055 [P] [US4] E2E in e2e/landscape.spec.ts: "rotate keeps CAGED focus", "arrangement" (icon-only bar, strip one row tall, Panels at strip end), "sliding panel" (≤ 50% width, board still operable, Escape, focus return), "state survives rotation", "function inventory" (same control names as portrait), "no rotate hint" at 844×390 and hint still shown once at 390×844; 1024×768 not landscape

### Implementation for User Story 4

- [X] T056 [US4] Implement landscape behaviour in src/lib/tools/SidePanels.svelte per contracts/ui.md §7 (opener `panels_open`, close button `panels_close`, `role="region"` with `panels_region`, `hidden` when closed, trailing-edge panel ≤ `--side-panel-max`, own vertical scroll, slide transition none under reduced motion, Escape handler, focus management) (depends on T054)
- [X] T057 [US4] Edit src/lib/shell/ToolLayout.svelte: `data-landscape` on the header iff arrangement is `landscape`; visually hide tool `h1` and zone headings in landscape (kept in accessibility tree)
- [X] T058 [US4] Add landscape grid rules (strip B one row tall + Panels button, C fills remaining height, panel fixed trailing) to src/lib/styles/tokens.css and `.bar-label` tooltip / visually-hidden rules to src/lib/styles/global.css; no `@media (orientation)` in src/
- [X] T059 [P] [US4] Icon + `.bar-label` span (icons `aria-hidden`, accessible name unchanged, tooltip on hover/focus-visible in landscape) in src/lib/shell/AppNav.svelte
- [X] T060 [P] [US4] Same icon + `.bar-label` in src/lib/shell/ShareButton.svelte
- [X] T061 [P] [US4] Same icon + `.bar-label` in src/lib/shell/InstrumentButton.svelte
- [X] T062 [P] [US4] Same icon + `.bar-label` in src/lib/shell/NotationToggle.svelte
- [X] T063 [P] [US4] Same icon + `.bar-label` in src/lib/shell/LanguagePanel.svelte
- [X] T064 [US4] Confirm src/lib/state/rotate-hint.ts is unchanged and still gated on width ≤ 599 and height > width (FR-019); fix only if the new viewport store interferes

**Checkpoint**: `pnpm vitest run tests/unit/side-panels.test.ts` and `pnpm build:test && pnpm test:e2e:fast e2e/landscape.spec.ts`

---

## Phase 7: User Story 5 - Everything works at 200% text size (Priority: P3)

**Goal**: No truncation, overlap or hidden function at 200% text in any arrangement.

**Independent Test**: Root font 200% at 320, 800, 1280, landscape.

- [X] T065 [US5] E2E in e2e/text-zoom.spec.ts (root font 200% via `page.addInitScript`): per arrangement no label/summary with `scrollWidth > clientWidth`, no overlapping bounding boxes among zone children, all controls reachable; "summary wraps" at narrow; live re-evaluation (a neck that fit at 100% shows Fit to screen and minimap at 200%)
- [X] T066 [US5] Fix any wrapping, clipping or overlap found by T065 in src/lib/styles/tokens.css, src/lib/styles/global.css and the affected component styles (depends on T065)

**Checkpoint**: `pnpm test:e2e:fast e2e/text-zoom.spec.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T067 [P] Extend e2e/a11y-audit.spec.ts with axe targets of contracts/ui.md §11 (each tool at narrow collapsed and expanded, medium, wide-side, wide-stacked, landscape panel closed and open, whole mode with notice, minimap focused); zero violations
- [X] T068 [P] Run `pnpm vitest run tests/unit/no-raw-text.test.ts tests/unit/i18n/catalogs.test.ts tests/unit/presentation-boundary.test.ts` and fix findings in new components
- [X] T069 [P] Write docs/adr/0023-fit-mode-and-adaptive-arrangement.md (fit mode as fretboard event; JS-computed arrangement with media-query fallback)
- [X] T070 Bundle: `pnpm build && node scripts/check-bundle-size.mjs build`; if > 128 KB gzip, trim first (inline SVG `<symbol>` sprite in src/app.html), then if still over apply the planned MINOR amendment 1.9.0 → 1.10.0 (≤ 136 KB) in .specify/memory/constitution.md with Sync Impact Report, scripts/check-bundle-size.mjs and docs/adr/0002-*.md history (depends on T001 and all implementation tasks)
- [X] T071 Run the manual table of specs/025-minimap-fit-and-landscape/quickstart.md §1 (320, 800, 1440 at 12/24 frets, 2560, 844×390, 200% text)
- [X] T072 Run all local gates once: `pnpm verify` (full Playwright matrix runs in CI only)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none; T002/T003 parallel
- **Foundational (2)**: after Setup; BLOCKS all stories
- **US1 (3)** and **US2 (4)**: after Foundational. US2 builds on US1's Fretboard edits (T028 depends on T020), so run US1 → US2
- **US3 (5)**: after Foundational; independent of US1/US2 except shared edits to the three tool files (T053 vs T021–T023, T032–T034: sequence these edits, do not run in parallel)
- **US4 (6)**: after US3 (needs `SidePanels`, `data-arrangement`, ToolLayout)
- **US5 (7)**: after US1–US4 (tests all arrangements)
- **Polish (8)**: after all desired stories

### Within Stories

- Tests first and failing, then implementation
- Pure modules → store → component → tool wiring → e2e

### Task-level notes

- T005 after T004; T007 after T005, T006; T009 after T008; T011 after T010; T014 after T012, T013; T015 after T011
- T020 after T012, T019; T028 after T009, T014, T020; T045 after T044; T047 after T015, T046; T053 after T045–T047; T056 after T054; T070 last before T072

## Parallel Examples

```bash
# Foundational tests together:
T004 geometry.test.ts | T006 minimap.test.ts | T008 pinch.test.ts | T010 layout.test.ts | T013 fit.test.ts

# US1 tests together:
T016 minimap-component.test.ts | T017 fretboard.test.ts | T018 minimap-fit.spec.ts

# US3 independent files together:
T041 triads-view.ts | T042 caged-view.ts | T043 notes-view.ts | T050 NoteSelector.svelte | T051 TriadsControls.svelte | T052 CagedControls.svelte

# US4 bar icons together:
T059 AppNav | T060 ShareButton | T061 InstrumentButton | T062 NotationToggle | T063 LanguagePanel
```

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2
2. Phase 3 (US1 minimap): stop and validate at 320 px / 7 strings / 24 frets
3. Phase 4 (US2 fit + pinch) completes the P1 slice

### Incremental Delivery

US1 → US2 (P1 done) → US3 → US4 (P2) → US5 (P3) → Polish. Each story ends at a checkpoint with targeted tests only; `pnpm verify` runs once at T072.

## Notes

- [P] = different files, no dependency on incomplete tasks
- Handedness is read only inside `src/lib/fretboard/geometry.ts`; the minimap draws from layout x
- No new dependency, no storage, no share-link field (session-only state)
- Commit after each task or logical group
