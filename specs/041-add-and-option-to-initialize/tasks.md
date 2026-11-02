---

description: "Task list for 041 Timer Linked to Metronome"
---

# Tasks: Timer Linked to Metronome

**Input**: Design documents from `/specs/041-add-and-option-to-initialize/`

**Prerequisites**: plan.md, spec.md, research.md (R-01 to R-08), data-model.md, contracts/ (timer-link-api, preferences-record, timer-card-ui), quickstart.md

**Tests**: Included. Constitution IV (test-first) applies and plan.md lists the test files. Write each test task first and watch it fail.

**Organization**: grouped by user story. Behaviour table: data-model.md §3. TypeScript surface: contracts/timer-link-api.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- Local verification is targeted (CLAUDE.md): `pnpm vitest run <paths>`, then `pnpm build:test` once and `pnpm test:e2e:fast <specs>`. Run `pnpm verify` once at the end. Never run `pnpm test:e2e` or `pnpm lhci` locally.
- Unit tests that touch `document`/`window`/`localStorage` or render a component start with `// @vitest-environment jsdom`.

## Phase 1: Setup

**Purpose**: confirm the baseline and read the code being extended. No new dependency or directory.

- [X] T001 Read `src/lib/state/metronome.svelte.ts`, `src/lib/state/timer.svelte.ts`, `src/lib/state/preferences.svelte.ts`, `src/lib/prefs/schema.ts`, `src/lib/tools/metronome/TimerCard.svelte`, `src/lib/tools/metronome/CountInSettings.svelte`, and the existing tests `tests/unit/metronome/store.test.ts` and `tests/unit/metronome/timer-store.test.ts` (fake scheduler deps, fake timer clock) so later tasks reuse their helpers
- [X] T002 Run the baseline `pnpm vitest run tests/unit/metronome tests/unit/prefs tests/unit/erase-preferences.test.ts` and confirm it is green before any change

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the two store seams and the link module skeleton. Nothing in the user stories works without them. With nothing attached, both stores MUST behave exactly as in 039.

**⚠️ CRITICAL**: no user story work starts until this phase is complete.

- [X] T003 [P] Write failing seam tests in `tests/unit/metronome/store.test.ts`: `metronome.observeRun()` reports `started()` on settings→starting inside `start()`; `clicked('count-in' | 'beat')` from the existing `onCountIn` / `onBeat` points; `paused()` on running→paused (user pause and audio suspend via `pauseState()`); `stopped()` from `reset()`, from `halt()` (via `selectMode`, `screenChanged`, `restore`) and from `onEnd`, but only when the phase before was not `settings`; resume (paused→starting) reports nothing until its first `clicked`; `stopForTimer()` halts a starting/running/paused run to `settings` with values kept, no announcement and no `stopped`, and is a no-op in `settings`; with no observer the announcements are unchanged
- [X] T004 [P] Write failing seam tests in `tests/unit/metronome/timer-store.test.ts`: `arm()` leaves the timer stopped at the full selected duration with `armed` set; `startArmed()` plays from the full duration only if `armed`, then clears it; `disarm()` clears it; `hold()` pauses a `running` timer and sets `held` (no-op otherwise); `release()` plays from the paused reading only if `held` and `paused`; `toggle()`, `selectPreset()` and `restore()` clear both flags; `onFinished(listener)` is called once at the end of `finish()`; invariants: `armed` ⇒ `status === 'stopped'` at full duration, `held` ⇒ `status === 'paused'`, never both
- [X] T005 Add to `src/lib/state/metronome.svelte.ts` the exported `RunClick` and `RunObserver` types, `metronome.observeRun(observer | null)` and `metronome.stopForTimer()`, and report `started` / `clicked` / `paused` / `stopped` from `start`, `onBeat`, `onCountIn`, `pauseState`, `reset`, `halt` and `onEnd` exactly as in contracts/timer-link-api.md. `halt()` reports `stopped` only if the previous phase was not `settings`. `stopForTimer()` neither announces nor reports `stopped`. The metronome MUST NOT import the timer or the link module. Makes T003 pass
- [X] T006 Add to `src/lib/state/timer.svelte.ts` the `armed` and `held` session flags (not reactive, never stored) and `arm()`, `startArmed()`, `disarm()`, `hold()`, `release()`, `onFinished(listener | null)`; `arm()` captures the audio sink inside the gesture (039 R-05); `toggle()`, `selectPreset()` and `restore()` also clear both flags; `finish()` calls the listener last. The timer MUST NOT import the metronome. Makes T004 pass
- [X] T007 Create `src/lib/state/timer-link.svelte.ts` exporting `timerLink` (`enabled` reactive `$state(false)`, `setEnabled(on: unknown)` ignoring non-booleans, `restore(on: unknown)`) and `resetTimerLinkForTests()` per contracts/timer-link-api.md. `restore` connects the observers once (idempotent) via `metronome.observeRun` and `timer.onFinished`. Reactions are empty stubs here, and each later story fills in its own. `setEnabled(false)` calls `timer.disarm()` and nothing else; `setEnabled(true)` touches neither store (FR-016). `setEnabled` also writes `preferences.remember({ metronome: { timerLink: enabled } })`
- [X] T008 Run `pnpm vitest run tests/unit/metronome/store.test.ts tests/unit/metronome/timer-store.test.ts` and confirm green, including the pre-existing 038/039 tests unchanged

**Checkpoint**: seams in place, 039 behaviour intact, link module wired but inert.

---

## Phase 3: User Story 2 - Turn the link on and off (Priority: P1) 🎯 MVP

**Goal**: an opt-in switch in the Timer card, off by default, remembered on the device, cleared by Erase preferences, with the independence of 039 intact when off.

**Independent Test**: with the switch off, start the metronome and confirm the timer stays stopped. Turn it on, reload, and the switch is still on with nothing running. Erase preferences and it is off.

### Tests for User Story 2

- [X] T009 [P] [US2] Add failing tests to `tests/unit/prefs/schema.test.ts` for every row of contracts/preferences-record.md: missing key, `{"timer":5}`, `{"timer":5,"timerLink":true}`, `{"timerLink":true}`, `{"mode":"speed","timerLink":"yes"}` (other fields kept), non-object `metronome` entry; serialization order `ratios, plain, speed, mode, timer, timerLink`, written only when `true`; a record with only `timerLink: false` serializes with no `metronome` key (byte-identical to 039)
- [X] T010 [P] [US2] Add the three fixtures `tests/unit/prefs/fixtures/metronome-timer-link.txt` (`{"timer":5,"timerLink":true}`), `metronome-timer-link-only.txt` (`{"timerLink":true}`), `metronome-timer-link-invalid.txt` (`{"mode":"speed","timerLink":"yes"}`) and register them in `tests/unit/prefs/fixtures/index.ts`. Add, never replace, existing fixtures
- [X] T011 [P] [US2] Add failing tests to `tests/unit/erase-preferences.test.ts`: with `timerLink` on, Erase preferences removes the stored field and `timerLink.enabled` becomes `false`
- [X] T012 [P] [US2] Add failing jsdom tests (`// @vitest-environment jsdom`) to `tests/unit/metronome/timer-card.test.ts`: the card renders `getByRole('switch', { name: 'Start and stop with metronome' })`, `aria-checked` follows `timerLink.enabled`, click toggles it, Space and Enter on the focused switch toggle it, the switch is never disabled in any metronome phase or timer status, and the On/Off word is `aria-hidden`
- [X] T013 [P] [US2] Create `tests/unit/metronome/timer-link.test.ts` with its harness (real `metronome` and `timer` stores, fake scheduler deps and frames, fake timer clock, `resetTimerLinkForTests()` in `beforeEach`) and the US2 cases first: default off; with the switch off, start, pause, Reset and zero leave the other store untouched (SC-004); `setEnabled(1)` and `setEnabled('true')` are ignored; `setEnabled` writes the preference; toggling never starts, stops, pauses or resets anything by itself (FR-016)

### Implementation for User Story 2

- [X] T014 [US2] In `src/lib/prefs/schema.ts` add `timerLink: boolean` to `Preferences['metronome']` (default `false`), `parseTimerLink` using `v.parse(v.fallback(v.boolean(), false), …)` (non-object entry → `false`, other fields unaffected), and serialize it after `timer` only when `true`. `PREFS_VERSION` stays `1`. Makes T009 and T010 pass
- [X] T015 [US2] In `src/lib/state/preferences.svelte.ts` call `timerLink.restore(p.metronome.timerLink)` in `start()` after `metronome.restore` and `timer.restore`, and `timerLink.restore(false)` in `erase()`. `restore` writes nothing. Makes T011 pass
- [X] T016 [P] [US2] Add message `timer_link_label` to `messages/en.json` ("Start and stop with metronome"), `messages/pt-BR.json` ("Iniciar e parar com o metrônomo") and `messages/es.json` ("Iniciar y detener con el metrónomo"), then regenerate Paraglide output with the project's usual command if it is not automatic
- [X] T017 [US2] In `src/lib/tools/metronome/TimerCard.svelte` add the last row (after the preset group, before the polite status region): `<button type="button" class="switch" role="switch" aria-checked={timerLink.enabled}>` with `.switch-track` / `.switch-thumb` (aria-hidden), the label `m.timer_link_label()` and an aria-hidden state word (`m.metronome_switch_on()` / `m.metronome_switch_off()`), toggling through `timerLink.setEnabled(!timerLink.enabled)`, same markup as `CountInSettings.svelte` (contracts/timer-card-ui.md). Reuse existing tokens and `.switch` styles. Add card-local CSS only for wrapping at 320 px and 200 % text zoom. The component reads `timerLink` and holds no link logic. Makes T012 pass
- [X] T018 [US2] Run `pnpm vitest run tests/unit/prefs/schema.test.ts tests/unit/erase-preferences.test.ts tests/unit/metronome/timer-card.test.ts tests/unit/metronome/timer-link.test.ts` and confirm green

**Checkpoint**: the switch exists, persists, erases and does nothing else yet. Off-by-default independence is proven (US2 scenarios 1–4).

---

## Phase 4: User Story 1 - One press starts both and the run ends itself (Priority: P1)

**Goal**: with the switch on, starting the metronome arms the timer at its full duration, the countdown starts on the first click after the count-in, and reaching `00:00` halts the metronome while the 039 finished flash and chime remain.

**Independent Test**: turn the switch on, pick `1m`, start with a 4-click count-in. The timer holds `01:00` during the count-in, counts after it, and at `00:00` the metronome stops.

### Tests for User Story 1

- [X] T019 [P] [US1] Add failing cases to `tests/unit/metronome/timer-link.test.ts`: switch on, count-in 4 → timer reads full and is `stopped` during the count-in, then `running` on the first `beat` (US1-1/2, FR-003/004, SC-002); count-in 0 or off → starts with the first click (US1-4); a timer that was running, paused or finished when the metronome starts is replaced by a fresh full-duration countdown (FR-004); zero with the switch on halts a `starting`, `running` or `paused` metronome to `settings` with values kept, the timer stays `finished`, and only "Timer finished" is announced with no metronome "reset" announcement (US1-3, FR-006); zero with the metronome already stopped does nothing extra; zero with the switch off leaves the metronome running; a countdown started with the timer's own play reaching zero while the switch is on halts a running metronome; a late `finish()` (hidden tab) still halts the metronome in the same call; ratio repeat count-ins, tempo changes and Speed Training steps do not restart the countdown (FR-009)

### Implementation for User Story 1

- [X] T020 [US1] In `src/lib/state/timer-link.svelte.ts` implement the `started` reaction (switch on → `timer.arm()`), the `clicked('beat')` reaction (switch on → `timer.startArmed()`) and the `onFinished` reaction (switch on and metronome phase not `settings` → `metronome.stopForTimer()`), each checking `enabled` at the event (FR-016). Makes T019 pass
- [X] T021 [US1] Run `pnpm vitest run tests/unit/metronome/timer-link.test.ts tests/unit/metronome/timer-store.test.ts tests/unit/metronome/store.test.ts` and confirm green
- [X] T022 [US1] Create `e2e/metronome-timer-link.spec.ts` (copy the `page.clock` setup from `e2e/metronome-timer.spec.ts`) with the US1 and US2 flows: switch off by default and independent; turn on, pick `1m`, start with a 4-click count-in, `01:00` holds then counts down, the metronome stops at `00:00` with the finished readout; reload keeps the switch on with nothing running; Erase preferences turns it off; run axe on the card with the switch on, in light and dark; at 320 px and 200 % text zoom there is no horizontal page scroll and the switch is reachable. Then `pnpm build:test` and `pnpm test:e2e:fast e2e/metronome-timer-link.spec.ts e2e/metronome-timer.spec.ts`. The 039 spec must pass unchanged

**Checkpoint**: US1 and US2 work together. This is the MVP: one press starts both and the run ends itself.

---

## Phase 5: User Story 3 - Stopping early stays predictable (Priority: P2)

**Goal**: early stops reset the timer, metronome pause and resume hold and release it, and the timer's own controls always win.

**Independent Test**: start linked and press Reset mid-run, then check the timer. Repeat during the count-in, then pause and resume the metronome mid-run.

### Tests for User Story 3

- [X] T023 [P] [US3] Add failing cases to `tests/unit/metronome/timer-link.test.ts` (switch on): Reset mid-run → metronome stopped, timer `stopped` at the full duration (US3-1); Reset or Escape during the count-in → the timer never starts and shows the full duration (US3-2, FR-007); each of mode-tab switch (`selectMode`), `screenChanged`, `restore`, preferences erase and Speed Training ending by itself → timer stopped at the full duration (US3-6, SC-005); a stop with the switch off leaves the timer alone; a tab switch with the metronome already stopped does not reset a timer started with its own play (the plan's `halt()` rule); timer reset after a stop uses the selected preset
- [X] T024 [P] [US3] Add failing cases to `tests/unit/metronome/timer-link.test.ts` (switch on): pausing a linked metronome pauses a running timer and resuming resumes it from the same reading within one frame of the first resumed click, including a repeat count-in click (US3-5, FR-015); an audio suspend freezes the timer as a pause does; a timer paused by hand is left alone by metronome pause and resume; a pause during the initial count-in keeps the pending start, which fires on the first beat after resume; hand-pausing the timer leaves the metronome running and it still stops at zero after the timer resumes (US3-3); the timer's play with the metronome stopped does not start the metronome (US3-4); the timer's play or a preset during the count-in cancels the pending start (FR-008); turning the switch off during the count-in cancels the pending start; off during a pause then on again, then resume, still resumes the timer (`held` survives switch off, FR-016)
- [X] T025 [P] [US3] Add the US3 flows to `e2e/metronome-timer-link.spec.ts` (written failing first): Reset mid-run → timer shows `01:00` stopped; Reset during the count-in; pause then resume the metronome pauses and resumes the timer; mode-tab switch resets the timer; timer play alone does not start the metronome

### Implementation for User Story 3

- [X] T026 [US3] In `src/lib/state/timer-link.svelte.ts` implement the `stopped` reaction (switch on → `timer.restore(timer.preset)`), the `paused` reaction (switch on → `timer.hold()`) and extend the `clicked(kind)` reaction so any kind calls `timer.release()` while the `beat` kind also calls `startArmed()` (switch on, checked at the event). Confirm FR-008 needs no extra code, because the timer's own `toggle()`, `selectPreset()` and `restore()` already clear the flags (T006). Makes T023 and T024 pass
- [X] T027 [US3] Run `pnpm vitest run tests/unit/metronome/timer-link.test.ts`, then `pnpm build:test` (once, since `src/` changed) and `pnpm test:e2e:fast e2e/metronome-timer-link.spec.ts e2e/metronome-timer.spec.ts` and confirm green (T025)

**Checkpoint**: all three stories work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] Add a "Start and stop with metronome" note to the metronome/timer user docs if the repo has any (search `docs/` and `README.md` for the 039 timer), and skip it if none mention the timer
- [X] T029 [P] Confirm the Timer card screenshot baseline test (`metronome-timer`) is the one that changes. Do NOT regenerate Linux baselines locally. Note in the PR description that they come from `.github/workflows/update-snapshots.yml`. If a screenshot spec needs a new or changed shot, update the macOS desktop baseline only with `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`
- [X] T030 Check the bundle delta is under 1 KB gzip against the 180 KB initial-JS budget (plan Performance) using the project's existing size check output from `pnpm build:test` or `pnpm verify`
- [X] T031 Walk through quickstart.md §3 manual smoke steps against `pnpm dev` at `/metronome` where an audible check is needed. Record the by-ear steps (click stops at zero, one chime) under a "Manual checks" note at the bottom of this file, tick the task, and list them in the PR description
- [X] T032 Run all local gates once: `pnpm verify` (full Playwright matrix and Lighthouse run in CI only). Fix any failures it reports, including lint, format, svelte-check, i18n catalog parity for `timer_link_label`, and the prefs fixture checks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks every story. T003 and T004 are parallel. T005 needs T003, T006 needs T004, T007 needs T005 and T006, T008 needs T007.
- **US2 (Phase 3)**: after Phase 2. It is first because the switch, its store and its persistence are what the other stories read.
- **US1 (Phase 4)**: after Phase 2. It needs `timerLink.enabled` from T007 and can run in parallel with US2 apart from T022, whose e2e needs the switch in the UI (T017).
- **US3 (Phase 5)**: after Phase 2. It edits the same `timer-link.svelte.ts` and `timer-link.test.ts` as US1, so run it after US1 or merge carefully. T025 needs T017.
- **Polish (Phase 6)**: after all stories.

### Within each story

- Tests (fail first) → implementation → targeted run → checkpoint.
- `timer-link.test.ts` and `timer-link.svelte.ts` are touched by T013, T019, T020, T023, T024 and T026. Do not mark these [P] against one another, and the [P] marks above are only against tasks in other files.

### Parallel Opportunities

- Phase 2: T003 ∥ T004.
- US2: T009 ∥ T010 ∥ T011 ∥ T012 ∥ T013 (different files), then T014 and T016 ∥, then T015, T017.
- US3: T023 ∥ T024 ∥ T025 once written to separate edits of the same files in sequence. Do T023 and T024 in one sitting if working alone.

```bash
# US2 tests together:
Task: "schema tests in tests/unit/prefs/schema.test.ts"
Task: "fixtures in tests/unit/prefs/fixtures/"
Task: "erase test in tests/unit/erase-preferences.test.ts"
Task: "switch tests in tests/unit/metronome/timer-card.test.ts"
```

---

## Implementation Strategy

### MVP first (US2 + US1)

1. Phase 1, then Phase 2 (seams, inert link).
2. Phase 3 (US2): the switch, persistence, erase.
3. Phase 4 (US1): start-after-count-in and stop-at-zero.
4. **Stop and validate**: T022 e2e and the quickstart smoke steps 1–3. This is the shippable core.

### Incremental delivery

1. Add US3 (early stops, pause/resume, control precedence) → targeted unit + e2e.
2. Polish, then `pnpm verify` once.

### Notes

- Every reaction checks `timerLink.enabled` at its event (FR-016). Never snapshot it per run.
- With the switch off, or with no observer attached, the metronome and timer behave exactly as in 039 (FR-002). Keep the 039 specs unchanged and green.
- No new dependency, share-link field, measurement event or colour token (FR-014).
- Commit per task or logical group with Conventional Commits on branch `041-add-and-option-to-initialize`.

## Manual checks

_(Filled in during T031.)_

---

## Manual checks

Automatable parts pass (unit + e2e). Needs a human by ear on `pnpm dev` at `/metronome` (quickstart §3):

- With "Start and stop with metronome" on, `1m`, count-in 4: the clicks stop at `00:00`.
- Exactly one chime plays at zero, and the readout flashes.
- Reset at ~`00:40` leaves the timer at `01:00`, stopped, with no chime.

Initial JS gzip after this feature: 162.2 KB, under the 180 KB budget (`scripts/check-bundle-size.mjs`).
Linux screenshot baselines (`timer-card-idle`) come from `.github/workflows/update-snapshots.yml`; list this in the PR description.

T032 note: `pnpm verify` unit and static checks pass. The e2e failure in `metronome-speed.spec.ts` (first `switch` role was now the timer link) is fixed by scoping to the Speed panel. Two other failures (modes tab keys, timer 28) were flaky and pass on rerun. The `timer-card-idle` screenshot baseline (Linux) needs regenerating via update-snapshots.yml in CI.
