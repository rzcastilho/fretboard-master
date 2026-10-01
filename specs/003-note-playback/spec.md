# Feature Specification: Note Playback

**Feature Branch**: `feature/003-note-playback`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/003-note-playback.md (id 003, note-playback)." Source sections: Area 7 (Audio, FR-7.1–7.2, 7.6–7.11), Edge cases Area 7 (EC-7.1–7.5), UJ-7, INT-3, ARCH-7, NFR-1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tap a position, hear its real pitch (Priority: P1)

A guitarist with an instrument on their lap taps a fret on screen and hears exactly that pitch, to check what they are playing and link shape to sound. The pitch is the open-string pitch in the tuning in use plus the fret number in semitones. String 5, fret 3 in standard tuning sounds C3.

**Why this priority**: Core promise of the feature. Without it nothing else in audio has value.

**Independent Test**: With the fretboard loaded, tap string 6 open as the first gesture; E2 sounds. Tap string 5 fret 3; C3 sounds. Change the tuning; the same fret sounds a different pitch.

**Acceptance Scenarios**:

1. **Given** a freshly loaded page and no prior gesture, **When** the user taps string 6 open, **Then** audio turns on and E2 plays.
2. **Given** standard tuning, **When** the user taps string 5, fret 3, **Then** C3 plays.
3. **Given** a non-standard tuning, **When** the user taps any position, **Then** the pitch equals that tuning's open-string pitch plus the fret number in semitones.
4. **Given** the page just loaded, **When** the user has done nothing, **Then** no sound is produced.
5. **Given** audio is on, **When** the user taps a position, **Then** the note starts within 100 ms of the tap.

---

### User Story 2 - Pulse in sync with sound, even when muted (Priority: P1)

Positions that sound pulse on the fretboard in step with the audio. The pulse also happens when sound is muted or unavailable, because it carries information. With reduced motion, the pulse becomes a plain state change.

**Why this priority**: Constitution V: sound must not be the only carrier of information. Required for deaf/muted users and for the unavailable-audio fallback.

**Independent Test**: Tap a position with sound on, muted, and with audio unavailable; the pulse shows in all three. Repeat with reduced motion enabled; a static state change replaces the animation.

**Acceptance Scenarios**:

1. **Given** sound is on, **When** a position sounds, **Then** that position pulses in sync with the audio.
2. **Given** sound is muted, **When** the user taps a position, **Then** no audio plays and the pulse still occurs.
3. **Given** the user prefers reduced motion, **When** a position sounds, **Then** it shows a plain emphasis state change with no animation.

---

### User Story 3 - Sound control: mute and volume (Priority: P2)

A sound control in the application bar lets the user mute and set volume. The setting lasts for the session only.

**Why this priority**: Needed for practical use (rehearsal, shared spaces), but the feature works at default volume without it.

**Independent Test**: Mute via the control and tap a position (silent). Unmute, change volume, tap (audibly different level). Reload the page; settings return to defaults.

**Acceptance Scenarios**:

1. **Given** the application bar, **When** the page is shown, **Then** a sound control is present and operable by keyboard and touch.
2. **Given** the user mutes, **When** they tap a position, **Then** no sound plays.
3. **Given** the user changes the volume, **When** they tap a position, **Then** the note plays at the new level.
4. **Given** the user changed mute or volume, **When** the page is reloaded, **Then** defaults apply (persistence is out of scope).

---

### User Story 4 - Interruption, Stop, and hidden app (Priority: P2)

A new sound request cuts off whatever is playing, so fast taps never pile up. Sequences offer a **Stop** command. Playback stops when the app is hidden (tab switch, screen lock) and does not resume by itself.

**Why this priority**: Prevents noisy, confusing audio; sequences themselves are used by later tools.

**Independent Test**: Tap three positions quickly; only the last sounds at the end. Start a note, switch tabs, return; silence. Start a sequence, press Stop; silence.

**Acceptance Scenarios**:

1. **Given** a note is sounding, **When** the user taps three positions in quick succession, **Then** each tap cuts off the one before.
2. **Given** a sequence is playing, **When** the user activates **Stop**, **Then** playback ends and pulses stop.
3. **Given** a note or sequence is playing, **When** the user switches tabs or locks the screen, **Then** sound stops, and it stays stopped when the app is visible again.
4. **Given** a sequence is playing, **When** the view state changes mid-way, **Then** playback stops.

---

### User Story 5 - Graceful failure when sound is unavailable (Priority: P2)

When audio cannot start or the sound material failed to load, a single notice shows for the session ("Sound is not available on this device right now"), the sound control shows unavailable, and the pulses keep working.

**Why this priority**: Constitution X: never blank; adjust and tell.

**Independent Test**: Simulate audio start failure; first tap shows exactly one notice, the control shows unavailable, pulses keep working, further taps show no new notice.

**Acceptance Scenarios**:

1. **Given** audio cannot start, **When** the user taps a position, **Then** one notice appears, the sound control shows the unavailable state, and the pulse occurs.
2. **Given** the notice was shown, **When** the user taps again, **Then** the notice is not repeated in the session.
3. **Given** the notice is shown, **When** the user dismisses it, **Then** it closes without blocking anything (non-modal, at most two lines).

---

### User Story 6 - Reusable musical-terms playback for later tools (Priority: P3)

Other tools can ask for playback in musical terms: one pitch, a set of simultaneous pitches, or a sequence with a tempo. The playback part returns time marks for each sounding position so those tools can synchronize emphasis. Triad, arpeggio and scale playback themselves belong to those tools.

**Why this priority**: Enables later waves; no direct end-user value in this slice beyond single notes.

**Independent Test**: Request a chord and a tempo sequence through the interface in a test with a controllable clock; verify the pitches, simultaneity, order, and returned time marks.

**Acceptance Scenarios**:

1. **Given** a request for one pitch, **When** played, **Then** that pitch sounds and one time mark is returned.
2. **Given** a request for a set of pitches, **When** played, **Then** all start together and time marks share one start time.
3. **Given** a sequence with a tempo, **When** played, **Then** notes sound in order at that tempo and time marks reflect each onset.

---

### Edge Cases

- Device in silent mode or system volume at zero: not detected; the sound control's help lists this as the first thing to check (EC-7.2).
- Sequence in progress and a state change: playback stops (EC-7.4).
- App becomes visible again after being hidden: no automatic resume (EC-7.5).
- Rapid taps: no pile-up; only the latest request sounds (EC-7.3).
- Highest pitch (highest fret of string 1) and lowest open string: both in tune and at balanced loudness.
- Low notes on a small phone speaker: still recognizable as the right pitch.
- No network after first load: sound still works.
- Sound material still loading when the user taps: the fretboard stays interactive; pulses work; sound begins when ready or the unavailable notice applies.
- Instruments with other string counts or tunings: pitch always derived from the tuning in use.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every fretboard position MUST sound at its real pitch: open-string pitch in the tuning in use plus the fret number in semitones (FR-7.1, FR-7.2, TM-1).
- **FR-002**: The system MUST produce no sound until a user gesture that asks for sound; audio turns on with that first gesture, and that gesture's note plays (FR-7.7).
- **FR-003**: After audio is on, a note MUST start within 100 ms of the tap.
- **FR-004**: The timbre MUST resemble a clean guitar string with a clear attack and natural decay (FR-7.10).
- **FR-005**: Every note from the lowest open string to the highest fret of string 1 MUST be in tune and at a balanced perceived volume.
- **FR-006**: Low notes MUST carry enough overtones to be recognizable on a small phone speaker.
- **FR-007**: Each sounding position MUST pulse on the fretboard in sync with the audio, and MUST also pulse when sound is muted or unavailable (FR-7.6).
- **FR-008**: With reduced motion preferred, the pulse MUST become a plain state change.
- **FR-009**: A sound control in the application bar MUST let the user mute and set volume; the state lasts for the session only.
- **FR-010**: The sound control MUST be keyboard-operable with visible focus and a screen-reader label, and its state (on, muted, unavailable) MUST NOT rely on color alone.
- **FR-011**: A new sound request MUST interrupt whatever is playing; sounds never pile up (FR-7.9).
- **FR-012**: Sequence playback MUST offer a **Stop** command that ends sound and pulses.
- **FR-013**: Playback MUST stop when the app is hidden and MUST NOT resume by itself when visible again (FR-7.11).
- **FR-014**: Playback of a sequence MUST stop when view state changes mid-sequence.
- **FR-015**: If audio cannot start or sound material failed to load, the system MUST show one notice per session, "Sound is not available on this device right now", mark the sound control unavailable, and keep pulses working. The notice is non-blocking, dismissible, at most two lines, and not styled as an error.
- **FR-016**: Once loaded, sound MUST work with no network.
- **FR-017**: Sound material MUST NOT delay the fretboard becoming interactive.
- **FR-018**: The playback interface MUST accept requests in musical terms (one pitch, a set of simultaneous pitches, a sequence with a tempo) and return time marks for synchronized emphasis, reusable by later tools.
- **FR-019**: All user-facing text (notice, control labels, help) MUST come from the message catalog and the help MUST list silent mode and zero system volume as the first check (EC-7.2).
- **FR-020**: Sound MUST NOT be the only carrier of any information.

### Key Entities

- **Pitch**: A musical pitch derived from string open pitch plus fret semitones; identified by note and octave.
- **Playback request**: A single pitch, a set of simultaneous pitches, or a sequence of steps with a tempo.
- **Time mark**: When a given position sounds, relative to the request start, used to sync emphasis.
- **Sound state**: Per-session on / muted / unavailable, plus volume level.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After audio is on, 95% of taps produce audible sound within 100 ms.
- **SC-002**: The first gesture asking for sound produces its note (string 6 open yields E2) in 100% of supported-browser trials.
- **SC-003**: Every position of a 24-fret, 7-string instrument sounds within 5 cents of its calculated pitch, and loudness varies by no more than a small audible-balance tolerance across the range.
- **SC-004**: In three rapid taps, exactly one note is audible at the end, never overlapping prior notes.
- **SC-005**: When audio is unavailable, users see exactly one notice per session and 100% of taps still show the pulse.
- **SC-006**: Switching away from the app mid-note results in silence on return in 100% of trials.
- **SC-007**: Sound adds no measurable delay to the fretboard becoming interactive on the reference device profile.
- **SC-008**: After the first load, sound works with the network disabled.
- **SC-009**: Zero accessibility violations on the sound control and notice.

## Assumptions

- Q-4 is resolved by the constitution: sound is synthesized (plucked string), not recorded, so there is no first-load sample weight; range is A1 to E6 at least.
- Volume and mute are not remembered between visits; that arrives with 003-your-instrument/002-remembered-preferences.
- Triad, arpeggio, and scale playback belong to the tools that trigger them; this feature only provides the reusable playback interface.
- The fretboard from 002-interactive-fretboard reports taps as (string, fret) events and supports emphasis levels.
- Default volume is a comfortable mid level; the notice follows existing notice conventions (non-modal, dismissible).
- English only strings ship, but live in the message catalog.
- Silent mode and low system volume are not detected.
