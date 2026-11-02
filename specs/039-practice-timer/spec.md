# Feature Specification: Practice Timer

**Feature Branch**: `feature/039-practice-timer`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/010-practice-sessions/001-practice-timer.md (id 001, practice-timer)."

## Clarifications

### Session 2026-11-01 (specify)

- Q: The source leaves open whether the timer starts the metronome or stops it at zero. → A (source: "this file assumes neither"; scope boundary "no link between timer and metronome"): neither. The timer and the metronome are fully independent in both directions (FR-009).
- Q: Which pages show the timer? → A (source: "above the metronome card"): the Metronome page, above the metronome card, in every mode tab (FR-001, FR-010).
- Q: What does "survives mode-tab switches and Reset" mean when the user leaves the Metronome page? → A (default): the timer state lives for the session on the device, so a running countdown keeps running while the user visits another page and returns, and it still chimes at zero. Only a full page reload ends it (FR-010).
- Q: What does tapping play at `00:00` do? → A (default): it restarts the countdown from the full selected duration and runs (FR-006).
- Q: What does play do after a pause? → A (default): it resumes from the paused reading. Pausing never changes the selected preset (FR-005).
- Q: What happens on first visit, with no remembered preset? → A (default; the source's example shows 2 minutes): `2m` is selected and the readout shows `02:00` (FR-003, FR-011).
- Q: Is the timer accurate if the tab is in the background or the device sleeps? → A (default): the countdown follows real elapsed time, so the reading is correct on return. If zero was reached while the page was hidden, the timer is stopped at `00:00` (FR-007, FR-012).
- Q: How do the flash and chime work under reduced motion and mute? → A (source): under reduced motion the flash is a plain state change (the readout shows a distinct finished state, with no animation). The chime is silent when the app is muted and follows the app volume. The visual finished state is shown regardless of mute (FR-007, FR-008).
- Q: How long does the finished state last? → A (default): it lasts until the user taps play, a preset or the selected preset, or 5 seconds pass for the flash itself, after which the readout stays at `00:00` in a static finished style (FR-007).
- Q: What is announced to screen readers? → A (source: "last 10 seconds and zero"): a polite announcement for each of the seconds 10 to 1 and at zero ("Timer finished"). No per-second announcement before that. The readout itself is not a live region (FR-013).
- Q: Are the 1m–10m presets and the stored value validated? → A (constitution IX): the remembered preset is an integer 1–10; any other stored value falls back to 2 without affecting other preferences (FR-011).

### Session 2026-11-01 (clarify)

- Q: Does the chime play when zero is reached while the tab is hidden? → A (default, revises the specify answer; the source says clicks continue in the background, and a time-box cue is most useful when the player is looking elsewhere): yes. The chime plays when the app detects zero, whether the page is visible or hidden, if zero is detected no more than 2 seconds after the real end time. If zero is detected later than that (for example, the device slept or the browser suspended the page), the timer is silently stopped at `00:00` in the finished state, with no late chime (FR-007, FR-012).
- Q: How long is the flash, and what ends the finished style? → A (default): the flash (or, under reduced motion, a static highlighted finished style) lasts 5 seconds; then the readout stays at `00:00` in a static finished style until the user taps play or any preset. Starting, stopping or resetting the metronome does not end it (FR-007, FR-009).
- Q: Does the chime play on another page of the app? → A (default, follows FR-010; the app is a single-page SvelteKit app): yes. A countdown keeps running while the user is on another tool page, and the chime plays there at zero (subject to mute). The timer card is shown only on the Metronome page.
- Q: Does the timer get a keyboard shortcut? → A (default; Space and Escape already belong to the metronome, `src/lib/state/metronome-keys.ts`): no. The timer adds no global shortcut and does not change the metronome keys. Space or Enter on a focused timer control activates that control only and does not toggle the metronome (native button activation already wins over the Space shortcut).
- Q: How is the chime produced? → A (default, constitution offline/no-asset preference and the existing engine): a short synthesized tone (≤ 1 s) through the shared audio engine's volume → mute chain (`src/lib/audio/engine.ts`), so app mute and volume apply. It does not use or interrupt the metronome scheduler, and it never starts or stops the metronome.
- Q: Where is the preset stored? → A (default, follows how 035–037 store metronome settings in `src/lib/prefs/schema.ts`): as a `timer` minutes field inside the existing `metronome` preferences entry, written only when it differs from the default `2`, parsed with a Valibot schema; an invalid value falls back to `2` without resetting other metronome settings. Selecting a preset (including the same one) writes the preference; play, pause and zero do not.
- Q: Exactly what text is announced? → A (default): for seconds 10 to 1 the polite region announces the bare number of seconds remaining (localized, for example "10 seconds"); at zero it announces "Timer finished". Pausing, resuming and preset changes announce nothing extra beyond each control's accessible name and pressed/selected state. Announcements are made only while the timer card is on screen (the Metronome page).
- Q: What does the play/pause button's accessible name say? → A (default): "Start timer" when stopped, paused or finished, and "Pause timer" while running.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Time-box an exercise (Priority: P1)

A player wants to practise one exercise for exactly two minutes without using another device. They pick `2m` above the metronome, press play and watch the readout count down while they play along with the metronome.

**Why this priority**: It is the whole point of the feature.

**Independent Test**: Open the Metronome page, select `2m`, press play, and watch the readout run from `02:00` to `00:00`, then check the finished state.

**Acceptance Scenarios**:

1. **Given** the timer shows `02:00` with `2m` selected, **When** the user presses play, **Then** the readout counts `02:00`, `01:59` … `00:00` in whole seconds and the play button shows pause while running.
2. **Given** a running countdown, **When** the user presses pause, **Then** the countdown holds its reading and the button shows play again; pressing play resumes from that reading.
3. **Given** a countdown reaches `00:00`, **When** it ends, **Then** the readout flashes, a short chime plays, and the timer stops with the button showing play.
4. **Given** the countdown finished, **When** the user presses play, **Then** it restarts from the full selected duration.

---

### User Story 2 - Choose and reset the duration (Priority: P1)

A player changes the exercise length between 1 and 10 minutes, or restarts the same length.

**Why this priority**: Without presets the timer cannot be used for different exercises.

**Independent Test**: Start a 2-minute countdown, tap `5m`, then tap `5m` again.

**Acceptance Scenarios**:

1. **Given** a 2-minute countdown is running, **When** the user taps `5m`, **Then** the countdown stops and reads `05:00`.
2. **Given** `5m` is selected and the countdown is partly through, **When** the user taps `5m` again, **Then** the countdown stops and resets to `05:00`.
3. **Given** the presets row, **Then** it offers `1m` to `10m`, and exactly one is marked selected, outlined in the secondary accent colour and announced as selected.

---

### User Story 3 - Timer and metronome stay independent (Priority: P1)

A player keeps the metronome running at zero, starts the timer without starting the metronome, and uses mode tabs and Reset freely.

**Why this priority**: Surprising coupling would break the player's practice flow.

**Independent Test**: Start the metronome and a 1-minute timer, switch tabs, press Reset on the metronome, and let the timer reach zero.

**Acceptance Scenarios**:

1. **Given** the metronome is running and a countdown reaches zero, **Then** the metronome keeps clicking.
2. **Given** the metronome is stopped, **When** the user starts the timer, **Then** the metronome does not start.
3. **Given** a running countdown, **When** the user resets the metronome, **Then** the timer keeps counting.
4. **Given** a running countdown, **When** the user switches mode tabs, **Then** the timer keeps counting and shows the same reading.

---

### User Story 4 - Remember my preset (Priority: P2)

A player who always practises for five minutes does not want to pick `5m` on every visit.

**Why this priority**: A convenience; the timer works without it.

**Independent Test**: Select `5m`, reload the page, and see `5m` selected with `05:00`.

**Acceptance Scenarios**:

1. **Given** the user selected `5m`, **When** they reload the page, **Then** `5m` is selected and the readout shows `05:00`, stopped.
2. **Given** a countdown was running, **When** the page is reloaded, **Then** nothing is running and the readout shows the full preset duration.
3. **Given** the user erases preferences, **Then** the remembered preset returns to `2m`.

---

### User Story 5 - Use the timer by ear and with a screen reader (Priority: P2)

A player who cannot look at the screen, or who is muted, still gets the right cues.

**Why this priority**: Accessibility and the mute setting are product requirements.

**Independent Test**: Run a countdown with the app muted and with a screen reader; check the last-10-seconds announcements.

**Acceptance Scenarios**:

1. **Given** the app is muted, **When** the countdown reaches zero, **Then** the finished state shows and no chime plays.
2. **Given** reduced motion is requested, **When** the countdown reaches zero, **Then** the readout changes to the finished state without animation.
3. **Given** a screen reader, **When** the countdown runs, **Then** seconds 10 to 1 and zero are announced politely and earlier seconds are not.

### Edge Cases

- The page is hidden or the device sleeps mid-countdown: the reading follows real elapsed time on return (FR-012).
- Another preset is tapped at `00:00` or while paused: the countdown stops and shows the new full duration.
- The chime cannot play (audio blocked): the visual finished state still appears and nothing errors.
- Zero is reached while the page is hidden: the chime plays if detected within 2 seconds of the real end; after a longer suspension the timer shows the finished state silently on return.
- A timer control has focus and the user presses Space: the control activates; the metronome does not toggle.
- Remembered preset is missing, non-integer or outside 1–10: falls back to `2m`.
- Narrow phone screens and 200% text zoom: all ten presets stay reachable without overlap or horizontal page scroll.
- The user leaves the Metronome page during a countdown and returns: the reading is correct (FR-010).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Metronome page MUST show a Timer card above the metronome card, with a stopwatch icon and the heading "Timer", a row of preset pills `1m` to `10m`, a large seven-segment-style readout in `MM:SS`, and a round play button on the right.
- **FR-002**: The play button MUST become a pause button while the countdown runs, with an accessible name that states the current action ("Start timer" when not running, "Pause timer" while running).
- **FR-003**: Exactly one preset MUST be selected at any time, outlined in the secondary accent colour, marked as selected for assistive technology; the default is `2m`.
- **FR-004**: Tapping a preset that is not selected MUST select it, stop any running countdown, and set the readout to that many minutes. Tapping the selected preset MUST stop the countdown and reset the readout to the full duration.
- **FR-005**: Play MUST start the countdown from the current reading; pause MUST hold the reading; play after pause MUST resume from it.
- **FR-006**: Pressing play at `00:00` MUST restart the countdown from the full selected duration.
- **FR-007**: At zero the timer MUST stop, flash the readout for 5 seconds (a plain, non-animated state change under reduced motion) and play a short chime (≤ 1 s), including when the page is hidden or another app page is shown, unless zero is detected more than 2 seconds after the real end time, in which case no chime plays. The readout MUST remain at `00:00` in a distinct finished style until the user taps play or a preset; metronome actions do not clear it.
- **FR-008**: The chime MUST respect the app's mute setting and volume. Mute MUST NOT hide the visual finished state, and a failure to play audio MUST NOT affect the timer.
- **FR-009**: The timer and the metronome MUST be fully independent: the metronome keeps running at zero, starting the timer does not start the metronome, stopping the metronome does not affect the timer, and Reset of the metronome does not affect the timer.
- **FR-010**: Timer state MUST survive mode-tab switches and in-app navigation within the session, and the timer MUST be present in every Metronome mode.
- **FR-011**: The selected preset MUST be remembered on the device inside the existing `metronome` preferences entry (written only when not `2`), validated as an integer 1–10 with fallback to `2` without affecting other preferences, and cleared by "Erase preferences". A running countdown, paused reading or finished state MUST NOT be remembered.
- **FR-012**: The countdown MUST follow real elapsed time so that it stays correct after the page was hidden or throttled, with no cumulative drift visible over 10 minutes.
- **FR-013**: A polite screen-reader announcement MUST be made for each of the last 10 seconds (10 to 1, as a localized "N seconds") and at zero ("Timer finished") while the timer card is on screen; the readout itself MUST NOT be a live region.
- **FR-017**: The timer MUST add no keyboard shortcut and MUST NOT change the metronome's Space/Escape/T keys; activating a focused timer control with Space or Enter MUST NOT toggle the metronome.
- **FR-018**: The chime MUST be a synthesized tone played through the shared audio engine's volume and mute chain, MUST NOT add an audio asset, and MUST NOT start, stop or reschedule the metronome.
- **FR-014**: All user-facing text, including accessible names and announcements, MUST come from the message catalog in all three shipped languages.
- **FR-015**: Controls MUST be keyboard operable with visible focus, have touch targets of at least 24 px, meet WCAG 2.2 AA contrast in light and dark themes, and fit on phone widths and 200% text zoom without overlap.
- **FR-016**: The feature MUST work offline, collect no personal data, add no share-link field, and add no measurement event.

### Key Entities

- **Timer preset**: a whole number of minutes from 1 to 10; the only remembered timer value.
- **Countdown**: remaining whole seconds with a state of stopped, running, paused or finished; session-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can set and start a timed exercise in at most two taps.
- **SC-002**: A 2-minute countdown reaches `00:00` within 1 second of 120 real seconds, including after the page was hidden for part of it.
- **SC-003**: At zero the visible finished state appears within 1 second, and the chime plays unless muted.
- **SC-004**: In 100% of tested sequences (metronome running, start, Reset, tab switch, zero) the metronome and the timer do not change each other's state.
- **SC-005**: Switching preset while running always yields a stopped timer showing the new full duration.
- **SC-006**: The timer card passes automated accessibility checks and all ten presets are reachable at 320 px width and 200% text zoom.

## Assumptions

- The timer card is only on the Metronome page, not on other tools; a running countdown continues (and chimes) while another app page is shown.
- Durations are limited to the ten presets; custom durations, stopwatch mode, session history and any timer–metronome link are out of scope.
- The seven-segment look is a visual style of the readout using the design system's tokens, not an image.
- The chime reuses the app's audio output so mute and volume apply, and plays only after the user has interacted (pressing play satisfies this).
- Prerequisite waves (ratios training, mode tabs and plain metronome) are already shipped.
