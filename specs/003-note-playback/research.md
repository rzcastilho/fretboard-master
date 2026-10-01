# Research: Note Playback

**Feature**: `003-note-playback` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Every Technical Context unknown is resolved below as Decision / Rationale / Alternatives. IDs
R-01…R-18 are referenced from the plan, data model, contracts, and quickstart.

---

## R-01 Synthesis technique: extended Karplus-Strong rendered on the main thread into an `AudioBuffer`

**Decision**: Synthesize each note with an extended Karplus-Strong (Jaffe–Smith) string model in a
pure TypeScript function `renderPluck(pitch, sampleRate, lengthSamples): Float32Array`
(`src/lib/audio/pluck.ts`). The engine renders the samples on demand at request time, copies them
into an `AudioBuffer`, and plays it through an `AudioBufferSourceNode`. No `AudioWorklet`, no
`ScriptProcessorNode`, no recorded samples.

**Rationale**:

- The constitution allows "Karplus-Strong or AudioWorklet". Rendering a 1.5 s note at 48 kHz is
  72 000 iterations of a few multiply-adds. That is well under 1 ms on desktop and a few ms on a
  4×-throttled phone, so it fits inside the 100 ms tap-to-sound budget even for a 7-note chord.
- A pure render function runs in Node and Vitest. This makes FR-005/FR-006 (±5 cents, ±3 dB
  A-weighted, harmonic energy) testable offline and deterministically, as the clarifications
  require ("measured on an offline render"). No `OfflineAudioContext` is needed in jsdom.
- An `AudioWorklet` needs `audioWorklet.addModule(url)`, which is a **separate network request**.
  It would break ADR 0002 / `e2e/continuity.spec.ts` (zero requests after load) and version skew
  safety, and a `blob:` URL would need a CSP `script-src blob:` relaxation. The buffer approach
  needs neither.

**Alternatives considered**:

- AudioWorklet KS processor: real-time and CPU-efficient for long sustains, but it needs an extra
  module request (version skew, offline after load, CSP), and its DSP is only testable through a
  browser. Rejected.
- Recorded samples (Q-4): ruled out by the constitution stack row. They would also weigh roughly
  0.5–2 MB for A1–E6 on first load.
- `OscillatorNode` additive synthesis: no real pluck attack or natural decay without many nodes
  per note. Rejected for FR-004.

## R-02 String model details (tuning, decay, brightness, determinism)

**Decision**: The delay line runs at period `N = sampleRate / f0`. It has:

1. **Excitation**: one period of seeded white noise (`mulberry32`, seed = pitch, so renders are
   bit-identical). The noise is shaped by a pick-position comb (pluck at β = 0.13 of the string
   length) and a one-pole low-pass whose cutoff rises with pitch (brightness).
2. **Loss filter**: two-point weighted average `y = (1 − S)·x[n] + S·x[n − 1]`, with decay
   stretch `S` in `[0.5, 0.9]` falling with pitch, times a per-pitch loop gain `ρ`. `ρ` is chosen
   so the 60 dB decay time T60 follows a smooth curve, from about 4 s at A1 to about 1.2 s at E6.
   This gives a natural decay and stops high notes from dying faster than low notes.
3. **Tuning**: the total loop delay is `N`. The integer delay line, the loss filter's phase delay
   (≈ `S` samples at f0), and a **first-order all-pass fractional delay** add up to `N`. The
   all-pass coefficient `η = (1 − d)/(1 + d)` for fractional part `d ∈ [0.1, 1.1)`. This keeps
   the fundamental within ±5 cents up to E6 at 44.1 kHz (period ≈ 33.4 samples). Integer
   rounding alone gives about 19 cents of error there.
4. **Fade**: a 10 ms linear fade-out is baked into the last 10 ms of the requested length (FR-004
   ≤ 20 ms anti-click). A 2 ms linear fade-in avoids a DC click at onset while keeping the attack
   clear.

**Rationale**: these are the standard Jaffe–Smith extensions. Each one targets a measurable
requirement: tuning → FR-005 cents, decay stretch → FR-005 level balance and "natural decay",
excitation brightness → FR-006 harmonics. Seeded noise makes every test deterministic
(Principle IV).

**Alternatives considered**: plain KS with integer delay (out of tune above about C5); `Math.random`
excitation (non-deterministic tests); Lagrange interpolation for the fractional delay (more taps,
and it low-passes the loop, which shortens high-note decay).

## R-03 Pitch → frequency belongs in theory

**Decision**: Add `frequencyOf(p: Pitch): number = 440 · 2^((p − 69)/12)` to
`src/lib/theory/pitch.ts`. Test it with a table (A4 = 440, C3 = 130.81, E2 = 82.41, A1 = 55,
E6 = 1318.51) and a fast-check property (an octave doubles the frequency).

**Rationale**: the conversion is pure arithmetic and part of "each note MUST sound at its
calculated pitch" (Principle I). Placing it in theory puts it under the ≥ 95 % theory coverage
gate. Audio derives its pitch through `positionPitch(instrument, position)` (FR-001, TM-1).
**Alternatives**: computing frequency inside `src/lib/audio` (moves a correctness-critical
formula outside the theory gate); passing frequencies in requests (forbidden by ARCH-7 /
clarification).

## R-04 Level balance (±3 dB A-weighted) and loudness normalization

**Decision**: After rendering, the synth multiplies each voice by a normalization gain. The gain
brings the A-weighted RMS of the first 500 ms to a fixed target (−24 dBFS; −18 let high-note attacks exceed full scale). The A-weighting is an
IEC 61672 bilinear-transformed IIR cascade in `src/lib/audio/loudness.ts`. Gains are memoized per
`(pitch, sampleRate)`.

The tests verify the result with an **independent** analysis helper
(`tests/unit/audio/support/analysis.ts`) that applies the A-weighting curve in the frequency
domain (FFT of the 500 ms window). This keeps the test from re-using the code under test.

**Rationale**: deterministic renders make exact normalization possible, so the ±3 dB criterion
holds by construction across A1–E6 and both 44.1/48 kHz. **Alternatives**: a fitted per-pitch
gain curve (fragile when timbre parameters change); runtime loudness compressor (non-deterministic,
colours the attack).

## R-05 Low-note harmonics on small speakers (FR-006)

**Decision**: Below 200 Hz, excitation brightness is held at a floor (low-pass cutoff ≥ 8·f0) and
pick-position β = 0.13 (does not null the 2nd–7th harmonics). The test measures the energy above
`1.5·f0` divided by the total energy (DC removed) over the first 500 ms. It must be ≥ 0.5 for
every pitch with f0 < 200 Hz (A1…G3 region).

**Rationale**: plucked strings naturally carry most low-note energy in upper partials. The
requirement is a guard against over-darkening, not a reason to add special processing (EC-7.6).
**Alternatives**: a high-pass "phone mode" (spec says no special handling); harmonic exciter
(extra DSP for no requirement).

## R-06 Measuring pitch offline (±5 cents)

**Decision**: The test helper estimates f0 with a **zoom-DFT sweep**. It windows 0.1–1.1 s with
a Hann window, evaluates Goertzel magnitude from −30 to +30 cents around the target in 0.1-cent
steps, and refines the peak with parabolic interpolation. The pass condition is
`|1200·log2(f̂/f)| ≤ 5`.

**Rationale**: the method is resolution-independent and accurate to well under 0.5 cents on a
KS tone. It is simple to write without an FFT library (no new dependency). **Alternatives**:
autocorrelation/YIN (octave errors on bright low notes); plain FFT peak (1 Hz bins are 30 cents
at A1).

## R-07 Audio graph, gain staging, and clipping (FR-021)

**Decision**: The graph is
`AudioBufferSourceNode → voice GainNode → volume GainNode → mute GainNode → ctx.destination`.

- A **chord or sequence step is mixed in pure code** (`mixVoices`) into a single buffer. Each
  voice gets `1/√n`, and then a **static peak limiter** scales the mixed buffer so its peak is at
  most 0.89 (−1 dBFS). The limiter is pure, so "a 7-note set never clips at 100 % volume" is
  provable offline. Each request step therefore plays exactly one source node.
- The volume gain uses a squared taper: `gain = (volume/100)²`. 0 % is silent and 80 % → 0.64.
  Mute is a separate gain node (0/1), so muting keeps the volume value (FR-009).
- Mute and volume changes ramp over 10 ms (`setTargetAtTime`, τ = 3 ms) and apply to sounding
  notes immediately.

**Rationale**: the clarification asks for 1/√n plus "an output limiter/compressor". A
deterministic peak limiter on the mixed buffer meets the no-clip guarantee testably. A
`DynamicsCompressorNode` cannot run in jsdom, and it adds attack colouring. **Assumption
recorded** in the plan: the static limiter is the "limiter" of the clarification; a
`DynamicsCompressorNode` was rejected as untestable and unnecessary once peaks are bounded before
playback. The squared taper was chosen over linear because a linear taper makes 50–100 % sound
almost the same.

## R-08 Unlock on gesture (FR-002) and first-note behavior

**Decision**: The engine creates **no `AudioContext` until the first sound-asking gesture**. These
gestures are fretboard `onactivate` (pointer or keyboard), mute/volume interaction, and later a
Listen command. In that same synchronous handler the engine does three things:

1. constructs `new AudioContext({ latencyHint: 'interactive' })`;
2. calls `resume()` (not awaited before scheduling);
3. schedules the note at `ctx.currentTime`.

If the context is still suspended, the note starts the moment it runs, so the unlocking gesture's
own note plays (SC-002). Navigation and scroll never reach the engine.

**Rationale**: browser autoplay policies (Chrome, Safari, Firefox) allow creating and resuming a
context inside a user activation. Scheduling before the resume promise settles keeps the first
note inside the gesture's activation window, which is needed on iOS. **Alternatives**: awaiting
`resume()` and then scheduling (it can lose transient activation on Safari and adds latency);
creating the context at page load (violates FR-002 and triggers autoplay warnings).

## R-09 Unavailable detection and the once-per-session notice (FR-015, EC-7.1, EC-7.7)

**Decision**: Availability becomes `unavailable` (permanently, for the page session) when, during
the **first unlock attempt**:

- the `AudioContext` constructor is missing or throws, or
- `resume()` rejects, or
- the synth loader rejects.

The first time this happens, the playback state sets `noticeShown = true` and the notice renders.
No retries follow. Later failures of `resume()` after audio was on (device switch, Safari
`interrupted` state) drop that request's sound silently. The pulse still shows, and the next
request tries `resume()` again (EC-7.7). This does not mark the session unavailable.

**Rationale**: it matches the clarification: "once unavailable stays unavailable" and "a device
switch is not unavailable". The decision also avoids treating "still suspended after N ms" as a
failure. Slow devices would produce false positives, and the clarification lists only
creation/resume/load failures. **Alternatives**: a timeout on `resume()` (false positives);
retrying on every tap (repeated notices, violates spec).

## R-10 "Sound material" loading and the 100 ms window (FR-017)

**Decision**: The synth code ships **inside the single bundle** (ADR 0002). It is reached through
an injectable `SynthLoader = () => Promise<Synth>`. Production resolves immediately with the
bundled synth. The engine starts the loader after the fretboard is interactive (on mount of the
playback host, inside `requestIdleCallback`, with a `setTimeout(0)` fallback). This does not
create an `AudioContext`.

A tap during loading pulses at once. Its note plays only if the loader settles within 100 ms of
the activation (measured on the injected clock); otherwise that note is dropped. A loader
rejection follows R-09.

**Rationale**: one bundle means nothing can fail to download mid-session and nothing is
requested after load (FR-016, continuity test). The loader seam still models the spec's
loading/failed states. It is exercised by unit tests (delayed/rejecting loader) and by the e2e
fault hook (R-16). Estimated bundle cost: synth + engine + state + UI ≈ 5–7 KB gzip, inside the
80 KB budget (SC-007; `check-bundle-size.mjs` gates it). **Alternatives**: dynamic `import()` of
the synth (with `bundleStrategy: 'single'` it is inlined anyway, so there is no gain); a separate
worklet file (see R-01).

## R-11 Scheduling, interruption, and time marks (FR-011, FR-012, FR-018)

**Decision**: A pure function `planRequest(request, instrument)` in `src/lib/audio/schedule.ts`
returns the steps and the time marks synchronously:

- `note` and `chord`: one step at 0 ms, length 1500 ms.
- `sequence`: tempo is clamped to [30, 300] bpm; step i starts at `i·60000/bpm` and ends at the
  next step's onset; the last step lasts one beat.

The engine then does three things:

1. stops the active request: each live source gets a voice-gain ramp to 0 over 10 ms and
   `stop(now + 0.012)`, and pending pulse timers are cleared;
2. schedules every step on the audio clock at `t0 = ctx.currentTime` plus the step onset, so a
   sequence is sample-accurate and needs no timer drift handling;
3. hands the time marks to the pulse scheduler.

`stop()` does step 1 only. At most one request is active.

**Rationale**: sample-accurate audio scheduling plus timer-driven pulses (R-12) is the standard
Web Audio pattern. Pure planning makes US6 and the tempo clamp unit-testable without audio.
**Alternatives**: a `setTimeout` per sequence step for audio (jitter, background throttling);
returning time marks asynchronously (spec says synchronously).

## R-12 Pulses: timing, rendering, reduced motion (FR-007, FR-008)

**Decision**:

- **Timing**: the playback state keeps `pulses: Pulse[]`. Pulses are added at `onsetMs` and
  removed at `endMs` through an injectable `TimerClock` (`now`/`setTimeout`/`clearTimeout`). This
  follows the pattern of 002's rAF `Clock` in `scroll-animation.ts`, but uses timers instead of
  frames, because a pulse is a start/end event, not a per-frame animation. The base time is the request time, and audio
  starts at `ctx.currentTime` at that same moment. Pulses run whether sound is on, muted,
  unavailable, or the synth note was dropped.
- **Drawing merge**: the fretboard gets a new optional prop `pulses`. A pure
  `applyPulses(markers, pulses)` in `src/lib/fretboard/pulse.ts` computes the drawn markers:
  - an existing marker at a sounding position keeps its function and is drawn `highlighted`
    with `pulse: { id, durationMs }`;
  - a position without a marker gets a transient `neutral` `highlighted` drawn marker.

  `DisplayModel` stays unchanged. Cell names and the text description use the un-pulsed model,
  so the live region never announces pulses. The fretboard keys the marker element by
  `pulse.id`, so a re-tap of the same position restarts the animation.
- **Render**: when `pulse` is present, the marker gets class `pulse` and the CSS custom property
  `--pulse-duration` is set via Svelte's `style:` directive. That directive goes through CSSOM,
  which CSP allows; pulses never exist in prerendered HTML. A single keyframe animates scale
  `1 → var(--pulse-scale) → 1` and opacity, using `animation-iteration-count: 1`. Under
  `@media (prefers-reduced-motion: reduce)` the animation is `none`, so only the `highlighted`
  emphasis switch remains, for the same interval. Scale and opacity come from new tokens
  (`--pulse-scale`, `--pulse-opacity-peak`). The duration is the note duration, as the design doc
  motion table requires.

**Rationale**: expressing the pulse only through emphasis plus one motion token satisfies
Principle VII. Keeping pulses a separate prop with a pure draw-time merge keeps the renderer dumb and testable, and keeps tool display models free of transient playback state. Rejected: merging pulses into `DisplayModel` (would change cell names and trigger live-region announcements on every tap).
**Assumption recorded**: a dimmed/normal marker becomes `highlighted` while it sounds, in both
motion modes, so reduced and full motion show the same state. Rejected alternative: keeping the
original emphasis during a non-reduced pulse, which would make the two modes disagree on state.
Web Animations API was also rejected: it needs per-element JS lifecycle, while a CSS animation
plus a keyed element is simpler.

## R-13 Sound control UI (FR-009, FR-010, FR-019)

**Decision**: `SoundControl.svelte` lives in every application bar: the tool layout header, the
About header, and the Home `header.top`. It has three parts:

- a **mute toggle**: `<button aria-pressed>` with an inline SVG icon (speaker + waves / speaker
  + cross / speaker + slash for unavailable), a visually hidden catalog label, and 44×44 px;
- a **settings disclosure button** (`aria-expanded`, `aria-controls`) that opens a non-modal
  panel containing a native `<input type="range" min=0 max=100 step=5>` with `aria-valuetext`
  ("80 %") and the help list, whose first item is "Check that silent mode is off and the system
  volume is up";
- the panel closes on Escape (focus returns to the disclosure button) or on a `pointerdown`
  outside it. There is no focus trap and no `inert`.

When unavailable, the mute button gets `aria-disabled="true"` (it stays focusable, so the state
is discoverable) with label "Sound unavailable", and the range input is `disabled`. A
`StopButton.svelte` renders beside it only while `sequencePlaying`.

**Rationale**: this follows the clarifications exactly. Distinct icon shapes plus text labels
mean state is not conveyed by color alone (Principle V). Mute stays outside the disclosure
(Principle VII "main controls never behind a menu"). **Alternatives**: a single combined
"slider with mute at 0" (conflates mute and volume 0 %, which the spec separates); a popover with
the `popover` attribute (light-dismiss semantics vary across the last-two-versions browsers;
plain state is simpler).

## R-14 Notice reuse (FR-015)

**Decision**: Generalize `src/lib/shell/Notice.svelte` to take `message: string` and an optional
`ondismiss`. The existing not-found usage passes `m.notice_not_found()`. A `SoundNotice` region
(always-present `role="status" aria-live="polite"` container inside `SoundControl`'s app-bar
area) renders `Notice` when `playback.noticeVisible`.

Dismissing sets `noticeVisible = false` and keeps `noticeShown = true`, so the notice never
returns in the session. Dismiss moves focus back to the mute button rather than `h1`, because the
user is in the app bar.

**Rationale**: two real uses justify generalizing the component (Principle X). The notice style,
two-line limit, and no-error-red are already implemented there. **Alternatives**: a second notice
component (duplication); a toast system (speculative).

## R-15 Stop triggers: hidden page, route change, instrument/view-state change (FR-013, FR-014)

**Decision**:

- `PlaybackHost` (mounted once in `src/routes/+layout.svelte`) listens to `visibilitychange`
  (hidden) and `pagehide`, and calls `playback.stop()`. It never auto-resumes.
- `+layout.svelte`'s navigation hook (`beforeNavigate`) calls `playback.stop()` for every route
  navigation.
- Instrument: the fretboard host (`ToolPlaceholder`) has an `$effect` that tracks the instrument
  passed to the board and calls `stop()` when it changes (verified with an injected instrument
  in a component test).
- View state: `src/lib/state` has no view state yet (it arrives in 004). The playback contract
  obliges the future view-state store to call `playback.stop()` on every change. The plan records
  this as a carried obligation.
- Mute and volume never call `stop()`.

**Rationale**: these are the narrowest hooks for each trigger. **Alternatives**: suspending the
`AudioContext` on hide (not needed: stopping sources silences it, and the next request calls
`resume()` if the browser suspended it); a global store subscription for "any state change"
(nothing to subscribe to yet, YAGNI).

## R-16 Test seams and test-build hooks

**Decision**:

- **Unit/component**: the engine takes `{ createContext, loadSynth, clock }`.
  `tests/unit/audio/support/fake-audio.ts` provides a recording fake `AudioContext`. It has
  controllable `currentTime`/`state`, `resume` that resolves or rejects, and fake
  `createBuffer`/`createBufferSource`/`createGain` that log `start(when)`, `stop(when)`, and gain
  automation. A fake `TimerClock` advances time manually.
- **E2E (test builds only, ADR 0004 rule)**:
  - `globalThis.__fmAudioFault: 'context' | 'synth' | undefined` forces the context factory to
    throw, or the loader to reject;
  - `globalThis.__fmAudioLog: AudioLogEntry[]` records every scheduled step (kind, pitches,
    frequencies, `when`, `contextTime`) and every stop.

  Both are read only under `__FM_FAULT_INJECTION__`. `scripts/check-no-fault-hook.mjs` adds both
  names. ADR 0004 gets an amendment, not a new ADR.
- E2E asserts that the first tap on string 6 open logs E2 = 82.41 Hz and a context that reached
  `running` (headless Chromium runs Web Audio with a null sink).

**Rationale**: this is the existing, CI-guarded mechanism (Principle IV determinism, ADR 0004).
Real-time listening is never used in automated tests (clarification). **Alternatives**: query
flags (unsafe if shipped); spying on `AudioContext.prototype` from Playwright (brittle across
browsers).

## R-17 No new runtime or dev dependencies

**Decision**: none. The FFT/Goertzel analysis, A-weighting, and PRNG are written in-repo (each
< 80 lines). **Rationale**: Principle X. Audio DSP libraries (Tone.js ≈ 80 KB gzip) would break
the bundle budget. **Alternatives**: `fft.js` as a dev dependency (a zoom-DFT needs no FFT; the
A-weighted RMS can use a direct DFT over 500 ms at test time, which is fast enough).

## R-18 ADR

**Decision**: Add `docs/adr/0007-main-thread-karplus-strong-playback.md`. It records R-01
(buffer render vs worklet, the continuity/CSP reasons), R-07 (pure mix + static limiter), and
R-10 (bundled synth behind a loader seam). Amend ADR 0004 for the audio hooks.
**Rationale**: the audio architecture is architecturally significant (constitution "Decisions").
