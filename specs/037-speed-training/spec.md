# Feature Specification: Speed Training Mode

**Feature Branch**: `feature/037-speed-training`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/009-more-modes/002-speed-training.md (id 002, speed-training)."

## Clarifications

### Session 2026-11-01 (specify defaults)

- Q: Where does the new tab go? → A (source § UI layout row 1): the tab bar becomes `♩ Metronome`, `⚡ Speed Training`, `+ Ratios Training`, three equal-width tabs, with the same active/inactive styling, narrow-width text-only rule, keyboard pattern and "switching stops playback" rule as the existing two tabs (FR-001, FR-014).
- Q: What does "Start BPM defaults to the current BPM" mean when each mode keeps its own settings? → A (default, keeps the per-mode rule "nothing is copied on a switch"): the first time Speed Training is used with nothing remembered, Start BPM is the shared default BPM (85) and Target BPM is Start + 40 (125). After that the mode remembers its own values like the other modes (FR-002, FR-013).
- Q: How do Start and Target stay consistent while editing? → A (default): Target is never below Start. Lowering Target below Start stops at Start BPM. Raising Start above Target lifts Target to the new Start. Both use the 30–300 BPM range; Target default Start + 40 is capped at 300 (FR-003).
- Q: How many steps are there? → A (derived from the acceptance cases): the step tempos are Start, Start + Increment, Start + 2×Increment, … while below Target, and the last step is exactly Target. 80→120 by 5 gives 9 steps; 80→102 by 5 gives 80, 85, 90, 95, 100, 102 (6 steps). If Target equals Start there is one step (FR-004).
- Q: What does the status line show when holding at target? → A (default): after the last step's loops are done, Hold keeps looping at Target BPM and the status reads `STEP n/n · HOLD` (n = last step); no count-in plays because the tempo does not change. This is a new catalog string in all three languages (FR-008).
- Q: Where do Initial and Repeat Count In apply? → A (source § Mode 2): Initial Count In plays once before step 1; Repeat Count In plays before every later step. When Count In is off, or the relevant count is 0, steps follow each other directly (FR-005).
- Q: At which BPM do count-in clicks play? → A (default, matches "Repeat Count In" in Ratios Training where the tempo is unchanged, and the source, which updates the BPM readout at the first click of each new step): count-in clicks before a step play at the previous step's tempo while the readout still shows it, and the readout and tempo change at the first loop click of the new step. The Initial Count In plays at Start BPM (FR-006).
- Q: What does the start button say and what is announced? → A (default, mirrors Ratios Training): `Start Training`; on Start the polite announcement is `Started, {start} to {target} BPM, {beats} beats` (plus `, count in {count}` when a count-in plays). Pause, Resume and Reset reuse existing strings (FR-012).
- Q: Are subdivisions, tempo decrease or per-step loop counts included? → A (scope boundary of the source): No. One click per beat, with beat 1 accented as in the plain Metronome (FR-007).
- Q: Are Speed Training settings stored, and is the privacy text changed? → A (default, extends the existing per-mode preferences record, format version stays 1): the `metronome` object gains an optional `speed` entry (fields in fixed order `startBpm`, `targetBpm`, `increment`, `loops`, `beats`, `countIn`, `initialCountIn`, `repeatCountIn`, `atTarget`), omitted when all values are defaults. The mode value may now be `"speed"`. Invalid values fall back to their defaults without affecting other modes. The privacy text stays accurate ("metronome settings") (FR-013).

### Session 2026-11-01 (clarify reviewer)

- Q: How does the Target BPM control enforce "never below Start"? → A (default, the simplest way to keep one slider/pill pattern for every row): the Target slider keeps the full 30–300 range; any value below Start (slider drag, − button, arrow key or typed entry) commits as Start BPM. The − button and the slider's lower keyboard step have no effect while Target equals Start (the − button is disabled, as at a range limit elsewhere). Lowering Start never changes Target; raising Start above Target sets Target to the new Start. Target never follows Start otherwise (the "Start + 40" rule applies only to the first-use default) (FR-003).
- Q: When exactly does a Stop run end? → A (default, "after the last loop" means after its last beat has sounded for its full beat length): the run ends at the moment the next click would have been due (one beat interval after the final beat of the last loop at Target BPM); no click sounds at that moment. The settings view then shows (FR-009).
- Q: Where does focus go and what is announced when a Stop run ends? → A (default, mirrors Reset, which returns focus to the Start button): focus moves to the `Start Training` button and the polite announcement is `Finished at {target} BPM` (new catalog string, three languages) (FR-009, FR-016).
- Q: Are step changes and Hold announced to screen readers? → A (default; constitution V "Sound MUST NOT be the only carrier", while per-beat or per-loop announcements would be noisy and are not made in other modes): yes, politely, once per event only: at the first click of each step after step 1, `Step {s} of {S}, {bpm} BPM`; on entering Hold, `Holding at {bpm} BPM`. Loops and beats are not announced (FR-016).
- Q: What does Pause announce in Speed Training? → A (default, extends the existing paused announcement): `Paused, step {s} of {S}, loop {l} of {L}, beat {b} of {N}` during loops; `Paused, holding at {bpm} BPM, beat {b} of {N}` in Hold; during a count-in the existing count-in paused announcement is reused (FR-016).
- Q: Does Hold count loops or step through anything? → A (default): no. Hold repeats # of Beats loops at Target BPM with beat 1 accented and the dots cycling; the status stays `STEP S/S · HOLD` and nothing else changes. Pause/Resume in Hold resumes in Hold at the same beat (FR-008, FR-009).
- Q: Does the Repeat Count In between steps depend on any other switch (as it depends on the ratio switch in Ratios Training)? → A (derived, source § Mode 2 "Repeat Count In before each tempo change"; Speed Training has no ratio switch): only on the Count In switch and the Repeat Count In value (0 = none). The Repeat Count In row is shown in Speed Training whenever Count In is on (FR-005).
- Q: How are the stored keys ordered, and what does Erase preferences do? → A (default, extends 036's fixed order): inside `metronome` the keys are `ratios`, `plain`, `speed`, `mode`, each only when non-default; `mode` is written when it is `"plain"` or `"speed"` and omitted for `"ratios"`, and an unknown `mode` still reads as `"ratios"`. Erase preferences clears `speed` along with the other modes. The first-visit active tab stays Ratios Training (FR-013, FR-014).
- Q: Are Speed Training values validated per field on read? → A (default, same as `plain`): each field is checked against its own range and type (integers; `atTarget` is `"hold"` or `"stop"`) and falls back to its default; after that, a Target below Start is lifted to Start. A missing or non-object `speed` gives all defaults (FR-013).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Climb from a start tempo to a target tempo (Priority: P1)

A player practising a passage opens the Speed Training tab, sets a start tempo, target tempo, increment and loops per step, and presses Start. The metronome plays the set number of loops at each tempo and nudges the tempo up by itself, so they can keep their eyes on the guitar.

**Why this priority**: This is the whole feature.

**Independent Test**: Set Start 80, Target 120, Increment 5, Loops per step 4, 4 beats, Count In on, press Start, and follow the clicks and status line.

**Acceptance Scenarios**:

1. **Given** Start 80, Target 120, Increment 5, Loops per step 4, 4 beats, **When** the user presses Start, **Then** the status line reads `COUNT IN 1/4` during the initial count-in and then `STEP 1/9 · LOOP 1/4`, and they hear 4 loops at 80 BPM.
2. **Given** step 1 has finished its 4 loops, **Then** a count-in of Repeat Count In clicks (2 by default) plays, then 4 loops at 85 BPM, and so on through 9 steps to 120 BPM.
3. **Given** Start 80, Target 102, Increment 5, **Then** the steps are 80, 85, 90, 95, 100 and 102, and the status shows `STEP n/6`.
4. **Given** a run is in progress, **Then** the status line shows the current step and loop (`STEP 3/9 · LOOP 2/4`) and the BPM readout shows the current tempo, changing at the first click of each new step.
5. **Given** the loop is playing, **Then** beat 1 is accented and the dots cycle through the beats as in the other modes.

---

### User Story 2 - Finish at the target (Priority: P1)

The player chooses what happens when the target tempo is reached: keep playing at it (Hold, the default) or end the run (Stop).

**Why this priority**: Part of the acceptance case; both endings must be predictable.

**Independent Test**: Run a short climb (e.g. Start 100, Target 105, Increment 5, 1 loop) once with Hold and once with Stop.

**Acceptance Scenarios**:

1. **Given** At target is Hold, **When** the last step's loops at Target BPM are done, **Then** the metronome keeps clicking at Target BPM with no count-in, the status reads `STEP n/n · HOLD`, and it continues until Pause or Reset.
2. **Given** At target is Stop, **When** the last loop at Target BPM is done, **Then** no further click plays, the run ends one beat interval after the last beat, the settings view shows with the user's values unchanged, focus is on `Start Training`, and `Finished at {target} BPM` is announced politely.
3. **Given** Start equals Target, **Then** there is a single step (`STEP 1/1`) and the ending rule applies after its loops.

---

### User Story 3 - Set up the climb with safe settings (Priority: P1)

The settings view shows Start BPM, Target BPM, Increment, Loops per step, # of Beats, the Count In rows and At target, using the same slider and −/value/+ controls as the other modes.

**Why this priority**: Without the settings the player cannot configure the run.

**Independent Test**: Open the Speed Training tab and edit every row with the pointer and the keyboard.

**Acceptance Scenarios**:

1. **Given** nothing is remembered, **Then** the settings read Start 85, Target 125, Increment 5, Loops per step 4, # of Beats 4, Count In on (Initial 4, Repeat 2) and At target Hold.
2. **Given** the user tries to set Target below Start (slider, −, arrow key or typed value), **Then** Target stops at Start BPM and the Target − button is disabled; **Given** the user lowers Start, **Then** Target does not change.
3. **Given** the user raises Start above Target, **Then** Target rises to equal Start.
4. **Given** the Increment row, **Then** it accepts 1–20 BPM, and Loops per step accepts a positive whole number within its range (1–16).
5. **Given** Count In is switched off, **Then** Initial and Repeat Count In rows are hidden, as in the other modes.
6. **Given** the settings view, **Then** it shows no Repeat/Subdivision ratio controls and no Loop 1 / Loop 2 rows.

---

### User Story 4 - Pause, resume and reset (Priority: P2)

The player can pause mid-step, resume where they were and reset to the settings.

**Why this priority**: Required for practice flow and consistency with the other modes.

**Independent Test**: Pause during step 3 loop 2, wait, resume, then reset.

**Acceptance Scenarios**:

1. **Given** a run is in progress, **When** the user pauses and later resumes, **Then** it continues in the same step and loop with no new count-in.
2. **Given** a run is in progress or paused, **When** the user resets (button or Escape), **Then** sound stops and the settings view shows with the same values; the next Start begins at step 1.
3. **Given** the user selects another tab during a run, **Then** playback stops at once and the other mode's settings view shows; returning to Speed Training shows its settings unchanged.
4. **Given** Space is pressed, **Then** it toggles Start/Pause/Resume as in the other modes.

---

### Edge Cases

- Target 300 with Start 290 and Increment 20: steps are 290 and 300 (the last step is exactly Target, never above it).
- Increment 1 with a 260 BPM gap: 261 steps are allowed; the status line shows `STEP 261/261` without truncation.
- Loops per step 1: the status reads `LOOP 1/1` at every step.
- Count In off or count of 0: no count-in at start or between steps.
- Pausing during a count-in: Resume continues the count-in from where it stopped.
- Stop ending: no further click plays after the last loop's final beat.
- Start 300: Target is also 300; one step.
- Stored Speed Training values that are missing or invalid take their defaults (and Target is lifted to Start if below it) without affecting other modes.
- Leaving the Metronome route while running stops the click, as today.
- 375 px and 320 px widths: three tabs and the status line fit without truncation or horizontal scroll in all three languages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mode tab bar MUST show three equal-width tabs in the order `♩ Metronome`, `⚡ Speed Training`, `+ Ratios Training`; Speed Training MUST follow the existing tab rules (active styling, text-only at 30rem and below, keyboard and assistive-technology behaviour, selecting it stops any running playback).
- **FR-002**: The Speed Training settings view MUST offer Start BPM, Target BPM, Increment, Loops per step, # of Beats, Count In with Initial and Repeat Count In, and At target (Hold or Stop), with defaults 85, 125, 5, 4, 4, on (4 and 2) and Hold. Numeric rows MUST use the same slider and −/value/+ controls and typed-entry validation as other modes.
- **FR-003**: Start and Target BPM MUST be within 30–300; Target MUST never be below Start. The Target slider keeps the 30–300 range; any attempt to set Target below Start (slider, − button, arrow key or typed entry) MUST commit Start BPM, and the Target − button MUST be disabled while Target equals Start. Raising Start above Target MUST raise Target to Start; lowering Start MUST NOT change Target. Increment MUST be 1–20; Loops per step 1–16; # of Beats 1–16; Count In rows keep their usual ranges.
- **FR-004**: A run's step tempos MUST be Start, Start + Increment, Start + 2×Increment, … while below Target, and the final step MUST be exactly Target BPM, even when the increment would overshoot it. When Target equals Start there MUST be exactly one step.
- **FR-005**: A run MUST play Initial Count In (when Count In is on and the count is above 0), then Loops per step full loops of # of Beats at step 1, then Repeat Count In (same conditions) — the Repeat Count In depends only on the Count In switch and its own value, not on any ratio setting, then the loops of the next step, and so on until the last step.
- **FR-006**: Tempo and the BPM readout MUST change at the first click of each new step's first loop, not during the preceding count-in. The Initial Count In plays at Start BPM, and a Repeat Count In plays at the tempo of the step just completed.
- **FR-007**: Each loop MUST play one click per beat with beat 1 accented (same sounds and dots as the plain Metronome), with no subdivisions.
- **FR-008**: The running status line MUST read `STEP s/S · LOOP l/L` during loops and `COUNT IN n/M` during count-ins as in other modes. In Hold, after the last step's loops, the status MUST read `STEP S/S · HOLD`.
- **FR-009**: With At target = Hold the metronome MUST keep clicking at Target BPM, with no count-in, until Pause or Reset. In Hold, Pause/Resume MUST resume in Hold at the same beat. With Stop it MUST end the run one beat interval after the final beat of the last loop at Target BPM, with no click at that moment, then show the settings view with values unchanged and move focus to the `Start Training` button.
- **FR-010**: Pause MUST hold the exact position; Resume MUST continue in the same step, loop and beat with no new count-in; Reset (button or Escape) and selecting another tab MUST stop at once, discard the position and show the settings view with values unchanged. The next Start begins at step 1.
- **FR-011**: Timing of clicks MUST be as accurate as in the other modes, including across step changes (no gap or extra click at the boundary other than the configured count-in).
- **FR-012**: The start button MUST read `Start Training`. Start MUST announce politely `Started, {start} to {target} BPM, {beats} beats` (plus `, count in {count}` when applicable). Pause, Resume and Reset use the existing announcements. All new visible text and accessible names MUST exist in English, Brazilian Portuguese and Spanish.
- **FR-013**: The mode and Speed Training settings MUST persist across reloads under the existing remembered-settings rules (version unchanged): the `metronome` object gains optional `speed` and `mode` may be `"speed"`; `speed` is omitted when all values are defaults; invalid stored values fall back per field to their defaults (Target lifted to Start if below), without affecting other modes. Keys inside `metronome` are ordered `ratios`, `plain`, `speed`, `mode`; `mode` is omitted when `"ratios"`, and an unknown `mode` reads as `"ratios"`. Erase preferences MUST clear `speed`. Values are written on change, as for other modes.
- **FR-014**: Existing Metronome and Ratios Training behaviour, settings and stored values MUST be unchanged; a stored record written before this feature MUST read as before.
- **FR-015**: The selected mode MUST NOT be added to share links and no new anonymous-measurement event is added. Speed Training MUST NOT include subdivisions, automatic tempo decrease or per-step loop counts.
- **FR-016**: Speed Training MUST make these polite announcements (new catalog strings, three languages), and no others beyond FR-012 and the shared Resume/Reset strings: at the first click of each step after step 1, `Step {s} of {S}, {bpm} BPM`; on entering Hold, `Holding at {bpm} BPM`; when a Stop run ends, `Finished at {target} BPM`; on Pause during loops, `Paused, step {s} of {S}, loop {l} of {L}, beat {b} of {N}`; on Pause in Hold, `Paused, holding at {bpm} BPM, beat {b} of {N}`; on Pause during a count-in, the existing count-in paused announcement. Loops and beats are not announced while running.

### Key Entities

- **Speed Training settings**: Start BPM, Target BPM, Increment, Loops per step, # of Beats, Count In (on/off, Initial, Repeat) and At target. Remembered per mode.
- **Step schedule**: The ordered list of tempos from Start to Target derived from the settings; its last item is exactly Target.
- **Run position**: Current step, loop and beat (or count-in click), held on Pause and discarded on Reset or mode switch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With Start 80, Target 120, Increment 5, Loops per step 4 and 4 beats, a run plays exactly 9 steps of 4 loops at 80, 85, … 120, with a 2-click count-in between steps and `STEP 1/9 · LOOP 1/4` shown at the first loop.
- **SC-002**: With Start 80, Target 102 and Increment 5, the step tempos are exactly 80, 85, 90, 95, 100, 102.
- **SC-003**: For every valid combination of settings, the last step's tempo equals Target and no step tempo exceeds it.
- **SC-004**: With At target = Stop, 100% of runs return to the settings view after the last loop with no extra click; with Hold, clicking continues at Target until Pause or Reset.
- **SC-005**: Pause then Resume never changes the step, loop or beat and never adds a count-in; Reset and tab switches stop sound with no further click.
- **SC-006**: Every control is reachable and operable by keyboard alone, automated accessibility checks report no new violations, and at 375 px all labels and the status line show without truncation or horizontal scroll in all three languages.
- **SC-007**: All Metronome and Ratios Training acceptance behaviour from earlier slices passes unchanged.

## Assumptions

- Builds on the mode tab bar and plain Metronome (009-more-modes/001) and the Ratios Training, count-in and remembered-settings slices; it shares their engine, running view, shortcuts and Reset semantics.
- Each mode keeps its own settings; "defaults to the current BPM" is read as the shared default BPM (85) on first use, with nothing copied from other modes afterwards.
- Loops per step is limited to 1–16 (an assumed range, as the source gives only the default of 4).
- Subdivisions (009-more-modes/003), tempo decrease and per-step loop counts are out of scope, as is tap tempo.
- Phones are not a supported target, but the layout must not be blocked at 375 px.
