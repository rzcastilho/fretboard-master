# Feature Specification: Alternate Two Ratios

**Feature Branch**: `feature/034-alternating-ratios`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/008-ratios-training/004-alternating-ratios.md (id 004, alternating-ratios)."

## Clarifications

### Session 2026-10-30 (clarify reviewer)

Sources: constitution (C), breakdown brief 008-ratios-training/004 (B), macro-spec `specs/autonomous/metronome-trainer-spec.md` (M), the 031/032/033 specs and code (X). "Default" marks an assumed conventional choice where no source decides.

- Q: Is Loop 2 hidden or disabled when the section is off? → A (default, X 033 precedent: Count In off removes its rows; M "Shows/hides"): **Hidden** — the Loop 2 row is not rendered while the switch is off, so it is not in the tab order or the accessibility tree. Its value stays in the run settings and the dropdown shows it again when the switch is turned on. Loop 1 stays visible in both states (FR-003).
- Q: Where do the header, switch and dropdowns sit? → A: Derived from M's settings table and X 033: BPM, # of Beats, Count In switch and rows, then the **SUBDIVISION RATIO** header with its switch on the right, then Loop 1, then Loop 2, then Start Training. The header is a heading one level below the panel heading (`h3` under the panel `h2`), text set in small caps (FR-001, FR-002).
- Q: What control is the section switch, and what colour? → A (default, X 033 Count In switch): The same `<button role="switch" aria-checked>` pattern and switch styling (tokens) as the Count In switch, with accessible name "Subdivision ratio" (translated), operable by click, Enter and Space, hit target at least 24 × 24 CSS px. Space on it toggles the switch and does not start training (X already excludes `[role="switch"]` from the Space shortcut). No new colour token is added for M's "green" switch; the existing switch tokens apply in every theme (FR-001, FR-011, FR-014).
- Q: How are click times computed across the cycle? → A: Derived from X 031–033 (integer index from one anchor, never accumulated). Let *T* = 60 / BPM, *N* = # of Beats, *k* = effective initial count-in, *r* = effective repeat count-in (Repeat Count In if Count In is on and the section is on, else 0). Each phase occupies a whole number of beat slots: initial count-in *k*, each loop *N*, each repeat count-in *r*. Phase *p* starts at `anchor + (beat slots before p) × T`; a count-in click *i* (0-based) of a phase at `phaseStart + i × T`; loop grid click *j* at `phaseStart + j × T / n` with *n* the loop's clicks per beat. Slot counts are integers, so no time is ever accumulated by addition of floats, and the cycle (2*N* + 2*r* beats when on; *N* when off) repeats exactly. After Resume the same rule applies from the new anchor (FR-008, SC-002).
- Q: What do the dots show at a switch? → A (default, M dot rules and X 033 single dot): When a loop begins (after a repeat count-in, or back to back), the full dot row returns with beat 1 lit and all later dots grey; nothing from the previous loop stays dimmed. During a repeat count-in only the single pulsing dot is shown, exactly as in the initial count-in (including the reduced-motion behaviour from 033) (FR-006).
- Q: Accents at a switch? → A: Derived from X 032/033: every repeat count-in click uses the accent click; beat 1 of each loop (Loop 1 or Loop 2, with or without a count-in before it) uses the accent click, beats 2…N the normal click, and in-between clicks the soft click (FR-006, Assumptions).
- Q: Pause on the last beat of a loop, before the repeat count-in has sounded? → A: Derived from FR-009 (freeze on the last sounded click). The status stays on e.g. `BEAT 4/4 · SUB 3`; Resume plays repeat count-in click 1 within 50 ms (or beat 1 of the next loop when *r* = 0). Pausing on the last repeat count-in click resumes with beat 1 of the next loop (FR-009).
- Q: Announcements and translations? → A (default, X 031–033 announcement set; X 032 subdivision names): With the section **on**, Start announces "Started, {bpm} BPM, {beats} beats, {loop1} then {loop2}" plus ", count in {k}" when an initial count-in plays (pt-BR "… {loop1} e depois {loop2}", es "… {loop1} y luego {loop2}"); Pause during a loop announces "Paused on beat {b} of {N}, {loop}" naming the playing loop's subdivision (pt-BR "Pausado no tempo {b} de {N}, {loop}", es "En pausa en el tiempo {b} de {N}, {loop}"); Pause during a repeat count-in reuses 033's "Paused on count-in click {n} of {r}". With the section **off** every announcement is unchanged from 033. Loop switches and clicks are never announced. Labels: en "Subdivision ratio" / "Loop 2"; pt-BR "Proporção de subdivisão" / "Loop 2"; es "Proporción de subdivisión" / "Bucle 2". The header text is the same word set in small caps (FR-013).
- Q: Same subdivision in both loops? → A: Derived from B ("alternates between two subdivisions" with no exception): the run still alternates and plays the repeat count-in at each switch; the settings are not validated against each other (US1 scenario 5).
- Q: Background suspension that skips past a switch? → A: Derived from X 031/033 (skip forward, no burst): the scheduler continues at the next due grid slot of the cycle; the view shows the phase that slot belongs to (dot row with the correct `SUB`, or the single dot with `COUNT IN n/r`). Missed clicks are never replayed (Edge Cases).
- Q: How is it stored for the later remembered-settings slice (005)? → A (default, X 033 field style): Two fields on the run settings: `ratio: boolean` (default `true`) and `loop2: Subdivision` (default `6`), validated with the existing `toSubdivision` so an unknown value gives 6; a non-boolean `ratio` gives `true`. The existing `subdivision` field remains Loop 1. Nothing is persisted in this slice (FR-012).
- Q: Anything left for a human? → No. Every open point is derived from a source or has a conventional default above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Alternate between two subdivisions with a count-in at each switch (Priority: P1)

The hardest part of fast playing is switching cleanly between note groupings without the tempo moving. With the Subdivision Ratio section on (the default), a run plays Loop 1 for the chosen number of beats, a short repeat count-in, Loop 2 for the same number of beats, another repeat count-in, then back to Loop 1, and so on until the user pauses or resets. The tempo never changes.

**Why this priority**: This is the core of Ratios Training. Without it the tool only repeats one pattern.

**Independent Test**: Set 85 BPM, 4 beats, Count In on with 4 initial and 2 repeat clicks, Loop 1 8th Triplets and Loop 2 Sextuplets. Start training and check the audible sequence: 4 count-in clicks, 4 beats × 3 clicks, 2 clicks, 4 beats × 6 clicks, 2 clicks, 4 beats × 3 clicks, and so on, with the status line in step.

**Acceptance Scenarios**:

1. **Given** the settings above, **When** the user starts training, **Then** the audible sequence is 4 clicks, 4 beats × 3, 2 clicks, 4 beats × 6, 2 clicks, 4 beats × 3, and so on, and the status line reads `COUNT IN n/4`, `BEAT n/4 · SUB 3`, `COUNT IN n/2`, `BEAT n/4 · SUB 6` in step with the audio.
2. **Given** a loop is playing, **Then** `SUB` shows the clicks per beat of the loop currently playing, and it changes at the first beat of the next loop.
3. **Given** a repeat count-in is playing, **Then** the running view shows the single pulsing dot, the same as the initial count-in, and the status reads `COUNT IN n/2` with n counting 1 to 2.
4. **Given** the switch from one loop to the next, **Then** there is no gap and no overlap: the first beat of the next loop falls exactly one beat after the last count-in click, or after the last beat of the previous loop when there is no count-in.
5. **Given** Loop 1 and Loop 2 hold the same subdivision, **Then** the run still alternates and plays the repeat count-in at each switch.
6. **Given** the run continues for many cycles, **Then** the beat spacing stays constant and does not drift.

---

### User Story 2 - Choose the two loops and turn alternation on or off (Priority: P1)

The settings view gets a **SUBDIVISION RATIO** section header in small caps with an on/off switch on its right (on by default). Under the Loop 1 dropdown a **Loop 2** dropdown offers the same eight options as Loop 1 and defaults to Sextuplets. Turning the section off leaves a run that repeats only Loop 1.

**Why this priority**: The user must pick which two ratios to practise, and must be able to fall back to a single loop.

**Independent Test**: Open the tool and check the section header, its switch on, Loop 1 on 8th Triplets and Loop 2 on Sextuplets. Change Loop 2 to each option, then turn the switch off, start training and check that only Loop 1 repeats.

**Acceptance Scenarios**:

1. **Given** the settings view on first open, **Then** the SUBDIVISION RATIO header shows its switch on, Loop 1 reads 8th Triplets and Loop 2 reads Sextuplets.
2. **Given** the Loop 2 dropdown, **Then** it lists the same eight options as Loop 1, in the same order.
3. **Given** the switch is off, **When** the user starts training, **Then** Loop 1 repeats for the chosen beats with no repeat count-in and no switch of subdivision, and `SUB` always shows Loop 1's value.
4. **Given** the switch is off, **Then** the Loop 2 dropdown is hidden (not rendered, not in the tab order or accessibility tree), and its value is kept and restored when the switch is turned on again.
5. **Given** a keyboard-only or screen-reader user, **Then** the switch (named "Subdivision ratio") and the Loop 2 dropdown are operable and have accessible names.
6. **Given** a running or paused session, **Then** these controls cannot be changed; they change only on the settings view.

---

### User Story 3 - Count-in settings at each switch (Priority: P2)

The repeat count-in uses the Repeat Count In value from the Count In section. If Count In is off, or Repeat Count In is 0, the loops switch back to back with no clicks between them.

**Why this priority**: It completes the Count In behaviour that the previous feature stored but did not play.

**Independent Test**: Run with Repeat Count In 0, then with Count In off, and check that Loop 1 flows straight into Loop 2 with no extra clicks. Run with Repeat Count In 6 and check that six clicks sound at each switch.

**Acceptance Scenarios**:

1. **Given** Count In is off, **When** the run switches loops, **Then** no count-in plays and the next loop begins exactly one beat after the last beat of the previous loop; the initial count-in also does not play.
2. **Given** Count In is on and Repeat Count In is 0, **Then** the loops switch back to back, while the initial count-in still plays.
3. **Given** Repeat Count In is *r* (1–8), **Then** *r* accented clicks play at each switch, one beat apart, and the status reads `COUNT IN n/r`.
4. **Given** the Subdivision Ratio section is off, **Then** no repeat count-in plays at the end of a loop even if Count In is on.

---

### User Story 4 - Pause and resume at the exact position (Priority: P2)

Pause and Resume keep the exact position in the cycle: which loop is playing, which beat, and whether a count-in was in progress.

**Why this priority**: Without exact resume the player loses their place in the exercise.

**Independent Test**: Pause on `BEAT 3/4 · SUB 6`, check the status stays frozen, resume and check that the next click is beat 4 of Loop 2. Repeat for a pause during a repeat count-in.

**Acceptance Scenarios**:

1. **Given** the run is paused on `BEAT 3/4 · SUB 6`, **When** the user resumes, **Then** the next click is beat 4 of Loop 2 and the sequence continues as before.
2. **Given** the run is paused on `COUNT IN 1/2` between loops, **When** the user resumes, **Then** the next click is count-in click 2 of 2, then the next loop starts one beat later, and the count-in is not restarted.
3. **Given** the run is paused, **Then** no click sounds after the Pause instant, and the display and status stay frozen on the last click that sounded.
4. **Given** the user presses Reset, **Then** the tool returns to the settings view with all settings unchanged, and starting again begins from the initial count-in and Loop 1.

---

### Edge Cases

- # of Beats of 1: each loop is a single beat, and loops alternate every beat (with the repeat count-in between them if on).
- # of Beats of 16 and Repeat Count In of 8: the status text `COUNT IN n/8` and `BEAT n/16 · SUB n` fit on the status line at every width.
- BPM 30 or 300: switches keep the same accuracy and constant tempo.
- Background suspension: missed clicks are not replayed; playback continues from the next due click, and the view and status show the loop or count-in that is current (including after a skipped switch).
- Mute: the app-wide mute and volume govern all clicks, and muting does not pause the run.
- Web Audio unavailable: the run proceeds visually with the existing notice, and the loop, count-in and `SUB` display still follow the cycle.
- Rapid Start, Pause, Resume or Space presses never produce overlapping click streams or a doubled count-in.
- Leaving the tool and reopening it shows the defaults (section on, Loop 1 8th Triplets, Loop 2 Sextuplets).
- Narrow widths (down to 320 CSS px at zoom) and every theme: the section header, switch and both dropdowns must not be cut off.
- Exactly two loops at one BPM: more than two patterns, per-loop tempos or per-loop beat counts are not part of this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ratios Training settings view MUST show, after the Count In rows and before Loop 1, a **SUBDIVISION RATIO** section header (an `h3`, small caps) with an on/off switch on its right, on by default, built like the Count In switch (`role="switch"`, `aria-checked`, existing switch tokens). The switch MUST have the accessible name "Subdivision ratio" and expose its on/off state to assistive technology.
- **FR-002**: The settings view MUST show a **Loop 2** dropdown directly under Loop 1, with the same eight options (Quarter notes 1, 8th notes 2, 8th Triplets 3, 16th notes 4, Quintuplets 5, Sextuplets 6, Septuplets 7, 32nd notes 8) in the same order, defaulting to Sextuplets.
- **FR-003**: When the section is off, the Loop 2 row MUST be hidden (not rendered, so not focusable and not in the accessibility tree) while Loop 1 stays visible, and the Loop 2 value MUST be kept and shown again when the section is turned on.
- **FR-004**: When the section is on, a run MUST go: Initial Count In, Loop 1 for # of Beats beats, Repeat Count In, Loop 2 for # of Beats beats, Repeat Count In, back to Loop 1, and so on until Pause or Reset.
- **FR-005**: When the section is off, a run MUST repeat only Loop 1 with no repeat count-in, and Loop 1 MUST continue back to back at each repeat.
- **FR-006**: The Repeat Count In MUST play only if Count In is on, Repeat Count In is greater than 0 and the section is on. It consists of that many accented clicks one beat apart at the running BPM, with no subdivision clicks, using the same single pulsing dot as the initial count-in. When it does not play, loops MUST switch back to back.
- **FR-007**: The status line MUST read `COUNT IN n/r` during a repeat count-in (n from 1 to r, the same word and translations as the initial count-in), and `BEAT n/N · SUB s` during a loop, where `SUB` MUST always show the clicks-per-beat of the loop currently playing. Updates MUST happen when each click's audio time is reached, in step with the audio.
- **FR-008**: Switches MUST have no gap and no overlap: the first click of the next phase MUST fall exactly one beat after the last click of the previous phase. Every click MUST be within 2 ms of its ideal time on the audio clock, with no accumulated drift over any number of cycles.
- **FR-009**: Pause MUST cancel every click not yet sounded and freeze the display and status on the last click that sounded. Resume MUST continue with the next click in the cycle within 50 ms, keeping the exact position: the loop (1 or 2), the beat within it, and whether a count-in was in progress, and its click number. Resume MUST NOT replay an initial or repeat count-in already finished.
- **FR-010**: Reset MUST return to the settings view with all settings unchanged. Starting again MUST begin at the initial count-in (if enabled) and Loop 1.
- **FR-011**: The new settings (section on/off, Loop 2) MUST be changeable only in the settings view, and be fully operable by keyboard with the app's standard focus ring. The switch and dropdown targets MUST be at least 24 × 24 CSS px.
- **FR-012**: The run settings MUST include `ratio: boolean` (default true; a non-boolean gives true) and `loop2: Subdivision` (default 6, Sextuplets), validated with `toSubdivision` like Loop 1, so that an unknown value falls back to 6. The existing `subdivision` field remains Loop 1. They are not persisted across reloads in this feature.
- **FR-013**: The live-region announcements MUST mention the second loop where relevant: Start MUST announce the alternation (for example "Started, 85 BPM, 4 beats, 8th Triplets then Sextuplets, count in 4"), and Pause MUST announce the frozen position (for example "Paused on beat 3 of 4, Sextuplets"). Individual clicks and loop switches MUST NOT each be announced. All new texts MUST be available in English, Portuguese and Spanish.
- **FR-014**: The new controls MUST follow the app's themes, including high contrast and forced colours, using only design tokens for colour, and MUST not be cut off from 320 to 2560 CSS px wide. The section header uses small caps in the style of the other section headers.
- **FR-015**: Existing behaviour MUST be unchanged: BPM, # of Beats, Count In and Loop 1 ranges and defaults, beat and subdivision click timing, background and hidden-page behaviour, mute, Space and Esc shortcuts, and the initial count-in, apart from the alternation and repeat count-in added by this feature.

### Key Entities

- **Ratio settings**: Whether the Subdivision Ratio section is on (default on), the Loop 1 subdivision (default 8th Triplets) and the Loop 2 subdivision (default Sextuplets). They are part of the run settings, with BPM, # of Beats and the Count In values.
- **Cycle position**: Where the run is in the cycle: initial count-in, repeat count-in, or a loop (1 or 2), with the beat or click number within it. It is what Pause freezes and Resume continues from.
- **Repeat count-in**: A run of Repeat Count In accented clicks inserted at each switch of loop.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With 85 BPM, 4 beats, Count In 4/2, Loop 1 8th Triplets and Loop 2 Sextuplets, a user hears 4 clicks, 4 beats × 3, 2 clicks, 4 beats × 6, 2 clicks, 4 beats × 3, and the status line shows the expected `COUNT IN` and `BEAT · SUB` text in step with the audio, in 100% of runs over at least 5 full cycles.
- **SC-002**: The gap between the last click of one phase and the first click of the next equals one beat (60 / BPM) within 2 ms at any BPM from 30 to 300, with no drift after at least 100 cycles.
- **SC-003**: With the section off, Loop 1 repeats and no repeat count-in sounds in 100% of runs.
- **SC-004**: After pausing on `BEAT 3/4 · SUB 6` and resuming, the next click is beat 4 of Loop 2 in 100% of runs, and the same holds for a pause during a repeat count-in (the next click is the next count-in click).
- **SC-005**: A user can choose two ratios and start an alternating run in under 15 seconds from opening the tool, by keyboard or pointer.
- **SC-006**: The section header, switch, both dropdowns and the status line remain fully visible and usable at every width from 320 to 2560 CSS px in every theme, with no accessibility violations on the settings or running view.

## Assumptions

- This builds on the Metronome tool and click engine (031), Subdivisions (032) and Count In (033), and applies to the Ratios Training view.
- Both loops use the same # of Beats and the same BPM; per-loop tempos and beat counts are out of scope.
- The first click of each loop's beat 1 is accented, as in 032; count-in clicks are all accented, as in 033.
- Settings are not remembered across reloads in this feature (008-ratios-training/005 adds that) and reset to defaults on reopening.
- When the section is off, the Loop 2 row is hidden, following the Count In precedent (see Clarifications).
- The dot row length follows # of Beats in both loops, so it does not change at a switch; at the start of each loop the row restarts with beat 1 lit and later dots grey.
