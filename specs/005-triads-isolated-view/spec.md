# Feature Specification: Triads Isolated View

**Feature Branch**: `feature/005-triads-isolated-view`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/005-triads-isolated-view.md (id 005, triads-isolated-view)." Source sections: Area 5 (FR-5.1–5.8, 5.12–5.15, 5.17 minus the Full neck and All notes behavior), Edge cases Area 5 (EC-5.1, 5.2, 5.6, 5.7, 5.8), TM-4, TM-5, UJ-3, NFR-9.

## Clarifications

### Session 2026-10-01 (clarify reviewer)

No material ambiguity remains; no human escalation needed. Each item is either derived from a source (cited) or an assumed default (marked **Default**), and is reflected in the requirement text below.

- **C1 — Root state model (derived: FR-5.2, FR-5.3, TM-4.3).** The selection stores the root as a pitch class 0–11 plus a spelling override `none | sharp | flat`. The effective root spelling is: the override if set; otherwise the TM-4.3 default for the current quality (altered roots) or the natural letter. Picking a different root clears the override; quality, inversion, string set, label, and octave changes keep it. Re-picking the already-selected root changes nothing.
- **C2 — Root control labels (Default; reuses the Notes tool convention in `NoteSelector`, UJ-3 step 2a).** The twelve root buttons show naturals as one name and altered keys with both spellings ("C♯ / D♭"). The spelling actually in use is shown by the composition panel and the spelling-switch command ("Switch to D♭"), not by the root button.
- **C3 — Which notes get the "sounds as" line (derived: EC-5.6, TM-4.2).** Only notes with a double accidental (𝄪, 𝄫) get an equivalent-sound line. Single-accidental spellings such as E♯, B♯, C♭, F♭ get none. When a triad has two double-accidental notes (e.g. D♯ augmented), the panel shows one line per note, in root–third–fifth order ("F𝄪 sounds as G", "A𝄪 sounds as B"). The equivalent is named with the notation layer's default spelling.
- **C4 — The simpler-spelling suggestion (derived: TM-4.2, TM-4.3).** The suggestion is the other spelling of the same altered root, shown only when the current triad has a double accidental and the other spelling has none. In TM-4.2 this is always the TM-4.3 default (e.g. D♯ major → E♭). Activating it performs the same action as the spelling-switch command. For a natural root with a double accidental (B augmented: B–D♯–F𝄪) no suggestion appears; only the sounds-as line does. Because double accidentals only appear in non-default altered spellings (and B augmented), reaching D♯ major means picking the D♯/E♭ root and switching to D♯.
- **C5 — Fretboard note-name labels use the triad spelling (derived: Constitution I and VIII).** With note-name labels on, markers show the triad's own spelling (F𝄪, not G), produced by `src/lib/notation`. Spoken text reads accidentals in full ("F double sharp").
- **C6 — Meaning of [n] in "This shape lies beyond fret [n]" (Default; plain reading of EC-5.2 "exists only above the last fret").** n is the instrument's fret count (the last fret on the fretboard), not the highest fret the shape would need. Example: with 12 frets, C diminished root position on 5-4-3 (lowest occurrence 15-13-11) shows "This shape lies beyond fret 12".
- **C7 — Reachability in the MVP (derived: shipped `STANDARD_GUITAR`, 6 strings, 22 frets, standard tuning; computed over all 12 roots × 4 qualities × 3 inversions × 4 sets).** In the shipped configuration the highest lowest-occurrence fret is 15, the largest span is 4, and every shape has 1 or 2 occurrences. So the wide-stretch mark, the beyond-fret guidance, and the does-not-close guidance never appear in the shipped UI. They MUST still be implemented and are verified by tests that inject an instrument: Drop D (TM-5.7, C major root position on 6-5-4 = 10-7-5, span 5 → mark) for wide stretch; a 12-fret standard guitar for beyond-fret (40 of 576 combinations exceed fret 12); a tuning with unison or descending adjacent strings for does-not-close.
- **C8 — "Look for the shape an octave lower" (derived: TM-5.3).** TM-5.3 already picks the lowest occurrence with no negative fret, so a lower octave never exists for the Isolated view. The beyond-fret guidance shows exactly when the lowest occurrence's highest fret exceeds the fret count. No extra search is implemented.
- **C9 — Octave commands (derived: FR-5.8, TM-5.3).** Occurrences are the lowest occurrence plus k×12 frets for every k whose highest fret ≤ fret count. The view state stores the occurrence index (0 = lowest). **Octave up** / **Octave down** move by one index and are disabled (`aria-disabled`, not hidden, no error styling) at the ends. When there are no occurrences (beyond-fret or does-not-close), both are disabled. Spelling and label changes keep the index (same pitches). Root, quality, inversion, and string set changes reset it to 0 (FR-018).
- **C10 — Listen timing (Default; reuses slice 003/004 playback).** **Listen** sends one `sequence` request at the Notes tool's tempo (`LISTEN_BPM` = 120): steps = low string, middle string, high string, then all three as one chord step. A new **Listen** restarts playback from the beginning. While playback runs, the sounding positions pulse, also when muted (slice 003 behavior). Changes listed in FR-028 call the playback stop.
- **C11 — "Another set" action (Default; constitution X "adopt the nearest equivalent and tell").** **Another set** selects the nearest string set that closes for the current selection: first the set one step toward the treble, then one step toward the bass, then further out in the same alternating order. If no set closes, the action is not shown and only the guidance appears. The selected set is announced in the usual polite description.
- **C12 — View control (derived: Assumptions, breakdown scope boundary).** This slice shows no view selector (Isolated is the only view). The Isolated name appears nowhere as a control. The octave commands, label switch, and **Listen** are the secondary controls (design spec, Triads row).
- **C13 — Composition panel contents (derived: FR-5.7, UJ-3 step 5).** The name uses the effective root spelling and the inversion name: "Root position", "1st inversion", "2nd inversion" (e.g. "A♭ major — Root position"). The low-to-high line lists the note name and function for each string from low to high (e.g. "C♯ (third) – E (fifth) – A (root)"), so the bass function is stated explicitly. The panel shows the triad even when the fretboard shows guidance (beyond-fret or does-not-close), because the spelling does not depend on the shape.
- **C14 — Guidance presentation (Default; Constitution VII and X "never blank").** Beyond-fret and does-not-close guidance are the fretboard's empty state, not a transient notice: shown over the empty fretboard area (never covering controls), at most two lines, no error red, no modal, and not dismissible, because dismissing would leave a blank fretboard. They are also included in the polite text description. They disappear as soon as a selection with a shape is made.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what a chord is made of (Priority: P1)

A guitarist who plays chords from memorized shapes opens the Triads tool. It shows C major, root position, strings 3-2-1, in the Isolated view with interval labels. They see which three notes carry the harmony and where the root, third, and fifth sit, and a composition panel tells them the name, the notes, and the intervals.

**Why this priority**: It is the whole reason the tool exists, and every other story builds on this default view.

**Independent Test**: Open the tool with no input and check the fretboard and the composition panel against the reference tables.

**Acceptance Scenarios**:

1. **Given** the tool has just opened, **When** the user looks at the fretboard, **Then** it shows frets 5-5-3 on strings 3-2-1 (C, E, G), with the root, third, and fifth markers and the labels R, 3, 5.
2. **Given** the tool has just opened, **When** the user reads the composition panel, **Then** it shows "C major — Root position", the notes C, E, G in root–third–fifth order with their markers, the intervals R – 3 – 5, the stacking "major third + minor third", and the low-to-high order root, third, fifth.
3. **Given** the default view, **When** the user switches the label type to note names, **Then** the markers read C, E, G; switching back restores interval labels.
4. **Given** any selection of root, quality, inversion, and string set, **When** the shape is shown, **Then** it has one note per string on three adjacent strings, rising in pitch, within one octave.

---

### User Story 2 - Choose root, quality, inversion, and string set (Priority: P1)

The user changes any of the four main controls — root (twelve notes), quality (major, minor, diminished, augmented), inversion (root position, 1st, 2nd), and string set (6-5-4, 5-4-3, 4-3-2, 3-2-1). All controls stay visible, and the fretboard and the panel update together.

**Why this priority**: Without it the tool shows one chord. It is the core interaction and the main source of musical-correctness risk.

**Independent Test**: Pick each combination and compare the displayed frets and notes with the reference tables.

**Acceptance Scenarios**:

1. **Given** the default state, **When** the user picks root A, 1st inversion, set 4-3-2, **Then** the fretboard shows string 4 fret 11 C♯ (third), string 3 fret 9 E (fifth), and string 2 fret 10 A (root), and the panel names it "A major — 1st inversion".
2. **Given** root C, **When** the user steps through every quality, inversion, and string set, **Then** every shape equals the standard-tuning reference table for root C (lowest occurrence).
3. **Given** any root and quality, **When** the panel shows the notes, **Then** their spelling equals the reference spelling table (alternate letters, correct accidentals, including double sharps and flats).
4. **Given** the user changes any control, **When** the new shape is shown, **Then** only the controls changed by the user differ from before, and the other three selections are kept.

---

### User Story 3 - Correct spelling of altered roots (Priority: P1)

For roots that have two spellings (C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭), the tool uses the spelling with fewer accidentals for the chosen quality (A♭ major, G♯ minor, F♯ major) and offers a command to switch spelling. When theory needs a double sharp or flat, the tool shows it and explains it.

**Why this priority**: A single wrong enharmonic undermines trust in the product (NFR-9). It is a release gate for the theory code.

**Independent Test**: For all 12 roots × 4 qualities, check the default spelling and the switched spelling against the reference tables.

**Acceptance Scenarios**:

1. **Given** the D♯ / E♭ root is picked with major quality and the user switches the spelling to D♯ (the default is E♭, TM-4.3), **When** the panel shows the notes, **Then** it shows D♯–F𝄪–A♯, adds the line "F𝄪 sounds as G", and suggests E♭ as the simpler spelling of the root.
2. **Given** the user accepts the suggestion or uses the spelling-switch command, **When** the spelling changes to E♭, **Then** the notes become E♭–G–B♭, the shape does not move (same pitches), and the user's choice holds until the root changes.
3. **Given** a root with two spellings and the quality changes, **When** the user has not chosen a spelling, **Then** the default for the new quality is used (for example, C♯ minor but D♭ major).
4. **Given** C augmented, **When** the notes are shown, **Then** they read C–E–G♯, never C–E–A♭.
5. **Given** a root with only one spelling, **When** the user looks for the switch command, **Then** it is not offered.
6. **Given** D♯ augmented (D♯–F𝄪–A𝄪), **When** the panel is shown, **Then** it shows two lines, "F𝄪 sounds as G" and "A𝄪 sounds as B", and suggests E♭.
7. **Given** B augmented, **When** the panel is shown, **Then** it shows B–D♯–F𝄪 and "F𝄪 sounds as G", with no spelling suggestion and no switch command.
8. **Given** A augmented (A–C♯–E♯), **When** the panel is shown, **Then** no sounds-as line appears (single accidentals only, C3).
9. **Given** note-name labels and D♯ major, **When** the fretboard is shown, **Then** the third's marker reads F𝄪, not G.

---

### User Story 4 - Move the shape between octaves (Priority: P2)

The Isolated view shows the lowest occurrence that fits on the fretboard. When the same shape also fits an octave higher, the **Octave up** and **Octave down** commands move between the occurrences.

**Why this priority**: It lets players explore the same shape higher up the neck, but the default view is useful without it.

**Independent Test**: Choose a shape with two occurrences, use both commands, and check the frets and the disabled states at the ends.

**Acceptance Scenarios**:

1. **Given** a shape that fits at two octaves, **When** the user picks **Octave up**, **Then** every fret is 12 higher, the notes stay the same, and **Octave down** becomes available.
2. **Given** the lowest occurrence is shown, **When** the user looks at the commands, **Then** **Octave down** is unavailable. At the highest occurrence **Octave up** is unavailable. Neither is shown as an error.
3. **Given** a shape that fits only once, **When** the user looks at the commands, **Then** both are unavailable.
4. **Given** the user changes root, quality, inversion, or string set, **When** the new shape is shown, **Then** it starts at its lowest occurrence.

---

### User Story 5 - Know how hard a shape is to play (Priority: P2)

Shapes that span five or more fretted frets get a "wide stretch" mark and are never hidden. Open strings are displayed normally and do not count toward the span.

**Why this priority**: It sets realistic expectations without removing shapes. It is smaller than the core selection flow.

**Independent Test**: Compare the span and the mark for every shape in the reference table.

**Acceptance Scenarios**:

1. **Given** a shape whose highest and lowest fretted frets differ by 5 or more (in standard tuning no shape does, C7; tested with an injected Drop D instrument, where C major root position on 6-5-4 is 10-7-5, span 5), **When** it is shown, **Then** it carries the "wide stretch" mark and is still fully visible.
2. **Given** a shape with a span of 4 or less (every shape in standard tuning), **When** it is shown, **Then** no mark appears.
3. **Given** C major 2nd inversion on 3-2-1 (0-1-0), **When** it is shown, **Then** open strings display normally and the span is calculated from the fretted notes only.

---

### User Story 6 - Understand special qualities (Priority: P2)

The composition panel explains the augmented triad as symmetric (the three inversions have the same shape, and each note could be the root) and marks ♭5 as the characteristic note of the diminished triad.

**Why this priority**: These are the two cases where learners are most often confused. The tool already works without the explanations.

**Independent Test**: Select augmented and diminished and read the panel.

**Acceptance Scenarios**:

1. **Given** the quality is augmented, **When** the panel is shown, **Then** it says the triad is symmetric.
2. **Given** the quality is diminished, **When** the panel is shown, **Then** it marks ♭5 as the characteristic note.
3. **Given** the quality is major or minor, **When** the panel is shown, **Then** neither statement appears.

---

### User Story 7 - Hear the shape (Priority: P2)

**Listen** plays the shape arpeggiated from low to high, then as a block, at the calculated pitches.

**Why this priority**: Sound reinforces the shape, but the visual teaching works without it.

**Independent Test**: Press Listen with an injectable clock and audio context, and check the notes, order, and pitches.

**Acceptance Scenarios**:

1. **Given** any shape is shown, **When** the user presses **Listen**, **Then** the three notes sound one by one from the lowest string to the highest, then all three together, at their calculated pitches.
2. **Given** playback is running, **When** the user changes any control, **Then** the playback stops.
3. **Given** the device is muted, **When** the user presses **Listen**, **Then** the notes still light up in sequence.

---

### User Story 8 - Honest messages when a shape cannot be shown (Priority: P3)

When a shape lies only beyond the last fret, and no lower octave exists, the tool says "This shape lies beyond fret [n]" instead of showing a blank fretboard. When the string set cannot form a close-position triad, the tool says so and offers another set.

**Why this priority**: These are rare in standard tuning, but "never blank, adjust and tell" is a constitution rule.

**Independent Test**: Inject a 12-fret standard instrument and check the guidance. Check the unclosable case with an injected tuning that has unison or descending adjacent strings (C7). Neither case occurs in the shipped 22-fret standard guitar.

**Acceptance Scenarios**:

1. **Given** a selection whose shape fits only above the last fret and has no lower octave, **When** it would be shown, **Then** the fretboard shows no notes and displays "This shape lies beyond fret [n]", where n is the instrument's fret count (C6). Example: 12 frets, C diminished root position on 5-4-3 → "This shape lies beyond fret 12"; both octave commands are disabled and the composition panel still shows C–E♭–G♭.
2. **Given** a tuning in which the string set cannot form a close-position shape, **When** it would be shown, **Then** the fretboard is empty with "This triad does not close on this string set with the current tuning" and an **Another set** action that selects the nearest set that closes (C11), or no action if none closes.
3. **Given** the guidance is shown, **When** the user changes any control, **Then** the guidance updates or disappears with the new selection.

### Edge Cases

- A shape that fits only above the last fret: TM-5.3 already yields the lowest occurrence, so no lower octave exists to fall back on (C8). The tool shows "This shape lies beyond fret [n]", n = fret count (EC-5.2, C6).
- The **See all notes** action is not available yet, because the All notes view ships in a later wave. The guidance shows without it until that view exists.
- A tuning in which the string set cannot close: empty fretboard with guidance and **Another set**. **See all notes** is likewise left out until that view exists (EC-5.1).
- Double accidentals (D♯ major, A♯ major, G♯ augmented, D♭ diminished and so on) are displayed as theory requires, with the equivalent sound line and a simpler root suggestion when one exists (EC-5.6).
- Augmented inversions share the same pitches and the same shape type: expected, and explained by the symmetry statement (EC-5.8).
- Shapes with open strings: displayed normally, with the span computed from fretted notes only (EC-5.7).
- A root with two spellings: the user's chosen spelling holds until the root changes. A quality change keeps the user's choice; without a choice, the default for the new quality applies.
- Fretboards with fewer frets (12 or more are supported by the instrument): the lowest occurrence is chosen for the available fret count; the octave commands appear only if a second occurrence fits.
- Only standard tuning is offered by the MVP, but the shape calculation takes the tuning as input and never assumes standard.

## Requirements *(mandatory)*

### Functional Requirements

**Selection**

- **FR-001**: On opening, the tool MUST show root C, major quality, root position, string set 3-2-1, the Isolated view, and interval labels (FR-5.1).
- **FR-002**: The user MUST be able to pick any of the twelve root notes. The tool MUST calculate the three notes with correct spelling (FR-5.2, TM-4).
- **FR-003**: The user MUST be able to pick a quality from major, minor, diminished, and augmented, and an inversion from root position (root in the bass), 1st (third in the bass), and 2nd (fifth in the bass) (FR-5.4).
- **FR-004**: The user MUST be able to pick a string set from 6-5-4, 5-4-3, 4-3-2, and 3-2-1. All four controls (root, quality, inversion, string set) MUST be visible at once, never behind a menu (FR-5.5).
- **FR-005**: The user MUST be able to switch the label between intervals (R, 3, ♭3, 5, ♭5, ♯5) and note names. Note-name labels MUST use the triad's own spelling (e.g. F𝄪), from the notation layer (C5).
- **FR-005a**: The root control MUST show the twelve keys, with altered keys labeled by both spellings ("C♯ / D♭") as in the Notes tool (C2). The selection MUST store the root as a pitch class plus a spelling override (`none | sharp | flat`) (C1).

**Spelling**

- **FR-006**: Triad notes MUST use alternate letters (root, third two letters above, fifth four letters above), with the accidental that reaches the exact interval, including double sharps and double flats (TM-4.1).
- **FR-007**: Every root × quality spelling MUST equal the reference table TM-4.2 (68 triads over the 17 root spellings).
- **FR-008**: For the five roots with two spellings, the tool MUST default to the spelling with fewer accidentals for the chosen quality, per TM-4.3, with the tie cases (E♭ minor, F♯ major) resolved as listed there (FR-5.3).
- **FR-009**: The tool MUST offer a command to switch to the other spelling of an altered root. The user's choice MUST hold until the user picks a different root, and MUST be kept across quality, inversion, string set, label, and octave changes (C1). The command MUST NOT be offered for roots with one spelling.
- **FR-010**: For each note spelled with a double accidental, the composition panel MUST add one line stating the equivalent sound ("F𝄪 sounds as G"), in root–third–fifth order. Single accidentals (E♯, B♯, C♭, F♭) get no line. When the root is altered and its other spelling has no double accidental, the panel MUST suggest that spelling; activating the suggestion MUST act as the spelling-switch command. Natural roots (B augmented) get no suggestion (EC-5.6, C3, C4).

**Shape**

- **FR-011**: Every shape MUST be in close position: three adjacent strings, one note per string, ascending in pitch, within one octave (FR-5.6, TM-5.1).
- **FR-012**: Shapes MUST be calculated from the tuning, string count, and fret count using the TM-5.3 procedure. Pre-drawn or hard-coded shapes MUST NOT be used.
- **FR-013**: The low-to-high order MUST follow the inversion: root position root–third–fifth, 1st third–fifth–root, 2nd fifth–root–third (TM-5.2).
- **FR-014**: In standard tuning, the lowest occurrence of every quality × inversion × string set for root C MUST equal the TM-5.5 table (48 shapes).
- **FR-015**: Markers MUST follow the product-wide note-function code: root as a filled rounded square, third as a filled circle, fifth as a filled diamond, each with its label. The function MUST NOT be conveyed by color alone.

**Isolated view and octaves**

- **FR-016**: The Isolated view MUST show a single shape: the lowest occurrence that fits on the fretboard. All other positions MUST be hidden (FR-5.8).
- **FR-017**: When the same shape also fits an octave higher within the fret count, **Octave up** and **Octave down** MUST switch between occurrences. Occurrences are the lowest occurrence plus k×12 frets while the highest fret ≤ fret count; the view state stores the occurrence index. A command with no target MUST be shown as disabled (not hidden), not as an error. Spelling and label changes MUST keep the index (C9).
- **FR-018**: A change of root, quality, inversion, or string set MUST reset the view to the lowest occurrence.
- **FR-019**: When the lowest occurrence's highest fret exceeds the fret count, the tool MUST show no notes and display "This shape lies beyond fret [n]", with n = the instrument's fret count (EC-5.2, C6, C8). Guidance is the fretboard's empty state: at most two lines, no error red, not dismissible, included in the text description (C14).
- **FR-020**: When the string set cannot form a close-position shape with the current tuning, the tool MUST show an empty fretboard with the guidance "This triad does not close on this string set with the current tuning" and an **Another set** action that selects the nearest closing set (one step toward the treble first, then toward the bass, alternating outward); when no set closes, the action is omitted (EC-5.1, C11).
- **FR-021**: The **See all notes** action in FR-019 and FR-020 MUST be omitted until the All notes view exists. When it exists, the action joins without changing these messages.

**Composition panel**

- **FR-022**: A composition panel MUST always be visible and MUST show: the name (for example, "A major — 1st inversion"); the three notes in root–third–fifth order with their markers; the intervals from the root; the stacking of thirds (major third + minor third, minor third + major third, minor third + minor third, major third + major third); and the low-to-high order in the current inversion, as note name plus function per string (e.g. "C♯ (third) – E (fifth) – A (root)"). The name uses the effective root spelling and "Root position" / "1st inversion" / "2nd inversion". The panel MUST stay populated when the fretboard shows guidance (FR-5.7, C13).
- **FR-023**: For the augmented quality, the panel MUST state that the triad is symmetric: the three inversions have the same shape and each note can be the root (FR-5.12).
- **FR-024**: For the diminished quality, the panel MUST mark ♭5 as the characteristic note (FR-5.13).

**Span and open strings**

- **FR-025**: The tool MUST calculate the span as the difference between the highest and the lowest fretted fret, ignoring open strings, and MUST give shapes with a span of 5 or more the "wide stretch" mark. The mark MUST NOT be conveyed by color alone and no shape may be hidden for difficulty (FR-5.14, TM-5.4).
- **FR-026**: Shapes using fret 0 MUST be displayed normally (FR-5.15).

**Sound**

- **FR-027**: **Listen** MUST play the displayed shape arpeggiated from low to high, then as a block, with each note at its calculated pitch, as one `sequence` request of four steps (low, middle, high, all three) at the Notes tool's `LISTEN_BPM` (120); pressing **Listen** again restarts it (C10). **Listen** MUST be disabled when no shape is shown. Playing notes MUST pulse on the fretboard, also when sound is muted (FR-5.17, FR-7.3).
- **FR-028**: Any change of root, quality, inversion, string set, spelling, label, or octave MUST stop playback in progress.
- **FR-028a**: This slice MUST NOT show a view selector; Isolated is the only view (C12).

**Cross-cutting**

- **FR-029**: The shape, the spelling, and the composition panel MUST be accessible by keyboard and described as text, with accidentals read in full ("F sharp") and the description announced politely when it changes.
- **FR-030**: All user-facing text MUST come from the message catalog and note names MUST come from the notation layer.
- **FR-031**: A control change MUST update the fretboard and the panel within the product's 100 ms budget.
- **FR-032**: The tool's state MUST live outside the tool component and survive in-app navigation away from the tool and back within the same page session.

**Automated verification**

- **FR-033**: Automated table tests MUST check all 68 spellings of TM-4.2, the default spellings of TM-4.3, and the 48 shapes of TM-5.5. Property tests MUST check, over randomly generated tunings, that shapes have three adjacent strings, strictly rising pitch, span under one octave, correct pitch classes, and the correct bass note.

### Key Entities

- **Triad selection**: root pitch class (0–11), spelling override (`none | sharp | flat`), quality, inversion, string set, label type, occurrence index (0 = lowest). The effective root spelling is derived (C1). Defaults per FR-001 (override `none`, index 0).
- **Triad spelling**: the three named notes (root, third, fifth), each with letter and accidental, and the notes' pitch classes.
- **Triad shape**: for a selection and a tuning, the three positions (string, fret, note function), the span, and the wide-stretch flag.
- **Occurrence set**: the shapes of one selection that fit the fretboard, ordered low to high, with the one currently shown.
- **Composition**: the name, notes, intervals, stacking, low-to-high order, and the optional notes (symmetry, characteristic note, double-accidental equivalent).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On opening, 100% of the first-view facts match the reference: frets 5-5-3 on strings 3-2-1, notes C, E, G, name "C major — Root position".
- **SC-002**: 100% of the 68 triad spellings and 100% of the 48 reference shapes match the reference tables, and no combination of root, quality, inversion, and set leaves the fretboard blank without a message.
- **SC-003**: A user can change root, quality, inversion, or string set and see the new shape and panel in under 100 ms on the reference mid-range phone.
- **SC-004**: Every shape in the product satisfies the close-position rules (three adjacent strings, one note per string, rising pitch, within an octave) over at least 1,000 randomly generated tunings.
- **SC-005**: In a review by guitar teachers, none finds a misspelled note, a wrong inversion order, or a wrong fret in the sampled views.
- **SC-006**: At least 90% of first-time users asked to find the third of A major in 1st inversion on strings 4-3-2 point to string 4, fret 11 without help.
- **SC-007**: Every function works from 320 to 2560 px wide with a keyboard only and with no automated accessibility violations, and no information is carried by color or sound alone.
- **SC-008**: Every acceptance scenario in this spec has an automated test.

## Assumptions

- The Notes tool slice (004), the interactive fretboard (002), and note playback (003) are available, along with the notation layer, the message catalog, and the design tokens built before this slice.
- The MVP runs in standard tuning with 6 strings only. The instrument panel, other tunings, and 7-string sets arrive later. The shape calculation still takes the tuning as an input (FR-012).
- The fret count is that of the instrument configuration already shipped (`STANDARD_GUITAR`: 22 frets). Tests inject other instruments (12 frets, Drop D, non-closing tunings) to cover the cases unreachable in the shipped configuration (C7).
- The default label type is intervals and the choice is not persisted. Persistence and share links belong to later waves.
- The Full neck view, the All notes view, quality comparison, the **View in CAGED** shortcut, and 7-string sets are out of scope and arrive in wave 002 or later. Their controls MUST NOT appear in this slice.
- The shortcut and **See all notes** actions that depend on later views are added when those views exist (FR-021).
- The arpeggio then block uses the playback contract from slice 003, with its default tempo and an injectable clock for tests.
- The notice messages follow the product-wide non-blocking, dismissible notice rules (two lines at most, no modal, no error red).
- The "Octave" commands move by exactly 12 frets, because other occurrences lie 12 frets higher (TM-5.3).
