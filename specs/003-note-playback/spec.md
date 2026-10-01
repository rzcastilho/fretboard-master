# Feature Specification: Note Playback

**Feature Branch**: `feature/003-note-playback`

**Created**: 2026-10-01

**Status**: Clarified

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/003-note-playback.md (id 003, note-playback)." Source sections: Area 7 (Audio, FR-7.1–7.2, 7.6–7.11), Edge cases Area 7 (EC-7.1–7.7), UJ-7, INT-3, ARCH-7, NFR-1, NFR-3.6, NFR-9.4, design doc §motion and §layout (12-design-and-experience.md).

## Clarifications

### Session 2026-10-01

Resolutions marked **[source]** are derived from an authoritative document; those marked **[default]** are assumed conventional defaults chosen by the clarify reviewer because no source settles them.

- Q: Synthesized or recorded sound (Q-4)? → A: **[source: constitution, Technology Stack "Audio"]** Synthesized plucked string (Karplus-Strong or AudioWorklet) via Web Audio API in `src/lib/audio`. No recorded samples. "Sound material" in this spec means the synthesis code/module (e.g. an AudioWorklet module), which loads after the fretboard is interactive.
- Q: What tuning reference turns a calculated pitch into a frequency? → A: **[default]** 12-tone equal temperament, A4 = 440 Hz, pitch numbering C4 = 60 (as in `src/lib/theory/pitch.ts`): `f = 440 · 2^((p − 69)/12)`. Conventional concert reference; required for "in tune".
- Q: What does "in tune / imperceptible tuning error" mean testably (NFR-9.4)? → A: **[default]** The fundamental frequency of every rendered note, measured on an offline render, is within ±5 cents of the calculated frequency. 5 cents is the conventional just-noticeable threshold.
- Q: What range must be playable? → A: **[source: FR-7.10, TM-1, data model]** Every position of the instrument in use, from the lowest open string to the highest fret of string 1, for any supported string count (up to 7) and fret count (up to 24) and any tuning. The synthesis MUST therefore cover at least A1 (MIDI 33) to E6 (MIDI 88); tests cover that full span.
- Q: What does "balanced perceived volume" mean testably? → A: **[default]** On an offline render at a fixed volume, the A-weighted RMS level over the first 500 ms of each note from A1 to E6 is within ±3 dB of the median across that span. A-weighting is the conventional proxy for perceived loudness.
- Q: What does "enough harmonics on a small phone speaker" mean testably (EC-7.6)? → A: **[default]** For every note whose fundamental is below 200 Hz, at least 50% of the rendered signal energy in the first 500 ms lies at or above the 2nd harmonic (so the pitch is inferable when a small speaker cuts the fundamental). No special handling beyond the timbre itself (EC-7.6).
- Q: How long does a single tapped note last, and how long is its pulse? → A: **[source for pulse: design doc motion table "marker that sounds pulses once — duration of the note"]**; **[default for length]** A single note decays naturally and is stopped (with a short anti-click fade, ≤ 20 ms) at 1.5 s after onset. The pulse of a position lasts exactly from its onset time mark to its end time mark (1.5 s for a single note). One pulse per onset.
- Q: Which gestures "ask for sound" and therefore unlock audio? → A: **[source: FR-7.7, UJ-7]** plus **[default]** Fretboard position activation (pointer tap or keyboard Enter/Space on a focused position, as reported by the fretboard's `onactivate`), a **Listen** command (later tools), and interaction with the sound control (unmute, volume change). Navigation, scrolling, and drag-to-scroll do NOT unlock audio. The unlocking gesture's own note plays (it is not swallowed).
- Q: Does keyboard activation of a position play sound like a tap? → A: **[source: constitution V, every function keyboard-operable]** Yes. "Tap" throughout this spec means any fretboard activation event (pointer or keyboard).
- Q: What pulses when the tapped position has no marker drawn? → A: **[source: DX-5 "everything that sounds lights up"]** A transient marker is shown at the sounding position for the pulse duration, using the neutral note function at `highlighted` emphasis; it disappears at the end time mark. If a marker already exists there, that marker pulses (keeps its shape/function) instead. The pulse is expressed only through the existing emphasis levels plus the motion token (constitution VII).
- Q: How does the pulse look with and without reduced motion? → A: **[source: design doc motion table, NFR-3.6]** Without reduced motion: the marker animates once (scale/opacity), timed to the note. With `prefers-reduced-motion: reduce`: the position switches to `highlighted` emphasis at onset and back at the end time mark with no animation. The pulse is never removed under reduced motion.
- Q: What form does the sound control take? → A: **[source: design doc §layout zone A, FR-7.8]** plus **[default]** One sound control in the application bar, present on every screen that shows the application bar. It consists of (a) a mute toggle button (`aria-pressed`, icon + text/aria label; on/muted/unavailable distinguished by icon shape and label, not color), and (b) a volume slider (native range input semantics, 0–100 %, step 5, keyboard-operable) plus (c) a one-line help text listing "device silent mode or system volume at zero" as the first thing to check (EC-7.2). (b) and (c) may sit in a non-modal disclosure next to the mute button that opens on activation and closes on Escape or outside click without trapping focus. Mute itself is never behind the disclosure.
- Q: Default sound state and how mute and volume interact? → A: **[default]** Session defaults: not muted, volume 80 %. Mute is independent of volume: muting keeps the volume value; unmuting restores it. Volume 0 % is silent but is not the "muted" state. Mute and volume changes apply immediately, including to a note already sounding (mute silences it at once via the anti-click fade). State lives in memory only and resets on reload (persistence is 003-your-instrument/002).
- Q: What does "unavailable" mean and is it retried? → A: **[source: EC-7.1, EC-7.7]** plus **[default]** Unavailable = the audio context could not be created/resumed on the unlocking gesture, or the synthesis module failed to load. Once unavailable, the state stays unavailable for the rest of the session (no retries, no repeated notices); the mute/volume inputs are disabled and the control shows the unavailable icon and label. An output-device switch mid-note (EC-7.7) may stop the current note but does NOT mark audio unavailable; the next request plays normally.
- Q: Where and how often does the unavailable notice show? → A: **[source: EC-7.1, constitution VII notices]** plus **[default]** Exactly once per page session (in-memory flag), on the first sound request that fails, in the existing shell notice style (non-modal, dismissible, ≤ 2 lines, `role="status"` polite, no error red). Dismissing it does not bring it back; reloading the page starts a new session.
- Q: What if the user taps while the synthesis module is still loading? → A: **[default]** The pulse shows immediately. If the module becomes ready within 100 ms of the tap, the note plays; otherwise that tap's note is dropped (not queued late) and subsequent taps play once ready. If loading fails, the unavailable rules apply. Late-queued notes would desync from the pulse, so dropping is the conventional choice.
- Q: What does "a new request interrupts whatever is playing" cover? → A: **[source: FR-7.9, EC-7.3]** Any new request (single pitch, set, or sequence) stops all currently sounding notes and pending sequence steps (≤ 20 ms anti-click fade) and cancels their pending pulses before starting. At most one request is active at any time.
- Q: Which "state changes" stop playback (EC-7.4)? → A: **[source: EC-7.4]** plus **[default]** Any change to view state or instrument (tuning, string count, fret count), and any route navigation, stops whatever is playing — single notes as well as sequences — and clears pulses. Mute toggling and volume changes are not view-state changes and do not stop sequences (mute silences sound while pulses continue).
- Q: Where is the **Stop** command and when does it show? → A: **[source: FR-7.9]** plus **[default]** The playback interface exposes `stop()`. A **Stop** button appears in the application bar beside the sound control only while a sequence is playing, and disappears when the sequence ends or is stopped. No tool in this slice triggers sequences, so the Stop button is verified by component tests that drive a sequence through the injectable playback interface. Stop also clears pulses.
- Q: What happens when the app is hidden? → A: **[source: FR-7.11, EC-7.5]** On `visibilitychange` to hidden (and `pagehide`), all sound stops, pending sequence steps and pulses are cancelled, and nothing resumes on return. The next user request plays normally (audio context resumed on that gesture if the browser suspended it).
- Q: What is the shape of the playback interface (time marks, tempo)? → A: **[source: ARCH-7]** plus **[default]** Requests are expressed in musical terms with positions attached: `note` (one position), `chord` (a set of positions starting together), `sequence` (an ordered list of steps, each a position or set of positions, plus a tempo in beats per minute, one step per beat). Pitches are derived from the instrument in use, never passed as frequencies. The interface returns, synchronously, one time mark per sounding position: `{ position, onsetMs, endMs }` relative to request start. A chord's marks share one `onsetMs`. A sequence step's onset = `stepIndex × 60000 / bpm`; each step's `endMs` equals the next step's onset, and the last step lasts one beat (the 1.5 s length applies only to `note` and `chord` requests). Tempo valid range 30–300 bpm; out-of-range values are clamped to the nearest bound. Slow/medium/fast tempo values belong to the tools that use them.
- Q: How are simultaneous pitches kept from clipping? → A: **[default]** A chord's per-note gain is scaled by 1/√n (n = notes in the set) with an output limiter/compressor, so a 7-note set never clips at 100 % volume.
- Q: How is the 100 ms tap-to-sound budget verified (NFR-1.4)? → A: **[source: constitution IV, VI]** plus **[default]** Automated: with an injectable clock/audio context, the scheduled start time of a tapped note is ≤ 100 ms after the activation event time (the engine schedules at the context's current time, never with added look-ahead beyond that budget). Manual/Lighthouse budgets remain as in the constitution. Real-time measurement is not used in automated tests.
- Q: Is anything recorded for anonymous measurement ("sound played" event)? → A: **[source: Q-1 open, constitution II]** No. Measurement is not adopted yet; this slice emits no measurement events.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tap a position, hear its real pitch (Priority: P1)

A guitarist with an instrument on their lap taps a fret on screen and hears exactly that pitch, to check what they are playing and link shape to sound. The pitch is the open-string pitch in the tuning in use plus the fret number in semitones. String 5, fret 3 in standard tuning sounds C3 (130.81 Hz at A4 = 440 Hz).

**Why this priority**: Core promise of the feature. Without it nothing else in audio has value.

**Independent Test**: With the fretboard loaded, tap string 6 open as the first gesture; E2 (82.41 Hz) sounds. Tap string 5 fret 3; C3 sounds. With a non-standard instrument injected in a component/unit test, the same fret sounds a different pitch.

**Acceptance Scenarios**:

1. **Given** a freshly loaded page and no prior gesture, **When** the user taps (or keyboard-activates) string 6 open, **Then** audio turns on on that gesture and E2 plays for that same activation.
2. **Given** standard tuning, **When** the user taps string 5, fret 3, **Then** C3 plays (fundamental within ±5 cents of 130.81 Hz).
3. **Given** a non-standard tuning, **When** the user taps any position, **Then** the pitch equals that tuning's open-string pitch plus the fret number in semitones (verified at unit level; tuning selection UI arrives in a later slice).
4. **Given** the page just loaded, **When** the user has done nothing, or has only navigated or scrolled, **Then** no audio context is started and no sound is produced.
5. **Given** audio is on, **When** the user taps a position, **Then** the note is scheduled to start within 100 ms of the activation event (verified with an injectable clock).

---

### User Story 2 - Pulse in sync with sound, even when muted (Priority: P1)

Positions that sound pulse on the fretboard in step with the audio. The pulse also happens when sound is muted or unavailable, because it carries information. With reduced motion, the pulse becomes a plain state change.

**Why this priority**: Constitution V: sound must not be the only carrier of information. Required for deaf/muted users and for the unavailable-audio fallback.

**Independent Test**: Tap a position with sound on, muted, and with audio unavailable; the pulse shows in all three, lasting from the note's onset to its end time mark. Repeat with reduced motion enabled; a static `highlighted` state replaces the animation for the same interval.

**Acceptance Scenarios**:

1. **Given** sound is on, **When** a position sounds, **Then** that position pulses once, starting at its onset time mark and ending at its end time mark.
2. **Given** sound is muted, **When** the user taps a position, **Then** no audio plays and the pulse still occurs with the same timing.
3. **Given** the user prefers reduced motion, **When** a position sounds, **Then** it switches to `highlighted` emphasis at onset and back at the end time mark with no animation.
4. **Given** the tapped position has no marker in the current display model, **When** it sounds, **Then** a transient neutral marker at `highlighted` emphasis appears there for the pulse duration and is then removed.

---

### User Story 3 - Sound control: mute and volume (Priority: P2)

A sound control in the application bar lets the user mute and set volume. The setting lasts for the session only.

**Why this priority**: Needed for practical use (rehearsal, shared spaces), but the feature works at default volume without it.

**Independent Test**: Mute via the control and tap a position (silent, pulse shown). Unmute, change volume, tap (output gain matches the new level). Reload the page; settings return to defaults (not muted, 80 %).

**Acceptance Scenarios**:

1. **Given** any screen with the application bar, **When** the page is shown, **Then** a sound control (mute toggle, volume slider 0–100 % step 5, help text) is present and operable by keyboard and touch, with 44×44 px targets and a screen-reader label.
2. **Given** the user mutes, **When** they tap a position, **Then** no sound plays; **and Given** a note is sounding, **When** the user mutes, **Then** it is silenced immediately.
3. **Given** the user changes the volume, **When** they tap a position, **Then** the note plays at the new level; muting then unmuting restores that level.
4. **Given** the user changed mute or volume, **When** the page is reloaded, **Then** defaults apply (not muted, 80 %).
5. **Given** the sound control's help is shown, **Then** its first listed check is the device's silent mode or system volume at zero.

---

### User Story 4 - Interruption, Stop, and hidden app (Priority: P2)

A new sound request cuts off whatever is playing, so fast taps never pile up. Sequences offer a **Stop** command. Playback stops when the app is hidden (tab switch, screen lock) and does not resume by itself.

**Why this priority**: Prevents noisy, confusing audio; sequences themselves are used by later tools.

**Independent Test**: Tap three positions quickly; only the last sounds at the end. Start a note, switch tabs, return; silence. Drive a sequence through the playback interface in a component test, press Stop; silence and no pulses.

**Acceptance Scenarios**:

1. **Given** a note is sounding, **When** the user taps three positions in quick succession, **Then** each tap stops the previous note (and its pulse) before the new one starts; at most one request is active at any time.
2. **Given** a sequence is playing, **When** the user activates **Stop** (visible in the application bar only while a sequence plays), **Then** playback ends, pending steps are cancelled, pulses clear, and the Stop button disappears.
3. **Given** a note or sequence is playing, **When** the user switches tabs or locks the screen, **Then** sound stops, and it stays stopped when the app is visible again; the next tap plays normally.
4. **Given** a note or sequence is playing, **When** view state, the instrument, or the route changes, **Then** playback stops and pulses clear.

---

### User Story 5 - Graceful failure when sound is unavailable (Priority: P2)

When audio cannot start or the sound material failed to load, a single notice shows for the session ("Sound is not available on this device right now"), the sound control shows unavailable, and the pulses keep working.

**Why this priority**: Constitution X: never blank; adjust and tell.

**Independent Test**: Simulate audio start failure (test-only fault injection, ADR 0004); first tap shows exactly one notice, the control shows unavailable, pulses keep working, further taps show no new notice.

**Acceptance Scenarios**:

1. **Given** audio cannot start, **When** the user taps a position, **Then** one notice appears, the sound control shows the unavailable state (icon and label, inputs disabled), and the pulse occurs.
2. **Given** the notice was shown (dismissed or not), **When** the user taps again, **Then** the notice is not repeated in the page session and audio is not retried.
3. **Given** the notice is shown, **When** the user dismisses it, **Then** it closes without blocking anything (non-modal, at most two lines, not error-styled).
4. **Given** the synthesis module failed to load, **When** the user taps, **Then** the same single-notice and unavailable behavior applies.

---

### User Story 6 - Reusable musical-terms playback for later tools (Priority: P3)

Other tools can ask for playback in musical terms: one position, a set of simultaneous positions, or a sequence with a tempo. The playback part returns time marks for each sounding position so those tools can synchronize emphasis. Triad, arpeggio and scale playback themselves belong to those tools.

**Why this priority**: Enables later waves; no direct end-user value in this slice beyond single notes.

**Independent Test**: Request a chord and a tempo sequence through the interface in a test with a controllable clock; verify the pitches, simultaneity, order, and returned time marks.

**Acceptance Scenarios**:

1. **Given** a request for one position, **When** played, **Then** that pitch sounds and one time mark `{position, onsetMs: 0, endMs: 1500}` is returned.
2. **Given** a request for a set of positions, **When** played, **Then** all start together, time marks share one `onsetMs`, and the summed output does not clip at 100 % volume.
3. **Given** a sequence with a tempo of B bpm, **When** played, **Then** step i sounds at `i × 60000 / B` ms in order and time marks reflect each onset and end.
4. **Given** a tempo outside 30–300 bpm, **When** a sequence is requested, **Then** the tempo is clamped to the nearest bound.

---

### Edge Cases

- Device in silent mode or system volume at zero: not detected; the sound control's help lists this as the first thing to check (EC-7.2).
- Playback in progress and a view-state, instrument, or route change: playback stops (EC-7.4).
- App becomes visible again after being hidden: no automatic resume (EC-7.5).
- Rapid taps: no pile-up; only the latest request sounds (EC-7.3).
- Highest pitch (highest fret of string 1) and lowest open string: within ±5 cents and within ±3 dB A-weighted of the median level.
- Low notes (fundamental < 200 Hz) on a small phone speaker: ≥ 50% of energy at or above the 2nd harmonic (EC-7.6).
- Audio output switched mid-note (headphones): current note may stop; next request works normally; not treated as unavailable (EC-7.7).
- No network after first load: sound still works.
- Synthesis module still loading when the user taps: fretboard stays interactive; pulse shows; the note plays only if ready within 100 ms, otherwise it is dropped; later taps play once ready; on load failure the unavailable rules apply.
- Tapped position has no marker: transient neutral marker pulses there.
- Instruments with other string counts or tunings: pitch always derived from the instrument in use.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every fretboard position MUST sound at its real pitch: open-string pitch in the tuning in use plus the fret number in semitones (FR-7.1, FR-7.2, TM-1), converted to frequency with 12-TET, A4 = 440 Hz.
- **FR-002**: The system MUST produce no sound and start no audio context until a gesture that asks for sound (fretboard activation by pointer or keyboard, a Listen command, or sound-control interaction); audio turns on with that first gesture, and that gesture's note plays (FR-7.7). Navigation and scrolling do not unlock audio.
- **FR-003**: After audio is on, a note MUST be scheduled to start within 100 ms of the activation event.
- **FR-004**: The timbre MUST be a synthesized plucked string resembling a clean guitar string, with a clear attack and natural decay (FR-7.10); a single note or chord ends at 1.5 s after onset with an anti-click fade of at most 20 ms.
- **FR-005**: Every note from A1 to E6 (covering the lowest open string to the highest fret of string 1 for up to 7 strings and 24 frets) MUST have a fundamental within ±5 cents of its calculated frequency and an A-weighted RMS level (first 500 ms, fixed volume) within ±3 dB of the median across that range.
- **FR-006**: Every note with a fundamental below 200 Hz MUST have at least 50% of its first-500 ms energy at or above the 2nd harmonic.
- **FR-007**: Each sounding position MUST pulse once on the fretboard from its onset time mark to its end time mark, and MUST also pulse when sound is muted or unavailable (FR-7.6). A position with no marker gets a transient neutral `highlighted` marker for the pulse duration.
- **FR-008**: With reduced motion preferred, the pulse MUST become a plain switch to `highlighted` emphasis for the same interval, with no animation.
- **FR-009**: A sound control in the application bar, on every screen showing the bar, MUST provide a mute toggle and a volume slider (0–100 %, step 5); session defaults are not muted and 80 %; mute preserves the volume value; changes apply immediately, including to sounding notes; state resets on reload.
- **FR-010**: The sound control MUST be keyboard-operable with visible focus, 44×44 px targets, and screen-reader labels; its state (on, muted, unavailable) MUST be conveyed by icon shape and label, not color alone. Any volume/help disclosure MUST be non-modal, close on Escape, and not trap focus; mute is never inside the disclosure.
- **FR-011**: A new sound request MUST stop all sounding notes, pending sequence steps, and pending pulses before starting; at most one request is active (FR-7.9, EC-7.3).
- **FR-012**: While a sequence plays, a **Stop** button MUST appear in the application bar beside the sound control; activating it (or calling `stop()`) ends sound, cancels pending steps, and clears pulses; the button disappears when no sequence plays.
- **FR-013**: Playback MUST stop (sound, pending steps, pulses) when the page becomes hidden (`visibilitychange` to hidden or `pagehide`) and MUST NOT resume by itself when visible again (FR-7.11, EC-7.5); the next request plays normally.
- **FR-014**: Any view-state, instrument, or route change MUST stop playback (single notes and sequences) and clear pulses (EC-7.4). Mute and volume changes do not stop playback.
- **FR-015**: If the audio context cannot be created/resumed or the synthesis module fails to load, the system MUST show one notice per page session, "Sound is not available on this device right now", mark the sound control unavailable (inputs disabled) for the rest of the session without retrying, and keep pulses working. The notice is non-blocking, dismissible, at most two lines, `role="status"` polite, and not styled as an error. An output-device switch (EC-7.7) does not trigger this state.
- **FR-016**: Once loaded, sound MUST work with no network.
- **FR-017**: The synthesis module MUST load after, and MUST NOT delay, the fretboard becoming interactive; a tap during loading pulses immediately and plays only if the module is ready within 100 ms, otherwise its note is dropped.
- **FR-018**: The playback interface MUST accept requests in musical terms with positions — `note` (one position), `chord` (set of positions), `sequence` (ordered steps of positions with a tempo in bpm, one step per beat, clamped to 30–300) — derive pitches from the instrument in use, and synchronously return one time mark `{position, onsetMs, endMs}` per sounding position relative to request start; it MUST expose `stop()` and accept an injectable clock/audio context for tests.
- **FR-019**: All user-facing text (notice, control labels, Stop, help) MUST come from the message catalog, and the help MUST list device silent mode or zero system volume as the first check (EC-7.2).
- **FR-020**: Sound MUST NOT be the only carrier of any information.
- **FR-021**: Simultaneous pitches MUST be gain-scaled (1/√n) and limited so a set of up to 7 notes does not clip at 100 % volume.
- **FR-022**: This slice MUST NOT emit any anonymous-measurement events (Q-1 unresolved).

### Key Entities

- **Pitch**: Semitone number (C4 = 60) derived from string open pitch plus fret; frequency = 440 · 2^((p − 69)/12).
- **Playback request**: `note` (one position), `chord` (set of positions), or `sequence` (ordered steps + tempo in bpm).
- **Time mark**: `{position, onsetMs, endMs}` relative to request start; drives the pulse.
- **Sound state**: Per-session `on` / `muted` / `unavailable`, plus volume 0–100 % (default 80 %), plus whether a sequence is playing (drives Stop visibility) and whether the unavailable notice was already shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After audio is on, every tap's note is scheduled within 100 ms of the activation event in automated tests with an injectable clock.
- **SC-002**: The first gesture asking for sound produces its note (string 6 open yields E2) in 100% of supported-browser trials.
- **SC-003**: Every pitch from A1 to E6 renders within ±5 cents of its calculated frequency and within ±3 dB (A-weighted RMS, first 500 ms) of the median level.
- **SC-004**: In three rapid taps, exactly one note is audible at the end, never overlapping prior notes.
- **SC-005**: When audio is unavailable, users see exactly one notice per session and 100% of taps still show the pulse.
- **SC-006**: Switching away from the app mid-note results in silence on return in 100% of trials.
- **SC-007**: Sound adds no measurable delay to the fretboard becoming interactive on the reference device profile; initial JS stays within the 80 KB gzip budget.
- **SC-008**: After the first load, sound works with the network disabled.
- **SC-009**: Zero axe violations on the sound control, Stop button, and notice.

## Assumptions

- Q-4 is resolved by the constitution: sound is synthesized (plucked string), not recorded, so there is no first-load sample weight.
- Volume and mute are not remembered between visits; that arrives with 003-your-instrument/002-remembered-preferences.
- Triad, arpeggio, and scale playback (and their slow/medium/fast tempos and Listen commands) belong to the tools that trigger them; this feature provides the reusable playback interface and the Stop button.
- The fretboard from 002-interactive-fretboard reports activations as (string, fret) events via `onactivate` for both pointer and keyboard, and supports the four emphasis levels.
- Tuning selection UI does not exist yet; non-standard tuning behavior is verified at unit/component level with injected instruments.
- English only strings ship, but live in the message catalog.
- Silent mode and low system volume are not detected.
- Audio failure is simulated in tests through the existing test-only fault injection mechanism (ADR 0004).
