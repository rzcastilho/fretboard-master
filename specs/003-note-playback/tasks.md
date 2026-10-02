# Tasks: Note Playback

**Input**: Design documents from `/specs/003-note-playback/`

**Prerequisites**: plan.md, spec.md, research.md (R-01–R-18), data-model.md, contracts/ (playback-api, sound-control-ui, test-hooks), quickstart.md

**Tests**: INCLUDED. Constitution Principle IV requires test-first for logic (`theory`, audio `pluck`/`loudness`/`schedule`/`engine`, `fretboard/pulse`, `state/playback`) and tested behavior for UI. Every test task below MUST be written and seen failing before its implementation task.

**Organization**: Grouped by user story. Stories are independently testable; shared pure pieces sit in Phase 2.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6, user-story phases only
- Paths are relative to the repository root. Single static SvelteKit project.

## Conventions every task inherits

- No new runtime/dev dependencies (R-17). DSP, A-weighting, PRNG, analysis are in-repo.
- All user-facing strings come from `messages/en.json` (Paraglide `m.*`). All visual values are tokens in `src/lib/styles/tokens.css`.
- `src/lib/audio/**` must not import `svelte`, `$app/*`, `$lib/paraglide/*`, `$lib/fretboard/*`, `$lib/state/*`, `$lib/shell/*`. `src/lib/fretboard/**` must not import `$lib/audio/*` or `$lib/state/*`. Only `src/lib/state/playback.svelte.ts` imports `$lib/audio/engine`.
- Exported functions have explicit return types and never throw on expected input.
- Pitch is C4 = 60; frequency = `440 · 2^((p − 69)/12)`. Pitch range guaranteed: A1 (33) … E6 (88).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lint boundaries, catalog, tokens, and test-build globals that every story needs.

- [X] T001 Edit `eslint.config.js`: add import boundaries from contracts/playback-api.md §4 (audio ↛ svelte/`$app/*`/`$lib/paraglide/*`/fretboard/state/shell/prefs; fretboard ↛ `$lib/audio/*` and `$lib/state/*`; only `src/lib/state/playback.svelte.ts` may import `$lib/audio/engine`). Verify by temporarily adding `import 'svelte'` to a scratch file under `src/lib/audio/` and confirming `pnpm lint` fails, then remove it.
- [X] T002 [P] Edit `messages/en.json`: add the 14 keys from contracts/sound-control-ui.md §5 exactly (`sound_group_label`, `sound_mute`, `sound_unavailable_label`, `sound_state_on`, `sound_state_muted`, `sound_state_unavailable`, `sound_settings`, `sound_volume`, `sound_volume_value` with `{value}` placeholder, `sound_help_title`, `sound_help_silent_mode`, `sound_help_app_volume`, `sound_unavailable_notice`, `playback_stop`).
- [X] T003 [P] Edit `src/lib/styles/tokens.css`: add `--pulse-scale` (1.25), `--pulse-opacity-peak`, `--sound-panel-width`, `--icon-size`; extend the existing `prefers-contrast: more` block with a stronger sound-panel border using the existing border-token pattern.
- [X] T004 [P] Edit `src/app.d.ts`: declare `var __fmAudioFault: 'context' | 'synth' | undefined` and `var __fmAudioLog: AudioLogEntry[] | undefined` (shape in data-model.md §8; import the type from `$lib/audio/types`).
- [X] T005 [P] Edit `scripts/check-no-fault-hook.mjs`: add needles `__fmAudioFault` and `__fmAudioLog`; extend `tests/unit/no-fault-hook.test.ts` so a build dir containing either string fails the check.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure, shared pieces and test support that all stories use.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Write failing tests in `tests/unit/theory/pitch.test.ts` (extend): `frequencyOf` table E2(40)=82.41, A1(33)=55.00, C3(48)=130.81, A4(69)=440.00, E6(88)=1318.51 (2-decimal tolerance) plus a fast-check property that `frequencyOf(p + 12) ≈ 2 · frequencyOf(p)`.
- [X] T007 Implement `frequencyOf(p: Pitch): number` in `src/lib/theory/pitch.ts` (`440 · 2^((p − 69)/12)`, 12-TET, A4 = 440 Hz). Keep theory coverage ≥ 95 %.
- [X] T008 [P] Create `src/lib/audio/types.ts`: `PlaybackRequest` (`note` / `chord` 1..7 positions / `sequence` with steps and `bpm`), `TimeMark {position, onsetMs, endMs}`, `PlannedStep`, `Plan`, `Synth {renderVoice(pitch, sampleRate, lengthSamples): Float32Array; mixVoices(voices): Float32Array}`, `SynthLoader`, and `AudioLogEntry` (data-model.md §2, §3, §4, §7, §8).
- [X] T009 [P] Create `src/lib/audio/prng.ts`: `mulberry32(seed: number): () => number` (pure, seeded, deterministic). Add `tests/unit/audio/prng.test.ts` (same seed → identical sequence; values in [0,1)).
- [X] T010 [P] Write failing tests `tests/unit/audio/schedule.test.ts`: `clampBpm` (29→30, 301→300, NaN→30, +∞→300, −∞→30); `planRequest` marks for note `{onsetMs:0,endMs:1500}`, chord (shared onset 0, end 1500), sequence step i at `i·60000/bpm` ending at next onset and last step one beat; invalid positions dropped (via `isValidPosition`); request with nothing valid → `[]` marks and no steps; duplicate positions in one chord/step de-duplicated by `positionKey`; marks ordered by step then input order; pitches from an injected non-standard instrument equal open-string pitch + fret (US1-3, US6-1…4, FR-018).
- [X] T011 Implement `src/lib/audio/schedule.ts`: `NOTE_MS = 1500`, `MIN_BPM = 30`, `MAX_BPM = 300`, `clampBpm`, `planRequest(request, instrument): Plan` using `positionPitch`/`isValidPosition`/`positionKey` from `src/lib/instrument/instrument.ts`. Pure; no throw.
- [X] T012 [P] Create `tests/unit/audio/support/fake-audio.ts`: recording fake `AudioPort` (controllable `currentTime`, `state`, `resume()` that resolves or rejects on demand, `createBuffer`/`createBufferSource`/`createGain` that log `start(when)`, `stop(when)`, buffer contents, and gain automation calls such as `setTargetAtTime`/`linearRampToValueAtTime`/`setValueAtTime`) and a fake `TimerClock` (`now`, `setTimeout`, `clearTimeout`, `advance(ms)`), per contracts/playback-api.md §2.
- [X] T013 [P] Create `tests/unit/audio/support/analysis.ts`: independent analysis helper (not importing `src/lib/audio/loudness.ts`): zoom-DFT/Goertzel pitch estimator (Hann window 0.1–1.1 s, −30…+30 cents in 0.1-cent steps, parabolic refinement; R-06), FFT/direct-DFT-domain IEC A-weighted RMS over the first 500 ms (R-04), and harmonic-share function (energy above `1.5·f0` / total energy with DC removed, first 500 ms; R-05). Add a small self-check test `tests/unit/audio/support/analysis.test.ts` (pure sine at known frequency → within 0.5 cent; known sine level → expected A-weighted dB).
- [X] T014 [P] Generalize `src/lib/shell/Notice.svelte` to props `message: string` and optional `ondismiss`; keep `notice_dismiss` for the dismiss button, notice tokens, ≤ 2 lines, no error red. Update `src/routes/[...unknown]/+page.svelte` to pass `m.notice_not_found()` (refactor only, no copy change). Update `tests/unit/notice.test.ts`: generic `message` prop renders, not-found copy unchanged, `ondismiss` called, dismiss absent when no handler (write the test updates first and see them fail).

**Checkpoint**: Foundation ready. User stories can begin.

---

## Phase 3: User Story 1 - Tap a position, hear its real pitch (Priority: P1) 🎯 MVP

**Goal**: Activating any fretboard position (pointer or keyboard) unlocks audio on that gesture and sounds the correct pitch with a clean plucked-string timbre, scheduled at the audio clock's current time.

**Independent Test**: Load `/notes`; as the first gesture activate string 6 open → `__fmAudioLog` shows `unlock` then `step` with `pitches: [40]`; activate string 5 fret 3 → pitch 48. No `unlock` entry before a gesture. Offline renders A1–E6 are within ±5 cents.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T015 [P] [US1] Write `tests/unit/audio/loudness.test.ts`: the A-weighting filter response at 100 Hz, 1 kHz, 10 kHz is within ±0.5 dB of IEC 61672 values (−19.1, 0, −2.5 dB); `aWeightedRms` of a unit sine at 1 kHz ≈ 0.707 within 1 %.
- [X] T016 [P] [US1] Write `tests/unit/audio/pluck.test.ts` for `pluckSynth.renderVoice` over every pitch 33–88 at 44 100 and 48 000 Hz using `tests/unit/audio/support/analysis.ts`: fundamental within ±5 cents of `frequencyOf(pitch)` (FR-005); A-weighted RMS of the first 500 ms within ±3 dB of the median across the span; for `frequencyOf(pitch) < 200` the harmonic share ≥ 0.5 (FR-006); last 10 ms fades linearly to exactly 0 and the first 2 ms fade in; same `(pitch, sampleRate, length)` yields identical samples (determinism); outputs finite and non-silent; a pitch outside A1–E6 still renders (clamped timbre).
- [X] T017 [P] [US1] Write `tests/unit/audio/engine.test.ts` (first part, E1–E3) with the fake port/clock: E1 `createContext` not called by construction or `preload()`; E2 first `play(note)` creates the context, calls `resume()`, and calls `source.start(when)` with `when === ctx.currentTime` in the same synchronous call (no await; also assert ≤ 100 ms after activation on the injected clock, SC-001); E3 `play` returns marks synchronously equal to `planRequest(...).marks`; first note of string 6 open uses pitch 40 and a buffer rendered at `ctx.sampleRate` of length 1.5 s; graph is source → voice gain → volume gain (`(v/100)²`, default 0.64) → mute gain → destination.
- [X] T018 [P] [US1] Write `tests/unit/state/playback.test.ts` (first part): defaults `availability: 'idle'`, `muted: false`, `volume: 80`, `controlState: 'on'`; `playback.note(position, instrument)` delegates to the engine from `resetPlaybackForTests(deps)` and returns its marks; navigation/scroll helpers never call the engine.
- [X] T019 [P] [US1] Extend `tests/unit/home-screen.test.ts`-style host test `tests/unit/tool-placeholder.test.ts` (new): activating a fretboard cell in `ToolPlaceholder` with an injected fake engine calls `playback.note` with the activated `(string, fret)` and the instrument in use; a non-standard injected instrument produces a different pitch for the same fret (US1-3).
- [X] T020 [P] [US1] Write `e2e/playback.spec.ts` (US1 cases only for now; projects phone 360, phone-touch 320, desktop) plus helpers `readAudioLog` and `injectAudioFault` in `e2e/support/helpers.ts`: (a) load `/notes`, scroll the board, navigate to `/triads` and back → `__fmAudioLog` has no `unlock` entry (US1-4, FR-002); (b) first action click "string 6, open" → `unlock` then `step` with `kind:'note'`, `pitches:[40]`, frequency ≈ 82.41 (US1-1, SC-002); (c) keyboard: focus the grid, move to string 5 fret 3, press Enter → `step` pitch 48 (keyboard parity).

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement `src/lib/audio/loudness.ts`: IEC 61672 A-weighting as a bilinear-transformed IIR cascade and `aWeightedRms(samples, sampleRate, windowSamples): number` (R-04). Pure.
- [X] T022 [US1] Implement `renderVoice` in `src/lib/audio/pluck.ts` and export `pluckSynth: Synth` (mixVoices is added in T052): extended Karplus-Strong per R-02 (seeded `mulberry32` excitation with seed = pitch, pick-position comb β = 0.13, one-pole low-pass with pitch-rising cutoff and floor ≥ 8·f0 below 200 Hz per R-05, two-point loss filter with decay stretch S ∈ [0.5, 0.9] and per-pitch loop gain targeting T60 ≈ 4 s at A1 to ≈ 1.2 s at E6, first-order all-pass fractional delay η = (1 − d)/(1 + d) with d ∈ [0.1, 1.1), 2 ms fade-in and 10 ms fade-out baked in) then normalize by A-weighted RMS of the first 500 ms to −18 dBFS using `loudness.ts`, memoized per `(pitch, sampleRate)` (R-04). Depends on T021. Pure TypeScript, no DOM.
- [X] T023 [US1] Implement `src/lib/audio/engine.ts` core (E1–E3 only for now): `TimerClock`, `AudioPort`, `EngineDeps`, `EngineEvents`, `PlaybackEngine`, `createPlaybackEngine(events, deps?)`. Defaults: `createContext = () => new AudioContext({ latencyHint: 'interactive' })`, `loadSynth = () => Promise.resolve(pluckSynth)`, window timers + `performance.now`. `preload()` only starts the loader (no context). `play()` lazily creates the context inside the call, calls `resume()` without awaiting, plans via `planRequest`, renders voice(s) at `ctx.sampleRate` for the step length, copies into an `AudioBuffer`, builds source → voice gain → volume gain (`(volume/100)²`) → mute gain → destination, and `start(when = ctx.currentTime)`; returns `plan.marks` synchronously. `unlock()` creates/resumes the context without playing. Keep the file free of Svelte and DOM-global access beyond the default factories.
- [X] T024 [US1] Implement `src/lib/state/playback.svelte.ts` (first part): module-level runes state (`availability`, `muted`, `volume`, `sequencePlaying`, `pulses`, `noticeVisible`, internal `noticeShown`), derived `controlState`, facade `note(position, instrument)`, `preload()`, and `resetPlaybackForTests(deps?)` per contracts/playback-api.md §3. Engine events update state. Depends on T023.
- [X] T025 [US1] Edit `src/lib/shell/ToolPlaceholder.svelte`: call `playback.note(position, instrument)` from the fretboard `onactivate` (pointer and keyboard). Keep the model unchanged. Depends on T024.
- [X] T026 [P] [US1] Create `src/lib/shell/PlaybackHost.svelte`: on mount call `playback.preload()` inside `requestIdleCallback` with `setTimeout(0)` fallback (no `AudioContext` creation, no effect on interactivity; FR-017, SC-007). Create `tests/unit/playback-host.test.ts` (first part): preload is scheduled idle after mount and creates no context.
- [X] T027 [US1] Edit `src/routes/+layout.svelte`: mount `<PlaybackHost/>`. Depends on T026.
- [X] T028 [US1] Run the US1 unit suites and `e2e/playback.spec.ts` US1 cases (`pnpm build:test`, `pnpm test:e2e -g playback`); add the test-build log hooks to the engine now so the e2e can read them: under `__FM_FAULT_INJECTION__`, append `unlock` and `step` entries (`step` includes `scheduledAtMs = performance.now()` read right after the step's last `source.start`, data-model.md §8; numbers and enum strings only; `__fmAudioLog` created on first write, never read by app code) in `src/lib/audio/engine.ts`.

**Checkpoint**: Tapping a position sounds the correct pitch. MVP audio works.

---

## Phase 4: User Story 2 - Pulse in sync with sound, even when muted (Priority: P1)

**Goal**: Each sounding position pulses once from its onset mark to its end mark on the board, with sound on, muted, or unavailable; reduced motion shows a plain `highlighted` state; a position without a marker gets a transient neutral marker.

**Independent Test**: Tap a position: the marker gets `.pulse`, removed at the 1.5 s end mark (duration checked on the fake clock in unit tests; e2e advances Playwright `page.clock`). Mute and tap: still pulses. Reduced motion: highlighted with `getAnimations().length === 0`. Empty position: a transient neutral highlighted marker appears and is removed at the end mark.

### Tests for User Story 2 ⚠️

- [X] T029 [P] [US2] Write `tests/unit/fretboard/pulse.test.ts` for `applyPulses`: an existing marker at the sounding position keeps its `function` and `spelling` and is drawn `highlighted` with `pulse {id,durationMs}`; a position with no marker appends `{string, fret, function:'neutral', emphasis:'highlighted', pulse}`; first marker per position wins; invalid positions ignored; inputs not mutated; empty `pulses` returns the input markers unchanged (data-model.md §6, US2-4).
- [X] T030 [P] [US2] Extend `tests/unit/fretboard/fretboard.test.ts`: the `pulses` prop draws `.pulse` markers keyed by `pulse.id` (re-sounding the same position with a new id re-creates the element); `--pulse-duration` equals `durationMs` ms; cell accessible names and the text description are identical with and without pulses (no live-region change); transient marker for an empty position; under reduced motion the stylesheet declares `animation: none` for `.marker.pulse .shape` (FR-008).
- [X] T031 [P] [US2] Extend `tests/unit/audio/engine.test.ts` (E5): `onPulseStart` fires at `onsetMs` and `onPulseEnd` at `endMs` on the fake clock for a note (1500 ms); pulses fire when the engine is muted, when the context is unavailable, and when the note was dropped; one pulse per onset; ids strictly increase.
- [X] T032 [P] [US2] Extend `tests/unit/state/playback.test.ts`: `playback.pulses` gains a pulse at onset and loses it at the end mark via the fake clock, including when muted (US2-1, US2-2).
- [X] T033 [P] [US2] Extend `e2e/playback.spec.ts` (no wall-clock waits for pulse timing; constitution IV): install Playwright `page.clock` before `page.goto` in these cases; after a click the marker has `.pulse`, then `page.clock.runFor(1500)` → no `.pulse` (exact onset/end timing is covered by T031/T032 on the fake `TimerClock`); after muting, clicking still shows `.pulse` (US2-2); `emulateMedia({ reducedMotion: 'reduce' })` then click → the marker is highlighted and `getAnimations().length === 0` (US2-3); clicking an empty position shows a transient neutral marker that is gone after `page.clock.runFor(1500)` (US2-4).

### Implementation for User Story 2

- [X] T034 [P] [US2] Edit `src/lib/fretboard/types.ts`: add `Pulse {id, position, durationMs}`, `DrawnMarker extends Marker { pulse?: {id, durationMs} }`, and optional `pulses?: readonly Pulse[]` on `FretboardProps`. `DisplayModel` and `Marker` unchanged.
- [X] T035 [US2] Create `src/lib/fretboard/pulse.ts`: pure `applyPulses(markers, pulses): readonly DrawnMarker[]` per data-model.md §6. Depends on T034.
- [X] T036 [US2] Edit `src/lib/fretboard/Fretboard.svelte`: new `pulses` prop (default `[]`); marker layer draws `applyPulses(model.markers, pulses)`; marker element keyed by `pulse?.id ?? positionKey`; `class:pulse` and `style:--pulse-duration="{ms}ms"` set only client-side; cell names and description keep using `model`; add CSS `.marker.pulse .shape { animation: marker-pulse var(--pulse-duration) var(--ease-standard) 1 both; }`, `@keyframes marker-pulse` using `--pulse-scale` and `--pulse-opacity-peak`, and `@media (prefers-reduced-motion: reduce) { .marker.pulse .shape { animation: none; } }` (contracts/sound-control-ui.md §4). Depends on T035.
- [X] T037 [US2] Edit `src/lib/audio/engine.ts`: schedule pulse timers on the `TimerClock` from `plan.marks` (`onPulseStart` at `onsetMs`, `onPulseEnd` at `endMs`, monotonic ids, durations `endMs − onsetMs`), independent of audio success, mute, or dropped notes (E5). Implement `setMuted(muted)` and `setVolume(volume)` gain automation here too (10 ms ramp via `setTargetAtTime`, τ = 3 ms; never stops sources; E12) since pulse behavior with mute is tested in this story.
- [X] T038 [US2] Edit `src/lib/state/playback.svelte.ts`: maintain `pulses` from engine `onPulseStart`/`onPulseEnd`; add `setMuted`/`setVolume` facade (volume clamped to 0–100 and snapped to step 5; also unlocks the engine) so mute-with-pulse works. Depends on T037.
- [X] T039 [US2] Edit `src/lib/shell/ToolPlaceholder.svelte`: pass `pulses={playback.pulses}` to the fretboard next to the unchanged `model`. Depends on T036, T038.
- [X] T040 [US2] Run the US2 unit suites and e2e cases (`pnpm test:unit`, `pnpm build:test && pnpm test:e2e -g playback`) and fix failures.

**Checkpoint**: US1 and US2 both work independently; visual feedback exists without sound.

---

## Phase 5: User Story 3 - Sound control: mute and volume (Priority: P2)

**Goal**: A sound control in every application bar offers a mute toggle, a 0–100 % step-5 volume slider, and help listing silent mode first. Settings last for the session only.

**Independent Test**: On `/notes`, `/about`, and Home, the control is present and operable by keyboard/touch. Mute then tap: silent with pulse. Change volume: the gain follows `(v/100)²`. Reload: defaults (not muted, 80).

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Write `tests/unit/sound-control.test.ts` (`@testing-library/svelte`): group labeled `sound_group_label`; mute button `aria-pressed` reflects `muted`; clicking toggles and calls `playback.setMuted`; three states render distinct icon markup plus status text (on/muted/unavailable); settings button `aria-expanded`/`aria-controls="sound-panel"`; panel opens and closes on Escape (focus returns to the settings button) and on outside `pointerdown`, with no focus trap; range input `min=0 max=100 step=5`, default 80, `aria-valuetext` from `sound_volume_value`, input event calls `playback.setVolume`; unavailable state → mute `aria-disabled="true"` (focusable, activation ignored) and range `disabled`; first help list item is the silent-mode text (US3-5, FR-010, S1–S7).
- [X] T042 [P] [US3] Extend `tests/unit/state/playback.test.ts`: muting keeps `volume`; unmuting restores it; `setVolume(43)` snaps to 45 and `setVolume(250)` clamps to 100; volume 0 does not set `muted`; `controlState` mapping; `setMuted`/`setVolume` unlock the engine (US3-1…3).
- [X] T043 [P] [US3] Extend `tests/unit/audio/engine.test.ts` (E12 and gain checks): `setMuted`/`setVolume` change only gain-node automation (10 ms ramp, τ = 3 ms) and never call `source.stop`; volume 80 → gain 0.64; 0 → silent; mute applies to an already sounding note.
- [X] T044 [P] [US3] Extend `tests/unit/headers.test.ts` and `tests/unit/tool-layout.test.ts` and `tests/unit/home-screen.test.ts`: each application bar (ToolLayout header, About header, Home `header.top`) contains the sound control; `tests/unit/no-raw-text.test.ts` and `tests/unit/reserved-colors.test.ts` still pass with the new components (no raw strings, no root/third/fifth color reuse).
- [X] T045 [P] [US3] Extend `e2e/playback.spec.ts`: mute then click → `step` logged with the muted path (gain 0) and the pulse is shown; change volume to 40 and mute, reload → control shows not muted and slider value 80 (US3-4); control present on `/`, `/about`, `/notes`, `/triads` with 44×44 targets (bounding boxes ≥ 44); no horizontal page scroll at 320 px; axe zero violations with the panel open (SC-009); grayscale screenshot of the control in its on/muted/unavailable states in `e2e/playback.spec.ts-snapshots/` (distinguishable without color).

### Implementation for User Story 3

- [X] T046 [US3] Create `src/lib/shell/SoundControl.svelte` per contracts/sound-control-ui.md §2: DOM/ARIA exactly as specified, three distinct inline SVG icon geometries (speaker + arcs, speaker + ✕, speaker + diagonal slash) using text/accent tokens only, status `sr-only` text, settings disclosure with Escape/outside-pointerdown close and no trap, native range input, help list (silent-mode first), 44×44 targets via `--target-min`, `--icon-size`, `--sound-panel-width`, existing focus-ring token, header wraps at 320 px. Include the always-present `role="status" aria-live="polite"` notice slot (wired in T060). All strings via `m.*` from T002.
- [X] T047 [US3] Edit `src/lib/shell/ToolLayout.svelte`: render `<SoundControl/>` in the `<header aria-label="Application bar">` beside `AppNav`. Depends on T046.
- [X] T048 [P] [US3] Edit `src/routes/about/+page.svelte`: render `<SoundControl/>` in its application-bar header. Depends on T046.
- [X] T049 [P] [US3] Edit `src/lib/shell/HomeScreen.svelte`: render `<SoundControl/>` in `header.top` next to the About link. Depends on T046.
- [X] T050 [US3] Run the US3 unit suites, e2e cases, and update snapshots only for the new grayscale states (`pnpm test:e2e --update-snapshots` limited to the new test).

**Checkpoint**: Mute and volume work on every screen; session-only.

---

## Phase 6: User Story 4 - Interruption, Stop, and hidden app (Priority: P2)

**Goal**: A new request interrupts what is playing; a Stop button shows only while a sequence plays; hidden page, route change, or instrument change stops playback and clears pulses; nothing auto-resumes.

**Independent Test**: Three rapid taps → two `stop` entries (`interrupt`) and one live pulse. Hide the page → `stop` reason `hidden`, no step on return. Navigate → `stop` reason `navigate`. A sequence driven through the state shows Stop; pressing it clears everything.

### Tests for User Story 4 ⚠️

- [X] T051 [P] [US4] Extend `tests/unit/audio/engine.test.ts` (E4, E6): a new `play` ramps every live voice gain to 0 within ≤ 20 ms (10 ms ramp), calls `source.stop` on each source, and clears all pending pulse timers before scheduling the new request; at most one active request (SC-004); `stop()` silences, cancels pending steps and pulses, and emits `onSequenceChange(false)` only if a sequence was active; `stop(reason)` for `'stop' | 'hidden' | 'navigate' | 'instrument' | 'view'` logs the reason; `stop()` with nothing active is a no-op; mute/volume still never stop sources.
- [X] T052 [P] [US4] Extend `tests/unit/state/playback.test.ts`: `stop()` clears `pulses` and `sequencePlaying`; interruption by a new request clears prior pulses; `sequencePlaying` true from sequence start until the last `endMs`/stop/interruption (uses the fake clock and the sequence from US6 via `playback.sequence`, so write this case after T062 exists or mark `it.todo` and enable it in T067).
- [X] T053 [P] [US4] Write `tests/unit/stop-button.test.ts`: not rendered when `sequencePlaying` is false; a sequence driven through `playback.sequence(...)` with a fake engine renders the Stop button (label `playback_stop`, ≥ 44×44); activation calls `playback.stop('stop')`, clears pulses, removes the button, and moves focus to the mute button (never `body`) (US4-2, FR-012).
- [X] T054 [P] [US4] Extend `tests/unit/playback-host.test.ts`: `visibilitychange` to hidden and `pagehide` call `playback.stop('hidden')`; becoming visible again does not call `play`/`resume` (US4-3, FR-013). Extend `tests/unit/tool-placeholder.test.ts`: changing the instrument passed to `ToolPlaceholder` calls `playback.stop('instrument')` (US4-4). Add a case that `beforeNavigate` in the root layout calls `playback.stop('navigate')` (extend `tests/unit/routes.test.ts` or add `tests/unit/layout-navigation.test.ts`).
- [X] T055 [P] [US4] Extend `e2e/playback.spec.ts`: three rapid clicks on different positions → two `stop` entries with `reason:'interrupt'` and exactly one `.pulse` at the end (US4-1, SC-004); click then stub `document.visibilityState = 'hidden'` and dispatch `visibilitychange` → `stop` reason `hidden`, then visible → no new `step` (US4-3, SC-006); click then navigate via the app nav → `stop` reason `navigate` (US4-4).

### Implementation for User Story 4

- [X] T056 [US4] Edit `src/lib/audio/engine.ts`: implement the active-request lifecycle (id, live sources with voice gains, timers). New `play` and `stop(reason)` ramp voice gains to 0 over 10 ms and `stop(now + 0.012)` each source, clear pending pulse timers, emit pulse ends for cleared pulses, emit `onSequenceChange(false)` when a sequence was active; log `stop` entries with reason (`interrupt` for superseding plays) under `__FM_FAULT_INJECTION__`.
- [X] T057 [US4] Edit `src/lib/state/playback.svelte.ts`: add `stop(reason?)`; `stop` clears `pulses` and `sequencePlaying`; wire engine `onSequenceChange`.
- [X] T058 [P] [US4] Create `src/lib/shell/StopButton.svelte` per contracts/sound-control-ui.md §3: rendered only while `playback.sequencePlaying`; `m.playback_stop()` label with a square stop icon, ≥ 44×44, existing focus ring; activation → `playback.stop('stop')`; if it had focus, move focus to the mute button.
- [X] T059 [US4] Edit `src/lib/shell/PlaybackHost.svelte`: add listeners for `visibilitychange` (when `document.visibilityState === 'hidden'`) and `pagehide` → `playback.stop('hidden')`; never auto-resume; clean up listeners on destroy. Edit `src/routes/+layout.svelte`: `beforeNavigate(() => playback.stop('navigate'))`. Edit `src/lib/shell/ToolPlaceholder.svelte`: `$effect` tracking the instrument that calls `playback.stop('instrument')` on change (not on first run).
- [X] T060 [US4] Edit `src/lib/shell/ToolLayout.svelte`, `src/routes/about/+page.svelte`, `src/lib/shell/HomeScreen.svelte`: render `<StopButton/>` beside `<SoundControl/>` in each application bar. Run the US4 unit and e2e cases.

**Checkpoint**: Interruption, Stop, hidden-page, and navigation behavior all work.

---

## Phase 7: User Story 5 - Graceful failure when sound is unavailable (Priority: P2)

**Goal**: If audio cannot start (context, resume, or synth load failure on the first unlock), show one notice per session, mark the control unavailable, never retry, and keep pulses working. A device switch is not unavailable.

**Independent Test**: With `__fmAudioFault = 'context'` (and `'synth'`), the first tap shows exactly one notice, the control shows unavailable with inputs disabled, pulses still show on every tap, and no new notice appears on later taps.

### Tests for User Story 5 ⚠️

- [X] T061 [P] [US5] Extend `tests/unit/audio/engine.test.ts` (E7–E9): constructor throws / `AudioContext` missing / first `resume()` rejects / loader rejects → `onUnavailable(cause)` exactly once; afterwards no `createContext` and no `resume` calls and pulses still fire (E7); after audio was `on`, a later `resume()` rejection drops that request's sound, does not call `onUnavailable`, and the next `play` calls `resume()` again (E8, EC-7.7); synth still loading at `play`: pulse now, and if the loader resolves ≤ 100 ms after the activation (fake clock) the note is scheduled at that moment's `currentTime`, otherwise it is dropped and later taps play once ready (E9, FR-017); Safari `interrupted` state treated as resumable, not unavailable.
- [X] T062 [P] [US5] Extend `tests/unit/state/playback.test.ts`: `availability` transitions per data-model.md (idle → on, idle → unavailable terminal, unavailable stays unavailable); notice becomes visible exactly once on the first failure; dismiss sets `noticeVisible` false, keeps `noticeShown` true, and the notice never returns; `controlState` is `unavailable`; pulses continue (US5-1…4).
- [X] T063 [P] [US5] Extend `tests/unit/sound-control.test.ts`: when `noticeVisible`, the notice slot renders `Notice` with `sound_unavailable_notice` text inside the `role="status" aria-live="polite"` container; Dismiss calls `playback.dismissNotice()` and moves focus to the mute button; the notice slot container exists even when empty (S8).
- [X] T064 [P] [US5] Extend `e2e/playback.spec.ts`: `addInitScript(() => { globalThis.__fmAudioFault = 'context' })`, click twice → exactly one element with the text "Sound is not available on this device right now", control shows unavailable, `.pulse` on both clicks, no retry (`unavailable` logged once) (US5-1/2, SC-005); same for `'synth'` (US5-4); dismiss the notice → gone, not shown again, focus on the mute button, ≤ 2 lines at 320 px (US5-3); axe zero violations with the notice visible (SC-009); offline: `context.setOffline(true)` after load, click → `step` still logged (FR-016, SC-008).

### Implementation for User Story 5

- [X] T065 [US5] Edit `src/lib/audio/engine.ts`: availability handling per R-09 (constructor missing/throw, first `resume()` reject, loader reject → terminal unavailable, emit `onUnavailable` exactly once, never call `createContext`/`resume` again; later `resume()` rejection only drops sound), synth-loading 100 ms window using the injected clock per R-10/E9, and test-build fault hook: read `globalThis.__fmAudioFault` once at engine creation under `__FM_FAULT_INJECTION__` (`'context'` → factory throws, `'synth'` → loader rejects; enum allow-list only) and log `unavailable {cause}` entries.
- [X] T066 [US5] Edit `src/lib/state/playback.svelte.ts`: handle `onUnavailable` (availability = `'unavailable'`, `noticeShown = true`, `noticeVisible = true` once), add `dismissNotice()` (visible false, shown stays true).
- [X] T067 [US5] Edit `src/lib/shell/SoundControl.svelte`: unavailable presentation (mute `aria-disabled="true"` focusable with activation ignored, unavailable icon and label `sound_unavailable_label`, range `disabled`), render `Notice` in the notice slot with `ondismiss` → `playback.dismissNotice()` then focus the mute button.
- [X] T068 [US5] Run the US5 unit and e2e cases with `pnpm build:test`, then `node scripts/check-no-fault-hook.mjs build` against a production `pnpm build` to confirm neither hook string is shipped. Amend `docs/adr/0004-test-only-fault-injection.md` with a section for `__fmAudioFault` / `__fmAudioLog` (contracts/test-hooks.md).

**Checkpoint**: Audio failure is handled with one notice and visible pulses.

---

## Phase 8: User Story 6 - Reusable musical-terms playback (Priority: P3)

**Goal**: Later tools call `note`, `chord`, and `sequence` in musical terms and get time marks synchronously; chords and steps are mixed without clipping; sequences are scheduled sample-accurately.

**Independent Test**: Through the state facade with a fake engine/clock: a chord's marks share one onset and the mixed peak ≤ 0.89 for 1–7 notes; a sequence at B bpm schedules step i at `t0 + i·60/B`; out-of-range bpm clamps.

### Tests for User Story 6 ⚠️

- [X] T069 [P] [US6] Extend `tests/unit/audio/pluck.test.ts`: `pluckSynth.mixVoices` of every 1–7 voice combination from rendered A1–E6 voices (including 7 loud simultaneous voices at full gain) has peak ≤ 0.89, applies 1/√n scaling before the static peak limiter, is deterministic, and returns a buffer as long as the longest input.
- [X] T070 [P] [US6] Extend `tests/unit/audio/engine.test.ts` (E10, E11): a chord plays exactly one source whose buffer equals `mixVoices(voices)` with peak ≤ 0.89 and one shared onset; a sequence step i is scheduled with `start(t0 + i·60/bpm)` on the audio clock using sample-accurate times (not timers); `onSequenceChange(true)` fires at start and `(false)` after the last `endMs`; tempo clamped to 30–300 (29 → 30, 301 → 300); each sequence step with a set of positions plays one mixed source; time marks returned equal `planRequest(...).marks`.
- [X] T071 [P] [US6] Extend `tests/unit/state/playback.test.ts`: `playback.chord(positions, instrument)` and `playback.sequence(steps, bpm, instrument)` return marks per data-model.md §3, a chord's pulses start together, sequence pulses follow step onsets and ends, `sequencePlaying` toggles around a sequence (enable the `it.todo` from T052).

### Implementation for User Story 6

- [X] T072 [US6] Implement `mixVoices` in `src/lib/audio/pluck.ts` and add it to `pluckSynth`: scale each voice by `1/√n`, sum into a buffer sized to the longest voice, then apply a static peak limiter so the peak ≤ 0.89 (−1 dBFS). Pure.
- [X] T073 [US6] Edit `src/lib/audio/engine.ts`: render and mix each plan step through `mixVoices` (one source per step), schedule step i at `t0 + onsetMs/1000` on the audio clock, emit `onSequenceChange(true)` at start and `(false)` via the clock after the last `endMs`, and log one `step` entry per scheduled step (`kind`, `pitches`, `frequencies`, `when`, `contextTime`, `gain`) in test builds.
- [X] T074 [US6] Edit `src/lib/state/playback.svelte.ts`: add `chord(positions, instrument)` and `sequence(steps, bpm, instrument)` facade methods returning the engine's marks synchronously. Document the future view-state obligation (`playback.stop('view')`) in a doc comment on `stop`.

**Checkpoint**: All six stories work. The API is ready for later tools.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: ADR, budgets, hygiene, final verification across all stories.

- [X] T075 [P] Create `docs/adr/0007-main-thread-karplus-strong-playback.md` recording R-01 (buffer render vs AudioWorklet; continuity/CSP/version-skew reasons), R-07 (pure mix + static limiter), R-10 (bundled synth behind the loader seam); follow the existing ADR format in `docs/adr/`.
- [X] T076 [P] Reconcile the file list in `specs/003-note-playback/plan.md` (Project Structure) with the files actually created; docs only, no behavior change.
- [X] T077 Run all static gates: `pnpm lint`, `pnpm format:check`, `pnpm check` (zero warnings). Fix any boundary violation instead of loosening the rule.
- [X] T078 Run `pnpm test:unit --coverage`: theory ≥ 95 % lines and branches, overall ≥ 80 %. Add missing unit tests where coverage falls short (e.g. `src/lib/audio/engine.ts` error branches).
- [X] T079 Run `pnpm build:test && pnpm test:e2e` on phone 360, phone-touch 320, desktop, and firefox/webkit smoke; confirm `e2e/continuity.spec.ts`, `e2e/version-skew.spec.ts`, `e2e/nojs.spec.ts`, `e2e/perf.spec.ts` (including the T082 tap-to-sound gate) stay green (zero requests after load; control renders default state without JS).
  - Local run 2026-10-01 (macOS 12 x64 host; bundled Chromium/WebKit builds cannot launch, so Chromium projects ran on system Chrome 150 via `channel: 'chrome'`): 375 passed incl. playback, continuity, version-skew (after `pnpm build:test:skew`), nojs, firefox smoke, and tap-to-sound (serial run). WebKit smoke not runnable on this host — CI must confirm. `perf.spec.ts` navigation latency (FR-023, feature 001) measured 328–395 ms vs 300 ms here, identically on the pre-003 build `e879aab` — host limitation, not a 003 regression; CI must confirm.
- [X] T080 Run production hygiene (quickstart §5): `pnpm build`, `node scripts/check-bundle-size.mjs build` (initial JS ≤ 80 KB gzip, expect +5–7 KB), `node scripts/check-no-fault-hook.mjs build`, `pnpm lhci` (Lighthouse mobile ≥ 90). Do not raise any budget.
- [X] T082 Extend `e2e/perf.spec.ts` (Chromium only, same CDP `Emulation.setCPUThrottlingRate` rate 4 as the navigation test): add `describe('tap-to-sound latency (constitution VI)')` that loads `/notes`, makes one unlocking tap (excluded), then for ≥ 5 taps on different positions records the activation `timeStamp` with a capturing `pointerdown` listener installed via `page.evaluate` and reads the matching `step` entry's `scheduledAtMs` from `__fmAudioLog`; assert median(`scheduledAtMs − timeStamp`) ≤ 100 ms so a budget regression fails CI. Depends on T028 (log field) and T027 (wiring). Do not raise the budget.
- [X] T081 Validate quickstart.md §3–§6 end to end, including the manual listening check on a phone and a laptop (tap string 6 open, string 5 fret 3, string 1 fret 22; headphone switch mid-note).
  - 2026-10-01: §2–§5 validated (lint/format/check clean; 499 unit tests pass, coverage 96.7 % lines / 85.9 % branches, theory thresholds met; e2e per T079; initial JS 48.8 KB gzip; no fault hook in production build; `pnpm lhci` zero assertion failures).
  - 2026-10-01 §6 offline proxy (`pluckSynth.renderVoice`, 48 kHz, 1.5 s): E2 (40), C3 (48), D6 (86) all measure 0.0 cents off; attack peak at 2.5–9 ms, smooth decay (≈ −25 to −40 dB by 1.3 s), last sample 0 (clean 10 ms fade); low E carries 84 % of harmonic energy ≥ 300 Hz (phone-speaker proxy). **Finding:** single notes skip `mixVoices` (`engine.ts` uses `voices[0]` when n = 1), so the −1 dBFS limiter never applies. 55 of 112 pitch × rate renders peak above 0.89, up to 1.77 (pitches 76, 81–84). At 80 % volume (gain 0.64) 1–3 samples clip within the first 3 ms; at 100 % volume, 22–38 samples clip during the attack. **Fixed:** `TARGET_DBFS` lowered to −24 (every voice now peaks ≤ 0.89, balance unchanged) and single notes routed through `mixVoices`; regression tests added.
  - 2026-10-01 §6 manual check (user, production build): laptop speakers — offline renders of E2/C3 sound clean; high notes (D6, A♯5) judged good enough after an A/B against brighter/longer variants (current timbre preferred). In Chrome on the laptop, all three taps played, and the tap after switching headphones mid-note played (EC-7.7). Phone over LAN, silent mode off: clean plucks, low E recognizable on the speaker. Tuner not used (offline: 0.0 cents).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T002–T005 parallel with T001.
- **Foundational (Phase 2)**: depends on Setup. Blocks all stories. T006→T007; T010→T011; T008 before T010/T011/T012; T012, T013, T014 parallel.
- **US1 (Phase 3)**: after Phase 2. Creates the engine, state, and wiring that US2–US6 extend.
- **US2 (Phase 4)**: after US1 (needs engine + state + `ToolPlaceholder` wiring). Pure pieces T029/T034/T035 can start right after Phase 2.
- **US3 (Phase 5)**: after US2's `setMuted`/`setVolume` (T037, T038); the UI (T046) can start right after Phase 2 against a stub state.
- **US4 (Phase 6)**: after US1; T058 (StopButton) and T059 can proceed once T057 exists.
- **US5 (Phase 7)**: after US1; UI part after T046 (US3).
- **US6 (Phase 8)**: after US1 (engine); T072 can start after T022.
- **Polish (Phase 9)**: after all desired stories.

### User Story Dependencies

- US1 has no story dependency (MVP).
- US2, US4, US5, US6 each extend US1's engine/state but are independently testable through the fake engine and e2e hooks.
- US3's control UI is independent of US2's pulses. It depends only on the state facade.
- US5's control presentation edits the component US3 creates (T067 after T046).

### Within Each Story

- Tests first and failing, then pure modules, engine, state, components, host wiring.
- Same-file edits are sequential: `engine.ts` (T023 → T028 → T037 → T056 → T065 → T073), `playback.svelte.ts` (T024 → T038 → T057 → T066 → T074), `SoundControl.svelte` (T046 → T067), `ToolPlaceholder.svelte` (T025 → T039 → T059), `PlaybackHost.svelte` (T026 → T059), `engine.test.ts` and `playback.test.ts` and `e2e/playback.spec.ts` (extend in story order).

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 together.
- Phase 2: T006, T008, T009, T010, T012, T013, T014 together (different files).
- US1 tests T015–T020 together. T021 parallel with T026.
- US2 tests T029–T033 together; T034 parallel with test writing.
- US3 tests T041–T045 together; T048 and T049 together after T046.
- US4 tests T051–T055 together; T058 parallel with T056.
- US5 tests T061–T064 together.
- US6 tests T069–T071 together.
- Polish: T075 and T076 together.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (different files):
Task: "Write tests/unit/audio/loudness.test.ts (A-weighting response)"
Task: "Write tests/unit/audio/pluck.test.ts (±5 cents, ±3 dB, harmonics, fade, determinism)"
Task: "Write tests/unit/audio/engine.test.ts E1–E3 with fake port/clock"
Task: "Write tests/unit/state/playback.test.ts defaults + note delegation"
Task: "Write tests/unit/tool-placeholder.test.ts onactivate → playback.note"
Task: "Write e2e/playback.spec.ts US1 cases + helpers"

# Then in parallel:
Task: "Implement src/lib/audio/loudness.ts"
Task: "Create src/lib/shell/PlaybackHost.svelte (idle preload)"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US1: tap a position, hear its real pitch.
3. **STOP and VALIDATE**: US1 unit suites, e2e cases (first gesture plays E2, keyboard C3, no unlock before a gesture), budgets.
4. US1 alone ships audible fretboards. Pulses (US2) come next because Principle V forbids sound as the only channel, so US1 and US2 should merge together.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 (both P1) → audible and visible feedback (release candidate).
3. US3 → mute/volume on every bar.
4. US4 → interruption, Stop, hidden/route/instrument stops.
5. US5 → graceful failure.
6. US6 → reusable chord/sequence API for later tools.
7. Polish → ADR, budgets, quickstart.

### Parallel Team Strategy

After Phase 2: Dev A runs US1 then US4/US6 (engine owner); Dev B takes US2's fretboard pieces (T029–T036) and the US3 control UI (T041, T046–T049) in parallel; Dev C takes US5's tests and test-build hooks once US1's engine lands. Serialize edits to `engine.ts`, `playback.svelte.ts`, and `SoundControl.svelte` per the order above.

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies.
- Each story ends with a checkpoint: stop and validate before moving on.
- Tests use fake `AudioPort` + fake `TimerClock` only. No real-time audio measurement in any automated test.
- Commit after each task or logical group (Conventional Commits).
- Deferred by design: the view-state stop trigger (FR-014 for view state) has no source until feature 004. It is recorded as a caller obligation in contracts/playback-api.md §3, and T074 documents it in code.
