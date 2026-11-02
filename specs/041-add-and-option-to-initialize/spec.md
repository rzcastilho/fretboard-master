# Feature Specification: Timer Linked to Metronome

**Feature Branch**: `feature/041-add-and-option-to-initialize`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/ad-hoc/041-add-and-option-to-initialize.md (id 041): Add an option to initialize the timer when the metronome starts, and automatically stop the metronome when the timer ends. The timer starts counting after the metronome count-in."

## Clarifications

### Session 2026-11-02 (specify)

- Q: Is the link on by default? → A (default; spec 039 FR-009 made the two independent and 039's users rely on that): no. The option is **off** by default; with it off, behaviour is exactly as in 039 (FR-002, FR-012).
- Q: Where does the option live and is it remembered? → A (default, follows how 039 stores the preset): a labelled switch in the Timer card, remembered on the device in the existing `metronome` preferences entry (written only when on), cleared by "Erase preferences" (FR-001, FR-011).
- Q: What does "initialize the timer" mean? → A (source: "timer starts count after the metronome count in"): when the metronome starts, the timer starts counting down from the full selected duration. If the metronome has a count-in, the timer starts on the first click after the count-in ends, not before (FR-003, FR-004).
- Q: What does "stops the metronome when the timer ends" cover? → A (source): when the countdown reaches `00:00` while linked, the metronome stops in addition to the 039 finished state (flash and chime) (FR-006).
- Q: What if the user stops the metronome by hand while linked? → A (default): the timer is stopped and reset to the full selected duration, so the next start is a clean time-box. During a count-in, stopping cancels the pending timer start (FR-007).
- Q: What if the user pauses/starts the timer by hand while linked? → A (default): the timer's own controls still work. Pressing play on the timer while the metronome is stopped does not start the metronome (the link is metronome → timer, plus timer end → stop). Pausing the timer leaves the metronome running; it stops when the countdown later reaches zero (FR-008).
- Q: What if the timer was already running or paused when the metronome starts? → A (default): linking starts a fresh countdown from the full selected duration, replacing the old reading (FR-004).
- Q: Does the metronome restarting inside a run (Speed Training repeats, tempo changes, mode tab switches) restart the timer? → A (default): no. Only a start from stopped begins the countdown; ongoing runs and repeat count-ins do not restart it. Switching mode tabs while running behaves as 039 (FR-009).
- Q: Does the chime, reduced motion, mute, announcement and offline behaviour of 039 change? → A (default): no; they are reused unchanged (FR-010).

### Session 2026-11-02 (clarify)

Code facts used below (`src/lib/state/metronome.svelte.ts`): the metronome has phases `settings` (stopped), `starting`, `running` and `paused`. Its toggle (button or Space) goes start → pause → resume, and Reset returns it to `settings`. A mode-tab switch (`selectMode`), leaving the Metronome page (`screenChanged`) and applying stored or erased preferences (`restore`) all halt a run back to `settings`. Speed Training ends by itself (`onEnd`). Ratio runs replay a repeat count-in between loops. The first non-count-in click fires `onBeat`. The timer (`src/lib/state/timer.svelte.ts`) has statuses `stopped`, `running`, `paused` and `finished`.

- Q: What counts as "starting" and "stopping" the metronome? → A (derived from code): **start** means leaving `settings` (a start from stopped). Resuming from `paused` is not a start. **Stop** means any return to `settings` other than the timer-driven stop: Reset (button or Escape), a mode-tab switch, leaving the Metronome page, a preferences restore or erase, and Speed Training ending by itself. Every stop follows FR-007: the timer is stopped and shows the full selected duration. The spec's earlier wording ("mode-tab switches MUST NOT restart or reset it") contradicted the code, which halts the run on a tab switch. It is replaced: a tab switch stops the metronome, so the timer resets (FR-007, FR-009).
- Q: What does pausing the metronome do to a linked timer? → A (default; pausing both together is the conventional reading of a link, and a running timer with no click is a partial time-box): pausing the metronome pauses a running timer. Resuming the metronome resumes that timer from its paused reading, aligned with the first resumed click (within 100 ms). If the timer was paused by hand, or was not running, the metronome's pause and resume leave it alone. If the metronome is paused during the count-in, the pending timer start stays pending and fires on the first click after the count-in once resumed (FR-015).
- Q: Does the timer-driven stop at zero reset the timer like other stops? → A (default; the 039 finished state must stay visible, FR-010): no. When a linked countdown reaches zero, the metronome is halted back to `settings` (the same end state as Reset, values kept), and the timer stays in its 039 `finished` state with flash and chime. FR-007's reset does not apply to this stop. The metronome's own "reset" announcement is suppressed for this stop, so only the timer's polite "Timer finished" is announced and the two messages do not collide (FR-006).
- Q: When is the link evaluated, and what does toggling it mid-run do? → A (default, simplest consistent rule): each linked reaction checks the switch at the moment its event happens. A metronome start begins the countdown only if the switch is on at that start. Zero stops the metronome only if the switch is on at zero. A metronome stop or pause resets or pauses the timer only if the switch is on then. Toggling the switch never starts, stops or resets anything by itself. Turning it off during a count-in cancels the pending timer start. Turning it on mid-run has no immediate effect, but a countdown that is then running stops the metronome at zero (FR-016).
- Q: Does zero stop the metronome when the countdown was started with the timer's own play, not by the metronome? → A (default; follows the "evaluated at the event" rule): yes. While the switch is on, any countdown reaching zero halts a running or paused metronome. If the metronome is already stopped, nothing extra happens (FR-006).
- Q: What if the user operates a timer control during the count-in? → A (default; the user's direct action wins): pressing the timer's play, or tapping any preset, during the count-in cancels the pending linked start. Play then runs the countdown at once from the current reading (039 FR-005). A preset tap shows the new full duration, stopped (039 FR-004) (FR-008).
- Q: Do repeat count-ins in ratio runs, and Speed Training tempo steps, affect a running countdown? → A (derived from FR-009 and the code): no. The countdown keeps running through repeat count-ins and tempo changes. Only the initial count-in of a start delays it. Speed Training ending by itself is a stop (FR-007).
- Q: Leaving the Metronome page halts the metronome. Does a linked countdown keep running on another page? → A (derived from code plus FR-007): no. While the switch is on, leaving the page halts the metronome, which stops and resets the timer. With the switch off, 039's behaviour applies unchanged (the timer keeps running across pages). The specify-step edge case "zero reached on another app page while linked" cannot occur and is removed. The hidden-tab case still applies (FR-006).
- Q: What is the preference field, and what does the switch say? → A (default, follows the 039 `timer` field pattern in `src/lib/prefs/schema.ts`): a boolean `timerLink` field in the `metronome` entry, serialized after `timer`, written only when `true`, and parsed with a Valibot boolean schema that falls back to `false`. The control is a native switch (`role="switch"` with `aria-checked`, or a checkbox styled as a switch) in the Timer card. Its visible label, which is also its accessible name, is "Start and stop with metronome" in English, with translations in the other two catalogs. Toggling the switch writes the preference. Erase preferences clears the field and leaves the switch off (FR-001, FR-011).
- Q: Is the option shared across mode tabs? → A (default, per Assumptions): yes. It is one setting for all three mode tabs, not one per mode.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One press starts both and the run ends itself (Priority: P1)

A player wants a fixed-length drill with the click: press start once, play for the chosen time, and have everything stop at the end without touching the screen.

**Why this priority**: It is the whole point of the feature.

**Independent Test**: Turn the option on, pick `1m`, start the metronome with a 4-click count-in, confirm the timer holds at `01:00` during the count-in, then counts down; at `00:00` the metronome stops.

**Acceptance Scenarios**:

1. **Given** the option is on, `1m` is selected and the metronome is stopped, **When** the user starts the metronome, **Then** the timer begins counting down from `01:00`.
2. **Given** the option is on and the metronome has a count-in, **When** the user starts the metronome, **Then** the timer stays at its full reading and does not run during the count-in, and begins counting on the first click after the count-in.
3. **Given** a linked countdown is running, **When** it reaches `00:00`, **Then** the metronome stops, the readout flashes and the chime plays as in 039.
4. **Given** the option is on and the metronome has no count-in, **When** the user starts the metronome, **Then** the timer starts counting immediately with the first click.

---

### User Story 2 - Turn the link on and off (Priority: P1)

A player who prefers the independent timer keeps it that way, and one who wants the link can enable it in one tap.

**Why this priority**: The link changes existing behaviour, so it must be opt-in and reversible.

**Independent Test**: With the option off, start the metronome and confirm the timer stays stopped; turn it on and repeat.

**Acceptance Scenarios**:

1. **Given** a fresh visit, **Then** the option is off and the timer and metronome are independent as in 039.
2. **Given** the option is off, **When** the user starts the metronome or the timer reaches zero, **Then** the other does not change.
3. **Given** the user turned the option on, **When** they reload the page, **Then** it is still on and nothing is running.
4. **Given** the user erases preferences, **Then** the option returns to off.

---

### User Story 3 - Stopping early stays predictable (Priority: P2)

A player ends a drill early, or fiddles with the timer controls mid-run.

**Why this priority**: Edge handling that keeps the link from surprising people.

**Independent Test**: Start linked and press Reset mid-run, then check the timer. Repeat during a count-in, then pause and resume the metronome mid-run.

**Acceptance Scenarios**:

1. **Given** a linked run is in progress, **When** the user presses the metronome's Reset, **Then** the metronome stops, and the timer stops and shows the full selected duration.
2. **Given** a linked metronome is in its count-in, **When** the user presses Reset, **Then** the timer never starts and shows the full duration.
3. **Given** a linked run is in progress, **When** the user pauses the timer, **Then** the metronome keeps running and stops when the resumed countdown reaches zero.
4. **Given** the option is on and the metronome is stopped, **When** the user presses the timer's play, **Then** only the timer runs; the metronome does not start.
5. **Given** a linked run is in progress, **When** the user pauses the metronome, **Then** the timer pauses; **When** they resume the metronome, **Then** the timer resumes from the same reading.
6. **Given** a linked run is in progress, **When** the user switches mode tab or leaves the Metronome page, **Then** the metronome stops and the timer shows the full selected duration, stopped.

### Edge Cases

- Zero is reached while the tab is hidden: the metronome still stops, and the 039 late-detection rules for the chime apply (FR-006).
- The user leaves the Metronome page during a linked run: the metronome halts (existing behaviour), so the timer stops and resets (FR-007).
- The user pauses the metronome mid-run: the timer pauses; resuming the metronome resumes it (FR-015).
- Speed Training ends by itself before the countdown reaches zero: this is a stop, so the timer resets (FR-007).
- The user presses the timer's play or a preset during the count-in: the pending linked start is cancelled (FR-008).
- The user changes the timer preset during a linked run: the countdown stops and shows the new full duration (as in 039); the metronome keeps running until stopped.
- The user toggles the option while a run is in progress: toggling never starts, stops or resets anything by itself. Each reaction checks the switch when its event happens. Turning it off during a count-in cancels the pending start (FR-016).
- Ratio repeat count-ins and Speed Training tempo steps: the countdown keeps running (FR-009). Reset, a mode-tab switch and a preferences restore stop the metronome, so FR-007 applies.
- Count-in set to zero: the timer starts with the first click.
- Audio blocked or muted: the metronome still stops at zero and the visual finished state shows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Timer card MUST offer a labelled on/off switch ("Start and stop with metronome") that links the timer to the metronome. It MUST be a native switch semantic (`role="switch"` with `aria-checked`, or a checkbox), operable by keyboard, with a visible focus ring, a touch target of at least 24 px, and its visible label as its accessible name.
- **FR-002**: The switch MUST default to off. While off, the timer and metronome MUST behave exactly as specified by feature 039, including full independence.
- **FR-003**: While on, starting the metronome from stopped (leaving the `settings` phase) MUST start the timer's countdown from the full selected duration once the metronome's initial count-in has finished. Resuming from pause is not a start (see FR-015).
- **FR-004**: The timer MUST NOT run during the count-in; it MUST show the full selected duration until the first click after the count-in. A timer that was running, paused or finished when the metronome starts MUST be replaced by a fresh full-duration countdown.
- **FR-005**: The countdown start MUST be aligned with the first post-count-in click, within 100 ms of it.
- **FR-006**: While on, when any countdown reaches `00:00`, a running, starting or paused metronome MUST be halted back to its stopped (`settings`) phase with its values kept. This is in addition to the 039 finished state (flash and chime), which MUST remain and MUST NOT be reset by this stop. It MUST hold whether the tab is visible or hidden. Only the timer's "Timer finished" announcement is made; the metronome adds no reset announcement for this stop.
- **FR-007**: While on, every other return of the metronome to stopped MUST stop the timer and show the full selected duration, and MUST cancel a timer start pending after the count-in. This covers Reset (button or Escape), a mode-tab switch, leaving the Metronome page, a preferences restore or erase, and Speed Training ending by itself, including during the count-in.
- **FR-008**: While on, the timer's own play, pause and preset controls MUST still work as in 039. Starting the timer MUST NOT start the metronome, and pausing the timer MUST NOT pause or stop it. Pressing the timer's play or any preset during the count-in MUST cancel the pending linked start.
- **FR-009**: Only a metronome start from stopped MUST begin a linked countdown. Ratio repeat count-ins, tempo changes (including tap tempo and Speed Training steps) and metronome resume MUST NOT restart or reset it. A mode-tab switch halts the metronome and so follows FR-007.
- **FR-010**: The chime, finished flash, reduced-motion behaviour, mute handling, screen-reader announcements and offline behaviour of 039 MUST be unchanged.
- **FR-011**: The switch state MUST be remembered on the device as a `timerLink` boolean in the existing `metronome` preferences entry, serialized after `timer` and written only when `true`. It MUST be validated as a boolean with fallback to `false`, without affecting other preferences, and cleared by "Erase preferences". Toggling writes the preference. A running, paused or pending linked state MUST NOT be remembered across reloads.
- **FR-012**: All user-facing text, including the switch label and any accessible names, MUST come from the message catalog in all three shipped languages.
- **FR-013**: The switch MUST fit on phone widths and at 200% text zoom without overlap or horizontal page scroll, and meet WCAG 2.2 AA contrast in light and dark themes.
- **FR-014**: The feature MUST work offline, collect no personal data, add no share-link field, and add no measurement event.
- **FR-015**: While on, pausing the metronome MUST pause a running timer, and resuming the metronome MUST resume a timer it paused, from its paused reading, aligned within 100 ms of the first resumed click. A timer paused by hand, or not running, MUST be left alone by metronome pause and resume. Pausing during the count-in MUST keep the pending start, which fires on the first click after the count-in once resumed.
- **FR-016**: Each linked reaction (FR-003, FR-006, FR-007, FR-015) MUST check the switch when its event happens. Toggling the switch MUST NOT itself start, stop, pause or reset the timer or the metronome, except that turning it off MUST cancel a pending linked start.

### Key Entities

- **Timer link setting**: an on/off preference, default off; the only new remembered value.
- **Linked run**: the period from a metronome start (including count-in) to a metronome stop or timer end; session-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the option on, a user can run a fixed-length drill, from start to automatic stop, with one press to start and none to stop.
- **SC-002**: A linked 1-minute run counts 60 seconds from the first post-count-in click, to within 1 second, regardless of the count-in length.
- **SC-003**: At zero, the metronome is silent within 1 second of the finished state appearing, in 100% of tested runs.
- **SC-004**: With the option off, 100% of tested sequences leave the timer and metronome independent, as in 039.
- **SC-005**: In 100% of tested early-stop sequences (Reset during count-in, Reset mid-run, mode-tab switch, leaving the page, Speed Training ending) the timer ends stopped at the full selected duration.
- **SC-006**: The switch passes automated accessibility checks and is reachable at 320 px width and 200% text zoom.

## Assumptions

- This amends 039 FR-009 (full independence) only when the user turns the option on; the default preserves it.
- The link is one way in effect: metronome start/stop drive the timer, and timer end stops the metronome; the timer's play does not start the metronome.
- Stopping (resetting) the metronome resets the timer, since a partial time-box with no click has no practice meaning. Pausing the metronome pauses the timer, so the time-box can continue.
- Custom durations, session history and keyboard shortcuts for the option are out of scope.
- The option applies in every metronome mode tab.
- Prerequisites: the practice timer (039) and the metronome count-in settings are already shipped.
