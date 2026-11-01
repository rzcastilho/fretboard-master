---

description: "Task list for Mode Tabs and Plain Metronome (036)"
---

# Tasks: Mode Tabs and Plain Metronome

**Input**: Design documents from `/specs/036-mode-tabs-and-plain-metronome/`

**Prerequisites**: plan.md, spec.md, research.md (R-01…R-13), data-model.md, contracts/ (metronome-store-api, preferences-record, mode-tabs-ui), quickstart.md

**Tests**: Included. The constitution (Principle IV) and plan.md require test-first work: unit tests (Vitest + fast-check) come first and must fail before the implementation; every acceptance scenario maps to a row of `e2e/metronome-modes.spec.ts`.

**Organization**: Grouped by user story. US1 = plain Metronome run (P1), US2 = mode tab bar (P1), US3 = switching stops playback and each mode keeps its settings, persisted (P1). Phases are ordered US2 → US1 → US3 because the tab bar is the only way to reach the plain mode in the UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3
- Paths are relative to the repo root (single SvelteKit project)

## Verification (CLAUDE.md)

- Unit per task: `pnpm vitest run <touched test paths>`. A test that renders a component or touches `document`/`window`/`localStorage` MUST start with `// @vitest-environment jsdom`.
- E2E per task: `pnpm build:test` once (rebuild only after changing `src/`), then `pnpm test:e2e:fast <spec files>`.
- Screenshots: `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`. Linux baselines come only from `.github/workflows/update-snapshots.yml`.
- `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tokens and catalog strings used by every story. No new dependency, no new directory.

- [X] T001 [P] Add `--metronome-tab-underline: 2px;` (with a short comment: mode tab active underline, FR-002) next to the other metronome tokens in `src/lib/styles/tokens.css`
- [X] T002 [P] Add the six new keys to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json` per research R-11: `metronome_modes_label` (Metronome modes / Modos do metrônomo / Modos del metrónomo), `metronome_mode_plain` (Metronome / Metrônomo / Metrónomo), `metronome_mode_ratios` (takes over the existing `metronome_panel_heading` values: Ratios Training / Treino de proporções / Entrenamiento de proporciones), `metronome_start_plain` (Start / Iniciar / Iniciar), `metronome_announce_started_plain` (`Started, {bpm} BPM, {beats} beats`; pt-BR/es copy the nouns of each locale's existing `metronome_announce_started`) and `metronome_announce_started_plain_count_in` (`Started, {bpm} BPM, {beats} beats, count in {count}`; pt-BR/es follow the pattern of the existing `metronome_announce_started_count_in` without the subdivision). Keep `metronome_panel_heading` for now (removed in T020)
- [X] T003 Run `pnpm vitest run tests/unit/i18n` and, if the catalog tests demand it, add entries to `tests/unit/i18n/identical-allowlist.ts` only for values that are legitimately identical across locales (e.g. "Iniciar" in pt-BR/es, "Metronome" if needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure settings maths and the store's mode/plain state. Every story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first (must fail before implementation)

- [X] T004 [P] Extend `tests/unit/metronome/settings.test.ts` with tests for: `METRONOME_MODES` equals `['plain','ratios']`; `DEFAULT_MODE === 'ratios'`; `DEFAULT_PLAIN_SETTINGS` is frozen with `{bpm: 85, beats: 4, countIn: true, initialCountIn: 4}`; `plainRunPlan(p)` returns `{ clicksPerBeat: 1, initialCountIn: effectiveCountIn(p) }` with no `alternate` (initialCountIn 0 when `countIn` is off); `effectiveCountIn` accepts a `PlainSettings`; `stepSetting`/`atLimit` work on a `PlainSettings` for `bpm | beats | initialCountIn` (±1, held at 30/300, 1/16, 0/8) and `repeatCountIn` stays Ratios-only; `toMode('plain'|'ratios')` returns the value and `toMode('speed'|'PLAIN'|1|null|{}|undefined)` returns `null` without throwing
- [X] T005 [P] Extend `tests/unit/metronome/view.test.ts`: `statusParams` with `sub: null` yields no SUB part for `BEAT n/N` and `BEAT –/N`; the count-in branches and the numeric-`sub` output are unchanged
- [X] T006 [P] Extend `tests/unit/metronome/store.test.ts` (use the injectable fake clock and sink) with guarantees from contracts/metronome-store-api.md: S3 (fast-check property: over random sequences of plain-mode setter calls `settings` never changes, and over random Ratios-mode calls `plain` never changes); S4 (a plain Start calls `ClickScheduler.start` with `clicksPerBeat: 1`, no `alternate`, `initialCountIn = effectiveCountIn(plain)`, `bpm`/`beats` from `plain`); S5 (Ratios start segment, announcements and `sub` unchanged); defaults `mode === 'ratios'`; `current` returns the active mode's record; Ratios-only setters (`setRepeatCountIn`, `stepRepeatCountIn`, `setRatio`, `setSubdivision`, `setLoop2`) are no-ops in plain mode; `sub === null` and `dots` follow `current.beats` in plain mode; plain Start announces `metronome_announce_started_plain` / `_plain_count_in`; plain Pause announces `metronome_announce_paused` (never `_paused_loop`); `restore({ratios, plain, mode})` halts any run and applies all three without writing; `resetMetronomeForTests(deps?, settings?, plain?, mode?)` seam

### Implementation

- [X] T007 Implement in `src/lib/state/metronome-settings.ts` (pure): `MetronomeMode`, `METRONOME_MODES = ['plain','ratios']`, `DEFAULT_MODE = 'ratios'`, `PlainSettings` (bpm integer 30..300 default 85; beats integer 1..16 default 4; countIn boolean default true; initialCountIn integer 0..8 default 4), frozen `DEFAULT_PLAIN_SETTINGS`, `plainRunPlan`, `toMode`; make `effectiveCountIn` take `Pick<PlainSettings,'countIn'|'initialCountIn'>` and `atLimit`/`stepSetting` generic over `S extends PlainSettings` for `'bpm'|'beats'|'initialCountIn'` (reuse `clampBpm`, `clampBeats`, `clampCount`; `MetronomeSettings` stays a structural superset). Makes T004 pass
- [X] T008 [P] Update `src/lib/state/metronome-view.ts` so `statusParams` accepts `sub: number | null` and omits the SUB part when null (R-12). Makes T005 pass
- [X] T009 Extend `src/lib/state/metronome.svelte.ts` (R-01, R-03): add `state.mode` (default `'ratios'`) and `state.plain`; getters `mode`, `current`, `plain`; `sub` returns `null` in plain mode; `dots` and the count-in rule use `current`; shared setters (`setBpm`, `stepBpm`, `setBeats`, `stepBeats`, `setCountIn`, `setInitialCountIn`, `stepInitialCountIn`) edit the active mode's record; the Ratios-only setters are no-ops in plain mode; `toggle()`/`beginSegment` use `plainRunPlan(plain)` with `bpm`/`beats` from `plain` in plain mode and the plain announcements and pause variants; replace `restoreSettings(s)` with `restore(m: {ratios, plain, mode})` (halts, applies, does not write) and update its callers in `src/lib/state/preferences.svelte.ts` (`start()`/`erase()` call `metronome.restore(p.metronome)`) plus the tests that referenced `restoreSettings`; extend `resetMetronomeForTests(deps?, settings?, plain?, mode?)`. Do not change `src/lib/audio`. Makes T006 pass. (Persistence of `plain`/`mode` is T029–T030.)

**Checkpoint**: `pnpm vitest run tests/unit/metronome tests/unit/i18n tests/unit/state` passes. Ratios Training behaviour is unchanged (S5).

---

## Phase 3: User Story 2 - Mode tab bar (Priority: P1) 🎯 MVP

**Goal**: A WAI-ARIA tab bar (`♩ Metronome`, `+ Ratios Training`) is the first row of the metronome card, usable by pointer and keyboard, in every phase.

**Independent Test**: Open `/metronome` with empty storage: tab bar first, two equal-width tabs, Ratios Training selected, no Speed Training tab; click and arrow keys behave per FR-012; at ≤ 480 px the icons are hidden.

### Tests first

- [X] T010 [P] [US2] Create `tests/unit/metronome/mode-tabs.test.ts` (`// @vitest-environment jsdom`): renders `role="tablist"` named by `metronome_modes_label` with tabs in `METRONOME_MODES` order; selected tab has `aria-selected="true"`, `tabindex="0"`, others `-1`; each tab has `aria-controls="metronome-mode-panel"` and ids `metronome-tab-plain` / `metronome-tab-ratios`; icons are `aria-hidden="true" focusable="false"` so the accessible name is the text alone; ArrowRight/ArrowLeft move focus with wrap and Home/End go to first/last without calling `onselect`; click, Enter and Space on a tab call `onselect(mode)`; no Speed Training tab
- [X] T011 [P] [US2] Extend `tests/unit/metronome/store.test.ts` with S1 and S2 for `selectMode(v: unknown)`: from `running`, `starting`, `paused` and during the count-in it calls `halt` once, ends in `phase === 'settings'` with `position === null`, and a fake-clock advance yields no further `onBeat`/`onCountIn`; selecting the active mode or `'speed'`, `null`, `3` changes nothing and a running session keeps running
- [X] T012 [P] [US2] Extend `tests/unit/metronome/keys.test.ts`: `matchMetronomeKey` returns null for Space when the target is a `<button role="tab">` (native activator) so Space on a tab never toggles Start/Pause; Escape is unchanged
- [X] T013 [P] [US2] Extend `tests/unit/metronome/panel.test.ts` (jsdom): the card renders the tab bar first (before any settings row or status box) in settings, running and paused phases; the visible `Ratios Training` `<h2>` is gone; the content sits inside `role="tabpanel" id="metronome-mode-panel"` with `aria-labelledby="metronome-tab-{mode}"`; `<section>` carries `data-mode` and `data-phase`; clicking the other tab calls `selectMode`

### Implementation

- [X] T014 [US2] Add `selectMode(v: unknown)` to `src/lib/state/metronome.svelte.ts`: invalid or active mode is a no-op (no halt, no write); otherwise the existing `halt()` (reason `'leave'`, `generation++`, back to `settings`, position and sound notice cleared), then `state.mode = v` (R-05). No live-region announcement. Makes T011 pass. (The prefs write is added in T029.)
- [X] T015 [P] [US2] Create `src/lib/tools/metronome/ModeTabs.svelte` (props `{ mode: MetronomeMode; onselect: (m) => void }`) per contracts/mode-tabs-ui.md §1–3 and R-06/R-08/R-09: `div role="tablist"` of native `<button type="button" role="tab">`, roving tabindex, keydown on the tablist for ArrowLeft/ArrowRight (wrap)/Home/End moving focus only, inline SVG `♩` and `+` icons (`aria-hidden`, `focusable="false"`, `class="tab-icon"`, sized with `--bar-icon-size`), labels from `m.metronome_mode_plain()` / `m.metronome_mode_ratios()`. Styles use tokens only: `display: grid; grid-auto-flow: column; grid-auto-columns: 1fr`; active `color: var(--color-accent)` + `border-block-end: var(--metronome-tab-underline) solid var(--color-accent)`; inactive `var(--color-text-muted)` + transparent border of the same width; `min-block-size: var(--target-min)`; labels wrap (`min-inline-size: 0`, no ellipsis); `:focus-visible` outline with `--focus-ring-width`/`--color-focus-ring`; `@media (max-width: 30rem) { .tab-icon { display: none } }`; `@media (forced-colors: active)` active border `Highlight`. Makes T010 pass
- [X] T016 [US2] Update `src/lib/tools/metronome/MetronomePanel.svelte`: render `<ModeTabs mode={metronome.mode} onselect={(m) => metronome.selectMode(m)} />` as the first row inside `<section class="panel" data-mode=… data-phase=… data-print="omit">`; remove `<h2 id="panel-heading">` and the section's `aria-labelledby`; wrap the settings/running content in `<div role="tabpanel" id="metronome-mode-panel" aria-labelledby="metronome-tab-{metronome.mode}">`; keep the live-region and sound notice outside the tabpanel. Makes T013 pass
- [X] T017 [P] [US2] Update the four existing e2e specs' locators from `getByRole('region', { name: 'Ratios Training' })` to `getByRole('tabpanel', { name: 'Ratios Training' })` in `e2e/metronome.spec.ts`, `e2e/metronome-a11y.spec.ts`, `e2e/metronome-remembered.spec.ts` and `e2e/metronome-subdivisions.spec.ts` (locator change only, SC-007); check `e2e/metronome-count-in.spec.ts` and `e2e/metronome-ratios.spec.ts` for the same locator

**Checkpoint**: Tab bar works in the UI. `pnpm vitest run tests/unit/metronome`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome.spec.ts e2e/metronome-a11y.spec.ts e2e/metronome-remembered.spec.ts e2e/metronome-subdivisions.spec.ts e2e/metronome-count-in.spec.ts e2e/metronome-ratios.spec.ts` (screenshot assertions skipped locally).

---

## Phase 4: User Story 1 - Plain click to play along with (Priority: P1)

**Goal**: The Metronome tab shows BPM, # of Beats, Count In and Initial Count In; Start plays the initial count-in, then a repeating loop of one click per beat with beat 1 accented, status `BEAT n/N` with no `· SUB`.

**Independent Test**: Click the Metronome tab, set 100 BPM and 3 beats, press Start: 4 count-in clicks then a 3-beat loop at 100 BPM with one accented beat per loop; Space/Escape behave as in Ratios Training.

### Tests first

- [X] T018 [P] [US1] Extend `tests/unit/metronome/count-in-settings.test.ts` (jsdom): `CountInSettings` with `repeat={false}` hides the Repeat Count In row; the default (`repeat` omitted) is unchanged
- [X] T019 [P] [US1] Extend `tests/unit/metronome/panel.test.ts` (jsdom): in plain mode the settings view shows, in order, BPM `ValueRow`, # of Beats `ValueRow`, Count In and Initial Count In, and a Start button labelled `Start`; it does not render Repeat Count In, the Subdivision ratio switch or Loop 1 / Loop 2; Ratios mode still shows `Start Training`; in plain running view `StatusBox` shows `BEAT n/N` / `BEAT –/N` / `COUNT IN n/M` with no `· SUB` and `RunControls` is unchanged; the `StatusBox` omits the SUB part when `sub` is null

### Implementation

- [X] T020 [P] [US1] Add the optional `repeat` prop (default `true`) to `src/lib/tools/metronome/CountInSettings.svelte` that hides the Repeat Count In row; make `src/lib/tools/metronome/StatusBox.svelte` accept `sub: number | null` and render the separator and `SUB n` only when `sub` is a number. Also delete the now-unused `metronome_panel_heading` key from the three catalogs (replaced by `metronome_mode_ratios`, T002) and any test reference. Makes T018 pass
- [X] T021 [US1] Update `src/lib/tools/metronome/MetronomePanel.svelte` for plain mode (contracts/mode-tabs-ui.md §4–5): when `metronome.mode === 'plain'` render the BPM and # of Beats `ValueRow`s and `<CountInSettings repeat={false} />` bound to `metronome.current`, no `RatioSettings`, and the Start button text `m.metronome_start_plain()`; the running view passes `sub={metronome.sub}`, `beats={metronome.current.beats}`, `bpm={metronome.current.bpm}` to `StatusBox`. Element ids stay as in Ratios. Makes T019 pass
- [X] T022 [US1] Create `e2e/metronome-modes.spec.ts` with the plain-mode scenarios from quickstart.md: #2 (plain settings view: 85/4/Count In on/4, button `Start`, no Repeat Count In / Subdivision ratio / Loop 1/Loop 2), #3 (100 BPM, 3 beats, fake click sink: 4 count-in clicks then 3 slots per bar, only slot 1 accented, one click per beat, status `COUNT IN n/4` then `BEAT n/3` with no `SUB`, 3 dots), #4 (Space, Space, Escape: pause, resume, reset with 100/3 kept), #14 (1 beat: every click accented, single dot lit). Follow the helpers/fake-sink pattern of `e2e/metronome-count-in.spec.ts`
- [X] T023 [US1] Run `pnpm vitest run tests/unit/metronome`, `pnpm build:test`, then `pnpm test:e2e:fast e2e/metronome-modes.spec.ts`

**Checkpoint**: The plain Metronome is fully usable and testable on its own (US1 + US2 working together).

---

## Phase 5: User Story 3 - Switching stops playback and each mode keeps its settings (Priority: P1)

**Goal**: Switching tabs stops sound at once from any phase; each mode keeps its own values (no leakage) and both the selected mode and plain values persist across reloads in the `version: 1` preferences record.

**Independent Test**: Set 100/3 in Metronome and 120 BPM in Ratios, start one, switch mid-run, switch back and forth, reload: sound stops, each mode shows its own values, the page reopens on the last selected tab.

### Tests first

- [X] T024 [P] [US3] Add fixtures to `tests/unit/prefs/fixtures/` (and register them in `tests/unit/prefs/fixtures/index.ts`; added only, never remove): `metronome-plain.txt`, `metronome-mode-plain.txt`, `metronome-bad-mode.txt`, `metronome-plain-invalid.txt`, `metronome-plain-array.txt` (the acceptance-case record from contracts/preferences-record.md §1 is the model for the first two)
- [X] T025 [US3] Extend `tests/unit/prefs/schema.test.ts` with C1, C6 and C9–C14: default record is byte-identical to 035's output (C1); an unknown `speed` key is dropped (C6); every existing fixture re-serializes to the same bytes (C9); fast-check round trip `parsePreferences(serializePreferences(p))` deep-equals `p` over the eight Ratios fields, the four plain fields and the mode (C10); a single invalid `plain` field (out of range, fraction, numeric string, `null`, wrong type, never clamped) resets only itself and `ratios`/`mode` stay as stored, and the reverse (C11); `plain` as `null`, array, string or `5` gives plain defaults and `mode` as `"speed"`, `"PLAIN"`, `1`, `null` or `{}` gives `"ratios"` (C12); `{"metronome":{"mode":"ratios"}}` re-serializes with no `metronome` key (C13); `METRONOME_PLAIN_DEFAULTS` deep-equals `DEFAULT_PLAIN_SETTINGS` and `METRONOME_MODES` equals the state constant (C14). Writer order is `ratios`, `plain`, `mode` (W5); `plain` is written with all four fields in order `bpm, beats, countIn, initialCountIn` only when any differs (W6); `mode` only when `"plain"` (W7); `metronome` omitted when all three are default (W8)
- [X] T026 [P] [US3] Extend `tests/unit/metronome/store.test.ts`: `selectMode` writes `preferences.remember({ metronome: { ratios, plain, mode } })` with the full object; a plain value change (step, committed typed value, switch flip) and a Ratios value change write the same full object; equal values, the active tab and invalid input do not write (`commitMetronome` skip-if-unchanged); a storage failure does not block the tool; `reset()` and `screenChanged()` keep `mode` and both records (FR-005)
- [X] T027 [P] [US3] Extend `tests/unit/state/preferences-store.test.ts` and `tests/unit/erase-preferences.test.ts`: `start()` restores `metronome.mode` and `plain` from the stored record (invalid `mode` → `'ratios'`, invalid plain value → its default, `ratios` intact); Erase preferences returns both records to defaults and the mode to `'ratios'`

### Implementation

- [X] T028 [US3] Update `src/lib/prefs/schema.ts` (R-10; type-only imports from `$lib/state`): `Preferences.metronome` becomes `{ ratios: MetronomeSettings; plain: PlainSettings; mode: MetronomeMode }`; export frozen `METRONOME_PLAIN_DEFAULTS` and `METRONOME_MODES = ['plain','ratios'] as const`; `DEFAULT_PREFERENCES.metronome = { ratios: METRONOME_RATIOS_DEFAULTS, plain: METRONOME_PLAIN_DEFAULTS, mode: 'ratios' }`; `parsePreferences` parses `ratios`, `plain`, `mode` independently with per-field Valibot `fallback`s (R7–R12: missing/non-object `plain` → defaults; invalid field → its own default, never clamped; `mode` other than exactly `"plain"`/`"ratios"` → `"ratios"`; unknown keys dropped; never throws); `serializePreferences` per W5–W8. `PRIVACY_CATEGORIES` unchanged. Makes T024/T025 pass
- [X] T029 [US3] In `src/lib/state/metronome.svelte.ts` add the internal `commitMetronome()` (skip when nothing changed by shallow per-field equality per record plus the mode; otherwise `preferences.remember({ metronome: { ratios, plain, mode } })` with the whole object because `session.remember` replaces top-level keys) and call it from `selectMode` (T014) and from every setter that changes a value in either mode (this replaces the 035 `{ ratios }`-only write). Makes T026 pass
- [X] T030 [US3] Wire `src/lib/state/preferences.svelte.ts` so `start()` and `erase()` pass the parsed `metronome` object (`ratios`, `plain`, `mode`) to `metronome.restore(...)` (without writing). Makes T027 pass. Confirm `src/lib/prefs/session.ts` and the About privacy text need no change
- [X] T031 [US3] Extend `e2e/metronome-modes.spec.ts` with the remaining quickstart scenarios: #1 (empty storage: tab bar first in the card, tabs `Metronome` then `Ratios Training` of equal width, Ratios selected, no Speed Training tab), #5 (Ratios running → click `Metronome`: no click after the switch, Metronome settings view; back → Ratios values as left), #6 (switch during the count-in and while paused; next Start begins at `COUNT IN –/4`), #7 (click the active tab while running: still running), #8 (keyboard: Tab into the tablist, ArrowLeft/Right/Home/End while running leave `aria-selected` and playback unchanged; Enter selects and stops; Space on a tab selects and does not pause), #9 (120 BPM in Ratios, 100/3 in Metronome, switch back and forth, reload: values kept and the last selected tab opens), #10 (stored `metronome.mode: "speed"` and `plain.bpm: 999`: opens on Ratios, plain BPM 85, Ratios intact), #11 (Erase preferences on About, return: Ratios selected, both modes default)
- [X] T032 [US3] Run `pnpm vitest run tests/unit/prefs tests/unit/metronome tests/unit/state/preferences-store.test.ts tests/unit/erase-preferences.test.ts`, `pnpm build:test`, then `pnpm test:e2e:fast e2e/metronome-modes.spec.ts e2e/metronome-remembered.spec.ts`

**Checkpoint**: All three stories work together; SC-001…SC-004 and SC-007 are covered.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Layout across widths and languages, accessibility, screenshots, final gates.

- [X] T033 [P] Add the width, language and a11y scenarios to `e2e/metronome-modes.spec.ts`: #12 (viewport 375 px and 320 px in en, pt-BR and es: `.tab-icon` not visible, labels fully visible without truncation or overlap, `document.scrollingElement.scrollWidth <= innerWidth`; at 1024 px the icons are visible; accessible names `Metronome` and `Ratios Training` at both widths) and #13 (axe via `@axe-core/playwright` on settings, running and paused views in both modes: zero violations)
- [X] T034 [P] Add or update screenshot tests for the tab bar in `e2e/metronome.spec.ts` (existing settings, running and paused baselines change because the heading is replaced; add plain-mode settings and running baselines, light and dark). Generate locally only with `pnpm playwright test e2e/metronome.spec.ts -g "<test name>" --project=desktop --update-snapshots`; the Linux baselines are regenerated by `.github/workflows/update-snapshots.yml`
- [X] T035 Add a "Manual checks" note at the end of this file and list the same steps in the PR description; the PR description MUST also ask the reviewer to explicitly approve the recorded Principle VII deviation (first-visit mode is Ratios Training, not the simpler plain mode; plan.md Complexity Tracking). Steps: (1) by ear in a real browser, plain mode at 100 BPM / 3 beats gives 4 count-in clicks, then an accented beat 1 and two regular clicks, no soft subdivision clicks, steady for 5 minutes (SC-004); (2) with VoiceOver or NVDA, the tablist reads "Metronome modes, tab list" with the selected state, and Start reads "Started, 100 BPM, 3 beats, count in 4"
- [X] T036 Confirm no dead code or stale references remain: no `restoreSettings`, no `metronome_panel_heading` key or usage, no `panel-heading` id (search `src/`, `tests/`, `e2e/`, `messages/`); `src/lib/audio`, `src/lib/link` and `src/routes/metronome` are unmodified (`git diff --stat`)
- [X] T037 Run quickstart.md validation (unit and e2e commands listed there) and then, once, `pnpm verify` (check, lint, format, Vitest with coverage, build, bundle-size ≤ 160 KB gzip). Do not run `pnpm test:e2e` or `pnpm lhci` locally

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; T001 and T002 in parallel, T003 after T002.
- **Foundational (Phase 2)**: needs Phase 1 (T002 for announcement keys used by T009). Tests T004–T006 first, then T007 → T008 (parallel with T007's consumers) → T009. BLOCKS all stories.
- **US2 (Phase 3)**: after Phase 2. It is the first increment (MVP) since it adds the tab bar and `selectMode`.
- **US1 (Phase 4)**: after Phase 2; the UI needs US2's tab bar to be reachable (T021 builds on T016), so run it after US2.
- **US3 (Phase 5)**: after Phase 2; T029 builds on T014 (`selectMode`), T031 on T022 (same spec file). Codec work (T024, T025, T028) is independent of the UI and can run in parallel with Phases 3–4.
- **Polish (Phase 6)**: after all stories.

### Within each story

Tests are written first and must fail; then pure logic → store → components → e2e.

### Parallel opportunities

- Phase 1: T001 ∥ T002.
- Phase 2 tests: T004 ∥ T005 ∥ T006 (different files except T006 shares `store.test.ts` with later tasks, so keep sequential with T011/T026). T008 ∥ T007.
- US2: T010 ∥ T011 ∥ T012 ∥ T013 (T011 edits `store.test.ts`, T013 edits `panel.test.ts`; T018/T019 later touch `count-in-settings.test.ts`/`panel.test.ts`, so do not run T013 and T019 together); T015 ∥ T017.
- US1: T018 ∥ T019 (different files), T020 before T021.
- US3: T024 ∥ T026 ∥ T027; T025 after T024; T028 can start as soon as T025 is written.
- Polish: T033 ∥ T034.

### Parallel example: US3 codec work alongside UI work

```text
Task: "T024 Add prefs fixtures in tests/unit/prefs/fixtures/"
Task: "T026 Extend store persistence tests in tests/unit/metronome/store.test.ts"
Task: "T027 Extend tests/unit/state/preferences-store.test.ts and tests/unit/erase-preferences.test.ts"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 → Phase 2 (pure maths and store).
2. Phase 3 (US2): the tab bar and `selectMode`. **Stop and validate**: tab semantics, keyboard, icons hidden at ≤ 480 px, existing metronome specs green with `tabpanel` locators.
3. Phase 4 (US1): the plain run, which is the new capability. Validate with `e2e/metronome-modes.spec.ts`.

### Incremental delivery

4. Phase 5 (US3): persistence and isolation, then the remaining e2e rows.
5. Phase 6: width/language/axe checks, screenshots, `pnpm verify` once.

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks.
- Do not modify `src/lib/audio` (engine is mode-agnostic), `src/lib/link` (FR-017) or `src/routes/metronome`.
- Speed Training's tab is deliberately not pre-built (Principle X); a later slice adds one `METRONOME_MODES` entry and a label key.
- A task needing a human (listening by ear, screen reader) is done once its automatable part passes; the human step lives in the "Manual checks" note (T035).

## Manual checks

Human steps that cannot be automated (also listed in the PR description):

1. By ear in a real browser: plain mode at 100 BPM / 3 beats gives 4 count-in clicks, then an accented beat 1 and two regular clicks, no soft subdivision clicks, steady for 5 minutes (SC-004).
2. With VoiceOver or NVDA: the tablist reads "Metronome modes, tab list" with the selected state, and Start reads "Started, 100 BPM, 3 beats, count in 4".
3. Reviewer: explicitly approve the recorded Principle VII deviation (first-visit mode is Ratios Training, not the simpler plain mode; plan.md Complexity Tracking).
