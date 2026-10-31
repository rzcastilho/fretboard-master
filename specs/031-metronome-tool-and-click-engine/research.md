# Phase 0 Research: Metronome Tool and Steady Click

**Feature**: 031-metronome-tool-and-click-engine · **Date**: 2026-10-29 · **Spec**: [spec.md](./spec.md)

Every Technical Context unknown is resolved below. Each entry gives the decision, the rationale
and the alternatives considered. Sources: the existing code (`src/lib/audio/engine.ts`,
`src/lib/state/playback.svelte.ts`, `src/lib/shell/PlaybackHost.svelte`, `src/lib/shell/tools.ts`,
`src/lib/state/shortcuts.ts`, `eslint.config.js`), the constitution 2.0.0 and the spec's
clarifications.

---

## R-01 Where the click is scheduled: lookahead scheduler on the shared AudioContext

**Decision**: A new framework-free module `src/lib/audio/metronome.ts` exports
`createClickScheduler(deps)`. It schedules `AudioBufferSourceNode.start(when)` calls on the
**same** `AudioContext` the playback engine owns, using the "two clocks" pattern: a coarse
main-thread timer wakes the scheduler, and the scheduler queues every click whose ideal time
falls inside a **lookahead horizon** on the audio clock. Click *n* of a segment is at
`anchor + n × 60 / bpm`, which is computed directly and never accumulated.

**Rationale**: Sample-accurate `start(when)` is the only way to get ≤ 2 ms jitter in a browser.
Main-thread timers jitter by 4–50 ms and more when the tab is hidden. Multiplying from the anchor
instead of adding `period` each time removes floating-point accumulation, so the 3000th click at
300 BPM is still exact (SC-002). Using the engine's context means the click passes through the
existing `volume → mute → destination` gain chain, which gives FR-018 (app-wide mute and volume)
for free. It also avoids a second context, which Safari limits and which needs its own unlock.

**Alternatives considered**:
- *`setInterval` + play now*: jitter of tens of ms and drift. Rejected (FR-014).
- *AudioWorklet click generator*: sample-exact and immune to timer throttling. But it needs a
  separate module file loaded with `addModule` (an extra request, CSP `worker-src`/`script-src`
  review), it is harder to fake in Vitest, and it is more than this slice needs. Rejected (C X
  YAGNI). It stays the fallback if field reports show gaps under heavy throttling.
- *One pre-rendered long buffer per loop*: would stay exact, but it cannot change mute/volume per
  click, does not loop cleanly for a later Loop 2 / subdivisions, and Pause would need buffer
  surgery. Rejected.
- *Second, metronome-only AudioContext*: duplicates unlock and mute/volume wiring, and Safari
  caps live contexts. Rejected.

## R-02 Lookahead horizon and wake interval (hidden-tab throttling)

**Decision**: `TICK_MS = 25` (the wake interval while visible) and `HORIZON_S = 1.5` (schedule
every click with `time < currentTime + 1.5`). Each wake also re-arms itself. The scheduler never
depends on wakes arriving on time. It only needs at least one wake per `HORIZON_S − margin`.

**Rationale**: Browsers throttle hidden-tab timers to roughly once per 1000 ms (Chrome, Firefox,
Safari). A 1.5 s horizon covers a 1 s wake gap plus up to 500 ms of lateness, which meets
SC-004 ("timers firing once per 1000 ms, no beat missed or late"). Chrome's *intensive*
throttling (once per minute after 5 min hidden) does not apply to pages that are playing audio,
and a running metronome is audible. When muted, the context still renders (the gain is 0), so the
page stays "audible" to the throttling heuristics. At 300 BPM the horizon holds at most 8 pending
sources, so memory is trivial. Pause still cancels exactly, because each pending source is kept
and stopped (R-05).

**Alternatives considered**:
- *100 ms horizon (classic "A Tale of Two Clocks")*: gaps as soon as the tab is hidden. Rejected
  (FR-016).
- *Timer in a dedicated Worker*: Worker timers are throttled less. But it adds a second bundle
  entry or a blob URL (CSP), and the 1.5 s horizon already meets the requirement. Rejected
  for this slice.
- *Scheduling minutes ahead*: makes Pause and mute cancellation expensive, and makes a later BPM
  change impossible. Rejected.

## R-03 How the metronome reaches the AudioContext (import boundary)

**Decision**: The engine (`src/lib/audio/engine.ts`) gains one method, `sink(): AudioSink | null`.
It runs `ensureContext()` (the same unlock path as `play`), and returns
`{ port, destination, running }` (`destination` is the engine's volume gain node). `running` is a
`Promise<boolean>` that resolves `true` once `resume()` has resolved and `false` if the unlock
failed. `null` means audio is unavailable. The playback store exposes it as
`playback.clickSink()`, which also calls `markUnlocked()`. The new state module
`src/lib/state/metronome.svelte.ts` imports `$lib/audio/metronome` (allowed by the existing lint
rule, which forbids only `$lib/audio/engine` outside `playback.svelte.ts`) and calls
`playback.clickSink()`.

**Rationale**: It keeps the contract "only `playback.svelte.ts` imports the engine" (eslint rule,
contract §4). The click uses the engine's gain chain, so mute and volume apply without new code,
and the engine's `halt()` (used by `stop('hidden')`, `stop('navigate')` and note interrupts) never
touches metronome sources, because they are not part of the engine's `active` request. That is
exactly FR-016: the hidden-page rule keeps stopping note playback but not the click.

**Alternatives considered**:
- *Add a `'click'` `PlaybackRequest` kind*: a request is finite and planned up front. The engine
  `halt`s it on `hidden`, and a note play would interrupt it (at most one active request). That
  violates FR-016 and is wrong for an endless stream. Rejected.
- *Let `state/metronome` import the engine*: breaks the lint boundary. Rejected.

## R-04 First click within 50 ms and never cut off (unlock)

**Decision**: Start (a user gesture) calls `playback.clickSink()` synchronously, inside the
gesture, so `resume()` is called in the gesture as R-08 of the engine already requires. The
scheduler then awaits `sink.running`. When the promise settles `true`, it sets
`anchor = port.currentTime + START_LEAD_S` with `START_LEAD_S = 0.02`, and the first click plays
at `anchor`. If the context is already running (the usual case after the first gesture), the
anchor is set synchronously in the same task. The press-to-click budget is measured from the
gesture's `performance.now()` to the scheduled `when` mapped back through
`port.getOutputTimestamp?.()`, or `currentTime` where that is missing.

**Rationale**: A source started at a `when` earlier than `currentTime` is truncated: it starts
immediately but its head is skipped. On a freshly resumed context in Safari/WebKit, `currentTime`
can jump. Anchoring only once `running` holds, plus a 20 ms lead (one render quantum is 2.9 ms at
44.1 kHz, and `baseLatency` is 5–10 ms with `latencyHint: 'interactive'`), guarantees
`when ≥ currentTime` (SC-003) with total press-to-sound ≈ 20 ms + output latency < 50 ms. If
unlocking takes longer than 50 ms (rare, first gesture only), the click still waits for
`running`. The spec ranks "never cut off" above the 50 ms target ("only once the audio context is
running"), and the e2e test measures from the moment the context is running.

**Alternatives considered**:
- *Schedule at `currentTime` immediately*: truncated on WebKit cold start. Rejected.
- *Larger lead (100 ms)*: safe but misses the 50 ms budget. Rejected.

## R-05 Pause, Resume and Reset semantics on the audio clock

**Decision**: The scheduler keeps a small queue of pending clicks `{ index, beat, when, source }`.
- **Pause** at `t = port.currentTime`: the last sounded click is the greatest `when ≤ t`. Every
  queued source with `when > t` is `stop()`ped and disconnected, which cancels it before it starts.
  The run freezes on the last sounded beat (`0` before the first click sounds, which shows as
  "no beat yet" and resumes on beat 1).
- **Resume**: a new segment. `anchor = currentTime + START_LEAD_S`, and
  `startBeat = (frozenBeat mod beats) + 1`. Click *k* of the segment has beat
  `((startBeat − 1 + k) mod beats) + 1`, and it is accented iff that beat is 1. There is no
  count-in.
- **Reset**: same as Pause (cancel everything not yet sounded), then the run state returns to
  `settings` and the settings values are kept.

**Rationale**: It matches the clarification ("Pause freezes on the last beat that has sounded",
"Resume plays frozen + 1 within 50 ms, re-anchors the grid"). Stopping a not-yet-started source
silences it, while a click already playing (30 ms) ends naturally, so there is no click after the
Pause instant and no truncated tick. Re-anchoring per segment keeps every segment drift-free on
its own (SC-006, FR-009).

**Alternatives considered**: keep the original grid on Resume (the next click waits for the old
grid slot). Rejected: the spec requires the click within 50 ms of Resume.

## R-06 Keeping dots and status in step with the sound

**Decision**: The status line and dots are derived from the **audio clock**, never from
scheduling. A `requestAnimationFrame` loop (the injectable `FrameClock`) reads
`currentAudioTime()` and asks the pure scheduler for `positionAt(t)`, the beat of the latest click
with `when ≤ t`. The store's `$state` is written only when that beat changes. `currentAudioTime()`
is `port.currentTime` minus the output latency (`outputLatency ?? baseLatency ?? 0`), so the dot
lights when the click is heard, not when it enters the graph.

**Rationale**: rAF runs once per frame (≤ 16.7 ms at 60 Hz), which meets "within one animation
frame (≤ 20 ms)" (FR-006). Writing state only when the beat changes keeps Svelte work to at most
5 updates per second at 300 BPM. When the page is hidden, rAF stops. On return, the first frame
computes the correct beat from the clock, with no catch-up animation.

**Alternatives considered**: a `setTimeout` per click at `when − currentTime` jitters 4–50 ms and
is throttled when hidden. Rejected.

## R-07 Background suspension and catch-up (FR-026)

**Decision**: On each wake, if the next unscheduled click's `when` is `< currentTime`, the
scheduler **skips forward**: `n = ceil((currentTime + START_LEAD_S − anchor) / period)`, on the
same grid and segment, with the beat number derived from `n`. It never schedules a click in the
past. The scheduler also watches `port.state` on each wake. When it is `'suspended'` or
`'interrupted'`, it calls `resume()` once. If that rejects, or the state is still not `running`
after `SUSPEND_GRACE_MS = 2000`, the store moves to `paused` at the last sounded beat and
announces the pause.

**Rationale**: It matches the clarification "no catch-up burst; beat numbering follows the clock".
Skipping by formula keeps the grid exact.

**Alternatives considered**: play all missed clicks at once (a burst). Rejected by the spec.

## R-08 Visual-only run when Web Audio is unavailable (FR-027)

**Decision**: When `playback.clickSink()` returns `null` (an unavailable context, a resume
rejection, or the `__fmAudioFault` test fault), or when `running` resolves `false`, the scheduler
runs on a **visual clock** (`performance.now() / 1000` through the injected `TimerClock`) with the
same grid maths and no sources. The store shows a one-line, dismissible `Notice` with the message
`metronome_sound_unavailable`, on the Metronome screen.

**Rationale**: Constitution X ("never blank; adjust and tell") and V (sound is not the only
carrier). The app-wide `playback.noticeVisible` notice is shown once per session inside the sound
control. The metronome's notice is scoped to the screen and appears on each failed Start, so a
user who dismissed the global one still learns why the click is silent.

**Alternatives considered**: refuse to start. Rejected: it leaves a blank result.

## R-09 Click sound synthesis

**Decision**: A pure function `renderClick(kind: 'accent' | 'normal', sampleRate): Float32Array`
in `src/lib/audio/click.ts` makes a 30 ms tick: a sine burst with a 1 ms linear attack and an
exponential decay (τ = 6 ms), at **1600 Hz with peak 0.9** (accent) or **1000 Hz with peak 0.55**
(normal). The two buffers are rendered once per context and reused for every click.

**Rationale**: A short sine tick is the conventional metronome sound. It needs no sample files
(C II), and the 1 ms attack avoids the DC click artefact. The ~4.3 dB level difference and the
pitch difference make the accent distinct (FR-007). Rendering is about 1300 samples, and doing it
once keeps scheduling cheap. It is a pure function, so unit tests can check the frequency (zero
crossings), the peak and the length.

**Alternatives considered**: oscillator nodes per click (an extra node graph per click, more
garbage, and harder to test); noise clicks (harsher and less pitched). Rejected.

## R-10 Run state machine and at most one stream (FR-028)

**Decision**: The store holds `phase: 'settings' | 'starting' | 'running' | 'paused'` and a
monotonically increasing `generation`. Every async continuation (`running` promise, wake, frame)
captures the generation and does nothing if it changed. `toggle()` in `starting` is ignored (a
transition in progress). The scheduler is a single instance per store, and `start()` on a
running scheduler is a no-op.

**Rationale**: Ten alternating presses within a second can only flip between `running` and
`paused`, each of which cancels or creates one segment. A stale `running` promise from an
earlier Start cannot start a second stream.

## R-11 Keyboard: Space and Esc

**Decision**: A pure matcher `matchMetronomeKey(e: ShortcutEventLike): 'toggle' | 'reset' | null`
in `src/lib/state/metronome-keys.ts` reuses the `ShortcutEventLike`/`toShortcutEvent` adapter
from `shortcuts.ts`. Guards: Ctrl/Meta/Alt/AltGraph, `repeat`, `isComposing`, `defaultPrevented`,
a text field, select or contenteditable target. For Space, it also ignores natively activated
targets (`button`, `a`, `summary`, `input[type=checkbox|radio|button|submit|reset]`), because the
browser's own activation is the "one press = one toggle". A range input is *not* excluded, so
Space on the slider toggles. Esc is ignored when an app-bar disclosure is open (the
`SoundControl` and `LanguagePanel` handle Escape first and call `preventDefault`, so the
`defaultPrevented` guard covers them; the matcher gets a `disclosureOpen` flag as
belt-and-braces). The Metronome screen binds it through `<svelte:window onkeydown>`. Space/Esc
are **not** subject to the character-key shortcut switch: WCAG 2.1.4 covers letter, punctuation,
number and symbol keys only, and these are the tool's primary transport keys.
`runShortcut` returns `false` for every action (including `notation`) on the `metronome` screen
(FR-023).

**Alternatives considered**: add Space/Esc to `SHORTCUTS`. Rejected: that table is single
character keys gated by the switch, and it is reused by the About toggle semantics.

## R-12 Tool identity: `ToolId` vs fretboard tools

**Decision**: Split the union. `ToolId = FretboardToolId | 'metronome'` lists every tool (TOOLS,
home cards, nav, `lastTool`, `measure.activeTool` failure attribution).
`FretboardToolId = 'notes' | 'triads' | 'caged'` is used by everything fretboard-specific:
`ToolLayout`, `ShareButton`, `TuningBadge`, `share.svelte.ts`, `links.svelte.ts` (`LinkedTool`),
`failure.ts`, `instrument.overrideNoticeFor`, and the link codec (`LinkTool`, unchanged).
`fault.ts` keeps `ToolId` so a Metronome render fault can be injected to test the fallback view.
`ScreenId` gains `'metronome'`, and `SCREENS` gains `/metronome`. The Metronome route renders its
own `MetronomeLayout` (app bar = `AppNav` + `SoundControl` + `LanguagePanel`, same `.app-bar`
classes), not `ToolLayout`.

**Rationale**: FR-023 removes every fretboard concern. Widening `ToolId` everywhere would force
exhaustive `switch` changes in the share codec and links for a tool that has no link format.
TypeScript's exhaustiveness then proves that no fretboard path accepts `'metronome'`.

**Alternatives considered**: reuse `ToolLayout` with `{#if}` guards. Rejected: about 10 guards,
and Share/address-sync effects would run against a tool with no link.

**Measurement (028)**: `EVENT_TOOLS` in `src/lib/measure/wire.ts` stays
`['notes','triads','caged']`. The Metronome does not call `measure.toolOpened` in this slice,
so the Pages Function allow-list and wire format are unchanged. Audio failure records on
`/metronome` attribute to `'shell'`, as the home screen does. Recorded as an assumption in plan.md.

## R-13 `lastTool` preference compatibility (C IX)

**Decision**: `TOOL_IDS` in `src/lib/prefs/schema.ts` becomes
`['notes','triads','caged','metronome']`. There is no format version bump. A new fixture
`tests/unit/prefs/fixtures/last-tool-metronome.txt` is added (fixtures are only ever added).

**Rationale**: The schema is `v.fallback(v.nullable(v.picklist(TOOL_IDS)), null)`, so older
builds that read `lastTool: 'metronome'` fall back to `null` and keep every other field. The
field is additive, and old values remain valid.

## R-14 `--color-danger` token

**Decision**: Add `--color-danger: light-dark(#a1262e, #ff9aa8)` to `tokens.css`, plus
`--color-danger-text: light-dark(#ffffff, #101317)`. Under `prefers-contrast: more`, use
`light-dark(#7d1620, #ffc2ca)`. Under `forced-colors: active`, the Reset button uses `ButtonText`
on `ButtonFace` with a `CanvasText` border, which is legible without hue. Values are checked by
unit tests (see the next paragraph) and may be tuned to pass. The constraints are what must hold,
not these exact hex values.

**Constraints, enforced by `tests/unit/reserved-colors.test.ts` extensions**: ≥ 3:1 non-text
contrast against `--color-surface` and `--color-bg` in light, dark and contrast-more. CIEDE2000
ΔE ≥ 10 from `--fb-color-root` in every set, so the root colour is never reused (C VII).
`var(--color-danger)` is referenced only from `src/lib/tools/metronome/RunControls.svelte`
(FR-021).

**Rationale**: The clarification classes Reset as a destructive control, not an error, so the
C VII "error red" clause does not apply. Icon plus accessible name plus tooltip keep it from being
colour alone (C V).

## R-15 Slider and pill

**Decision**: A new component `src/lib/tools/metronome/ValueRow.svelte` combines a label, a
native `<input type="range">` (min/max/step and `aria-valuetext`, with free arrow, PageUp/PageDown
and Home/End behaviour) and a pill with −/+ buttons plus a read-only `<output>` readout. It reuses
the `.stepper`, `.stepper-value` and `.btn` classes from `controls.css` that `FretStepper` uses.
Layout is CSS grid `auto minmax(0, 1fr) minmax(96px-token, max-content)`, so the slider column
shrinks first. The 96 px value becomes a token, `--pill-min-inline`.

**Rationale**: Native range inputs expose value and range to every screen reader without ARIA
(FR-003, FR-011). There are two uses (BPM and beats), so one component is justified (C X).
`FretStepper` is bound to the instrument store and is not reusable as is. It is not refactored in
this slice, so its behaviour stays unchanged.

## R-16 Testing timing without real time (C IV)

**Decision**: The scheduler takes `{ port: ClickPort, clock: TimerClock, frames: FrameClock }`.
Vitest uses the existing `FakeAudioPort`/`FakeClock` from `tests/unit/audio/support/fake-audio.ts`,
extended with `advance(seconds)` for `currentTime`, a recording `FakeSource.start(when)` /
`stop()`, and a `FakeFrames`. These tests cover SC-001 (fast-check property over BPM 30–300:
every `when` equals `anchor + n·60/bpm` within 2 ms, actually ≤ 1e-9), SC-002 (3000 clicks at
300 BPM), SC-004 (clock wakes only every 1000 ms for 60 s, with no missing index and every
`when ≥ currentTime` at scheduling), SC-006 (pause on beat 3 → resume → beat 4), FR-026
(a 30 s jump → no burst, skip forward) and FR-028 (10 toggles → at most one live segment, no
duplicate `index`). E2E reads the test-build `__fmAudioLog`, extended with
`{ type: 'click', run, index, beat, accent, when, contextTime, pressedAtMs, scheduledAtMs }` and
`{ type: 'click-cancel', run, count }` entries, to check the accent pattern, the
log shape (`when ≥ contextTime`, `pressedAtMs` on the first click), and that hiding the page does
not stop the run (polling for new entries, no fixed waits). Press-to-click latency is asserted only
on the fake clock; the e2e budget check is the CI perf spec (tap-to-sound ≤ 100 ms).

## R-17 Budgets

**Decision**: There is no budget change. The metronome code (scheduler, about 3 KB; store; four
small components; three message sets) ships in the single bundle (ADR 0002), with an estimated
+4–6 KB gzip. The bundle check runs at the end of the slice (`pnpm verify`). The plan sandbox
had no toolchain, so the current headroom is measured there. If it exceeds 150 KB, the fallback is
to lazy-load `src/lib/tools/metronome/*` through the route's component import. That is allowed,
because ADR 0002 concerns version skew of the initial entry, and the plan records it as a
Complexity Tracking item only if it is needed. `lighthouserc.cjs` adds `/metronome` to the URL
list and to the tool-screen `interactive ≤ 3500` assertion pattern.

## R-18 ADR

**Decision**: Write `docs/adr/0030-metronome-click-scheduler.md`. It records the lookahead
scheduler on the shared context (R-01, R-02, R-03), the exception to the hidden-page stop rule
(FR-016) and the `ToolId`/`FretboardToolId` split (R-12). These are architecturally significant
(Development Workflow: Decisions).
