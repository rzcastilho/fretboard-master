# Research: Practice Timer

**Feature**: `039-practice-timer` | **Date**: 2026-11-01 | **Plan**: [plan.md](plan.md)

The specify and clarify sessions settled every product question, so Technical Context had no
`NEEDS CLARIFICATION` left. This file records the engineering decisions. Each one gives the
choice, the reason and the alternatives that were rejected.

## R-01 Where timer state lives

- **Decision**: a new module-level runes store, `src/lib/state/timer.svelte.ts`, exported as
  `timer`. It sits beside `metronome.svelte.ts` and does not import it. The pure arithmetic
  (preset validation, whole-second rounding, `MM:SS` formatting, tick delay, the late-chime rule,
  the announcement choice) goes in `src/lib/state/timer-model.ts`.
- **Rationale**:
  - Constitution III says view state lives outside components. A module singleton survives
    mode-tab switches and in-app navigation without any extra work (FR-010), and it ends only on
    a full reload, as the spec requires.
  - Keeping it out of `metronome.svelte.ts` makes FR-009 (full independence) structural. The
    metronome's `screenChanged()`, `selectMode()`, `reset()` and `restore()` cannot reach the
    timer, because the timer is not in their state.
- **Alternatives rejected**:
  - *Adding fields to the metronome store.* `halt()` runs on every tab switch and route change,
    so each of those paths would need an exemption, and a missed one would be an FR-009 bug.
  - *Component state in `TimerCard.svelte`.* It is destroyed when the user leaves
    `/metronome`, which breaks FR-010 and the off-page chime.

## R-02 Time source and drift (FR-012, SC-002)

- **Decision**: the countdown is anchored to an absolute end time. `endsAt = clock.now() +
  remainingMs` when play is pressed. Every reading is computed as `endsAt − clock.now()` and
  never by decrementing a counter. The display shows `ceil(remainingMs / 1000)` whole seconds.
  `clock.now` defaults to `Date.now()`.
- **Rationale**:
  - Throttled or skipped timer callbacks cannot accumulate error, because each tick recomputes
    the reading from the anchor (no cumulative drift over 10 minutes).
  - `Date.now()` keeps advancing while the device sleeps. In some browsers on some operating
    systems, `performance.now()` pauses during system sleep, which would leave the reading
    wrong on return (spec clarification: "the reading is correct on return").
  - The clock is injected (`{ now, setTimeout, clearTimeout }`, the same shape as `TimerClock`
    in `src/lib/audio/engine.ts`), so unit tests use a fake clock (constitution IV). E2E tests
    use `page.clock`, which controls `Date.now` and timers together.
- **Risk accepted**: a manual change of the system clock during a countdown shifts it. A
  negative jump is clamped: the reading never goes above the value it had at play.
- **Alternatives rejected**:
  - *`setInterval(1000)` with a decrementing counter.* It drifts under throttling and loses
    whole minutes under Chrome's intensive throttling.
  - *`performance.now()`.* It is monotonic, but it is wrong after sleep on some platforms.
  - *The audio clock (`AudioContext.currentTime`).* It stops while the context is suspended or
    the device sleeps, and it does not exist until audio is unlocked.

## R-03 Tick scheduling in visible and hidden pages

- **Decision**: there are two timers while running.
  1. **Display tick**: a chained `setTimeout` that fires just after the next whole-second
     boundary. The delay is `remainingMs − (secondsLeft − 1) × 1000 + TICK_SLACK_MS`, where
     `TICK_SLACK_MS = 15` keeps the callback from firing a hair early and showing the same
     second twice. Each tick recomputes the reading and sets the announcement.
  2. **End timer**: one non-chained `setTimeout(endsAt − now)`, armed from the play gesture
     (and from resume). When it fires, it runs the same "reached zero" path as a tick.
- **Rationale**:
  - Chrome's intensive throttling (pages hidden for more than 5 minutes) aligns *chained*
    timers (chain count ≥ 5) to one-minute wake-ups when the page has been silent. A timer
    created directly from a user-event handler has chain count 0, so it gets only the standard
    one-second alignment. The end timer therefore fires within about 1 s of the real end even
    in a hidden tab, so the 2 s chime window (R-05) is met in the common case.
  - Whichever timer detects zero first wins. The other is cleared, and the "reached zero" path
    is idempotent.
  - The display tick is cheap (O(1), one state write per second) and is skipped entirely when
    not running.
- **Alternatives rejected**:
  - *A Web Worker timer.* It adds a file and a CSP consideration, and dedicated-worker timers
    are throttled in hidden pages too.
  - *`requestAnimationFrame`.* It stops in hidden pages.
  - *A `visibilitychange` listener to re-sync.* It is not needed: pending timeouts fire as soon
    as the page becomes visible, and every reading is recomputed from `endsAt`.

## R-04 The chime sound (FR-018, FR-008)

- **Decision**: a new framework-free module, `src/lib/audio/chime.ts`.
  - `renderChime(sampleRate): Float32Array` is pure. It renders 0.8 s of two sine partials
    (880 Hz and 1320 Hz, amplitudes 1 and 0.5), with a 5 ms linear attack and an exponential
    decay to 0.1 % at the end, scaled to a peak of 0.5. Like `renderClick`, it falls back to
    48 kHz for a non-finite rate.
  - `playChime(sink, lateMs): boolean` starts one `AudioBufferSource` on `sink.port`, connected
    to `sink.destination`, which is the shared volume → mute chain. It returns `false`, without
    throwing, when the context is not `'running'` or any Web Audio call throws.
  - In test builds it appends `{ type: 'chime', when, contextTime, lateMs }` to the audio log,
    following the existing `click` entry.
- **Rationale**:
  - The chain is the same one the metronome click uses (`playback.clickSink()`, slice 031), so
    app mute and volume apply with no new code. Sources on the sink are outside the playback
    engine's active request, so `playback.stop()` (hidden page, navigation) never cuts the
    chime, and the chime never touches the click scheduler (FR-009, FR-018).
  - A synthesized tone adds no asset and works offline (FR-016, constitution II).
  - 880/1320 Hz is a bright perfect fifth that cuts through clicks at 1000–2400 Hz without
    sounding like any click kind. 0.8 s is under the 1 s limit.
  - Skipping a non-running context prevents a *late* chime. A source started on a suspended
    context would sound whenever the context resumes, which could be long after zero.
- **Alternatives rejected**:
  - *An audio file.* It is an asset, it adds bytes and a fetch, and FR-018 forbids it.
  - *Reusing `renderClick('accent')`.* At 30 ms it is too short to read as an end signal, and
    it would be confused with a downbeat.
  - *`OscillatorNode` with a gain envelope.* It is equivalent, but the fake `AudioPort` used by
    the tests implements only buffer sources and gains. A rendered buffer keeps the
    `AudioPort` subset unchanged and makes the waveform unit-testable.

## R-05 Audio unlock and the late-chime rule (FR-007)

- **Decision**:
  - Every play press (start, resume, restart) calls `playback.clickSink()` inside the gesture
    and keeps the returned `AudioSink | null` for that run.
  - When zero is detected, `lateMs = now − endsAt`. The chime plays only when `lateMs ≤
    LATE_CHIME_LIMIT_MS` (2000), a sink was captured, and the app is on any page.
  - Otherwise the timer goes to the finished state silently.
- **Rationale**:
  - Browsers allow audio only after a user gesture. The play press is that gesture (spec
    assumption), so the context exists and is running by the time zero comes.
  - The timer never creates or resumes an AudioContext outside a gesture. A context created
    then would start suspended, and a resume could fail silently.
  - A `null` sink (audio unavailable) means no chime. The visual state is unaffected (FR-008).
    The playback store's existing unavailable notice (slice 009) is the only feedback, as for
    the metronome.
- **Alternatives rejected**:
  - *Pre-scheduling the chime on the audio clock at play.* It is sample-accurate, but the
    audio clock stops during sleep and the chime would then sound late on wake, which the
    clarify session forbids. Every pause and preset tap would also need to cancel it.
  - *Calling `clickSink()` at zero.* That is outside a gesture, and it could create a
    suspended context.

## R-06 Persisting the preset (FR-011, constitution IX)

- **Decision**:
  - `Preferences.metronome` gains `timer: number` (default 2).
  - The stored record keeps `version: 1`. `metronome.timer` is written last in the `metronome`
    entry (after `mode`), and only when it is not 2.
  - It is parsed with `v.fallback(intIn([1, 10]), 2)`. Anything else (`"5"`, 5.5, 0, 11, null)
    reads as 2, and the other metronome fields are kept.
  - `PreferencesPatch.metronome` becomes a one-level partial that the session merges into
    `current.metronome`, as `labels` already is. The timer store writes
    `preferences.remember({ metronome: { timer } })`. The metronome store's existing full write
    (`ratios`, `plain`, `speed`, `mode`) leaves `timer` untouched.
  - The schema mirrors the constants (`METRONOME_TIMER_DEFAULT = 2`, `METRONOME_LIMITS.timer =
    [1, 10]`) and a unit test guards parity with `timer-model.ts`, as for the other metronome
    defaults. Prefs may import only types from `$lib/state`.
- **Rationale**:
  - The spec fixes the location (inside the existing `metronome` entry) and the
    written-only-when-not-default rule.
  - The deep merge avoids a circular import. Without it, each store would have to read the
    other's state to rebuild the full `metronome` object before every write.
  - An absent key is the default, so every record written by 035–038 parses unchanged, and a
    default-timer record serializes byte-identically to 038.
  - `PRIVACY_CATEGORIES.metronome` already covers `metronome`, and the privacy text already says
    "metronome settings", so no policy text changes.
- **Alternatives rejected**:
  - *A top-level `timer` key.* The spec places it inside `metronome`.
  - *Bumping to `version: 2`.* The field is additive and optional, and constitution IX needs a
    version bump only for an incompatible change.
  - *Having the metronome store own the preset.* That couples the stores (R-01).

## R-07 Erase preferences

- **Decision**: `preferences.erase()` calls `timer.restore(2)`, and `preferences.start()` calls
  `timer.restore(p.metronome.timer)`. `restore` sets the preset, stops any countdown, clears
  the finished state and the announcement, and shows the full duration. It never writes.
- **Rationale**:
  - This matches `metronome.restore()`, which also halts a run.
  - Leaving a running countdown on the old length while the selected pill jumps to `2m` would
    break FR-003 (exactly one preset, matching the readout).
  - Erase is reachable only from About, so the user is not on the Metronome page at the time.
- **Alternative rejected**: *keep the countdown running and change only the pill.* The readout
  and the pill would disagree.

## R-08 Preset control semantics (FR-003, FR-004, FR-017)

- **Decision**: ten native `<button type="button">` elements in a `role="group"` labelled
  "Timer length". Each has `aria-pressed="true|false"`, and exactly one is true. The visible
  text `5m` comes from the catalog (`timer_preset`) and is the accessible name, so the label is
  in the name (WCAG 2.5.3). The selected pill gets the secondary-accent outline *and* a heavier
  font weight and a thicker border, so selection is not conveyed by colour alone
  (constitution V).
- **Rationale**:
  - Tapping the *selected* preset must reset the countdown. Native radios fire no `change` when
    they are already checked, and arrow-key focus moves would select and stop the countdown.
  - Native buttons already make the metronome's Space handler stand down
    (`targetActivates` in `MetronomePanel.svelte`), so FR-017 needs no key change.
  - Tab order: ten tab stops is acceptable for a row the user rarely visits. A roving tabindex
    was considered and rejected (YAGNI).
- **Alternatives rejected**:
  - *`role="radiogroup"`.* See the reset-on-reselect problem above.
  - *A `<select>`.* The source shows pills, and a select needs two taps (SC-001: set and start
    in at most two taps).

## R-09 Seven-segment readout without an asset

- **Decision**:
  - The readout is text: `MM:SS` in `font-variant-numeric: tabular-nums`, at a new size token,
    in the accent colour.
  - It is drawn over an `aria-hidden` "ghost" layer `88:88` at low opacity (`--timer-ghost-opacity`)
    that gives the unlit-segment look of an LCD.
  - The element has `role="timer"` (implicit `aria-live="off"`) and `aria-label` "Time
    remaining", so it is never a live region (FR-013).
- **Rationale**:
  - Constitution "Fonts" mandates the system UI stack for digits (ADR 0006). A seven-segment web
    font is an asset and a stack change.
  - Text scales with 200 % text zoom and reflows, and screen readers read it directly.
- **Alternatives rejected**:
  - *Inline SVG segment digits.* It is ~70 shapes to keep in sync, it needs a parallel text
    alternative, and it does not follow text zoom.
  - *A DSEG-style font.* It is an asset and a stack change, and it adds to load time.

## R-10 Finished flash and reduced motion (FR-007)

- **Decision**:
  - The store sets `flashing = true` at zero and clears it with a clock timeout after
    `FLASH_MS = 5000`. Play or any preset clears it at once.
  - The card renders `data-status="finished"` and, while flashing, `data-flash`.
  - CSS animates the readout's opacity between 1 and `--timer-flash-dim` with `steps(2)` over
    `--timer-flash-period` (1 s, two state changes per second).
  - Under `prefers-reduced-motion`, the global token block already sets durations to `0s`. The
    card adds a reduced-motion rule that removes the animation and shows a static highlight (an
    accent border and surface) while `data-flash` is set.
  - After the flash, `data-status="finished"` keeps a static finished style (accent underline
    and muted ghost) until play or a preset.
- **Rationale**:
  - A store-driven flag, instead of a fire-and-forget CSS animation count, is deterministic
    under the fake clock. It also stays correct if the card is remounted mid-flash: returning
    to the page shows the remainder of the flash, not a fresh 5 s.
  - Two changes per second is well under WCAG 2.3.1's three-flashes-per-second threshold.
  - Metronome actions cannot clear it, because they do not touch the timer store (FR-009).
- **Alternative rejected**: *`animation-iteration-count: 5`.* It cannot be tested
  deterministically, and it replays on every remount.

## R-11 Screen-reader announcements (FR-013)

- **Decision**:
  - The store exposes `announcement`. For the ticks where the shown second becomes 10…2 it is
    `m.timer_announce_seconds({ count })`, for 1 it is `m.timer_announce_second()`, and at zero
    it is `m.timer_announce_finished()`.
  - Play, pause and preset changes set it to `''`.
  - `TimerCard.svelte` owns its own visually hidden `role="status" aria-live="polite"` region
    that renders `timer.announcement`. The region exists only while the card is mounted, so
    nothing is announced on other pages.
  - It is separate from the metronome's status region, so a metronome announcement cannot
    overwrite a timer one in the same region.
  - A second that is skipped because of throttling is not announced late.
- **Rationale**:
  - Singular and plural are two keys, because Paraglide's plural variants are not used anywhere
    in the catalog yet. Two plain keys keep the catalog uniform.
  - A paused or stopped countdown never announces, because only ticks set the text.
- **Alternative rejected**: *making the readout `aria-live`.* FR-013 forbids it, and it would
  speak every second.

## R-12 Placement, failure isolation and budget

- **Decision**:
  - `MetronomeLayout.svelte` renders `<TimerCard />` in its own `<svelte:boundary>` before the
    metronome panel's boundary, in every mode, and outside the mode `tabpanel`.
  - The boundary's fallback is `FailureView`, whose reset calls `timer.restore(timer.preset)`.
  - The card is constrained to `--metronome-panel-max`, like the panel.
- **Rationale**:
  - A failure in the timer cannot take down the metronome, and the reverse is also true
    (constitution X, "never blank").
  - It sits outside the tabpanel because it is not part of any mode (FR-010).
- **Budget**: the change adds an estimated +2.0 KB gzip of initial JS (store, model, chime,
  component and 9 keys × 3 catalogs) against the 160 KB budget. The bundle-size check gates
  it. There is no new dependency.
- **Alternative rejected**: *placing the card in `+layout.svelte` so that it shows on every
  page.* The spec limits the card to the Metronome page.
