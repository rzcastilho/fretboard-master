# Feature Specification: The Five CAGED Shapes Along the Neck

**Feature Branch**: `feature/014-caged-shapes`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/001-caged-shapes.md (id 001, caged-shapes)." Source sections: FR-6.1–FR-6.4, FR-6.13 (7 strings), TM-6, TM-7, EC-6.2, EC-6.3, EC-6.6, UJ-4 (steps 1–3 and 9), DM-11, Area 1 (home card and tool navigation).

## Clarifications

### Session 2026-10-04

Each answer derives from a cited source or is an assumed default (marked **Default**). No material question remains open.

- Q: What is the third tool and how is it reached? → A: Area 1. CAGED is the third tool, with its own home card asking "How does the whole neck connect?" and an entry in the tool navigation beside Fretboard Notes and Triads.
- Q: What is the initial state? → A: FR-6.1. Key C, major, all shapes visible, Chord layer, interval labels, connections off. In this slice the layer, label and connection settings are fixed at those values; only key and quality are user choices.
- Q: Which keys and spellings? → A: FR-6.2, FR-5.3. Twelve keys, altered roots spelled as in Triads (D♭ major, F♯ major). Quality: major or minor.
- Q: What exactly is drawn? → A: TM-6.1 / TM-7.1. Five shapes per key; for C in standard tuning, major: C `x-3-2-0-1-0`, A `x-3-5-5-5-3`, G `8-7-5-5-5-8`, E `8-10-10-9-8-8`, D `x-x-10-12-13-12`; minor: Cm `x-3-1-0-1-x`, Am `x-3-5-5-4-3`, Gm `8-6-5-5-8-8`, Em `8-10-10-8-8-8`, Dm `x-x-10-12-13-11`. Frets listed string 6 → 1. Other keys shift every fret by the semitone distance from C.
- Q: In what order and where? → A: FR-6.4 / TM-6.2. Always the cycle C → A → G → E → D, toward the body, beginning with the shape that fits nearest the nut; the cycle repeats 12 frets higher while frets remain. A shape is drawn only if every chord note fits on the fretboard. **Default** (EC-6.2): a shape whose lowest occurrence would need frets below the nut appears in the next octave, so the first shape is the next in the cycle.
- Q: Tags? → A: FR-6.3, EC-6.6. Each shape has a tag above its region ("E shape" major; "Em shape" minor) that also names the strings holding its roots. Roots use the root marker. Shape names always use the letters C A G E D (they name drawings, not notes), even in other languages. A shape that appears twice (frets 0 and 12) carries the same tag in both places.
- Q: 7 strings? → A: FR-6.13, A-23. Chord shapes sit on the six higher strings; the lowest string carries no chord marker.
- Q: Short fretboard? → A: EC-6.3. Only shapes that fully fit are drawn, and a note reads "With [n] frets, [k] shapes fit on the fretboard".
- Q: Which tunings? → A: Scope, FR-2.12, TM-8.1, constitution Principle I ("shapes MUST be calculated from the configured tuning, string count, and fret count"). See the review session below for the exact rule per tuning class.
- Q: Q-10 (explain the name "CAGED" on the card)? → A: **Default**: the card carries the question "How does the whole neck connect?" as its description, with the tool name CAGED; no extra explanatory text. Left open for usability testing (Q-10).
- Q: Q-13 (Cm/Gm emphasis)? → A: **Default**: all five minor shapes receive identical emphasis and tags; the Cm and Gm shapes are not singled out.
- Q: Handedness and orientation? → A: Feature 013 mapping applies: shapes, tags and their order mirror with handedness and follow string orientation; musical meaning is unchanged.

### Session 2026-10-04 (clarify review)

Resolutions from the clarify reviewer. Each cites a source or is marked **Default** with its rationale. No item met the materiality test for escalation.

- Q: How are positions computed in tunings other than Standard? → A: Constitution Principle I, FR-2.12, TM-8.1. Occurrence positions are computed from the real open-string pitches of the configured instrument, never from a fixed standard-tuning table: the shape drawing (relative frets) is fixed, and the start fret is the one where the shape's root strings sound the chosen key. Tag names still describe the drawing. Test: in Half step down (AF-2), key C major gives C (1) → A (4) → G (6) → E (9) → D (11), all tagged "C shape", "A shape"… In 7-string standard (AF-21) and Drop A (AF-23), key C gives the same frets as 6-string standard on strings 6–1.
- Q: What does CAGED show in a tuning that is not "Compatible" (FR-2.12 classes "Compatible with an altered string" and "Non-compatible")? → A: **Default** (interim until 004-caged/002; follows the slice-002 principle "never make up shapes"): no shapes, tags or count note are drawn; in place of the fretboard the tool shows the message "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet." with no action buttons (View in standard tuning / Go to Triads arrive in 002). Key and quality controls stay visible and keep their values. Changing the instrument while CAGED is open switches between the shapes view and this message immediately. Test: Drop D (AF-4) and Open G (AF-8) both show the message and zero shape markers; switching back to Standard redraws the shapes for the kept key and quality.
- Q: How are altered keys spelled, and per quality? → A: FR-5.3, TM-4.3. Defaults per quality: major D♭, E♭, F♯, A♭, B♭; minor C♯, E♭, F♯, G♯, B♭. A **Switch spelling** command (same as Triads) toggles the enharmonic spelling for those five roots; the user's choice holds until the root changes, including across a quality change. With no user choice, changing quality re-applies the default (D♭ major → minor shows C♯ minor). Test: pick the C♯/D♭ key in major → "D♭ major"; switch to minor → "C♯ minor"; switch spelling → "D♭ minor"; switch to major → stays "D♭ major".
- Q: What does the key picker look like? → A: **Default** (reuse; conventional): the same twelve-key note selector as Triads, chromatic order starting at C, plus a two-option quality control (Major / Minor). Positions do not depend on spelling.
- Q: Which interval labels and markers? → A: FR-6.1, FR-1.10 legend, Triads interval mode. Labels are "R", "3", "5" in major and "R", "♭3", "5" in minor, using the same interval label rendering and root / third / fifth markers as Triads. Muted strings ("x") carry no marker; open strings (fret 0) are drawn in the open-string column. A position shared by two neighbouring occurrences (TM-6.3) is drawn as one marker; with connections off it gets no extra emphasis.
- Q: Exact tag wording and placement? → A: **Default** (conventional; reuses the existing tag strip): tag text is "[Shape] shape · roots on strings [list]" (minor: "[Shape]m shape · …"), strings listed in the TM-6.1/TM-7.1 order, e.g. "E shape · roots on strings 6, 4, 1", "Dm shape · roots on strings 4, 2". Each tag is centred over its occurrence's chord fret span (lowest to highest chord fret) and placed by the existing tag-strip layout, which stacks a tag onto a new row instead of overlapping; tags never overlap. String numbers are the same on 6 and 7 strings (string 1 = highest).
- Q: What is "[k]" in the count note and when does it show? → A: EC-6.3, FR-6.4. An occurrence is drawn only if every chord note's fret is within 0…fret count. k = number of distinct shapes (C, A, G, E, D) with at least one drawn occurrence; the note shows iff k < 5. Because fret count is 12–24 (MIN_FRETS/MAX_FRETS), k is always 4 or 5. Tests: C major, 12 frets → C, A, G, E drawn, D omitted, note "With 12 frets, 4 shapes fit on the fretboard"; G major, 12 frets → five shapes, no note; D♭ major, 13 frets → note with k = 4; C major, 24 frets → nine occurrences C(0) A(3) G(5) E(8) D(10) C(12) A(15) G(17) E(20), no note. Minor gives the same counts (same fret spans).
- Q: Where does CAGED live in the app shell? → A: FR-1.1, FR-1.2, FR-1.4, FR-1.5, FR-1.7, FR-1.8, FR-1.11, DM-14. Route `/caged`; home cards and navigation in the order Fretboard Notes, Triads, CAGED; the card shows the tool name, the question and a fretboard thumbnail drawn with the configured instrument like the other cards; opening CAGED records it as the last tool so its card shows "Continue"; key, quality and spelling choice persist for the session when leaving and returning; browser back/forward move between screens, while key/quality changes add no history entry; **Reset tool** returns to C major, all shapes, no spelling override, without changing instrument, language or notation.
- Q: Does musical context carry over between CAGED and other tools in this slice? → A: Scope boundary; FR-1.6 carry-over is in 004-caged/006. In this slice switching to or from CAGED carries nothing: CAGED reopens in its session state or initial state, and the other tools are unaffected by CAGED's key.
- Q: Which languages and notation? → A: Breakdown wave 005-languages-and-notation. The app currently ships English only; all CAGED strings MUST come from the message catalog so later languages can translate them. The one-time solfège explanation (FR-8.9) arrives with solfège in wave 005. Shape letters are literal text and never pass through note-name formatting.
- Q: What happens when the instrument changes while CAGED is open? → A: Constitution Principle I, FR-1.7. Strings, frets, tuning, handedness and orientation changes recompute and redraw occurrences, tags and the count note immediately; key, quality and spelling are kept.
- Q: Are layer, label or connection controls shown? → A: **Default** (scope: those arrive in 003–005): no layer, label or connection controls are rendered in this slice; the fixed state is Chord layer, interval labels, connections off.
- Q: What exactly does FR-012 verify in this slice? → A: Constitution Principle I (suites added by the slice introducing the theory). Table tests reproduce TM-6.1 and TM-7.1 (frets, degrees, root strings for all ten shapes in C) and TM-6.2 (the sequence and start frets for all twelve keys, major and minor, on 24 frets). Arpeggio, pentatonic and scale tables (TM-6.4, TM-6.5, TM-7.4, TM-7.5) are added with the layers in 004-caged/004.
- Q: How is the tool announced to assistive technology? → A: **Default** (follows the existing fretboard description pattern): key and quality controls are labelled radio groups; tags are non-interactive text in this slice (focus arrives in 003); the fretboard description lists each occurrence in order as "[Shape] shape, frets [lowest] to [highest], roots on strings [list]" followed by its notes as string, fret and interval; the count note and the tuning message are announced as status text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the five linked shapes of a chord (Priority: P1)

A player stuck in one or two positions opens CAGED from the home screen and immediately sees the C major chord drawn as five linked shapes spread over the whole neck, each labeled.

**Why this priority**: This is the whole promise of the tool: one chord, five shapes, one connected neck.

**Independent Test**: Open the home screen, choose the CAGED card, and check the fretboard shows C, A, G, E, D starting at frets 0, 3, 5, 8, 10 with tags and root markers.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user looks at the tools, **Then** a third card (after Fretboard Notes and Triads) names CAGED, asks "How does the whole neck connect?" and shows a fretboard thumbnail, and CAGED also appears third in the tool navigation (route `/caged`).
2. **Given** the user opens CAGED, **When** it appears, **Then** it shows C major with all shapes visible and interval labels, and no layer, label or connection controls are rendered.
3. **Given** C major in standard tuning, **When** the view appears, **Then** the shapes are C (from fret 0), A (3), G (5), E (8), D (10), each drawn with the frets in the C-major table and each chord note labeled with its interval.
4. **Given** any shape, **When** it is drawn, **Then** a tag centred above its chord fret span reads e.g. "C shape · roots on strings 5, 2", tags never overlap, and each root carries the root marker.
5. **Given** a fretboard with enough frets for a second cycle, **When** a shape appears at frets 0 and 12, **Then** both occurrences carry the same tag.

---

### User Story 2 - Choose the key (Priority: P1)

The player picks any of the twelve keys and sees the shapes move to their correct place, in the same cyclic order.

**Why this priority**: A chord shape map is only useful if it works for every key the player meets.

**Independent Test**: Pick G major and check the order G (0), E (3), D (5), C (7), A (10); pick D♭ and F♯ and check spelling and start frets.

**Acceptance Scenarios**:

1. **Given** C major, **When** the user picks G, **Then** the order becomes G (0), E (3), D (5), C (7), A (10).
2. **Given** any key, **When** it is shown, **Then** the order matches the reference sequence for that key (e.g. D♭: C (1) → A (4) → G (6) → E (9) → D (11); F♯: E (2) → D (4) → C (6) → A (9) → G (11)).
3. **Given** altered roots, **When** the key picker and labels show, **Then** they use the TM-4.3 default for the quality (D♭ major, F♯ major, C♯ minor, G♯ minor), and **Switch spelling** toggles the enharmonic spelling, which holds until the root changes.
4. **Given** a key whose first shape would need frets below the nut, **When** it is shown, **Then** that shape appears one octave higher and the first visible shape is the next in the cycle.

---

### User Story 3 - Switch between major and minor (Priority: P2)

The player flips the quality and sees the five minor shapes of the same key in the same order.

**Why this priority**: Minor doubles the usefulness of the tool, but major alone is already a viable slice.

**Independent Test**: From G major switch to minor and verify the Gm, Em, Dm, Cm, Am shapes at the same fret starts, with tags "Gm shape" etc.

**Acceptance Scenarios**:

1. **Given** G major, **When** the user switches to minor, **Then** the five minor shapes of G appear in the same order and start frets.
2. **Given** C minor in standard tuning, **When** shown, **Then** the frets match Cm `x-3-1-0-1-x`, Am `x-3-5-5-4-3`, Gm `8-6-5-5-8-8`, Em `8-10-10-8-8-8`, Dm `x-x-10-12-13-11`.
3. **Given** minor, **When** tags show, **Then** they read "Cm shape", "Am shape", "Gm shape", "Em shape", "Dm shape" with the same roots-strings wording as major, and third markers are labelled "♭3".

---

### User Story 4 - Fewer frets, fewer shapes (Priority: P2)

On a short fretboard, the tool draws only shapes that fully fit and says how many.

**Why this priority**: Prevents misleading half-drawn shapes on small instruments.

**Independent Test**: Set the instrument to 12 frets and verify only fully fitting shapes appear with the note.

**Acceptance Scenarios**:

1. **Given** 12 frets and C major, **When** the view appears, **Then** C, A, G and E are drawn, the D shape is not drawn at all, and a note reads "With 12 frets, 4 shapes fit on the fretboard".
2. **Given** all five shapes fit (e.g. G major on 12 frets, or any key on 22 or 24 frets), **When** the view appears, **Then** no such note appears.
3. **Given** 7 strings, **When** shapes are drawn, **Then** they sit on the six higher strings and the lowest string has no chord marker.
4. **Given** CAGED is open, **When** the user changes fret count, string count, handedness or orientation, **Then** occurrences, tags and the note update immediately and key and quality are kept.

---

### User Story 5 - Honest behaviour in other tunings (Priority: P2)

The player with a transposed tuning sees correct shapes; a player in a tuning that breaks the standard string relationships sees no made-up shapes.

**Why this priority**: Constitution Principle I forbids standard-only diagrams; full tuning support follows in 004-caged/002.

**Independent Test**: Set Half step down and check C major starts C (1) → A (4) → G (6) → E (9) → D (11); set Drop D and Open G and check the message and no shape markers.

**Acceptance Scenarios**:

1. **Given** Half step down, **When** C major shows, **Then** occurrences are C (1), A (4), G (6), E (9), D (11), tagged by drawing name.
2. **Given** Drop D or any non-compatible tuning, **When** CAGED shows, **Then** no shape, tag or count note is drawn and the message "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet." appears, with no action buttons.
3. **Given** that message, **When** the user switches the instrument back to Standard, **Then** the shapes for the kept key and quality are drawn.

---

### User Story 6 - The tool behaves like the other tools (Priority: P3)

**Why this priority**: Shell consistency (FR-1.4, FR-1.7, FR-1.8, FR-1.11).

**Independent Test**: Use CAGED, leave and return, reload home, use back/forward and Reset tool.

**Acceptance Scenarios**:

1. **Given** the user picked G minor, **When** they go to Triads and back to CAGED in the same session, **Then** G minor is shown; Triads' state is unaffected by CAGED's key.
2. **Given** CAGED was the last tool used, **When** the home screen shows, **Then** the CAGED card is marked "Continue".
3. **Given** several key changes, **When** the user presses browser back, **Then** they leave CAGED to the previous screen (key changes add no history entries).
4. **Given** any CAGED state, **When** the user chooses **Reset tool**, **Then** C major is shown with no spelling override and the instrument is unchanged.

---

### Edge Cases

- Shape needing frets below the nut: moves to the next octave (EC-6.2).
- Fewer than five shapes fit: partial drawing never occurs; note states the count (EC-6.3).
- Same shape twice on the neck: identical tag on both (EC-6.6).
- Open-position shapes: open strings count as fret 0 and are drawn in the open-string column.
- Cm and Gm shapes have muted or substituted strings (string 1 unplayed in Cm; fifth in place of minor third on string 2 in Gm); muted strings show no marker.
- Seven strings: lowest string stays empty for chord shapes.
- Left-handed and lowest-on-top: mirrored/flipped drawing, same musical content.
- Altered keys with unusual spelling are accepted as in Triads.
- Fret count range is 12–24, so k is always 4 or 5; zero or partial counts below 4 cannot occur.
- Second cycle: an occurrence 12 frets higher is drawn only if all its chord frets ≤ fret count (C major on 24 frets: D at 22 is omitted because it needs fret 25).
- Positions shared by neighbouring occurrences: one marker, no extra emphasis (connections off).
- Tuning not "Compatible" (FR-2.12): interim message, no shapes (until 004-caged/002).
- Instrument changed while CAGED is open: immediate recompute, key/quality kept.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer CAGED as a third tool with its own home card ("How does the whole neck connect?") and an entry in the tool navigation.
- **FR-002**: On opening, CAGED MUST show C major, all shapes visible, Chord layer, interval labels, connections off.
- **FR-003**: Users MUST be able to pick any of the twelve keys and a quality of major or minor. Altered roots MUST default to the TM-4.3 spelling for the quality (major D♭ E♭ F♯ A♭ B♭; minor C♯ E♭ F♯ G♯ B♭), and a **Switch spelling** command MUST toggle it; the user's choice holds until the root changes, including across quality changes.
- **FR-004**: The system MUST draw the five chord shapes C, A, G, E, D for the chosen key and quality, using the reference fretting for C (major and minor) shifted by the semitone distance from C, with start frets computed from the real open-string pitches of the configured instrument (Half step down, key C → C (1), A (4), G (6), E (9), D (11)).
- **FR-005**: Shapes MUST run in the cycle C → A → G → E → D toward the body, starting with the shape that fits nearest the nut, and repeat 12 frets higher while frets remain.
- **FR-006**: An occurrence MUST be drawn only if every chord note's fret is within 0…fret count, and never partially; a shape needing frets below the nut MUST appear in the next octave.
- **FR-007**: Each occurrence MUST have a tag reading "[Shape] shape · roots on strings [list]" (minor "[Shape]m shape · …"), centred above its chord fret span and laid out so tags never overlap; repeated shapes MUST share the same tag text.
- **FR-008**: Roots MUST use the root marker; chord notes MUST show interval labels "R", "3"/"♭3", "5" with the Triads marker styles; muted strings show no marker; a position shared by two occurrences is drawn once.
- **FR-009**: Shape names MUST always use the letters C A G E D, in every language.
- **FR-010**: With seven strings, chord shapes MUST sit on the six higher strings.
- **FR-011**: With k = number of distinct shapes having at least one drawn occurrence, the system MUST show the note "With [n] frets, [k] shapes fit on the fretboard" iff k < 5.
- **FR-012**: Automated table tests MUST reproduce TM-6.1 and TM-7.1 (frets, degrees, root strings of the ten shapes in C) and TM-6.2 (sequence and start frets for all twelve keys, major and minor, on 24 frets). Layer tables (TM-6.4/6.5, TM-7.4/7.5) are verified when layers arrive (004-caged/004).
- **FR-013**: Drawing MUST honor handedness and string orientation without changing musical content.
- **FR-014**: The tool MUST be fully usable by keyboard and screen reader, with shape, tag, strings and frets announced in musical terms.
- **FR-015**: All CAGED texts MUST come from the message catalog (English is the only shipped language; others and the FR-8.9 solfège explanation arrive in wave 005); shape letters MUST be literal and never pass through note-name formatting.
- **FR-016**: In a tuning classed "Compatible with an altered string" or "Non-compatible" (FR-2.12), the system MUST draw no shapes, tags or count note and MUST show "CAGED depends on the standard relationship between the strings. It isn't available in this tuning yet." with no actions, keeping key and quality controls; this interim state is replaced by 004-caged/002.
- **FR-017**: CAGED MUST keep its key, quality and spelling for the session (FR-1.7), record itself as last tool so its home card shows "Continue" (FR-1.4), add no history entries for in-tool changes (FR-1.8), and offer **Reset tool** returning to C major with no spelling override and no instrument change (FR-1.11). No context carries over to or from other tools in this slice (FR-1.6 is 004-caged/006).
- **FR-018**: Instrument changes (strings, frets, tuning, handedness, orientation) while CAGED is open MUST redraw occurrences, tags, note and tuning message immediately, keeping key, quality and spelling.
- **FR-019**: No layer, label or connection controls MUST be rendered in this slice; the state is fixed at Chord layer, interval labels, connections off.

### Key Entities

- **CAGED shape**: One of five drawings (C, A, G, E, D) for a quality; per string, a fret offset and chord degree or muted; names the strings holding roots.
- **Shape occurrence**: A shape placed on the fretboard for a key; has a start fret and may repeat 12 frets higher.
- **Key and quality**: Root (twelve spelled notes) plus major or minor.
- **Shape tag**: Label of an occurrence: shape name plus root strings ("E shape · roots on strings 6, 4, 1").
- **Tuning class**: Compatible / Compatible with an altered string / Non-compatible (FR-2.12); only Compatible draws shapes in this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user reaches the CAGED view with all five shapes visible in at most 2 taps from the home screen.
- **SC-002**: For all 24 key/quality combinations on a 24-fret board, 100% of shape positions and orders match the reference tables.
- **SC-003**: All ten reference shapes in C major and C minor match the published tables with zero discrepancies.
- **SC-004**: Changing key or quality updates the full view in under 200 ms as perceived by the user (no visible delay).
- **SC-005**: On a 12-fret board, 100% of drawn shapes are complete, and the count note is correct.
- **SC-006**: In moderated checks, at least 90% of users can state the order of the five shapes along the neck after viewing one key.
- **SC-007**: Every control and tag is reachable and understandable without a pointer, and passes the project accessibility bar.

## Assumptions

- Compatible tunings (six higher strings keep standard intervals) draw shapes from real pitches; other tuning classes show the interim message until 004-caged/002.
- Focus, connections, extra layers, sound, and links to other tools come in 004-caged/003 through 006 and are not part of this slice.
- Instrument panel, seven strings, handedness and orientation from earlier features are available.
- Fixed interval labels, Chord layer and connections off are not user-changeable here.
- The name "CAGED" is not explained on the card beyond its question (Q-10 open for testing); Cm and Gm get the same emphasis as other minor shapes (Q-13).
- Only English ships today; translations and solfège arrive in wave 005.
- Fret count is bounded to 12–24 by the instrument panel.
