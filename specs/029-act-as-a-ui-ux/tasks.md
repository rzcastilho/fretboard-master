---

description: "Task list for Modern Minimalist UI Refinement (029)"
---

# Tasks: Modern Minimalist UI Refinement

**Input**: Design documents from `/specs/029-act-as-a-ui-ux/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-10), data-model.md, contracts/ui.md, contracts/style-lint.md, quickstart.md

**Tests**: Requested by the plan (Constitution IV, test-first): the style lint `tests/unit/style-tokens.test.ts` and the e2e `e2e/ui-refinement.spec.ts` are written first and start red.

**Organization**: Grouped by user story. This is a CSS and markup-class change only: no logic, text, preference or share-link change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2 or US3
- Verification per task uses the targeted commands from CLAUDE.md (`pnpm vitest run <paths>`, `pnpm build:test` once then `pnpm test:e2e:fast <specs>`). Do NOT run `pnpm test:e2e` or `pnpm lhci` locally.

## Rules that apply to every migration task

- Add the family class in markup (`btn`, `option`, `switch`, `link-button`, `stepper`) and delete that element's copied size, padding, border, radius, font, background and color rules from the component `<style>`. Keep only layout rules (grid, flex, margin, gap, inline-size).
- No colour literal, no unit literal other than `0` (also not in `var()` fallbacks), no undefined token, `font-weight` only via `var(--font-weight-normal|medium|bold)`.
- Replace per-component visually-hidden `1px` rules with the global `.sr-only` class.
- Do not change ARIA roles or names, message keys, DOM order or grid areas.
- Never edit a frozen token value (`--fb-*`, `--marker-*`, `--emph-*`, `--minimap-*`, `--connection-*`, `--pulse-*`, `--print-*`).

---

## Phase 1: Setup (Guards first, red)

**Purpose**: Write the failing guards before any styling change.

- [X] T001 Extend `tests/unit/a11y/tokens.ts` with a helper that returns every custom-property name declared in `src/lib/styles/tokens.css` (all blocks, including the contrast-more block)
- [X] T002 Create `tests/unit/style-tokens.test.ts` (node environment, no docblock) implementing rules 1–5 of `contracts/style-lint.md` over every `src/**/*.svelte` `<style>` block, with comment stripping, `file:line  rule  text` findings listed in one assertion message, allowances for component-local custom properties (set in the same file's style block or via `style:--x=` / `style="--x: …"`), and `ch`, `%`, `fr`, unitless values; include the inline fixture self-test (one offending and one passing case per rule). Run `pnpm vitest run tests/unit/style-tokens.test.ts`: the self-test passes and the real scan fails on today's ~80 offenders
- [X] T003 [P] Create `e2e/ui-refinement.spec.ts` with: G-1 (area of `section.c` greater than each of `header`, `section.b`, `.d`, `section.e` that has a box, and C's top < viewport height), G-2 (every focusable descendant of `section.b` fully inside the viewport, no scroll, nothing opened), G-3 (`documentElement.scrollWidth <= innerWidth`) for `/notes`, `/triads`, `/caged` at 320×568, 768×1024 and 1440×900; plus the family computed-style equality tests per the instance map in `contracts/ui.md` §2 (`min-block-size`, four-side padding, four-corner radius, border widths, `font-size`, `font-weight`, default vs selected weight and background differ); plus the home-card equal-height check (US2). Reuse helpers in `e2e/support/`. Confirm G-2 at 320 px and family equality fail today

**Checkpoint**: Both guards exist and are red for the right reasons.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokens, the global families file and the fretboard same-value swap. Every story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add the new tokens to `src/lib/styles/tokens.css` exactly as in `data-model.md`: `--radius-sm` (0.25rem), `--radius-lg` (0.75rem), `--radius-pill` (999px), `--font-weight-medium` (600), plus `--font-weight-normal` (400) and `--font-weight-bold` (700) if not already present, `--color-border-subtle` (`light-dark(#e3e6ea, #262c34)`, contrast-more `var(--color-text)`), `--color-surface-hover` (`light-dark(#e7eaee, #232931)`, contrast-more `light-dark(#e1e4e8, #1a1f26)`), `--color-shadow` (`light-dark(rgb(0 0 0 / 0.14), rgb(0 0 0 / 0.5))`, contrast-more `transparent`), `--shadow-overlay` (`0 var(--space-2) var(--space-6) var(--color-shadow)`), `--switch-track-inline` (2.25rem), `--switch-track-block` (1.25rem), `--switch-thumb-inset` (2px), `--item-min-inline` (12rem), `--unit-px` (1px), `--fb-stroke-hairline` (1px), `--fb-label-halo-width` (3px), `--fb-glyph-halo-width` (2px). Every colour token uses `light-dark()`. Keep the accent hue; change lightness only if a contrast test demands it. Do not edit any frozen value
- [X] T005 Run `pnpm vitest run tests/unit/a11y/palette-contrast.test.ts tests/unit/a11y/theme-tokens.test.ts tests/unit/reserved-colors.test.ts` and fix token definitions (not tests) until green (depends on T004)
- [X] T006 [P] Replace every literal in `src/lib/fretboard/Fretboard.svelte` and `src/lib/fretboard/MarkerSample.svelte` with the same-value tokens (`stroke-width: 1px|2px|3px` → `--fb-stroke-hairline`, `--fb-glyph-halo-width`, `--fb-label-halo-width`; `calc(var(--ring-base) * 1px …)` → `* var(--unit-px)`; font weights → weight tokens). Rendering must be pixel-identical
- [X] T007 [P] Replace literals in `src/lib/fretboard/Minimap.svelte` (frame `1px` → `--border-width`, `var(--radius-sm, 4px)` → `var(--radius-sm)`), `src/lib/fretboard/ViewAids.svelte` (`44px` → `--target-min`, `1px` hidden rule → `.sr-only`) and `src/lib/fretboard/LegendPanel.svelte` (`flex: 1 1 12rem` → `--item-min-inline`)
- [X] T008 Create `src/lib/styles/controls.css` with the five families per `data-model.md` Entity 2 and `contracts/ui.md` §1: `.btn`, `.option` (narrow-arrangement padding `--space-1 --space-2`), `.switch` / `.switch-track` / `.switch-thumb`, `.stepper` / `.stepper-value` (buttons reuse `.btn`), `.link-button`. Selected selector `[aria-pressed='true'], [aria-checked='true'], [aria-selected='true'], [aria-current]` gives accent fill, `--color-accent-text`, `--font-weight-bold`; default weight `--font-weight-medium`; hover only inside `@media (hover: hover)` using `--color-surface-raised` (or `--color-surface-hover` on raised parents); disabled via `:disabled, [aria-disabled='true']` with the disabled tokens and `cursor: not-allowed`; transitions only `background-color, color, border-color` over `--duration-fast` with `--ease-standard`; global focus ring unchanged. Values only from tokens
- [X] T009 Import `controls.css` in `src/routes/+layout.svelte` immediately after `global.css`; add to `src/lib/styles/global.css` the zone-heading label style (`--font-size-sm`, `--font-weight-medium`, `--color-text-muted`) only if not placed in ToolLayout later (see T016), and confirm `.sr-only` exists there
- [X] T010 Run the frozen snapshots without updating: `pnpm build:test`, then `pnpm test:e2e:fast e2e/fretboard.spec.ts -g "grayscale"` and `pnpm test:e2e:fast e2e/notation.spec.ts -g "accidental glyphs"`. Both must pass; if not, fix code, never the baseline (depends on T004–T009)

**Checkpoint**: Tokens, families and the fretboard swap done. User stories can start.

---

## Phase 3: User Story 1 - Calmer, fretboard-first tool screens (Priority: P1) 🎯 MVP

**Goal**: Tool screens (Notes, Triads, CAGED) are calm, the fretboard dominates, and equivalent controls look identical across tools.

**Independent Test**: At 320, 768 and 1440 px, `pnpm test:e2e:fast e2e/ui-refinement.spec.ts` passes G-1, G-2, G-3 and the `.option`, `.btn` and `.switch` equality checks for Notes, Triads and CAGED.

### Implementation for User Story 1

- [X] T011 [P] [US1] Migrate `src/lib/tools/ChoiceGroup.svelte` to `.option` (keep `role="radio"` and `aria-checked`), delete copied rules
- [X] T012 [P] [US1] Migrate `src/lib/tools/NoteSelector.svelte` to `.option` (keep `aria-pressed`), delete copied rules
- [X] T013 [P] [US1] Migrate `src/lib/tools/FitToggle.svelte` to `.option`, delete copied rules
- [X] T014 [P] [US1] Migrate `src/lib/tools/notes/RegionFilter.svelte` and `src/lib/tools/notes/StringFilter.svelte` to `.option`; replace the `1px` hidden rules in StringFilter with `.sr-only`
- [X] T015 [P] [US1] Migrate `src/lib/tools/triads/TriadsCompare.svelte` and `src/lib/tools/triads/TriadsControls.svelte` to `.option` and `.btn`; remove literal fallbacks (`--font-size-sm`, `--space-4`, `--border-width`, `--radius-md`, `--focus-ring-offset`)
- [X] T016 [US1] Restyle zones in `src/lib/shell/ToolLayout.svelte` (and `src/lib/styles/global.css` where zone rules live) per `contracts/ui.md` §3: zone B and E transparent, no border; zone D `--color-surface-raised`, `--radius-lg`, no border; zone C geometry (padding, border width, gutters) unchanged with border colour `--color-border-subtle`; zone `h2` as small muted label; page `h1` keeps `--font-size-xl`. Keep landscape and print neutralisation working
- [X] T017 [P] [US1] Migrate `src/lib/tools/notes/NotesActions.svelte` and `src/lib/tools/notes/PositionCard.svelte` to `.btn`; drop literal fallbacks
- [X] T018 [P] [US1] Migrate `src/lib/tools/notes/DetectedTriad.svelte` (`.sr-only` for the `1px` rules, weight tokens) and `src/lib/tools/notes/NotesTool.svelte`
- [X] T019 [P] [US1] Migrate `src/lib/tools/triads/TriadsSecondary.svelte` to `.btn` (replace undefined `--touch-target-min` with the family's `--target-min`), `src/lib/tools/triads/CompositionPanel.svelte` (drop literal fallbacks) and `src/lib/tools/triads/TriadsTool.svelte`
- [X] T020 [P] [US1] Migrate `src/lib/tools/caged/CagedTool.svelte` (connections switch to `.switch` / `.switch-track` / `.switch-thumb`, remove the `2.25rem`, `1.25rem`, `999px`, `2px`, `4px` literals; `.actions button` and `.step` to `.btn`) and `src/lib/tools/caged/CagedControls.svelte`, `src/lib/tools/caged/CagedFocusControls.svelte`, `src/lib/tools/caged/CagedTriadSets.svelte`
- [X] T021 [P] [US1] Migrate `src/lib/tools/caged/CagedLayerList.svelte` (`.sr-only`, `.option`/`.btn`) and `src/lib/tools/caged/CagedListen.svelte` (`.btn`, drop literal fallbacks)
- [X] T022 [P] [US1] Replace literals in `src/lib/tools/ContextZone.svelte` (`flex: 1 1 var(--item-min-inline)`), `src/lib/tools/FitNotice.svelte` and `src/lib/tools/SidePanels.svelte` (drop the `--landscape-bar-height` `3.5rem` fallback; side panel `box-shadow: var(--shadow-overlay)`)
- [X] T023 [US1] SC-005 at 320 px: run G-2; if a tool's default zone-B controls overflow, tighten `.option` narrow padding in `src/lib/styles/controls.css`, and if still overflowing set `.controls-row` to `flex-wrap: wrap` at the narrow arrangement in `src/lib/styles/global.css` (record the choice in a comment-free commit message). Do not move any control
- [X] T024 [US1] Verify the story: `pnpm build:test`, then `pnpm test:e2e:fast e2e/ui-refinement.spec.ts e2e/notes.spec.ts e2e/triads.spec.ts e2e/caged.spec.ts e2e/responsive-layout.spec.ts`; also re-run the T010 frozen snapshots (no update)

**Checkpoint**: US1 works and is independently testable. This is the MVP.

---

## Phase 4: User Story 2 - Clear hierarchy and consistent navigation (Priority: P2)

**Goal**: Navigation, home cards, panels and the about page share one hierarchy; current location and every control state are clear without colour alone.

**Independent Test**: Walk home → each tool → instrument panel → language panel → about; `pnpm test:e2e:fast e2e/ui-refinement.spec.ts e2e/navigation.spec.ts e2e/a11y-keyboard.spec.ts e2e/home.spec.ts` passes, including the stepper, link-button and home-card checks.

### Implementation for User Story 2

- [X] T025 [P] [US2] Restyle `src/lib/shell/AppNav.svelte`: current item keeps `aria-current="page"`, bold weight and the `--indicator-width` bar; hover per family rules; literals to tokens
- [X] T026 [P] [US2] Apply `.link-button` and delete copied rules in `src/lib/shell/InstrumentButton.svelte`, `src/lib/shell/LanguageButton.svelte` and `src/lib/shell/ShareButton.svelte`; `src/lib/shell/StopButton.svelte` to `.btn`
- [X] T027 [P] [US2] Restyle `src/lib/shell/ToolCard.svelte` and `src/lib/shell/HomeScreen.svelte` per `contracts/ui.md` §4: single `<a>` per card, `--color-surface-raised`, `--color-border-subtle`, `--radius-lg`, `align-items: stretch` with `block-size: 100%`, one spacing token gap, hover `--color-surface-hover`, `.continue` borderless accent bold text
- [X] T028 [P] [US2] Migrate `src/lib/shell/FretStepper.svelte` (− and + buttons use `.btn`, readout `.stepper-value`: raised, tabular numerals, bold) and `src/lib/shell/InstrumentPanel.svelte` (`.btn`; bottom sheet `box-shadow: var(--shadow-overlay)`, `--color-backdrop` kept)
- [X] T029 [P] [US2] Migrate `src/lib/shell/NotationToggle.svelte` (`.option`; remove `1px` border and outline-offset literals), `src/lib/shell/NotationSelector.svelte`, `src/lib/shell/LanguageSelector.svelte`, `src/lib/shell/ThemeSelector.svelte` and `src/lib/shell/LanguagePanel.svelte` to the shared families
- [X] T030 [P] [US2] Migrate `src/lib/shell/SoundControl.svelte` (`.switch` where it is `role="switch"`, panel with `--shadow-overlay`) and `src/lib/shell/ErasePreferences.svelte` (`.btn`)
- [X] T031 [P] [US2] Migrate `src/lib/shell/Notice.svelte` and `src/lib/shell/PrefsNotice.svelte` (actions and dismiss `.link-button`; non-blocking, never red), `src/lib/shell/ShareFallback.svelte` (`.sr-only`, `--item-min-inline`) and `src/lib/shell/TuningBadge.svelte`, `src/lib/shell/InstrumentSummary.svelte`
- [X] T032 [P] [US2] Migrate `src/lib/shell/FailureView.svelte`, `src/lib/shell/ShellFailure.svelte`, `src/lib/shell/ToolPlaceholder.svelte`, `src/lib/shell/PrivacyPolicy.svelte`, `src/lib/shell/ShortcutList.svelte`, `src/lib/shell/BarIcon.svelte`, `src/routes/+error.svelte` and `src/routes/about/+page.svelte` (link and button classes), keeping their fallbacks
- [X] T033 [P] [US2] Triads guidance actions: apply `.link-button` in `src/lib/tools/triads/TriadsGuidance.svelte` (`max-inline-size: 60ch` stays)
- [X] T034 [US2] Verify the story: `pnpm build:test`, then `pnpm test:e2e:fast e2e/ui-refinement.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts e2e/a11y-keyboard.spec.ts e2e/instrument-panel.spec.ts e2e/about.spec.ts e2e/share.spec.ts`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Polished across themes, languages and settings (Priority: P3)

**Goal**: The refined layout holds in dark, light, high contrast, reduced motion, en/pt/es and 200% zoom with no truncation, overlap or lost state indicator.

**Independent Test**: `pnpm test:e2e:fast e2e/theme.spec.ts e2e/a11y-colour.spec.ts e2e/a11y-audit.spec.ts e2e/text-zoom.spec.ts e2e/languages-layout.spec.ts e2e/motion.spec.ts` passes with non-screenshot assertions unchanged.

### Implementation for User Story 3

- [X] T035 [US3] Confirm every new colour token has its `prefers-contrast: more` override from T004 and that borders and the full-width control borders return in contrast-more and forced colours (`src/lib/styles/tokens.css`, `src/lib/styles/global.css`); confirm transitions are `0s` under reduced motion
- [X] T036 [P] [US3] Run `pnpm test:e2e:fast e2e/text-zoom.spec.ts e2e/languages-layout.spec.ts e2e/notation-layout.spec.ts e2e/theme.spec.ts e2e/motion.spec.ts`; fix any wrap, truncation or overlap in the touched CSS (no text changes)
- [X] T037 [P] [US3] Run `pnpm test:e2e:fast e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts e2e/landscape.spec.ts e2e/print.spec.ts e2e/seven-strings.spec.ts`; fix violations in CSS only

**Checkpoint**: All stories verified in the supported environments.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 Run the full lint until green: `pnpm vitest run tests/unit/style-tokens.test.ts tests/unit/no-raw-text.test.ts tests/unit/reserved-colors.test.ts tests/unit/a11y/palette-contrast.test.ts tests/unit/a11y/theme-tokens.test.ts`; fix any remaining offender in `src/**/*.svelte` (zero findings required)
- [X] T039 [P] Write `docs/adr/0028-chrome-control-families-and-style-lint.md` recording the global-family classes in `src/lib/styles/controls.css`, the same-value fretboard tokens and the style-lint decision (use the format of the existing ADRs in `docs/adr/`)
- [X] T040 Regenerate the intentionally changed chrome baselines, one test at a time, per quickstart §5: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots` for the TM-9 views (`e2e/notes-tm9.spec.ts`, `e2e/triads-tm9.spec.ts`, `e2e/caged-tm9.spec.ts`), `arrangement-*` (`e2e/responsive-layout.spec.ts`), `theme-dark-*` (`e2e/theme.spec.ts`), `sound-control-*` (`e2e/playback.spec.ts`), and `e2e/triads-compare.spec.ts` if it changed. Never update `all-markers-grayscale` or `accidental-glyphs`. Inspect the diffs: chrome only, board drawing identical
- [X] T041 Run the quickstart.md validation sections 1–4 once
- [X] T042 Run all local gates once: `pnpm verify` (full Playwright matrix, Firefox/WebKit and Lighthouse run in CI only; do not run `pnpm test:e2e` or `pnpm lhci` locally). Confirm initial JS ≤ 150 KB gzip

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none, start immediately
- **Foundational (Phase 2)**: depends on Phase 1; blocks all stories
- **US1 (Phase 3)**: depends on Phase 2; no dependency on other stories
- **US2 (Phase 4)**: depends on Phase 2; independent of US1 (uses the same global families, different files)
- **US3 (Phase 5)**: depends on Phase 2 and is meaningful after US1 and US2 restyle their surfaces
- **Polish (Phase 6)**: depends on all desired stories; T038 can only reach zero findings after US1 and US2 migrations finish

### Within the phases

- T001 → T002; T003 is parallel to T001–T002
- T004 → T005; T004 → T006, T007, T008; T008 → T009; T006, T007, T009 → T010
- T016 and T023 touch shared CSS (`ToolLayout.svelte`, `controls.css`, `global.css`): do them in order, not in parallel with other edits to those files
- T020 (CagedTool) before T021 only if both edit shared CAGED styles; otherwise parallel
- T040 after T038 and after the visual changes are final

### Parallel Opportunities

- T006 and T007 (different fretboard files) run together once T004 is done
- In US1: T011–T015, T017–T022 are all different files and can run in parallel
- In US2: T025–T033 are all different files and can run in parallel
- US1 and US2 can proceed in parallel by different developers after Phase 2
- T036 and T037 can run in parallel

### Parallel Example: User Story 1

```text
Task: "Migrate src/lib/tools/ChoiceGroup.svelte to .option"
Task: "Migrate src/lib/tools/NoteSelector.svelte to .option"
Task: "Migrate src/lib/tools/FitToggle.svelte to .option"
Task: "Migrate src/lib/tools/caged/CagedTool.svelte switch and buttons"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: guards (red)
2. Phase 2: tokens, `controls.css`, fretboard same-value swap, frozen snapshots green
3. Phase 3: tool screens
4. **STOP and VALIDATE**: `e2e/ui-refinement.spec.ts` plus the tool specs

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate (MVP)
3. US2 → validate
4. US3 → validate environments
5. Polish: lint to zero, ADR, regenerate baselines, `pnpm verify`

Migrate family by family inside a story when working alone (`.option` → `.btn` → `.switch` → stepper → `.link-button`), running the lint and equality test after each family.

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks
- The style lint stays red for files not yet migrated; judge a story by its own listed e2e specs and by the findings dropping to zero for its files
- Commit after each task or logical group (Conventional Commits)
- Fretboard drawing, zone placement, ARIA, message keys, preferences and share links must not change
