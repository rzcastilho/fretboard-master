---

description: "Task list for Metronome Tool and Steady Click"
---

# Tasks: Metronome Tool and Steady Click

**Input**: Design documents from `/specs/031-metronome-tool-and-click-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (click-engine-api, metronome-store-api, metronome-ui), quickstart.md

**Tests**: Included. Constitution IV requires test-first for logic and tested behaviour for UI, and plan.md lists the test files. Write each test first and see it fail before the implementation.

**Organization**: Grouped by user story. US1 is the MVP (steady click). US2 adds pause/resume/reset. US3 adds the BPM/beats settings rows. US4 adds home card, nav, i18n and a11y completion.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, from spec.md
- Paths are relative to the repo root.

## Verification (CLAUDE.md)

- Per task: `pnpm vitest run <touched test paths>`. A test that renders a component or touches `document`/`window`/`localStorage` MUST start with `// @vitest-environment jsdom`.
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast <spec files>`.
- New screenshot: `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`.
- `pnpm verify` once, at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tool identity, tokens, message keys and test scaffolding that every story needs.

- [X] T001 Split tool ids in `src/lib/shell/tools.ts`: add `export type FretboardToolId = 'notes' | 'triads' | 'caged'` and `ToolId = FretboardToolId | 'metronome'`; append a 4th `TOOLS` entry `{ id: 'metronome', path: '/metronome', … }` using message keys `tool_metronome_name` and `tool_metronome_question`. Update `tests/unit/tools.test.ts` (4 tools, order Notes, Triads, CAGED, Metronome).
- [X] T002 [P] Narrow fretboard-only consumers to `FretboardToolId` (types only, no behaviour change) in `src/lib/state/links.svelte.ts`, `src/lib/state/share.svelte.ts`, `src/lib/state/instrument.svelte.ts` (`overrideNoticeFor`), `src/lib/shell/ToolLayout.svelte`, `src/lib/shell/ShareButton.svelte`, `src/lib/shell/TuningBadge.svelte`, `src/lib/shell/failure.ts` (its `tool` feeds `measure.report`, which accepts fretboard tools or `null` → `'shell'`; Metronome failures are recorded with `null`, R-12). Keep `src/lib/shell/fault.ts` on `ToolId` so `maybeFault('metronome')` can inject a Metronome render fault (T022, T027). Leave `EVENT_TOOLS` in `src/lib/measure/wire.ts` unchanged. Run `pnpm check` for the type errors.
- [X] T003 [P] Add the `'metronome'` screen and its title to `src/lib/shell/screens.ts` (`ScreenId`, `SCREENS`, `screenTitle` → `title_screen({ screen: tool_metronome_name })`). Update `tests/unit/screens.test.ts`.
- [X] T004 [P] Add `'metronome'` to `TOOL_IDS` (the `lastTool` picklist) in `src/lib/prefs/schema.ts`, keeping `v.fallback(…, null)` and the format version unchanged. Add the fixture `tests/unit/prefs/fixtures/last-tool-metronome.txt` (added, never remove others). Extend `tests/unit/prefs/schema.test.ts`: `lastTool: 'metronome'` round-trips, an unknown value gives `null` (FR-022).
- [X] T005 [P] Add design tokens to `src/lib/styles/tokens.css`: `--color-danger` and `--color-danger-text` (light, dark, `prefers-contrast: more`, forced colours; research R-14 hex values are starting points), `--pill-min-inline: 96px`, `--metronome-dot-size`, `--metronome-tempo-size`.
- [X] T006 [P] Add all message keys listed in `contracts/metronome-ui.md` §5 (about 24: `tool_metronome_*`, `metronome_*`, `shortcuts_metronome_heading/_toggle/_reset`, `shortcuts_key_space`, `shortcuts_key_escape`) to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json`, in the same commit (FR-012). Keep the `{beat}/{beats}`, `{bpm}` params identical in all three languages.
- [X] T007 [P] Add `outputLatency?: number` and `baseLatency?: number` to `AudioPort` and the `click` / `click-cancel` entries to `AudioLogEntry` (data-model §8) in `src/lib/audio/types.ts`. Move the test-build `__fmAudioLog` helper from `src/lib/audio/engine.ts` to the new `src/lib/audio/log.ts` and import it from both. Run the existing `tests/unit/audio` tests to confirm nothing breaks.
- [X] T008 [P] Extend the fakes in `tests/unit/audio/support/fake-audio.ts`: `FakeAudioPort` gains `createBuffer`/`createBufferSource` recording `start(when)`/`stop` calls, a settable `currentTime`/`state`, and `outputLatency`; add `FakeFrames` (the `FrameClock` fake with a manual `flush()`) and a `FakeClock` that can fire timers at 1000 ms steps.

**Checkpoint**: Types compile (`pnpm check`), existing tests still pass: `pnpm vitest run tests/unit/tools.test.ts tests/unit/screens.test.ts tests/unit/prefs tests/unit/audio`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The click synth, the scheduler, the engine sink and the pure state modules. Every story depends on them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T009 [P] Write `tests/unit/audio/click.test.ts` (fails first): accent dominant frequency 1600 Hz ± 2 %, peak 0.9 ± 0.01; normal 1000 Hz ± 2 %, peak 0.55 ± 0.01; accent peak / normal peak ≥ 1.5; first sample is 0 (1 ms linear attack); last sample ≤ 0.01 × peak; length = `round(CLICK_S × sampleRate)`; deterministic; never throws.
- [X] T010 [P] Write `tests/unit/audio/metronome.test.ts` (fails first) covering S1–S12 of `contracts/click-engine-api.md` §2 with the fakes from T008. Include a fast-check property: for BPM 30–300 and k ≤ 3000, `when = anchor + k·60/bpm` within 1e-9 s (S1/SC-001/SC-002); throttled wakes every 1000 ms for 60 s schedule each index once, in order, none late (S4/SC-004); `halt()` cancels sources with `when > now` (S5); pause at beat 3 of 4 then `startBeat = 4` gives beat 4 (not accent) then beat 1 (accent) (S6); a 30 s `currentTime` jump schedules no past click (S7); `onBeat` fires only from a frame callback (S8); double `start()` and stale timers after `halt()` do nothing (S9); `sink = null` makes no `createBufferSource` call and still steps (S10); `beats = 1` makes every click accented (S11); the two buffers are created once per sink (S12).
- [X] T011 [P] Write `tests/unit/metronome/settings.test.ts` (fails first): defaults 85/4 (frozen), `clampBpm` 30–300 rounded with NaN → 30, `clampBeats` 1–16 with NaN → 1, `stepSetting` returns the same object at a limit, `atLimit` for both fields and both directions.
- [X] T012 [P] Write `tests/unit/metronome/view.test.ts` (fails first): `beatDots(beats, beat)` gives `lit` at `i === beat`, `played` below, `upcoming` above and for `beat = 0`; loop wrap (beat 1 after N) resets the others to `upcoming`; `beats = 1` is always `lit`; `statusParams` for `beat = 0` selects the "none" message (FR-006, FR-020, FR-025).
- [X] T013 [P] Write `tests/unit/metronome/keys.test.ts` (fails first): the full table in `contracts/metronome-store-api.md` §2 (Space on button/a/summary/checkbox/radio → `null`; Space on range → `'toggle'`; Escape in settings or with a disclosure open → `null`; Ctrl/Meta/Alt/AltGraph, `repeat`, `isComposing`, `defaultPrevented`, text input/textarea/select/contenteditable → `null`), and that the result does not depend on `shortcuts.enabled`.

### Implementation

- [X] T014 [P] Implement `src/lib/audio/click.ts`: `ClickKind`, `CLICK_S = 0.03`, pure `renderClick(kind, sampleRate): Float32Array` (accent 1600 Hz peak 0.9, normal 1000 Hz peak 0.55, 1 ms linear attack, decay to ≤ 0.01 × peak). Make T009 pass.
- [X] T015 [P] Implement `src/lib/state/metronome-settings.ts`: `MetronomeSettings`, frozen `DEFAULT_SETTINGS = { bpm: 85, beats: 4 }`, `clampBpm` (reuse `MIN_BPM`/`MAX_BPM` from `src/lib/audio/schedule.ts`, then `Math.round`), `clampBeats`, `stepSetting`, `atLimit`. Make T011 pass.
- [X] T016 [P] Implement `src/lib/state/metronome-view.ts`: `DotState`, `beatDots`, `statusParams`. Make T012 pass.
- [X] T017 [P] Implement `src/lib/state/metronome-keys.ts`: `MetronomeKeyAction`, `matchMetronomeKey(e, ctx)` per the table, reusing the guards in `src/lib/state/shortcuts.ts` where possible. Make T013 pass.
- [X] T018 Implement `src/lib/audio/metronome.ts` (depends on T007, T014): `START_LEAD_S = 0.02`, `HORIZON_S = 1.5`, `TICK_MS = 25`, `ClickSink`, `FrameClock`, `SchedulerDeps`, `SchedulerEvents`, `SegmentStart`, `createClickScheduler`, pure `clickAt` and `skipTo`. Behaviour: click k at `anchor + k × period` (never accumulated); anchor at `clock.now() + START_LEAD_S` once `sink.running` resolves; 1.5 s lookahead on a 25 ms wake; two pre-rendered buffers per sink; `halt(reason)` cancels sources with `when > now` and returns the last audible beat; skip-forward on suspension (no burst); `onBeat` from `requestAnimationFrame` using `now − outputLatency`; visual-only when `sink` is `null` or `running` is `false` (`onSoundUnavailable`); generation guard so stale timers/frames never schedule; log `click` and `click-cancel` through `src/lib/audio/log.ts`. No imports from Svelte, `$app/*`, i18n, state, shell or prefs. Make T010 pass.
- [X] T019 Add `sink(): AudioSink | null` to `PlaybackEngine` in `src/lib/audio/engine.ts` (depends on T007): unlocks within the gesture, returns the shared context and its volume→mute chain, `running` resolves `true` after `resume()` (or at once if already running) and `false` if `resume()` rejects or the engine has failed. Sources started on it are not part of the active request, so `stop()` for any reason, including `'hidden'` and `'navigate'`, never touches them. Extend the engine tests under `tests/unit/audio/` accordingly.
- [X] T020 Add `playback.clickSink(): AudioSink | null` to `src/lib/state/playback.svelte.ts` (`engine.sink()` + `markUnlocked()`, called from a gesture). It is the only importer of the engine. `playback.stop(reason)` stays unchanged and `playback.sequencePlaying` is never set by the metronome. Add tests to `tests/unit/playback-host.test.ts`: `stop('hidden')` does not halt click sources; every other tool still stops.

**Checkpoint**: `pnpm vitest run tests/unit/audio tests/unit/metronome tests/unit/playback-host.test.ts` is green. The scheduler is verified without a browser.

---

## Phase 3: User Story 1 - Run a steady, trustworthy click (Priority: P1) 🎯 MVP

**Goal**: Open `/metronome`, keep 85 BPM / 4 beats, press Start Training, hear an accurate click (accent on beat 1) with dots and status stepping in step, that continues in a hidden tab.

**Independent Test**: Open `/metronome`, press Start Training. The first click sounds ≤ 50 ms after the press, clicks repeat at the set tempo with an accent every 4th click, and the dots/status step `BEAT 1/4`…`4/4`.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [X] T021 [P] [US1] Write `tests/unit/metronome/store.test.ts` (jsdom, uses `resetMetronomeForTests` with fake sink/clock/frames) for the start path: M1 (first open settings/85/4), M3 (`toggle()` from settings calls `playback.clickSink()` synchronously), M8 (`playback.stop('hidden')` and a hidden `visibilitychange` leave `phase = 'running'`), M9 (`announcement` changes on Start only, never on `onBeat`), M10 (null sink or `running = false` → run proceeds, `beat` steps, `soundNotice = true`), M12 (muting mid-run leaves `phase = 'running'`), SC-003 (first click ≤ 0.05 s after the press and not before `currentTime`).
- [X] T022 [P] [US1] Write `e2e/metronome.spec.ts` flows for US1 (desktop, reads `window.__fmAudioLog`): US1-1 (home → Metronome card → Start; 4 dots; status steps `BEAT 1/4`…`4/4`; `click` entries accent on beat 1 only; 2 clicks to reach a running click, SC-005), US1-2 (beats 2 → `BEAT n/2`; set via the UI built in US3, so mark the beats-2 case `test.fixme` until T041 and unmark it there), US1-4 (log shape only: the first `click` entry carries `pressedAtMs` and has `when ≥ contextTime`; the ≤ 50 ms press-to-click latency is asserted on the fake clock in T021 (SC-003), never against wall-clock time here), US1-5 (set `document.visibilityState = 'hidden'`, dispatch `visibilitychange`, then `expect.poll` until at least 4 more `click` entries with consecutive `index` values are logged — no fixed wait and no elapsed-time assertion; no hidden `stop` affects the run, `data-phase` stays `running`), FR-018 (mute mid-run: status keeps stepping), FR-027 (`__fmAudioFault = 'context'` → dots step and the dismissible one-line notice shows), C X failure fallback (arm `__fmFault = { metronome: 1 }` before load → the `FailureView` shows inside `main`, the app bar and nav stay operable, a `[fretboard-master] failure` console record is logged, and its Reset brings back the settings view at 85/4; same pattern as `e2e/resilience.spec.ts`).

### Implementation for User Story 1

- [X] T023 [US1] Implement the runes store `src/lib/state/metronome.svelte.ts` (depends on T015–T020): `RunPhase`, `phase`, `settings`, `beat`, `dots` (derived with `beatDots`), `announcement`, `soundNotice`, `generation`, `toggle()` for the `settings → starting → running` path (calls `playback.clickSink()` synchronously, then `scheduler.start({ bpm, beats, startBeat: 1, run, pressedAtMs })`), `onBeat` → `beat`, `onSoundUnavailable` → `audio = 'visual'` + `soundNotice`, `dismissSoundNotice()`, `screenChanged()` (halt with reason `'leave'`, back to settings with `DEFAULT_SETTINGS`), `resetMetronomeForTests(deps?)`. The store is the only module that creates a `ClickScheduler`. Announce `metronome_announce_started` with `{ bpm, beats }` on Start only. Make T021 pass.
- [X] T024 [P] [US1] Create `src/lib/tools/metronome/StatusBox.svelte`: bordered box (`--color-border`, `--radius-md`), `p.position` in small caps with `metronome_status_beat` / `metronome_status_beat_none` as real DOM text, `p.tempo` with `.digits` (`--color-accent`, `tabular-nums`, `--metronome-tempo-size`) and `.unit` (`metronome_bpm_unit`), and `ol.dots[aria-hidden="true"]` with one `li.dot[data-state=lit|played|upcoming]` per beat. Sizes from `--metronome-dot-size`. Lit = `--color-accent` fill, played = accent at the dimmed opacity token, upcoming = `--color-border`. Opacity-only transition at `--duration-fast`, instant under `prefers-reduced-motion: reduce`.
- [X] T025 [P] [US1] Add a `metronome` icon to `src/lib/shell/BarIcon.svelte` (`BarIconName`). Used by the nav in US4 and by the home card.
- [X] T026 [US1] Create `src/lib/tools/metronome/MetronomePanel.svelte` (depends on T023, T024): `section[aria-labelledby="panel-heading"][data-phase]` with `h2#panel-heading` = `metronome_panel_heading` and no mode tabs; in the settings phase a full-width accent **Start Training** button (play icon, `metronome_start`) calling `metronome.toggle()`; in `starting`/`running`/`paused` the `StatusBox` and a `div[role="status"][aria-live="polite"].sr-only` bound to `metronome.announcement`; the one-line dismissible notice for `soundNotice` (`metronome_sound_unavailable`); `data-print="omit"`. Move focus to the main button after Start. The BPM/beats rows are added in US3 and the Pause/Reset controls in US2.
- [X] T027 [US1] Create `src/lib/tools/metronome/MetronomeLayout.svelte` (depends on T026): own slim shell with `<header class="app-bar">` containing only `AppNav`, `SoundControl` and `LanguagePanel` (no `TuningBadge`, `StopButton`, `ShareButton`, `InstrumentButton`, `NotationToggle`, legend, describe-view or address sync), `<h1 tabindex="-1">` = tool name, `<svelte:head><title>` from `screenTitle`, the `MetronomePanel` wrapped in `<svelte:boundary onerror={(e) => recordFailure(null, e)}>` whose `failed` snippet renders `FailureView` with a reset that calls `metronome.screenChanged()` then `boundaryReset()` (C X: never a blank main area; same pattern as `ToolLayout`), and `onDestroy` → `metronome.screenChanged()`. `MetronomePanel` calls `maybeFault('metronome')` during render so the fallback is testable (T022).
- [X] T028 [US1] Create `src/routes/metronome/+page.svelte` rendering `<MetronomeLayout />` (prerendered like `src/routes/caged/+page.svelte`), and call `preferences.toolOpened('metronome')` the way other tool pages do.
- [X] T029 [US1] Edit `src/routes/+layout.svelte` so `beforeNavigate` also calls `metronome.screenChanged()` (FR-017), and edit `src/lib/state/shortcuts.svelte.ts` so `runShortcut` returns `false` for every action when `screen === 'metronome'` (P . , L N inert, FR-023). Add a unit case for the shortcut guard and a route test under `tests/unit/routes` if a pattern exists.
- [X] T030 [US1] Make T022 pass: `pnpm build:test && pnpm test:e2e:fast e2e/metronome.spec.ts`. Fix any timing or log-shape issue in the scheduler or store, not in the test.

**Checkpoint**: US1 works alone: Start produces a steady, accented click with synced dots, survives a hidden tab, and runs visually without Web Audio. Verify with `pnpm vitest run tests/unit/metronome tests/unit/audio` and `pnpm test:e2e:fast e2e/metronome.spec.ts`.

---

## Phase 4: User Story 2 - Pause, resume and reset (Priority: P2)

**Goal**: Pause freezes on the last sounded beat, Resume plays the next beat within 50 ms, Reset returns to the settings view with values kept; Space and Esc drive them.

**Independent Test**: Start, Pause on beat 3, Resume → the next click is beat 4, then accented beat 1; Reset → settings view with the same values.

### Tests for User Story 2 ⚠️

- [X] T031 [P] [US2] Extend `tests/unit/metronome/store.test.ts` with M2 (setters/steps are no-ops outside `settings`), M4 (`toggle()` ×10 within 1 s on the fake clock leaves ≤ 1 live segment and logs no duplicate `(run, index)`), M5 (pause on audible beat 3 of 4 freezes `beat = 3`; resume's next `onBeat` is 4, then 1; pause at `beat = 0` resumes at beat 1), M6 (`reset()` keeps `settings`, `phase = 'settings'`, `beat = 0`, scheduler halted; no-op in settings), M7 (`screenChanged()` restores `DEFAULT_SETTINGS`), M9 (announcement changes exactly on Start, Pause, Resume, Reset), M11 (`onSuspended` → `paused` at the last audible beat with the paused announcement), `starting` ignores `toggle()`.
- [X] T032 [P] [US2] Extend `e2e/metronome.spec.ts` with US2-1/2 (wait for `BEAT 3/4` → Pause → Resume: no `click` with `when` after the pause instant before Resume; first click after Resume is beat 4, then accented beat 1, and carries the Resume `pressedAtMs`; the ≤ 50 ms Resume latency is asserted on the fake clock in T031 (M5), not against wall-clock time here), US2-3 (Reset → settings view, values kept), US2-4 (Space toggles start/pause/resume, exactly one toggle also with the main button focused; Esc resets; Esc in settings does nothing), FR-017 (Start → navigate to Notes → back: settings at 85/4, `click-cancel` with reason `leave`), FR-023/024 (no Share, TuningBadge, Stop button or instrument button on `/metronome`; P/L/N do nothing), FR-028 (10 rapid Space presses: no duplicate `(run, index)`).
- [X] T033 [P] [US2] Write `tests/unit/metronome/panel.test.ts` (jsdom): the run controls render per phase (Pause → Resume with accessible name in sync), Reset's `aria-label` and `title` both equal `m.metronome_reset()` and follow the active locale (assert in en and pt-BR, never a literal "Reset"), the Space/Esc page handler calls `toggle()`/`reset()` once per press and ignores guarded targets, focus moves to Pause after Start and to Start Training after Reset, and focus stays on the main button across Pause ⇄ Resume.

### Implementation for User Story 2

- [X] T034 [US2] Extend `src/lib/state/metronome.svelte.ts` (depends on T023): `toggle()` for `running → pause()` (scheduler `halt('pause')` returns the frozen beat; announce `metronome_announce_paused` with `{ beat, beats }`) and `paused → resume()` (start a new segment with `startBeat = (beat mod beats) + 1`, or 1 when `beat = 0`; announce `metronome_announce_resumed`); `reset()` (`starting | running | paused → settings`, values kept, `halt('reset')`, announce `metronome_announce_reset`); `onSuspended` → paused; `generation` guard on every transition; setters ignored outside `settings`. Make T031 pass.
- [X] T035 [US2] Create `src/lib/tools/metronome/RunControls.svelte`: full-width main button (**Pause**, or accent **Resume** with a play icon when paused) and a small **Reset** square ≥ `--target-min` using `--color-danger` / `--color-danger-text` with the ↺ icon, `aria-label={m.metronome_reset()}`, `title={m.metronome_reset()}` (catalog bindings, never literal text, C VIII) and a `:focus-visible` tooltip matching the bar's compact-label pattern. `RunControls.svelte` is the only file that references `--color-danger`. Use `metronome_pause`, `metronome_resume`, `metronome_reset`.
- [X] T036 [US2] Wire `RunControls` into `MetronomePanel.svelte` for the `starting | running | paused` phases, and add the page-level `keydown` handler (on `svelte:window`, active only while the route is shown) using `matchMetronomeKey` with `{ phase, disclosureOpen }` (derive `disclosureOpen` the way the existing Esc handling for the sound/language disclosures does) and `targetActivates`; call `metronome.toggle()` / `metronome.reset()` and `preventDefault` when handled. Make T033 pass.
- [X] T037 [P] [US2] Add the Metronome group to `src/lib/shell/ShortcutList.svelte`: a second `<dl>` titled `shortcuts_metronome_heading` with `shortcuts_key_space` → `shortcuts_metronome_toggle` and `shortcuts_key_escape` → `shortcuts_metronome_reset`, outside the character-key switch and labelled always on. Update `tests/unit/shortcut-list.test.ts` and `e2e/about.spec.ts`.
- [X] T038 [US2] Run `pnpm vitest run tests/unit/metronome tests/unit/shortcut-list.test.ts` and `pnpm build:test && pnpm test:e2e:fast e2e/metronome.spec.ts e2e/about.spec.ts`.

**Checkpoint**: US1 and US2 both work: Start, Pause, Resume and Reset by button and by keyboard, with no duplicate streams.

---

## Phase 5: User Story 3 - Choose tempo and beats per loop (Priority: P2)

**Goal**: BPM (30–300, default 85) and # of Beats (1–16, default 4) rows, each with a slider and a −/value/+ pill, usable from 320 to 2560 CSS px.

**Independent Test**: Adjust each row by slider and pill, confirm limits and defaults, start, and see the chosen values in the running view.

### Tests for User Story 3 ⚠️

- [X] T039 [P] [US3] Extend `tests/unit/metronome/panel.test.ts` (jsdom) for `ValueRow` and the settings view: defaults 85/4; `+` disabled at 300 and 16, `−` disabled at 30 and 1; slider and pill stay in sync; PageUp/PageDown step ±10 and Home/End jump to the limits; `<output>` is a read-only readout; the buttons have the accessible names `metronome_bpm_decrease/_increase` and `metronome_beats_decrease/_increase`; slider exposes min, max, value and `aria-valuetext`; the settings are not editable once running.
- [X] T040 [P] [US3] Extend `e2e/metronome.spec.ts` with US3-1/2 (first open 85/4; + at 300 disabled; slider and pill in sync; Home/End go to the limits) and US3-3 (viewports 1024 and 2560, and a 320 CSS px reflow: pill ≥ 96 px wide, no horizontal page scroll, slider shrinks first; run once with pt-BR at 200 % text zoom). Add the screenshot test named "metronome views" (settings, running, paused; light and dark; desktop only).

### Implementation for User Story 3

- [X] T041 [US3] Create `src/lib/tools/metronome/ValueRow.svelte` (depends on T015, T023): `<label for>` on the left, a native `input[type=range]` (`min`, `max`, `step="1"`, `aria-valuetext`; PageUp/PageDown ±10 through a keydown handler that calls the store; Home/End native) in the middle, and the pill on the right: `button` − (`disabled` at the limit, disabled tokens, never red), `<output aria-live="off" for>` readout with `tabular-nums`, `button` + . Grid `grid-template-columns: max-content minmax(0, 1fr) minmax(var(--pill-min-inline), max-content)`. Props: label, min, max, value, labels for the two buttons (passed from the catalog: `m.metronome_bpm_decrease()` / `_increase()`, `m.metronome_beats_decrease()` / `_increase()`, bound to each button's `aria-label`; no literal text, C VIII), `onset`, `onstep`. Make T039 pass.
- [X] T042 [US3] Add the BPM row (30–300, `metronome.setBpm` / `stepBpm`) and the # of Beats row (1–16, `metronome.setBeats` / `stepBeats`) to the settings view of `MetronomePanel.svelte`, above Start Training; the running view reads the snapshot taken at Start. Unmark the `test.fixme` for US1-2 in `e2e/metronome.spec.ts` (T022).
- [X] T043 [US3] Generate the baselines: `pnpm playwright test e2e/metronome.spec.ts -g "metronome views" --project=desktop --update-snapshots`. Then run `pnpm vitest run tests/unit/metronome` and `pnpm build:test && pnpm test:e2e:fast e2e/metronome.spec.ts`.

**Checkpoint**: Settings, running and paused views are complete and responsive. US1–US3 work independently.

---

## Phase 6: User Story 4 - Reach the tool, in my language and theme, accessibly (Priority: P3)

**Goal**: A fourth home card and nav entry, three languages, every theme, reduced motion, screen-reader and keyboard-only support.

**Independent Test**: Switch language, theme and reduced motion, then do a full start/pause/resume/reset flow by keyboard only; axe is clean.

### Tests for User Story 4 ⚠️

- [X] T044 [P] [US4] Update the existing unit tests to expect the 4th tool: `tests/unit/home-screen.test.ts` (4th `ToolCard`, href `/metronome`, "continue" mark when `lastTool === 'metronome'`), `tests/unit/app-nav.test.ts` (Metronome 4th with icon `metronome`; no link carry), `tests/unit/routes` tests if they enumerate routes. Make them fail first.
- [X] T045 [P] [US4] Update `tests/unit/reserved-colors.test.ts`: `--color-danger` has ΔE ≥ 10 from `--fb-color-root` in every set (light, dark, high contrast), contrast ≥ 3:1 against the surface, and is referenced only in `src/lib/tools/metronome/RunControls.svelte` (FR-021). Tune the token values in `src/lib/styles/tokens.css` until it passes.
- [X] T046 [P] [US4] Write `e2e/metronome-a11y.spec.ts`: axe (`@axe-core/playwright`) with zero violations in the settings, running and paused views, in light and dark (SC-008); the whole flow by keyboard only (SC-007); the live region only ever holds run-state announcements (never per beat); pt-BR and es show translated labels including the status line (US4-2); forced-colours and reduced-motion smoke (no transition on the dots).
- [X] T047 [P] [US4] Update `e2e/home.spec.ts` and `e2e/navigation.spec.ts` for the 4th card and nav entry (order Notes, Triads, CAGED, Metronome; card opens `/metronome`).

### Implementation for User Story 4

- [X] T048 [US4] Make `HomeScreen` and `AppNav` render the 4th entry: `src/lib/shell/HomeScreen.svelte` (or its existing location) iterates `TOOLS` and shows the "continue" mark for `lastTool === 'metronome'`; `src/lib/shell/AppNav.svelte` shows Metronome 4th with the `metronome` icon and skips link carry (`linkTools`) because it is not a `LinkedTool`. Make T044 and T047's unit-side pass.
- [X] T049 [US4] Run the i18n checks: `pnpm vitest run` on the existing `no-raw-text` and i18n-gap tests (find them with `grep -rl "no-raw-text\|i18n" tests/unit`) to confirm all new keys exist in en, pt-BR and es with matching params, and that no component hard-codes text.
- [X] T050 [US4] Verify high-contrast and forced-colours handling of `--color-danger`, lit/dimmed dots and disabled pill buttons in `src/lib/styles/tokens.css` and the component styles, and check reduced-motion behaviour. Make T045 and T046 pass: `pnpm build:test && pnpm test:e2e:fast e2e/metronome-a11y.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts`.

**Checkpoint**: All four stories are complete: `pnpm vitest run tests/unit/home-screen.test.ts tests/unit/app-nav.test.ts tests/unit/reserved-colors.test.ts` and the a11y/home/navigation e2e specs pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T051 [P] Write `docs/adr/0030-metronome-click-scheduler.md`: the shared-context lookahead scheduler, the hidden-rule exception (clicks outside the engine's active request) and the `ToolId` / `FretboardToolId` split. Follow the format of the existing ADRs in `docs/adr/`.
- [X] T052 [P] Add `/metronome` to `lighthouserc.cjs` with the tool-screen `interactive ≤ 3500`, score ≥ 0.9 and CLS ≤ 0.1 assertions, like the other tool routes. Do not run `pnpm lhci` locally.
- [X] T057 [P] Extend `e2e/perf.spec.ts` (constitution VI; SC-008) for `/metronome`, both `/m` modes, Chromium 4× CPU throttle, measured in the page like the existing cases: (a) home → Metronome card and Notes → Metronome nav link, median pointerdown → `<h1>` focused ≤ 300 ms (`timeClickToFocus`); (b) Start Training tap-to-sound: 5 samples of pointerdown on Start Training → the run's first `click` entry `scheduledAtMs` (Reset between samples), median ≤ 100 ms. Run `pnpm build:test && pnpm test:e2e:fast e2e/perf.spec.ts`.
- [X] T053 [P] Add a note to the constitution follow-up list (the file the wave-end compliance review uses, e.g. `specs/autonomous/breakdown/008-ratios-training/`) that the source-layout route list gains `/metronome` (a PATCH wording update). Do not edit `.specify/memory/constitution.md` in this slice.
- [X] T054 Review the code for the points in the plan: no dead exports, `src/lib/audio/**` imports nothing from Svelte/state/shell/prefs, only `playback.svelte.ts` imports the engine, only `metronome.svelte.ts` creates a scheduler, no literal colours, no `console` output.
- [X] T055 Run the `quickstart.md` validation: sections 1 and 2 commands, then the one-time manual listening check (§3) in Chrome, Firefox and Safari. _(§1: 13 files / 410 unit tests pass. §2: `pnpm build:test` + `test:e2e:fast` on metronome, metronome-a11y, home, navigation, about specs: 86 passed. §3 is a manual check, see below.)_

**Manual checks** (need a human with real browsers; not run here, record in the PR description): quickstart §3 listening check in Chrome, Firefox and Safari: accent audible on every 4th click at 85/4 with no stutter over 1 min; click continues across a 30 s tab switch; 300 BPM for 10 min shows no phase drift against a hardware metronome.
- [X] T056 Run all local gates once: `pnpm verify`. Confirm the initial JS stays ≤ 150 KB gzip (R-17: fall back to a lazy route only if it fails). The full Playwright matrix and Lighthouse run in CI only. _(Partial: check, lint, format, unit+coverage, build and bundle (≤ 150 KB) pass. Desktop e2e: 1385 passed; fixed two stale tests (`perf.spec.ts` Metronome card name after "Continue", `preferences.spec.ts` card count 3→4). Still failing here only for sandbox reasons: ~25 screenshot baselines (the sandbox renders a different font from the committed Linux baselines, and the new Metronome nav entry also shifts every shell screenshot; regenerate in the CI font environment, not here) and non-Metronome 4× CPU-throttle perf timings (e.g. nav median 355 ms vs 300 ms). Needs CI to confirm.)_
  - **T056 note (operator decision: CI is the gate for screenshots and perf).** Final local `pnpm verify`: check, lint, format, unit+coverage, build and bundle (≤ 150 KB) pass. In `test:e2e:fast`, 1390 passed; the stale card-count assertions found on this run were fixed (`caged.spec.ts` Q1 count 3→4 and nav list gains Metronome; `nojs.spec.ts` ×2 count 3→4). The only remaining failures are `toHaveScreenshot` mismatches and 4× CPU-throttle timing limits:
    - Screenshots: `caged-tm9.spec.ts` (views 15, 15 left-handed, slice 015 Open G, Drop D, views 16–20), `fretboard.spec.ts` all-markers grayscale, `notation.spec.ts` accidental glyphs, `notes-tm9.spec.ts` views 1–5, `responsive-layout.spec.ts` arrangement reflow / wide-side / wide-stacked, `theme.spec.ts` dark shots (Notes, Triads with comparison, CAGED with layers), `triads-compare.spec.ts` grayscale, `triads-tm9.spec.ts` views 6–14 and 22.
    - Timing: `perf.spec.ts` nav home→tool/tool→tool (`/m` 204 and aborted), Notes→Triads carry, seeded preferences control change, seven strings × 24 frets, handedness/orientation, CAGED open and key change. No Metronome perf case fails.
    - Baselines must be regenerated with `.github/workflows/update-snapshots.yml` after the PR opens. No baselines were regenerated or committed here.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. Start at once.
- **Foundational (Phase 2)**: needs Phase 1 (T007, T008 for the scheduler and engine). Blocks every story.
- **US1 (Phase 3)**: needs Phase 2. It is the MVP.
- **US2 (Phase 4)**: needs US1 (store and panel exist). Extends the same store and panel files.
- **US3 (Phase 5)**: needs US1 (panel). Independent of US2 except that both edit `MetronomePanel.svelte` and `panel.test.ts`, so do not run them in parallel on the same files.
- **US4 (Phase 6)**: needs T001, T003, T025 and the route from US1. The unit work (T044, T045, T048) can run beside US2/US3. The a11y spec (T046) is best run once US2 and US3 are done so all views exist.
- **Polish (Phase 7)**: after all stories.

### Within Each Story

- Tests first and failing, then the implementation. Pure modules before the store, store before components, components before the route and e2e.

### Task-level notes

- T018 needs T007, T014. T019 needs T007. T020 needs T019. T023 needs T015–T020.
- T026 needs T023, T024. T027 needs T026. T028 needs T027. T029 needs T023.
- T034 needs T023. T036 needs T034, T035, T017. T041 needs T015, T023. T042 needs T041.

## Parallel Opportunities

- Phase 1: T002–T008 are [P] after T001.
- Phase 2: all tests T009–T013 in parallel. Then T014–T017 in parallel (different files). T018 after T014; T019 beside T018.
- US1: T021, T022, T024, T025 in parallel.
- US2: T031, T032, T033 in parallel (T031 and T033 touch different files). T037 beside T035.
- US3: T039 and T040 in parallel.
- US4: T044–T047 in parallel.
- Polish: T051, T052, T053, T057 in parallel.

### Parallel Example: Foundational

```bash
Task: "Write tests/unit/audio/click.test.ts (T009)"
Task: "Write tests/unit/audio/metronome.test.ts (T010)"
Task: "Write tests/unit/metronome/settings.test.ts (T011)"
Task: "Write tests/unit/metronome/view.test.ts (T012)"
Task: "Write tests/unit/metronome/keys.test.ts (T013)"
# then
Task: "Implement src/lib/audio/click.ts (T014)"
Task: "Implement src/lib/state/metronome-settings.ts (T015)"
Task: "Implement src/lib/state/metronome-view.ts (T016)"
Task: "Implement src/lib/state/metronome-keys.ts (T017)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup, then Phase 2 Foundational (the scheduler is fully unit-tested with fakes).
2. Phase 3 US1: Start Training at the default 85/4 gives a steady click.
3. **Stop and validate**: `pnpm vitest run tests/unit/audio tests/unit/metronome` and `pnpm test:e2e:fast e2e/metronome.spec.ts`. Listen once in a real browser.

### Incremental Delivery

1. Setup + Foundational → click engine proven by tests.
2. US1 → MVP (steady click, synced display, hidden-tab safe).
3. US2 → Pause/Resume/Reset and Space/Esc.
4. US3 → BPM and beats rows, responsive layout, screenshots.
5. US4 → home card, nav, i18n, a11y completion.
6. Polish → ADR, Lighthouse, `pnpm verify`.

---

## Notes

- Commit after each task or logical group. Do not run `pnpm test:e2e` or `pnpm lhci` locally.
- Timing is verified only through the injectable `ClickPort`, `TimerClock` and `FrameClock`, never real time.
- Where the spec or brief says "orange", use `--color-accent`. `--color-danger` is for Reset only.
