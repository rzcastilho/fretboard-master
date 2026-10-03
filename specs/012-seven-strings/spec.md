# Feature Specification: Seven-String Guitars

**Feature Branch**: `feature/012-seven-strings`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/003-your-instrument/004-seven-strings.md (id 004, seven-strings)." Source sections: FR-2.3, FR-2.4 (AF-21 to AF-23), FR-2.5, FR-2.10, FR-5.5, NFR-1.6, EC-2.3, TM-2, TM-5, design §6 (fretboard in detail), UJ-5 alternate paths 3b and 4a.

## Clarifications

### Session 2026-10-03

Each answer derives from a cited source or is an assumed default (marked **Default**, with rationale). No material question remains open.

- Q: What happens to the strings when the count changes? → A: FR-2.3: 6 → 7 adds string 7 a perfect fourth (5 semitones) below the current string 6 and leaves strings 1–6 exactly as they were. 7 → 6 removes string 7 and keeps strings 1–6. From 6-string standard, string 7 is B1.
- Q: Which presets show for each count? → A: FR-2.4 and TM-2. With 6 strings: AF-1 … AF-11 (unchanged). With 7 strings: AF-21 7-string standard (B1 E2 A2 D3 G3 B3 E4), AF-22 7-string half step down (B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4), AF-23 Drop A (A1 E2 A2 D3 G3 B3 E4), and the 6-string presets. A 6-string preset on 7 strings puts string 7 a perfect fourth below that preset's string 6 (so Drop D on 7 strings is A1 D2 A2 D3 G3 B3 E4).
- Q: AF-1 and AF-2 on 7 strings have exactly the pitches of AF-21 and AF-22. Are they listed twice? → A: **Default** (pitch equality decides the name, FR-2.5; a list with two rows that select the same pitches and show the same name is a convention violation): no. With 7 strings the list is, in this order: AF-21, AF-22, AF-23, AF-3, AF-4, AF-5, AF-6, AF-7, AF-8, AF-9, AF-10, AF-11 (12 rows). AF-1 and AF-2 are reached on 7 strings as AF-21 and AF-22, so every 6-string tuning stays available (brief: "All 6-string presets stay available"). When matching pitches to a name on 7 strings, AF-21/AF-22 win over AF-1/AF-2.
- Q: How is string 7 spelled in a 6-string preset used on 7 strings? → A: **Default** (TM-4 letter rule applied to the perfect fourth): the letter four below string 6's letter, with the accidental that makes an exact perfect fourth. For AF-3 … AF-11 this gives naturals only: string 6 D2 → A1, C2 → G1, E2 → B1. The other six strings keep the preset's own spelling (TM-2).
- Q: What happens to the chosen tuning when the count changes? → A: **Default** (follows FR-2.3 "keeps the other six as they were" and UJ-5 3b "the previous 6-string tuning is kept on the six higher strings"): the pending tuning's six existing strings are kept. When the result equals a preset's pitches for the new count, it takes that name. 6 → 7 from Standard gives 7-string standard; from Half step down gives 7-string half step down; from any of AF-3 … AF-11 gives that same preset (e.g. Drop D → "Drop D", A1 D2 A2 D3 G3 B3 E4). 7 → 6 from AF-21 gives Standard, from AF-22 Half step down, from AF-23 Drop A gives Standard (string 7 removed, strings 1–6 are E2 … E4), from AF-3 … AF-11 the same preset. Only a tuning that matches no preset for its count is named "Custom". String 7 is never remembered within the panel: 7 → 6 → 7 recomputes it a fourth below string 6.
- Q: What does custom tuning cover on 7 strings? → A: FR-2.5 applied to string 7: the same −7/+4 semitone range around that string's standard pitch (B1), i.e. limits **E1 to D♯2**, with the same disabled-at-limit controls, note/octave display, and audition as the other strings. A custom tuning that matches a preset (including AF-21, AF-22, AF-23) shows the preset's name. Inverted-order and equal-pitch rules (EC-2.1, EC-2.2) apply to the pair 7/6 like any other pair.
- Q: When is the tuning badge shown? → A: FR-2.10: shown whenever the confirmed tuning is not the standard tuning for the current count: hidden for AF-1 on 6 strings and AF-21 on 7 strings; shown for every other tuning. AF-1 with the seventh string added has the same pitches as AF-21, so it is named 7-string standard and the badge stays hidden.
- Q: Is "7-string standard" the same as "Standard with a seventh string"? → A: Yes. Pitch equality decides the name, as in FR-2.5. Standard + added seventh = AF-21; there is no separate representation.
- Q: What does the fretboard draw for string 7? → A: Design §6: string thickness increases from highest to lowest, the seventh string visibly thicker than the sixth; height large enough that markers on neighboring strings never touch, with 6 or 7 strings. String labels (numbers/open notes) include string 7.
- Q: What does Fretboard Notes do with seven strings? → A: Brief: covers all seven strings, including filters and unisons. Every note shown, filtered (by note, by region), and played for string 7 uses its real pitch; the position card's unison list includes string 7 by the existing unison rule (same pitch; string 7's B1 and string 2's B3 differ by two octaves and so are not unisons).
- Q: What does Triads do? → A: FR-5.5: with 7 strings the set selector offers 7-6-5, 6-5-4, 5-4-3, 4-3-2, 3-2-1; with 6 strings it offers the existing four. Shapes are calculated from the real tuning of the three strings (TM-5). Acceptance (TM-5.5 7-6-5 table, AF-21): C major root position = 13-12-10, E minor root position = 5-3-2 (strings 7-6-5). Sets 6-5-4 … 3-2-1 are unchanged by string 7.
- Q: What happens when switching to 6 strings while Triads shows 7-6-5? → A: EC-2.3 + brief: after the user confirms the panel, Triads moves to the nearest equivalent set, 6-5-4, and shows the message "We adjusted the view to the new instrument". The message uses the existing adjustment-notice behavior (polite announcement, dismissable as existing). No notice appears when the view did not need to change. 6 → 7 never changes the Triads set (the default set for a new view stays 3-2-1).
- Q: What happens to the Fretboard Notes string filter when the count changes? → A: **Default** (the brief requires Notes to cover all seven strings; the existing "never blank; adjust and tell" rule, Principle X, covers the rest): 6 → 7: if all six strings were on, string 7 is added and on; if the user had turned some strings off, string 7 is added off and the filter is otherwise unchanged. No notice. 7 → 6: string 7 is removed from the filter silently; if string 7 was the **only** string on, every string is turned on and the notice "We adjusted the view to the new instrument" shows. A position card open on string 7 closes with the same notice (existing EC-2.3 card rule).
- Q: Are share links, CAGED, and eight strings in scope? → A: No. CAGED on string 7 is 004-caged/001 and 004/004; eight-string guitars are out (Q-9); share links belong to the sharing wave.
- Q: How is the string count stored? → A: Source: stored-preferences contract (specs/010-remembered-preferences/contracts/storage-format.md, "Extension rule"; specs/011-custom-tuning/contracts/storage-format.md). **Default**: a new optional `strings` field with value 6 or 7 (absent or invalid = 6); `version` stays 1, and every record written before this slice loads exactly as before. With `strings: 7`: `tuning` is one of AF-21, AF-22, AF-23, AF-3 … AF-11 (canonical form: never AF-1/AF-2); an unmatched custom tuning is written as `"tuning":"AF-21"` plus `customTuning` with exactly 7 integer offsets in −7 … 4, ordered strings 7 → 1, relative to B1 E2 A2 D3 G3 B3 E4. With 6 strings the 011 rules are unchanged (6 offsets). Inconsistent records fall back per field to the default for the stored count: AF-21/AF-22/AF-23 with 6 strings → AF-1; a `customTuning` whose length is not the stored count → ignored (tuning from `tuning`); AF-1/AF-2 with 7 strings load as AF-21/AF-22. Fixtures for each of these cases are added, never removed.
- Q: What do Restore default and the fret count do? → A: FR-2.11: Restore default sets 6 strings and AF-1. FR-2.8: fret count (12–24) is independent of the string count and keeps its value.
- Q: Does the panel preview change? → A: FR-2.4: yes. The preview always shows the pending string count and tuning, including string 7.
- Q: Any escalation needed? → A: No. Every remaining decision is derived from FR-2.3/2.4/2.5/2.10/5.5, TM-2/TM-5.5, EC-2.3, or is a reversible convention recorded above as **Default**.
- Q: Does sound change? → A: Each string-7 note plays at its calculated pitch (Principle I). Very low pitch on small speakers needs no special handling (EC-7.6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add the seventh string to my instrument (Priority: P1)

A 7-string player opens the instrument panel, picks 7 strings, confirms, and sees and hears the extra low string in every tool, tuned as 7-string standard.

**Why this priority**: Without the string on screen and in the sound, a 7-string player has to mirror 6-string diagrams mentally. Everything else depends on it.

**Independent Test**: Open the panel in the default state, choose 7 strings, confirm, and check the fretboard, the open-string pitch, and the preset list.

**Acceptance Scenarios**:

1. **Given** 6-string standard, **When** the user chooses 7 strings and confirms, **Then** the fretboard shows seven strings, the new string is B1, activating it at fret 0 plays B1, the tuning is named "7-string standard", and no tuning badge appears.
2. **Given** 6-string standard, **When** the user chooses 7 strings, **Then** strings 1–6 keep E4 B3 G3 D3 A2 E2 exactly.
3. **Given** the panel with 7 strings selected, **When** the user opens the tuning list, **Then** it lists, in order, 7-string standard (B1 E2 A2 D3 G3 B3 E4), 7-string half step down (B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4), Drop A (A1 E2 A2 D3 G3 B3 E4), then AF-3 … AF-11, each with its seven notes from lowest to highest (string 7 a fourth below string 6); "Standard" and "Half step down" do not appear as separate rows.
4. **Given** 7 strings selected, **When** the user picks Drop A and confirms, **Then** string 7 shows and plays A1 and the badge reads "Drop A".
5. **Given** 6-string Drop D confirmed, **When** the user chooses 7 strings, **Then** the pending tuning is A1 D2 A2 D3 G3 B3 E4 (string 7 a fourth below D2), named "Drop D", and after confirming the badge reads "Drop D".
6. **Given** 7 strings selected, **When** the user picks a 6-string preset such as Whole step down, **Then** string 7 sits a fourth below that preset's string 6 (Whole step down has string 6 at D2, so string 7 is A1) and the row reads A1 D2 G2 C3 F3 A3 D4.
7. **Given** 7 strings in 7-string standard, **When** the user chooses 6 strings and confirms, **Then** the seventh string is removed, strings 1–6 are unchanged, and the tuning is Standard with no badge.
8. **Given** the panel with unsaved changes to the string count, **When** the user closes it without confirming, **Then** the previous instrument remains (EC-2.7).
9. **Given** 7 strings confirmed, **When** the user reloads the page, **Then** the 7-string instrument is restored.
10. **Given** 7 strings with Custom open, **When** the user lowers string 7 from B1 until its limit, **Then** it stops at E1, the lower control is disabled with no error message, and the raise control stays enabled; at D♯2 the raise control is disabled.
11. **Given** 7 strings with Custom open, **When** the user lowers string 7 from B1 to A1 (others unchanged), **Then** the tuning is named "Drop A"; lowering it further to G♯1 names it "Custom".
12. **Given** 7 strings in Drop A, **When** the user chooses 6 strings and confirms, **Then** the tuning is Standard (E2 A2 D3 G3 B3 E4) with no badge.

---

### User Story 2 - Find notes on all seven strings in Fretboard Notes (Priority: P1)

A player on 7 strings opens Fretboard Notes and sees every occurrence of the chosen notes on all seven strings, with filters and unisons working across them.

**Why this priority**: The brief requires Fretboard Notes to cover all seven strings; a tool that ignores string 7 would silently give wrong answers.

**Independent Test**: With 7-string standard, show all notes in frets 0–5 and check string 7 against the reference sample (TM-9 view 4).

**Acceptance Scenarios**:

1. **Given** 7-string standard, **When** the user shows all notes frets 0–5, **Then** string 7 shows B C C♯ D D♯ E at frets 0–5 and the same notes as string 2 two octaves lower.
2. **Given** a note filter, **When** the user selects a note, **Then** its occurrences on string 7 appear, and activating one plays the string-7 pitch.
3. **Given** a region filter, **When** it is applied, **Then** string 7 is filtered like the other strings.
4. **Given** Drop A, **When** the user opens the position card for string 7 fret 12 (A2), **Then** its unisons list string 6 fret 5 and string 5 fret 0 (both A2), and the card for string 5 fret 0 lists string 7 fret 12 in return.
5. **Given** 6 strings with every string on, **When** the user switches to 7 strings, **Then** string 7 is on in the string filter; **Given** 6 strings with strings 1–3 only, **Then** string 7 is added off and strings 1–3 stay the only ones on. No notice in either case.
6. **Given** 7 strings with only string 7 on in the filter, **When** the user switches to 6 strings, **Then** all six strings are on and "We adjusted the view to the new instrument" shows; with any other filter, string 7 is dropped silently.

---

### User Story 3 - Triads on the set 7-6-5 (Priority: P1)

A player on 7 strings picks the string set 7-6-5 and sees triad shapes calculated from the real tuning.

**Why this priority**: Without 7-6-5, the lowest triads of the instrument cannot be found. The set is part of the acceptance criteria.

**Independent Test**: 7-string standard, Triads, set 7-6-5, C major root position and E minor root position.

**Acceptance Scenarios**:

1. **Given** 7 strings in standard, **When** the user opens the set selector, **Then** it offers 7-6-5, 6-5-4, 5-4-3, 4-3-2, 3-2-1.
2. **Given** 6 strings, **When** the user opens the set selector, **Then** it offers only 6-5-4, 5-4-3, 4-3-2, 3-2-1.
3. **Given** 7-string standard and set 7-6-5, **When** the user picks C major root position, **Then** the fretboard shows frets 13-12-10 on strings 7-6-5.
4. **Given** 7-string standard and set 7-6-5, **When** the user picks E minor root position, **Then** it shows frets 5-3-2 on strings 7-6-5.
5. **Given** set 7-6-5, **When** the user picks any quality, inversion and root, **Then** each shape matches TM-5.5 transposed with the lowest-occurrence rule, and the notes sound at their pitches.
6. **Given** a custom or alternate tuning on 7 strings (for example Drop A), **When** set 7-6-5 is shown, **Then** the shape is calculated from that tuning, never from a standard-tuning diagram; where the triad cannot close, the existing "does not close" guidance appears (EC-5.1).
7. **Given** 7 strings, **When** the user views sets 6-5-4 … 3-2-1, **Then** shapes are identical to a 6-string instrument with the same six higher strings.

---

### User Story 4 - Go back to six strings without a broken view (Priority: P2)

A player on 7 strings with Triads on 7-6-5 switches back to 6 strings and lands on a valid view with an explanation.

**Why this priority**: Prevents a blank or invalid view (EC-2.3), but only matters after the string count is changeable.

**Independent Test**: On 7-6-5, switch to 6 strings, confirm, and read the set and the message.

**Acceptance Scenarios**:

1. **Given** Triads on set 7-6-5, **When** the user switches to 6 strings and confirms, **Then** the set becomes 6-5-4 and the message "We adjusted the view to the new instrument" shows.
2. **Given** Triads on set 6-5-4 (or any other set) with 7 strings, **When** the user switches to 6 strings, **Then** the view does not change and no message appears.
3. **Given** the notice is showing, **When** a screen reader is in use, **Then** the message is announced politely and the new set is described.
4. **Given** a switch from 6 to 7 strings, **When** confirmed, **Then** the current view stays as it was and no message appears.

---

### User Story 5 - A fretboard that stays legible and smooth with seven strings (Priority: P2)

The seventh string looks distinct and everything stays readable and smooth on a small phone.

**Why this priority**: Quality of the experience; the functionality works without it.

**Independent Test**: Render 7 strings × 24 frets on the reference phone profile and scroll/drag.

**Acceptance Scenarios**:

1. **Given** 7 strings, **When** the fretboard is shown, **Then** string 7 is drawn visibly thicker than string 6, thickness increasing from highest to lowest.
2. **Given** markers on neighboring strings at the same fret, **When** shown with 7 strings, **Then** no markers touch or overlap.
3. **Given** 7 strings and 24 frets on the reference phone, **When** the user scrolls or drags, **Then** movement follows the finger without perceptible stutter (NFR-1.6).
4. **Given** 7 strings, **When** the user uses keyboard navigation or a screen reader, **Then** string 7 is reachable and described (Principle V), with touch targets at least 44×44 CSS px in comfortable mode.
5. **Given** left-handed mode or lowest-string-on-top orientation, **When** 7 strings are shown, **Then** string 7 follows the mirroring and orientation rules.

---

### Edge Cases

- Switching to 7 strings while a custom tuning is pending: strings 1–6 are kept and string 7 is a fourth below string 6. The tuning takes a preset name if the pitches match.
- String 7 added below any in-range string 6 (A1–G♯2) lands at E1–D♯2, which is inside string 7's range, so no clamping is ever needed.
- Equal pitches or inverted order involving string 7 (EC-2.1, EC-2.2): allowed; panel note "The strings are not in order from low to high" applies; Triads applies EC-5.1 to sets with string 7.
- Switching to 6 strings while a custom tuning is pending: string 7 is dropped; strings 1–6 keep their pitches.
- A stored preference whose `customTuning` length differs from its string count, or a 7-string preset id with 6 strings: that field falls back as defined in Clarifications (custom ignored; AF-21/22/23 with 6 strings → AF-1).
- Triads on set 7-6-5 with a fret count under 13 (e.g. 12): C major root position (13-12-10) does not fit, so the existing "This shape lies beyond fret 12" guidance appears (beyond-fret rule, TM-5.3 step 5), not the "does not close" message, which is reserved for EC-5.1 tunings.
- 24 frets on a 320 px wide screen with 7 strings: comfortable mode stays default and the minimap stays visible (EC-3.6).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The instrument panel MUST offer a string-count choice of 6 (default) or 7.
- **FR-002**: Changing from 6 to 7 MUST add a seventh string a perfect fourth below string 6 and leave strings 1–6 unchanged; changing from 7 to 6 MUST remove string 7 and leave strings 1–6 unchanged.
- **FR-003**: With 7 strings the tuning list MUST be, in order: 7-string standard (B1 E2 A2 D3 G3 B3 E4), 7-string half step down (B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4), Drop A (A1 E2 A2 D3 G3 B3 E4), AF-3 … AF-11 (AF-1 and AF-2 are represented by AF-21 and AF-22, which have identical pitches); with 6 strings the list MUST remain AF-1 … AF-11.
- **FR-004**: A 6-string preset selected on 7 strings MUST place string 7 a perfect fourth below that preset's string 6, spelled with the letter four below and the accidental giving an exact perfect fourth.
- **FR-005**: Custom tuning MUST cover string 7 with an adjustment range of 7 semitones below to 4 semitones above B1 (E1–D♯2), disabled controls at the limits without an error message, and note/octave display and audition as for other strings.
- **FR-006**: A tuning (preset, custom, or the result of a string-count change) whose pitches equal a preset available for its string count MUST be named after that preset; on 7 strings AF-21/AF-22 take precedence over AF-1/AF-2. Only a tuning matching no preset is "Custom".
- **FR-007**: The tuning badge MUST be hidden for 6-string standard and 7-string standard and shown for every other tuning.
- **FR-008**: The panel preview MUST show the pending string count and tuning.
- **FR-009**: The fretboard MUST draw seven strings with string 7 visibly thicker than string 6 and with enough height that markers on neighboring strings never touch.
- **FR-010**: Fretboard Notes MUST show, filter, list unisons on, and play all seven strings from the real tuning. On 6 → 7, string 7 MUST be on in the string filter iff all six strings were on. On 7 → 6, string 7 MUST be dropped from the filter; if it was the only string on, all strings MUST be turned on with the adjustment notice.
- **FR-011**: Triads MUST offer string set 7-6-5 only with 7 strings, and MUST offer 6-5-4, 5-4-3, 4-3-2, 3-2-1 for both counts.
- **FR-012**: Triad shapes on any set MUST be calculated from the real tuning, string count and fret count; with 7-string standard, C major root position on 7-6-5 MUST be frets 13-12-10 and E minor root position MUST be frets 5-3-2.
- **FR-013**: When the string count changes to 6 while Triads is on 7-6-5, Triads MUST move to 6-5-4 and show "We adjusted the view to the new instrument". No notice MUST appear when the view needs no adjustment.
- **FR-014**: Each string-7 note MUST sound at its calculated pitch; activating string 7 at fret 0 in 7-string standard plays B1; in Drop A it plays A1.
- **FR-015**: Confirming MUST apply the string count and tuning to every tool without reloading and store them on the device; closing without confirming MUST discard the change; Restore default MUST set 6 strings and Standard.
- **FR-016**: Stored preferences MUST restore the string count and its tuning (preset or 7-offset custom tuning); an invalid string count MUST fall back to 6, and a tuning inconsistent with the stored count MUST fall back per field as set in Clarifications, without error. Records written before this slice MUST load unchanged.
- **FR-017**: Scrolling and dragging the fretboard MUST follow the finger without perceptible stutter on the reference phone with 7 strings and 24 frets.
- **FR-018**: String 7 MUST be operable by keyboard, described in the text equivalent of each view (notes read in full, "F sharp"), and honor handedness and orientation.
- **FR-019**: Existing 6-string behavior MUST be unchanged.

### Key Entities

- **Instrument**: string count (6 or 7), tuning, fret count, handedness, orientation.
- **Tuning**: ordered pitches (note and octave) from string 7 or 6 up to string 1; a preset name or "Custom".
- **String**: number (7 = lowest on a 7-string), open pitch, thickness rank.
- **String set**: three adjacent strings identified by the lowest string; 7-6-5 exists only with 7 strings.
- **View adjustment**: change of the current view forced by an instrument change, with its notice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A 7-string player gets a correct 7-string instrument in a single panel confirmation, in under 15 seconds from opening the panel.
- **SC-002**: 100% of the acceptance values hold: switching to 7 strings gives B1 at fret 0, Drop A gives A1, C major on 7-6-5 is 13-12-10, E minor on 7-6-5 is 5-3-2.
- **SC-003**: Every TM-5.5 7-6-5 value (4 qualities × 3 inversions, root C) is reproduced exactly.
- **SC-004**: Switching back to 6 strings from 7-6-5 never leaves a blank or invalid view: 100% of attempts land on 6-5-4 with the adjustment message.
- **SC-005**: With 7 strings and 24 frets, scrolling and dragging on the reference phone show no perceptible stutter in 100% of review sessions, and no markers on neighboring strings touch.
- **SC-006**: No 6-string view, shape, sound or stored preference changes as a result of this feature (all existing tests pass).
- **SC-007**: Two guitar teachers reviewing a sample of 7-string views find zero musical errors (M-4).
- **SC-008**: Zero accessibility violations on every 7-string view.

## Assumptions

- Reference theory: `specs/autonomous/fretboard-master/11-music-theory-reference.md` (TM-2, TM-5); it is the single source of truth.
- The instrument panel, custom tuning, preferences, Fretboard Notes and Triads from prior slices (001–011) exist and are reused.
- The "We adjusted the view to the new instrument" notice reuses the existing adjustment-notice mechanism.
- CAGED behavior on string 7 is out of scope (004-caged/001 and 004/004); eight strings are out (Q-9); share links belong to a later wave.
- The reference phone profile and performance budgets are those fixed by the constitution.
