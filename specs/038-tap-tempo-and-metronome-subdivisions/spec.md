# Feature Specification: Tap Tempo and Metronome Subdivisions

**Feature Branch**: `feature/038-tap-tempo-and-metronome-subdivisions`

**Created**: 2026-11-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/009-more-modes/003-tap-tempo-and-metronome-subdivisions.md (id 003, tap-tempo-and-metronome-subdivisions)."

## Clarifications

### Session 2026-11-01 (specify)

- Q: The source says "confirm before building, or drop this file". Do we build? → A (default; the task is to implement it, and both features are cheap, optional and isolated to the plain Metronome mode): build both, as optional extras that change nothing for users who ignore them (FR-014).
- Q: Which modes get these features? → A (source scope boundary): only the plain **Metronome** mode. Ratios Training and Speed Training get neither tap tempo nor the new selector; Ratios Training keeps its own Loop 1 / Loop 2 subdivision settings unchanged (FR-013).
- Q: What counts as "the recent taps" and how is the tempo computed? → A (derived from the acceptance cases): a measurement is a run of taps in which each gap to the previous tap is at most 2 seconds. From the fourth tap on, BPM is 60 000 ms divided by the average gap between consecutive taps in the run, rounded to a whole BPM and limited to 30–300. Only the most recent 8 taps of a run are averaged, so a drifting tempo is followed (FR-002, FR-003).
- Q: What happens on taps one to three? → A (derived from "three taps only, BPM does not change"): nothing changes; BPM stays as it was. Taps four and later each update BPM (FR-002).
- Q: What does a gap of exactly 2 seconds do? → A (default, source says "more than two seconds"): a gap of exactly 2.000 s continues the measurement; only a longer gap starts a new one, whose first tap is tap one of the new run (FR-004).
- Q: What does faster than 300 BPM, or slower than 30 BPM, give? → A (derived from the acceptance case): the result is clamped to 300 or 30. Because gaps over 2 s start a new run, the slowest reachable tap result is 30 BPM (2 s gaps) (FR-003).
- Q: What is the tap target and how is it reached from the keyboard? → A (default, the readout is today's non-interactive text): the BPM readout becomes a real button named "Tap tempo" (visible label stays the BPM value) so it works with mouse, touch, Enter and Space; in addition a global key `T` taps (tap-style keys must be pressable without moving focus). `T` is listed in the shortcut list only for the plain Metronome mode, and is ignored in other modes, while typing in a field, and with modifier keys held (FR-001, FR-005). *(Name, shortcut-list placement and `T` key rules refined in the clarify session below.)*
- Q: Does the key conflict with Space (Start/Pause)? → A (derived, existing rule that Space on a focused button activates the button, not Start/Pause): when the readout button has focus, Space/Enter tap; the global Start/Pause rule is unchanged elsewhere (FR-005).
- Q: Where is tap tempo available? → A (source): in the settings view, while running, and while paused. In the settings view it sets the BPM value that the BPM row also shows. During the count-in it also works and the new tempo applies as described below (FR-006).
- Q: When does a tapped tempo take effect while running? → A (source: "at the next beat without restarting the loop"): the loop keeps its position (beat number, dots, count-in progress); the interval of the next beat not yet scheduled uses the new tempo. Nothing restarts, no extra or missing click occurs, and the beat already sounding is not shortened. While paused, the value is stored and used on Resume (FR-007).
- Q: Where does the subdivision selector go and what are its choices? → A (default, matches other settings rows): a row in the plain Metronome settings view, after # of Beats, with four exclusive choices: Quarter (default), 8ths, Triplets, 16ths. Quarter = 1 click per beat, 8ths = 2, Triplets = 3, 16ths = 4. It uses the same choice-control pattern and labels as Ratios Training's subdivision choices where they exist (FR-008).
- Q: How do soft clicks sound and where do they fall? → A (source): the soft clicks use the same soft sound as Ratios Training's in-between clicks; they are evenly spaced between beats (beat interval divided by clicks per beat), beat 1 keeps the accent and beats 2…N the regular click. Soft clicks never carry a beat number or dot of their own. Count-in clicks are always one per beat, with no soft clicks (FR-009).
- Q: What does the status line show? → A (source): `BEAT n/N · SUB k` where k is the clicks per beat (2, 3 or 4) whenever the choice is not Quarter; with Quarter nothing is added (as today). The count-in status `COUNT IN n/M` is unchanged. Triplets at 90 BPM: each beat gives one beat click and two soft clicks, status `BEAT n/4 · SUB 3` (FR-010).
- Q: Can the subdivision change while running? → A (default, mirrors # of Beats, which is only edited in the settings view): no, the selector is in the settings view only; Reset returns to it. Tap tempo is the only live change (FR-008).
- Q: How are the values remembered? → A (source: "remembered with the other Metronome-mode settings"; extends the 036 `plain` record, format version stays 1): the `plain` entry gains an optional `subdivision` field (`1`, `2`, `3` or `4` clicks per beat) after its existing fields, written only as part of `plain` when `plain` is non-default, and counted as non-default when it is not 1. Tapped BPM is stored like any BPM change. On read, an invalid or missing `subdivision` gives Quarter without affecting other fields; an old record reads as before. Erase preferences clears it with the rest (FR-011).
- Q: Does the privacy text, share links or measurement change? → A (default, as 036/037): no. These are metronome settings, already covered by the existing text; no share-link field, no new measurement event (FR-012).
- Q: What is announced to screen readers? → A (default, polite, no per-tap noise): each tap that changes BPM updates the visible readout, which is a polite live value (`{bpm} BPM`), announced at most once per change; taps one to three announce nothing. Start's existing plain announcement gains `, {name}` (the subdivision name, for example `8th Triplets`) only when not Quarter (new catalog strings, three languages) (FR-015). *(Live-value mechanism replaced in the clarify session below: the announcement goes to the panel's status region.)*

### Session 2026-11-01 (clarify)

- Q: The settings view has no BPM "readout" today: BPM is a slider plus a −/value/+ pill (`ValueRow`), and only the running/paused view shows a large `{bpm} BPM` (`StatusBox`). What gets tapped? → A (default, derived from the code; the nearest thing to a readout in each view): in the settings view the value in the middle of the BPM pill (between − and +) becomes the tap button; in the running and paused views the large `{bpm} BPM` tempo becomes the tap button. Both run the same tap logic. Only the plain Metronome mode turns them into buttons; Ratios Training and Speed Training keep a non-interactive value (FR-001, FR-013).
- Q: The specify answer gives the button the accessible name "Tap tempo" while its visible text is the BPM number. That fails WCAG 2.2 SC 2.5.3 (Label in Name, level A, required by the constitution's AA target). What name does it get? → A (default, the WCAG convention that the accessible name starts with the visible text): the accessible name is `{bpm} BPM, tap tempo` (new catalog string, three languages), and its `title` tooltip is "Tap tempo". The visible text stays the BPM value (FR-001).
- Q: How is a tapped change announced, given that a button's changing name is not reliably announced? → A (default, reuses the panel's existing polite status region and avoids a second live region): a tap that changes BPM puts `{bpm} BPM` into the panel's existing polite status region. A tap that leaves BPM unchanged (taps 1–3, or the same value as before) announces nothing. The pill value keeps `aria-live="off"`. This replaces "the readout is a polite live value" (FR-015).
- Q: Does `T` obey the existing keyboard-shortcuts on/off preference (027)? → A (default; WCAG 2.1.4 Character Key Shortcuts requires that single-character shortcuts can be turned off, and 027's switch exists for this): yes. With shortcuts off, `T` does nothing, while pointer taps and Enter/Space on the focused tap button still work. `T` matches the typed character (`t` or `T`, Shift allowed), like the 027 matcher. Auto-repeat (key held down) is ignored. The key is also ignored while a sound or language menu is open, in a text field or select, and with Ctrl, Meta, Alt or AltGraph held. This amends 031 FR-023 ("the Metronome has no character-key shortcuts") for the plain mode only (FR-005).
- Q: The shortcut list is on the About page, which knows no metronome mode. Where is `T` listed? → A (default): the About shortcut list gains one row, key `T`, action "Tap tempo (Metronome mode)" (new catalog string, three languages). The `T` key works only on the Metronome page in the plain mode (FR-005).
- Q: The scheduler looks ahead, so the next beat may already be scheduled when a tap lands. What does "takes effect at the next beat" mean exactly? → A (default, derived from "without restarting the loop"): the new tempo applies from the first beat whose start is not yet scheduled when the tap lands. That is the next beat, or at most the one after it when the next beat is already in the look-ahead window. Soft clicks inside a beat keep the spacing of that beat's tempo. The grid is not shifted to line up with the taps, so a tap changes the tempo only, never the phase. The beat number, dots and count-in progress continue (FR-007, SC-003).
- Q: Which control, names and labels does the Subdivision row use? → A (derived from the existing Ratios Training control, 032): the same drop-down control and option labels as Ratios Training's Loop 1, limited to the first four choices: "Quarter notes (1)", "8th notes (2)", "8th Triplets (3)", "16th notes (4)" (existing `metronome_subdivision_option` / `metronome_subdivision_1…4` strings, in all three languages). The source's "Quarter, 8ths, Triplets, 16ths" are these four. Only the row label "Subdivision" is a new string. The status suffix reuses the existing `SUB {count}` string and the separator (FR-008, FR-010, FR-015).
- Q: Do taps 1–3 give any feedback? → A (default): only the button's normal pressed and focus styles; no counter or hint (simplest; meets the constitution's "no overlay tutorials" rule) (FR-002).
- Q: Does a tap persist immediately? → A (default, as any BPM change in 035/036): each tap that changes BPM commits the plain BPM and is remembered through the existing preference write path, including while running (FR-011).
- Q: Does the source's open question ("confirm before building, or drop this file") need a human? → A (default): no. Queuing this feature for implementation is the confirmation. Both features are opt-in, limited to one mode, and leave behaviour unchanged when unused (FR-014), so building them is cheap to reverse.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tap the tempo of a song (Priority: P1)

A player hears a tempo in a song or lesson. Instead of guessing a number, they tap the BPM readout along with the music and the metronome adopts that tempo.

**Why this priority**: It is the faster way to set a tempo and the core of the request.

**Independent Test**: In plain Metronome mode, tap the readout four times 0.5 s apart and read the BPM; repeat with three taps, with very fast taps, and with a pause between taps.

**Acceptance Scenarios**:

1. **Given** plain Metronome at 85 BPM, **When** the user taps the readout four times, 0.5 s apart, **Then** BPM becomes 120.
2. **Given** plain Metronome at 85 BPM, **When** the user taps only three times, **Then** BPM stays 85.
3. **Given** plain Metronome, **When** the user taps four times with gaps faster than 300 BPM (for example 0.1 s), **Then** BPM becomes 300.
4. **Given** the user tapped twice, **When** more than 2 seconds pass before the next tap, **Then** that tap starts a new measurement and BPM does not change until four taps of the new run.
5. **Given** a run of five taps, **Then** the fifth tap updates BPM again using the recent gaps.
6. **Given** the plain Metronome is running at 100 BPM, **When** the user taps a new tempo, **Then** the loop continues without restarting and the new tempo applies from the next beat.
7. **Given** focus is not in a text field, **When** the user presses `T` four times 0.5 s apart, **Then** the result equals tapping the readout.

---

### User Story 2 - Subdivide the click (Priority: P2)

A player wants to hear 8ths, triplets or 16ths between the beats, to feel the grid while playing.

**Why this priority**: Useful on its own, independent of tapping.

**Independent Test**: Pick Triplets at 90 BPM, press Start, and listen and watch the status line.

**Acceptance Scenarios**:

1. **Given** plain Metronome at 90 BPM with Triplets, **When** it runs, **Then** each beat sounds one beat click followed by two evenly spaced soft clicks, and the status reads `BEAT n/4 · SUB 3`.
2. **Given** 8ths or 16ths, **Then** each beat has one beat click plus 1 or 3 soft clicks, and the status adds `· SUB 2` or `· SUB 4`.
3. **Given** Quarter (default), **Then** the sound and status line are exactly as before, with no `· SUB`.
4. **Given** a count-in plays, **Then** its clicks are one per beat, with no soft clicks.
5. **Given** the user chose Triplets and reloads the page, **Then** plain Metronome shows Triplets again, and Ratios Training settings are unaffected.

---

### Edge Cases

- Taps while the Start/Pause state changes or while a count-in plays: they still count, and tempo applies to the next un-scheduled interval.
- Tapped result between taps is non-integer: rounded to the nearest whole BPM (half rounds up).
- Switching tabs or Reset ends the current tap measurement; a measurement never carries across modes.
- Highest rate: 16ths at 300 BPM means 20 clicks per second; timing stays accurate.
- Holding `T` down: auto-repeat events are ignored; only real presses count.
- Shortcuts switched off in About: `T` does nothing; the tap button still works.
- Two taps from a double-activating device within a few milliseconds: processed as written; the result is clamped.
- A stored record with an unknown `subdivision` value reads as Quarter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In plain Metronome mode, the BPM value MUST be a button the user can tap with pointer, touch, Enter or Space: the value in the BPM pill in the settings view, and the large `{bpm} BPM` tempo in the running and paused views. Its visible text MUST show the BPM, its accessible name MUST be `{bpm} BPM, tap tempo` (beginning with the visible text, per WCAG 2.5.3), and its tooltip MUST be "Tap tempo".
- **FR-002**: Taps one to three of a measurement MUST NOT change BPM; from the fourth tap on, each tap MUST set BPM to 60 000 ms divided by the average gap of the recent taps in the run, rounded to a whole BPM.
- **FR-003**: The tapped BPM MUST be limited to 30–300; only the most recent 8 taps of a run are averaged.
- **FR-004**: A gap of more than 2 seconds since the previous tap MUST start a new measurement (that tap is tap one); a gap of exactly 2 seconds continues it.
- **FR-005**: The key `T` (`t` or `T`) MUST tap on the Metronome page in plain mode. It MUST be ignored when keyboard shortcuts are turned off (027), on auto-repeat, when a text field or select has focus, when Ctrl, Meta, Alt or AltGraph is held, while an app-bar menu is open, and in other modes. The About shortcut list MUST show a `T` row "Tap tempo (Metronome mode)".
- **FR-006**: Tap tempo MUST work in the settings view, while running (including during a count-in) and while paused.
- **FR-007**: While running, a tapped tempo MUST take effect from the first beat whose start is not yet scheduled (the next beat, or the one after it when the next is already scheduled). The loop MUST NOT restart, lose its position, add or drop a click, or shift its phase to match the taps. Soft clicks within a beat keep that beat's spacing. While paused, the new tempo MUST apply on Resume.
- **FR-008**: The plain Metronome settings view MUST offer a "Subdivision" drop-down after # of Beats, using the Ratios Training subdivision control and option labels limited to "Quarter notes (1)" (default), "8th notes (2)", "8th Triplets (3)" and "16th notes (4)". It is not offered while running or paused.
- **FR-009**: With a subdivision, each beat MUST sound its normal click (accented on beat 1) followed by 1, 2 or 3 soft clicks at even spacing, using the soft sound of Ratios Training; count-in clicks MUST remain one per beat.
- **FR-010**: The running status MUST read `BEAT n/N · SUB k` (k = 2, 3, 4 clicks per beat) when not Quarter, and be unchanged for Quarter and during the count-in.
- **FR-011**: The subdivision MUST persist with the plain Metronome settings under the existing remembered-settings rules (format version unchanged; invalid values read as Quarter; old records read as before; Erase preferences clears it); the tapped BPM persists like any BPM change.
- **FR-012**: No share-link field, anonymous-measurement event or privacy-text change is added.
- **FR-013**: Ratios Training and Speed Training MUST NOT gain tap tempo or the new selector, and their behaviour and stored values MUST be unchanged.
- **FR-014**: With Quarter selected and no tapping, plain Metronome behaviour MUST be identical to before.
- **FR-015**: New text MUST exist in all three supported languages: the "Subdivision" row label, the tap button name and tooltip, the Start announcement addition, and the About `T` entry. Subdivision names and `SUB {count}` reuse the existing strings. Each tap that changes BPM MUST put `{bpm} BPM` into the panel's existing polite status region, once per change. A tap that leaves BPM unchanged announces nothing.
- **FR-016**: Both controls MUST be keyboard operable, meet WCAG 2.2 AA (touch target, contrast, visible focus), and fit at 320 px width without horizontal scrolling.

### Key Entities

- **Tap measurement**: the timestamps of the current run of taps; resets after a gap over 2 s, on Reset, and on tab switch.
- **Subdivision**: the clicks per beat (1–4) chosen for the plain Metronome, stored with its other settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Four taps 0.5 s apart give exactly 120 BPM; three taps leave BPM unchanged; taps faster than 300 BPM give 300 — in 100% of checked cases.
- **SC-002**: A user can set a tempo from a song by tapping in under 5 seconds for a 120 BPM song (four taps).
- **SC-003**: While running, tapping a new tempo never interrupts the click: no beat is missed or doubled across the change, and the new tempo is heard no later than the second beat after the tap (the first beat not yet scheduled).
- **SC-004**: With Triplets at 90 BPM every beat contains exactly 3 clicks spaced within 10 ms of an even third of the beat, and the status reads `BEAT n/4 · SUB 3`.
- **SC-005**: Chosen subdivision and tapped BPM are restored after a reload in 100% of cases, and Ratios Training and Speed Training look and sound exactly as before.
- **SC-006**: Both controls are usable by keyboard alone and fit at 320 px with no horizontal scrolling in all three languages.

## Assumptions

- The plain Metronome (036), remembered settings (035), the soft click and subdivision choice labels (Ratios Training, 008/002) already exist and are reused.
- The earlier open question about whether the original product has these features is resolved by building them as optional extras.
- Phone use is not blocked but desktop is the target.
- Tap timing uses the time of the user action; input latency is not compensated.
