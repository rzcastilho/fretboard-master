# Research: Timer Linked to Metronome (041)

All Technical Context unknowns are resolved below. Code facts come from
`src/lib/state/metronome.svelte.ts`, `src/lib/state/timer.svelte.ts`, `src/lib/audio/metronome.ts`,
`src/lib/prefs/{schema,session}.ts` and `src/lib/state/preferences.svelte.ts` as of commit `bc28c72`.

## R-01 Where the link lives

- **Decision**: a new runes module, `src/lib/state/timer-link.svelte.ts`, exported as `timerLink`.
  It imports `metronome`, `timer` and `preferences`. It owns the switch (`enabled`) and wires the two
  stores together through one observer slot on each:
  - `metronome.observeRun(observer)`: the metronome reports `started`, `clicked(kind)`, `paused`
    and `stopped` at the exact points where its phase changes.
  - `timer.onFinished(listener)`: the timer reports a finish (status becomes `finished`).
  Neither store imports the other or the link module. 039 R-01 ("the timer never imports the
  metronome") still holds, and the metronome gains no knowledge of the timer.
- **Rationale**:
  - The link needs to go both ways (metronome → timer, timer end → metronome). Putting it in either
    store would make the two import each other.
  - Every phase change already goes through a few functions in the metronome store (`start`, the
    `onBeat` / `onCountIn` callbacks, `pauseState`, `reset`, `halt`, `onEnd`). Reporting from there
    is exact and synchronous, so the stop reason (user vs timer-driven) is known. Watching
    `metronome.phase` with an `$effect.root` could not tell a timer-driven stop from a Reset, and it
    runs after a microtask.
  - The observer is a single slot, not an event bus (Constitution X): one consumer, one setter,
    `null` by default, so with the link module absent the stores behave exactly as in 039.
- **Alternatives rejected**:
  - *Link logic inside `metronome.svelte.ts`, importing `timer`.* Zero still needs a path back
    from the timer, so the timer would need a listener anyway. It would also grow a 619-line store
    with an unrelated concern.
  - *`$effect` watchers on `metronome.phase` and `timer.status`.* Cannot distinguish reasons for a
    stop, cannot tell a resume click from a fresh beat, and depend on effect scheduling.

## R-02 Pending start and the first post-count-in click (FR-003, FR-004, FR-005)

- **Decision**: the pending start lives in the timer as an `armed` flag.
  - `timer.arm()` is called by the link on `started` while the switch is on. It resets the timer to
    the full selected duration (stopped) and captures the audio sink. `started` is reported from
    `start()`, which runs inside the user's gesture, so the chime stays unlocked (as in 039 R-05).
  - `timer.startArmed()` is called on the first `clicked('beat')` of the run. It plays only if
    `armed`, then clears it.
  - The timer's own `toggle()`, `selectPreset()` and `restore()` clear `armed`. That is how "play or
    a preset during the count-in cancels the pending start" (FR-008) and "every stop cancels it"
    (FR-007) fall out with no extra event.
  - `timer.disarm()` clears it; the link calls it when the switch is turned off (FR-016).
- **Rationale**: the scheduler reports each slot from an animation frame once its audible time is
  reached (`reportAudible` in `src/lib/audio/metronome.ts`). The first `onBeat` after `start()` is
  therefore the first loop click, after any initial count-in, and is reported within one frame
  (~16 ms) of being heard, inside FR-005's 100 ms. With count-in 0 or off, the first click is a beat,
  so the same rule covers acceptance scenario US1-4.
- **Known limit (accepted)**: animation frames do not run in a hidden tab. If the user hides the tab
  during the count-in, the first beat is reported, and the countdown starts, when the tab is shown
  again. The spec's hidden-tab edge case covers zero (FR-006), which is unaffected. Rejected
  alternative: also reporting audible slots from the scheduler's `setTimeout` pump. That changes
  031's visual-sync contract for every metronome user, for a case nobody is watching.
- **Alternatives rejected**: start the countdown at `start()` offset by the count-in length. The
  metronome's start lead and output latency are only known inside the scheduler, so the offset would
  drift from the heard click.

## R-03 Pause and resume (FR-015)

- **Decision**: a `held` flag in the timer.
  - On `paused` with the switch on, the link calls `timer.hold()`: if the timer is `running`, it
    pauses it (same arithmetic as the 039 pause) and sets `held`. Otherwise it does nothing.
  - On any `clicked(kind)` with the switch on, the link calls `timer.release()`: if `held` and
    `paused`, it plays from the paused reading and clears `held`. The first click after a resume may
    be a repeat count-in click, so `release` reacts to both kinds.
  - The timer's own `toggle()`, `selectPreset()` and `restore()` clear `held`. A timer paused by
    hand is never `held`, so the metronome leaves it alone.
- **Pause during the initial count-in**: the timer is not running, so `hold` does nothing; `armed`
  stays set and fires on the first beat after resume.
- **`onSuspended`** (the audio context could not resume) goes through `pauseState()`, so it is
  reported as `paused` too: the time-box freezes with the click.

## R-04 Stops (FR-006, FR-007)

- **Decision**:
  - The metronome reports `stopped` only when it actually leaves a non-`settings` phase: `reset()`,
    `halt()` (used by `selectMode`, `screenChanged`, `restore`) and `onEnd`. A `halt()` while
    already in `settings` reports nothing, so switching tabs while only the timer runs (started with
    its own play) does not reset it.
  - With the switch on, `stopped` calls `timer.restore(timer.preset)`: stopped at the full duration,
    `armed` and `held` cleared.
  - Zero: the link's finish listener, with the switch on, calls a new `metronome.stopForTimer()`. It
    halts a `starting`, `running` or `paused` run back to `settings` with values kept, sets no
    announcement (so only "Timer finished" is announced) and does **not** report `stopped`, so the
    finished state, flash and chime are untouched. In `settings` it is a no-op.
- **Hidden tab at zero**: the timer's end `setTimeout` still fires (throttled), `finish()` runs, the
  listener halts the metronome in the same call. The 039 late-chime rule is unchanged. SC-003 holds
  because the halt happens in the same task as the finished state.

## R-05 Evaluating the switch (FR-016)

- **Decision**: the link reads `enabled` at each event; it keeps no "linked run" snapshot.
  `setEnabled(false)` calls `timer.disarm()` and nothing else. `setEnabled(true)` does nothing to
  either store. `held` is left as is on switch off, so a later resume with the switch on again
  resumes the timer the metronome paused.

## R-06 Preference field (FR-011)

- **Decision**: `Preferences['metronome'].timerLink: boolean`, parsed with
  `v.parse(v.fallback(v.boolean(), false), metronome.timerLink)` (non-object entry → `false`),
  serialized after `timer` and only when `true`. Written with
  `preferences.remember({ metronome: { timerLink } })`, which `session.ts` already merges one level
  deep (039), so the mode records and `timer` are kept. `PREFS_VERSION` stays `1`: the field is
  additive and optional, older stored records parse to `false`, and older app versions ignore the
  unknown key. New fixtures are added; none are changed or removed (Constitution IX).
- **Restore and erase**: `preferences.start()` calls `timerLink.restore(p.metronome.timerLink)`;
  `erase()` calls `timerLink.restore(false)`. `restore` writes nothing and also connects the
  observers (idempotent), so the wiring exists from app start, before the Metronome page mounts.
- **Not remembered**: `armed`, `held` and any run state (session only).

## R-07 The switch control (FR-001, FR-012, FR-013)

- **Decision**: reuse the existing switch pattern of `CountInSettings.svelte`: a `<button
  role="switch" aria-checked>` with the global `.switch`, `.switch-track` and `.switch-thumb` styles
  from `src/lib/styles/controls.css`, the label text as content and an `aria-hidden` On/Off word
  (`metronome_switch_on` / `metronome_switch_off`). Placed in `TimerCard.svelte` below the presets.
  New message `timer_link_label`: en "Start and stop with metronome", pt-BR "Iniciar e parar com o
  metrônomo", es "Iniciar y detener con el metrónomo".
- **Rationale**: the pattern already passes axe, target size (`--target-min`), focus ring, contrast
  in both themes and 200 % zoom in 031–038 e2e tests. No new token or CSS is needed beyond
  alignment inside the card.

## R-08 Testing approach (Constitution IV)

- Unit (Vitest, injected clocks/frames as in `tests/unit/metronome/store.test.ts` and
  `timer-store.test.ts`): new `tests/unit/metronome/timer-link.test.ts` drives both real stores with
  fake scheduler deps and a fake timer clock, covering every acceptance scenario and FR-015/016.
  Additions to `timer-store.test.ts` (`arm`, `startArmed`, `hold`, `release`, `disarm`,
  `onFinished`), `store.test.ts` (observer calls and `stopForTimer`), `tests/unit/prefs/schema.test.ts`
  plus fixtures, `timer-card.test.ts` (switch), `erase-preferences.test.ts`.
- E2E (Playwright, `page.clock` as in `e2e/metronome-timer.spec.ts`): new
  `e2e/metronome-timer-link.spec.ts` for US1–US3, reload persistence, erase, axe, 320 px / 200 %.
  Existing 039 tests 8–10 (independence) stay unchanged and prove the off default (SC-004).
- Screenshots: the Timer card grows one row, so `metronome-timer` baselines change. They are
  regenerated only through `.github/workflows/update-snapshots.yml`.
