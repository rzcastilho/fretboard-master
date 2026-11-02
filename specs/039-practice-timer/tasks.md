---

description: "Task list for 039 Practice Timer"
---

# Tasks: Practice Timer

**Input**: Design documents from `/specs/039-practice-timer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (timer-store-api, chime-api, preferences-record, timer-card-ui), quickstart.md

**Tests**: Requested. The constitution (IV, Test-First) and the contracts (M1–M6, S1–S15, A1–A9, C27–C35, U1–U13) require them. Write each test first and see it fail before the implementation.

**Organization**: Grouped by user story. Foundational work (pure model, chime, prefs codec, catalog, tokens) comes first, so each story is a small increment on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, from spec.md
- A unit test file that renders a component or touches `document`, `window` or `localStorage` MUST start with `// @vitest-environment jsdom`.

## Verification (CLAUDE.md)

- Per task: `pnpm vitest run <touched test paths>`.
- E2E: `pnpm build:test` once after `src/` changes, then `pnpm test:e2e:fast e2e/metronome-timer.spec.ts`.
- New screenshots: `pnpm playwright test e2e/metronome-timer.spec.ts -g "timer card" --project=desktop --update-snapshots`.
- `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.

---

## Phase 1: Setup

**Purpose**: The shared constants, strings and tokens every later task reads.

- [X] T001 [P] Add the 9 catalog keys from data-model §5 (`timer_heading`, `timer_presets_label`, `timer_preset` with `{minutes}`, `timer_start`, `timer_pause`, `timer_readout_label`, `timer_announce_second`, `timer_announce_seconds` with `{count}`, `timer_announce_finished`) with the exact en, pt-BR and es texts, to `messages/en.json`, `messages/pt-BR.json` and `messages/es.json`. Regenerate the Paraglide output the way the repo does (see `package.json` scripts)
- [X] T002 [P] Add the 6 design tokens from data-model §6 to `src/lib/styles/tokens.css`: `--color-accent-secondary` (`light-dark(#1d6b45, #3fd99a)`, mapped to `--color-text` under `prefers-contrast: more` and to `Highlight` under forced colours), `--timer-readout-size: 3.5rem`, `--timer-play-size: 3rem`, `--timer-ghost-opacity: 0.12`, `--timer-flash-dim: 0.25`, `--timer-flash-period: 1s` (`0s` under `prefers-reduced-motion: reduce`). Tune the secondary accent so `tests/unit/**/reserved-colors.test.ts` still passes (it must differ from `--fb-color-fifth`)
- [X] T003 [P] Extend `AudioLogEntry` in `src/lib/audio/types.ts` with the variant `{ type: 'chime', when, contextTime, lateMs }` (test builds only, chime-api A7)

---

## Phase 2: Foundational (blocking)

**Purpose**: The pure model, the chime and the preferences codec. No user story can start before these are done.

**⚠️ CRITICAL**: complete this phase before any user story.

### Tests first

- [X] T004 [P] Write `tests/unit/metronome/timer-model.test.ts` for M1–M6 (tables plus fast-check): `toPreset` accepts exactly integers 1–10; `secondsLeft` (120000→120, 119001→120, 119000→119, 0→0, -5→0, NaN→0); `formatReadout` (600→`10:00`, 119→`01:59`, 0→`00:00`, round trip for 0–5999); `nextTickDelay` (in `(TICK_SLACK_MS, 1000+TICK_SLACK_MS]`, and after waiting it `secondsLeft` is exactly one lower); `shouldChime(2000)` true and `shouldChime(2001)` false; `announcementFor` (null when equal or `next > 10`, `seconds` for 2–10, `second` for 1, `finished` for 0)
- [X] T005 [P] Write `tests/unit/audio/chime.test.ts` for A1–A9 using the existing fake `AudioPort`: length `round(0.8 × 48000)` and the rate fallback to 48 000; peak 0.5 ± 1e-6, first sample 0, quiet tail; DFT spot check at 880 and 1320 Hz against 1000 and 2400 Hz; one buffer and one source connected to `sink.destination` and never to `port.destination`; returns `false` and creates nothing when `port.state !== 'running'`; returns `false` when any Web Audio call throws; log entry appended in test builds; the metronome engine and schedulers are untouched; the source disconnects on `ended`
- [X] T006 [P] Add tests C27–C31 and C33 to `tests/unit/prefs/schema.test.ts`: a record without `timer` parses to 2 (all 035–038 fixtures); integers 1–10 parse to themselves; `"5"`, 5.5, 0, 11, -1, null, true and `{}` parse to 2 while `ratios`, `plain`, `speed`, `mode` and other fields keep their values; serialize writes `timer` only when ≠ 2, as the last key of `metronome`; with `timer: 2` the bytes equal 038's; a record whose only non-default is `timer` writes `"metronome":{"timer":n}`; the round-trip property draws `timer` from 1–10; parity: `METRONOME_TIMER_DEFAULT === DEFAULT_TIMER_MINUTES` and `METRONOME_LIMITS.timer` equals `[min, max]` of `TIMER_PRESETS`
- [X] T007 [P] Add the three fixtures in `tests/unit/prefs/fixtures/`: `metronome-timer.txt` (`metronome: { timer: 5 }`), `metronome-timer-with-plain.txt` (`plain` from 038, `mode: "plain"`, `timer: 10`) and `metronome-timer-invalid.txt` (`mode: "speed"`, `timer: "7"` → `timer: 2`, mode kept), and wire them into the fixture test. Do not change any existing fixture
- [X] T008 [P] Add test C32 to `tests/unit/prefs/session.test.ts`: `remember({ metronome: { timer: 5 } })` keeps the stored `ratios`, `plain`, `speed`, `mode`; `remember({ metronome: { ratios, plain, speed, mode } })` keeps the stored `timer`

### Implementation

- [X] T009 [P] Implement `src/lib/state/timer-model.ts` (pure, no Svelte): `TIMER_PRESETS = [1..10]`, `DEFAULT_TIMER_MINUTES = 2`, `FLASH_MS = 5000`, `LATE_CHIME_LIMIT_MS = 2000`, `TICK_SLACK_MS = 15`, `TimerStatus`, `TimerAnnouncement`, `toPreset`, `secondsLeft`, `formatReadout` (clamped 0–5999, `MM:SS`), `nextTickDelay` (= `r − (secondsLeft(r) − 1) × 1000 + TICK_SLACK_MS`), `shouldChime`, `announcementFor`. Make T004 pass
- [X] T010 [P] Implement `src/lib/audio/chime.ts` (framework-free; imports only `./types`, `./log` and the `AudioSink` type from `./engine`): `CHIME_S = 0.8`, `renderChime(sampleRate)` (880 Hz amp 1 plus 1320 Hz amp 0.5, 5 ms linear attack, exponential decay to 0.1 %, peak 0.5) and `playChime(sink, lateMs)` (running context only, `AudioBufferSource → sink.destination`, start at `port.currentTime`, swallow errors with a comment citing FR-008, log in test builds, disconnect on `ended`). Make T005 pass
- [X] T011 Update `src/lib/prefs/schema.ts`: add `METRONOME_TIMER_DEFAULT = 2` and `METRONOME_LIMITS.timer = [1, 10]`; add `timer: number` to `Preferences['metronome']` with `DEFAULT_PREFERENCES.metronome.timer = 2`; parse with `v.fallback(intIn([1, 10]), 2)` only when `metronome` is a plain object, otherwise 2; serialize `timer` only when ≠ 2 as the last key, and omit the `metronome` entry when every part is default. Keep `version: 1`. Depends on T009 (parity test). Make T006 and T007 pass
- [X] T012 Update `src/lib/prefs/session.ts`: make `PreferencesPatch.metronome` a `Partial<Preferences['metronome']>` and merge `metronome` one level deep in `remember()`, so existing callers that pass the whole object still work. Make T008 pass

**Checkpoint**: `pnpm vitest run tests/unit/metronome/timer-model.test.ts tests/unit/audio/chime.test.ts tests/unit/prefs/schema.test.ts tests/unit/prefs/session.test.ts` is green.

---

## Phase 3: User Story 1 - Time-box an exercise (P1) 🎯 MVP

**Goal**: Press play on the Metronome page and watch `02:00` count down to `00:00`, then see the flash and hear the chime. Pause, resume and restart from zero work.

**Independent Test**: Quickstart scenarios 1–4 and 20–22: start, pause and resume, finish, restart, late detection, audio fault.

### Tests first

- [X] T013 [P] [US1] Write `tests/unit/metronome/timer-store.test.ts` (fake clock, sink and chime through `resetTimerForTests`) for S1–S4, S8–S10, S12 and S14: initial state; `toggle()` calls `deps.sink()` once in the same call stack, then `01:59` after 1000 ms and `finished` after 120 000 ms; pause holds and resume continues, total time equals the preset (± `TICK_SLACK_MS`); restart from `finished` uses the full duration and clears `flashing`; chime called once with `lateMs ≤ 2000`; a clock jump past `endsAt + 2000` gives `finished` with no chime; a null sink gives `finished` with no chime; a chime that returns `false` or throws still leaves `finished` and `flashing true`; `flashing` lasts exactly `FLASH_MS`; the drift property under late callbacks (up to 900 ms) ends no later than `endsAt + 1000 ms` and `readout` equals `formatReadout(secondsLeft(endsAt − now))` at each tick; `restore(7)` and `restore('x')`
- [X] T014 [P] [US1] Write `tests/unit/metronome/timer-card.test.ts` (`// @vitest-environment jsdom`) for the play-related parts of U3, U4 and U12: the play button's accessible name is "Start timer" when stopped, paused or finished and "Pause timer" when running, and the icon swaps; the readout has `role="timer"`, the `aria-label` from the catalog and no `aria-live`; the ghost layer is `aria-hidden`; `data-status` reflects the store; `data-flash` appears only while flashing
- [X] T015 [P] [US1] Create `e2e/metronome-timer.spec.ts` with scenarios 1, 2, 3, 4, 20 and 22 from quickstart.md, using `page.clock.install()` before navigation and `page.clock.runFor(ms)`, and observing the chime through `__fmAudioLog` (`type: 'chime'`) and `__fmAudioFault = 'context'` for the audio-fault case. Import the shared helpers the other metronome specs use

### Implementation

- [X] T016 [US1] Implement `src/lib/state/timer.svelte.ts`: the module-singleton runes store `timer` and `resetTimerForTests`, with the `TimerDeps` interface (clock, `sink` defaulting to `() => playback.clickSink()`, `chime` defaulting to `playChime`). State per data-model §2: `status`, `remainingMs`, `endsAt` (`clock.now()` + remaining), derived `seconds` and `readout`, `flashing`, `announcement`, captured sink. Implement `toggle()` (stopped/paused → running, running → paused, finished → restart from the full duration), a chained display tick via `nextTickDelay`, a separate one-shot end timer armed at play, zero detection (`lateMs = now − endsAt`, chime only if `shouldChime` and the sink is non-null; wrap the `deps.chime` call in a `catch` that is not empty — it logs the error in test builds via `$lib/audio/log` and leaves the timer finishing silently with a comment citing FR-008, since the constitution forbids empty `catch` blocks outside storage and measurement writes), and a 5 s flash timer. Clear all timers on every transition. It MUST NOT import `metronome.svelte.ts` (R-01). Add `restore(minutes)` (non-writing, invalid → 2). `selectPreset` is added in T022. Make T013 pass
- [X] T017 [US1] Create `src/lib/tools/metronome/TimerCard.svelte` following timer-card-ui §2: `<section class="timer" aria-labelledby="timer-heading" data-status data-flash?>`; a heading with the aria-hidden stopwatch SVG and `m.timer_heading()`; the readout (`role="timer"`, `aria-label`, an aria-hidden `88:88` ghost layer under the digits, tabular numerals); the round play/pause button (`--timer-play-size`, `aria-label` from `m.timer_start()` / `m.timer_pause()`, an aria-hidden play/pause icon, `onclick={timer.toggle}`); the polite sr-only status region. Tokens only, `data-print="omit"`, `max-inline-size: var(--metronome-panel-max)`. Render a static finished style for `data-status="finished"` and an animated flash (`steps(2)` over `--timer-flash-period`) while `data-flash` is set. The preset pills are added in T022. Make T014 pass
- [X] T018 [US1] Edit `src/lib/tools/metronome/MetronomeLayout.svelte` to render `<TimerCard />` inside `<main>` after the `<h1>` and before the metronome panel, wrapped in its own `<svelte:boundary>` with a `FailureView` fallback whose `reset` calls `timer.restore(timer.preset)`. It must sit outside `#metronome-mode-panel`, so it appears in every mode. Do not edit `metronome.svelte.ts` or `src/lib/audio/metronome.ts`

**Checkpoint**: `pnpm vitest run tests/unit/metronome/timer-store.test.ts tests/unit/metronome/timer-card.test.ts`, then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-timer.spec.ts`. US1 works with the default `2m`.

---

## Phase 4: User Story 2 - Choose and reset the duration (P1)

**Goal**: Pick 1m–10m, and re-tapping the selected preset resets the countdown.

**Independent Test**: Quickstart scenarios 5, 6, 7 and 27.

### Tests first

- [X] T019 [P] [US2] Add S5, S6 and S7 to `tests/unit/metronome/timer-store.test.ts`: `selectPreset(5)` from any status gives `stopped`, `05:00`, timers cleared and `flashing false`; `selectPreset(5)` while 5 is selected mid-run also resets to `05:00`; an invalid value changes nothing and writes nothing; each valid call calls `preferences.remember({ metronome: { timer: n } })` once (including when equal to the current preset), and `toggle`, ticks, zero and `restore` never write
- [X] T020 [P] [US2] Add U1, U2 and U8 to `tests/unit/metronome/timer-card.test.ts`: exactly ten buttons labelled `1m`…`10m` from the catalog inside a `role="group"` named "Timer length"; exactly one has `aria-pressed="true"` and it matches `timer.preset`; clicking calls `selectPreset`; the selected pill has the `--color-accent-secondary` outline, `--font-weight-bold` and a 2 × `--border-width` border (check the CSS tokens used)
- [X] T021 [P] [US2] Add scenarios 5, 6, 7 and 27 to `e2e/metronome-timer.spec.ts`: tapping `5m` while `2m` runs gives stopped `05:00`; re-tapping `5m` at 20 s resets; ten buttons, one pressed; `5m` then play is running after two taps

### Implementation

- [X] T022 [US2] Add `selectPreset(v)` to `src/lib/state/timer.svelte.ts` using `toPreset`: on a valid value set `preset`, `remainingMs = n × 60 000`, go to `stopped`, clear timers, `flashing` and `announcement`, and call `preferences.remember({ metronome: { timer: n } })` every time (FR-004, FR-011); invalid is a no-op. Make `restore` share the same reset path without the write. Make T019 pass
- [X] T023 [US2] Add the preset group to `src/lib/tools/metronome/TimerCard.svelte`: `<div role="group" aria-label={m.timer_presets_label()}>` with ten native `<button type="button" aria-pressed={n === timer.preset}>` showing `m.timer_preset({ minutes: n })`. Selected: `--color-accent-secondary` outline, bold weight and double border width. Unselected: `--color-border`. Pills are at least 24 × 24 px (`--target-min`) and wrap with `flex-wrap`. Make T020 pass

**Checkpoint**: unit and `pnpm test:e2e:fast e2e/metronome-timer.spec.ts` green for US1 and US2.

---

## Phase 5: User Story 3 - Timer and metronome stay independent (P1)

**Goal**: Neither side changes the other, and the timer survives mode tabs and navigation.

**Independent Test**: Quickstart scenarios 8–12 and 23.

### Tests

- [X] T024 [P] [US3] Add S13 and S15 to `tests/unit/metronome/timer-store.test.ts`: `metronome.toggle()`, `reset()`, `selectMode()`, `screenChanged()` and `restore()` leave every timer field unchanged; timer actions never call a metronome method and never change `metronome.phase`. Add a structural check (grep-style test or import assertion) that `timer.svelte.ts` does not import the metronome store and the metronome store does not import the timer
- [X] T025 [P] [US3] Add scenarios 8, 9, 10, 11, 12 and 23 to `e2e/metronome-timer.spec.ts`: metronome running while a `1m` timer finishes (clicks continue after the chime); a timer start with the metronome stopped logs no `click`; metronome Reset and Escape leave the timer counting; each mode tab shows the card and the same reading; navigating to `/notes` and back after 61 s shows a finished `00:00` with one chime logged while away; Space on a focused `3m` pill and Space or Enter on the play button never toggle the metronome (phase stays `settings`)

### Implementation

- [X] T026 [US3] Verify the independence guarantees against the code and fix any gap in `src/lib/state/timer.svelte.ts` or `src/lib/tools/metronome/TimerCard.svelte`: the store is a module singleton (so it survives tabs and routes), there is no new key handler, and the timer buttons are native buttons, so the existing `targetActivates` check in `src/lib/tools/metronome/MetronomePanel.svelte` ignores Space on them. If the tests show Space still toggles the metronome, fix it in that handler. Make T024 and T025 pass

**Checkpoint**: all P1 stories pass.

---

## Phase 6: User Story 4 - Remember my preset (P2)

**Goal**: The preset persists across reloads; a running countdown does not; Erase restores `2m`.

**Independent Test**: Quickstart scenarios 13–16.

### Tests first

- [X] T027 [P] [US4] Add C34 to `tests/unit/state/preferences-store.test.ts`: `preferences.start()` calls `timer.restore(p.metronome.timer)` (stopped, no write); `preferences.erase()` calls `timer.restore(2)`, stops a running countdown, and removes the stored `timer` key
- [X] T028 [P] [US4] Add scenarios 13, 14, 15 and 16 to `e2e/metronome-timer.spec.ts`: select `5m` and reload (pressed, `05:00`, stored `metronome.timer === 5`); a running countdown does not survive a reload; About → Erase preferences returns to `2m` with no `timer` key; seeded `metronome: { mode: "speed", timer: "7" }` gives `2m` with the Speed Training tab active

### Implementation

- [X] T029 [US4] Edit `src/lib/state/preferences.svelte.ts`: in `start()` apply `timer.restore(p.metronome.timer)` and in `erase()` apply `timer.restore(2)`. Also check that every place that saves the whole `metronome` entry (the 035–038 stores) passes through the one-level merge from T012, so it never drops `timer`. Make T027 pass
- [X] T030 [US4] Confirm C35 (share links unchanged): add or extend a test under `tests/unit/` for the share-link codec showing that no `timer` field is encoded or decoded, and make no change to `src/lib/link/`

**Checkpoint**: `pnpm vitest run tests/unit/state/preferences-store.test.ts tests/unit/prefs` and the US4 e2e scenarios green.

---

## Phase 7: User Story 5 - By ear and with a screen reader (P2)

**Goal**: Correct announcements for the last 10 seconds and zero, a silent but visible finish when muted, a static finish under reduced motion.

**Independent Test**: Quickstart scenarios 17, 18 and 19.

### Tests first

- [X] T031 [P] [US5] Add S11 to `tests/unit/metronome/timer-store.test.ts`: while running through the last seconds the store sets `'10 seconds'` … `'2 seconds'`, `'1 second'`, then `'Timer finished'` in order, using the catalog; nothing is set above 10 s; any user action sets `''`
- [X] T032 [P] [US5] Add U4, U5 and U6 to `tests/unit/metronome/timer-card.test.ts`: the status region is `role="status"` with `aria-live="polite"` and lives only inside the card; the readout is not a live region
- [X] T033 [P] [US5] Add scenarios 17, 18 and 19 to `e2e/metronome-timer.spec.ts`: muted run to zero shows the finished state (A4 routing already guarantees silence through the mute chain); with `page.emulateMedia({ reducedMotion: 'reduce' })` the readout's computed `animation-name` is `none` and the static highlight applies while `data-flash` is set; the polite region reads `''`, then `10 seconds` at 50 s, `5 seconds` at 55 s, `1 second` at 59 s and `Timer finished` at 60 s

### Implementation

- [X] T034 [US5] In `src/lib/state/timer.svelte.ts`, set `announcement` from `announcementFor(prev, next)` on each display tick and at zero, mapped to `m.timer_announce_seconds({ count })`, `m.timer_announce_second()` or `m.timer_announce_finished()`. Clear it on any user action. Make T031 pass
- [X] T035 [US5] In `src/lib/tools/metronome/TimerCard.svelte` and `src/lib/styles/tokens.css`, make sure that under `@media (prefers-reduced-motion: reduce)` the flash animation is `none`, `--timer-flash-period` is `0s` and `data-flash` shows a static highlight, and that mute does not hide the finished state. Make T032 and T033 pass

**Checkpoint**: all five stories pass.

---

## Phase 8: Polish & Cross-Cutting

- [X] T036 [P] Add scenarios 24 and 25 to `e2e/metronome-timer.spec.ts`: 320 px and 1024 px at 200 % text zoom in en, pt-BR and es (all ten pills visible and clickable, no horizontal page scroll, no overlap); `/metronome` at 1024×768 and 2560×1440 at 100 % zoom (timer card and all ten pills visible, no horizontal page scroll, no truncation or overlap, via `expectNoHorizontalScroll` and `expectNoTruncationOrOverlap` from `e2e/support/helpers`; constitution VII); `@axe-core/playwright` on `/metronome` in light, dark and `prefers-contrast: more`, while running and finished (zero violations). Fix any layout or contrast finding in `TimerCard.svelte` and `tokens.css`
- [X] T037 [P] Add scenario 28 to `e2e/metronome-timer.spec.ts` (`context.setOffline(true)`: run `1m` to zero, no network requests from the timer) and a no-JS check for U13 in the existing no-JS spec (`2m` pressed, `02:00` rendered)
- [X] T038 [P] Run the repo guard tests and fix findings: `no-raw-text.test.ts` and catalog parity (scenario 26, FR-014), `style-tokens.test.ts` (no literal colours, sizes or durations), `reserved-colors.test.ts` (root, third and fifth not referenced, secondary accent distinct from the fifth). Locate them with `Glob tests/unit/**/{no-raw-text,style-tokens,reserved-colors}*.test.ts`
- [X] T039 Add a screenshot test named "timer card" to `e2e/metronome-timer.spec.ts` (idle and finished states) and generate its desktop baseline locally with `pnpm playwright test e2e/metronome-timer.spec.ts -g "timer card" --project=desktop --update-snapshots`. Note in the PR that Linux baselines, and the refreshed `e2e/metronome.spec.ts` baselines (the card now sits above the panel), come only from `.github/workflows/update-snapshots.yml`
- [X] T040 Check the bundle against the budget (initial JS ≤ 160 KB gzip, about +2 KB expected) using the repo's bundle-size check
- [X] T041 Record the manual checks under a "Manual checks" note at the end of this file and list them in the PR description: (1) by ear, the chime is audible, under 1 s, distinct from the clicks, follows volume and is silent when muted; (2) in real desktop Chrome, a `1m` timer in a hidden tab for over a minute chimes within about 2 s of the end; (3) with VoiceOver or NVDA, seconds 10 to 1 and "Timer finished" are spoken politely and nothing earlier. Tick this task once the note is written
- [X] T042 Run `pnpm verify` once. Fix any failure, and do not run `pnpm test:e2e` or `pnpm lhci` locally

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (1)**: none. T001–T003 are parallel.
- **Foundational (2)**: after Setup. Tests T004–T008 are parallel. T009 and T010 are parallel. T011 depends on T009, T012 is independent of T011 (both touch different files).
- **US1 (3)**: after Phase 2. T016 → T017 → T018.
- **US2 (4)**: after US1 (it extends `timer.svelte.ts` and `TimerCard.svelte`). T022 → T023.
- **US3 (5)**: after US1 and US2, since it verifies independence over the finished card.
- **US4 (6)**: needs T011, T012 and T022. It can run in parallel with US3 and US5.
- **US5 (7)**: after US1. T034 touches `timer.svelte.ts` and T035 touches `TimerCard.svelte`.
- **Polish (8)**: after all stories.

### Story dependencies

- US1 is the MVP and stands alone.
- US2 extends the store and card from US1 (same files, so it is sequential in practice).
- US3, US4 and US5 are mostly tests plus small edits, and are independently testable after US1 and US2.

### Same-file caution

`timer.svelte.ts` (T016, T022, T034), `TimerCard.svelte` (T017, T023, T035), `timer-store.test.ts` (T013, T019, T024, T031), `timer-card.test.ts` (T014, T020, T032) and `e2e/metronome-timer.spec.ts` (T015, T021, T025, T028, T033, T036, T037, T039) are edited by several tasks. Do not run those in parallel with each other.

## Parallel examples

```text
# Phase 1
T001 messages/*.json   |  T002 tokens.css  |  T003 audio/types.ts

# Phase 2 tests, then implementation
T004 timer-model.test.ts | T005 chime.test.ts | T006 schema.test.ts | T007 fixtures | T008 session.test.ts
T009 timer-model.ts      | T010 chime.ts

# US1 tests
T013 timer-store.test.ts | T014 timer-card.test.ts | T015 e2e/metronome-timer.spec.ts
```

## Implementation strategy

1. **MVP**: Phases 1–3 (a working default-`2m` timer with flash and chime). Stop and validate with scenarios 1–4, 20–22.
2. Add US2 (presets), then US3 (independence checks), the other P1 stories.
3. Add US4 (persistence) and US5 (announcements, reduced motion), the P2 stories.
4. Polish, screenshots, manual checks and one `pnpm verify`.

## Manual checks

Human steps that cannot be automated (list them in the PR description):

1. By ear: the chime is audible, under 1 s, distinct from the metronome clicks, follows the volume setting and is silent when muted.
2. In real desktop Chrome: a `1m` timer in a hidden tab for over a minute chimes within about 2 s of the end.
3. With VoiceOver or NVDA: seconds 10 to 1 and "Timer finished" are spoken politely, and nothing earlier.

## Open items after Phase 8

- T040 (bundle budget) now passes in `pnpm verify`.
- Lint is clean now: the `ShortcutList.svelte` mustache has an `eslint-disable-next-line` with a reason, and the unused `beats` in `metronome.test.ts` is fixed.
- Linux screenshot baselines, and the refreshed `e2e/metronome.spec.ts` baselines (the card now sits above the panel), come only from `.github/workflows/update-snapshots.yml`.
