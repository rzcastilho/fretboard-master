# Feature Specification: CAGED Across Tunings

**Feature Branch**: `feature/015-caged-in-any-tuning`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/002-caged-in-any-tuning.md (id 002, caged-in-any-tuning)." Source sections: FR-6.13–FR-6.16, FR-2.12, TM-8, EC-6.1, EC-6.9, EC-6.10, EC-2.5.

## Clarifications

### Session 2026-10-04

Each answer cites a source or is an assumed default (marked **Default**). No material question remains open.

- Q: How is a tuning classified? → A: FR-2.12. **Compatible**: the six higher strings keep standard intervals among themselves (Standard, Half step down, Whole step down, 7-string standard, 7-string half step down, Drop A). **Compatible with an altered string**: strings 5 to 1 keep standard intervals, string 6 does not (Drop D, Drop C). **Non-compatible**: every other case (Double Drop D, DADGAD, Open G/D/E/A, most custom tunings). Classification depends only on the open-string pitches, so a custom tuning that happens to match a compatible class is classified accordingly.
- Q: What changes in a compatible tuning? → A: FR-6.16, TM-8.1, TM-8.2. The drawing is the same as in standard tuning; notes, pitches and sound come from the real tuning. Shape names describe the drawing, not the sound. Half step down: the E shape at the nut sounds E♭; the E shape at fret 3 is a G♭ chord.
- Q: What does string 6 show in an altered-string tuning? → A: FR-6.15, TM-8.3. Strings 5 to 1 are drawn normally. String 6 never shows the shape's original note. It shows the active layer's notes (in this slice the Chord layer: the key's root, third and fifth) that fall inside the shape's fret region, computed from the real tuning, and the string carries an "altered" mark. In Drop D those notes sit two frets higher than in standard tuning.
- Q: What if no layer note falls in the region of an altered string? → A: EC-6.10. The string has no markers there but keeps the "altered" mark.
- Q: What does a non-compatible tuning show? → A: FR-6.14, EC-6.1. No shapes, tags or count note. In place of the fretboard the tool explains that CAGED depends on the standard relationship between the strings and offers two actions: **View in standard tuning** and **Go to Triads**. This replaces the interim message-only state introduced by slice 014.
- Q: What does View in standard tuning do? → A: FR-6.14. The tool shows Standard (6 strings) or 7-string standard (7 strings) in this view only, with a permanent badge "temporary tuning" naming it. The stored instrument preference is unchanged. Shapes for the chosen key and quality are drawn as in standard tuning.
- Q: Which standard tuning for a custom tuning or a non-compatible tuning with 6 strings? → A: **Default**: the standard tuning matching the string count (6 → Standard, 7 → 7-string standard).
- Q: When is the temporary tuning dropped? → A: EC-6.9. When the user leaves the tool (other tool, home, or a route change). Returning shows the preferred instrument again. Changing the instrument while the temporary tuning is active ends the temporary tuning and applies the new instrument. **Default**: reloading the page also drops it, since it is never stored.
- Q: What if the instrument changes to a non-compatible tuning while CAGED is open? → A: EC-2.5. The tool moves to the non-compatible state immediately, keeping key and quality. Changing back to a compatible or altered tuning redraws shapes.
- Q: What does Go to Triads do? → A: FR-6.14. Navigates to Triads under the preferred instrument (works in any tuning). **Default**: no musical context carry-over (that is slice 004-caged/006).
- Q: Accessibility and text description? → A: Constitution Principle V. The "altered" mark and the temporary-tuning badge are text, not color alone; the fretboard text description names the tuning, the "altered" string, and states when no shapes are drawn.
- Q: Open-tuning custom CAGED model? → A: Scope boundary / Q-5. Out of scope; open tunings only get the non-compatible state.

### Session 2026-10-04 (clarify review)

- Q: Where are shapes placed in an altered-string tuning, given string 6 no longer matches? → A: TM-8.3, Constitution Principle I. Occurrence positions are computed from the real open pitches of strings 5 to 1 only (the shape's string-5…1 drawing is fixed; the start fret is where those strings sound the key). String 6 never determines position or fit. An occurrence is drawn iff every chord note on strings 5 to 1 lies within 0…fret count; the count note (slice 014 FR-006 wording) counts shapes on that basis. Test: Drop D, any key, gives the same occurrence frets as Standard for the same key.
- Q: What exactly is the "fret region" on string 6? → A: **Default** (reuses the slice-014 "chord fret span"): the inclusive fret range from the lowest to the highest chord fret of the occurrence on strings 5 to 1. Every chord tone (root, third/♭3, fifth) of the key whose real-tuning position on string 6 lies in that range is shown — possibly more than one — spelled and labelled like other chord markers (e.g. D major → D, F♯, A; degree labels R, 3, 5).
- Q: Which shapes show notes on the altered string? → A: Derived from FR-6.15 ("does not draw the original note of the shape") plus **Default** for the Chord layer: only shapes whose standard drawing plays string 6 (major and minor G and E shapes) get region-computed notes on string 6. Shapes whose standard drawing mutes string 6 (C, A, D, Cm, Am, Dm) show no string-6 markers, exactly as in Standard. Rationale: the Chord layer shows the shape's voicing; adding notes to a string the shape mutes would invent a voicing.
- Q: When is the "altered" mark shown and where? → A: **Default**: whenever the tuning is "Compatible with an altered string" and the shapes view is shown, string 6 carries one visible text mark "altered" next to its string label (string-level, independent of how many markers it has, mirrored with handedness/orientation per slice 013). It is never shown in Compatible or Non-compatible tunings or in the temporary standard view.
- Q: Worked examples for Drop D, D major? → A: Derived from TM-2 (Drop D string 6 = D2) and the 014 shape table. E shape (strings 5–1 span frets 10–12): Standard would put the root on string 6 at fret 10; in Drop D string 6 shows exactly one marker, D (root) at fret 12. G shape (span 7–10): Standard would put D at fret 10; in Drop D string 6 shows exactly one marker, A (fifth) at fret 7. C, A and D shapes: no string-6 markers, "altered" mark present.
- Q: Does the tag text change in an altered-string tuning? → A: **Default** (honesty principle, FR-003): the shape name never changes ("E shape", "Em shape"). The "roots on strings" list names only strings that show the shape's own root, so in an altered-string tuning string 6 is omitted from it (E shape in Drop D: "E shape · roots on strings 4, 1"; G shape: "G shape · roots on strings 3, 1"). In Compatible tunings tag text equals Standard's.
- Q: "Picks the E shape at the nut" — is shape selection in scope? → A: No. Focus/selection arrives in slice 004-caged/003 (slice-014 Assumptions). In this slice "picks" means the E-shape occurrence at fret 0 is drawn and tagged; scenarios are worded accordingly. Its sound "E♭" is verified via its root markers' note names/pitches (E♭2, E♭3, E♭4), since Listen also arrives later.
- Q: What does the temporary standard tuning inherit? → A: **Default**: only the tuning changes. String count, fret count, handedness and orientation come from the preferred instrument; AF-1 is used for 6 strings and AF-21 for 7 strings.
- Q: Badge wording and its relation to the FR-2.10 tuning badge? → A: **Default**: while the temporary tuning is active the FR-2.10 tuning badge is replaced by one badge reading "Temporary tuning: Standard" (or "Temporary tuning: 7-string standard"), rendered as text with no time-out and at every viewport width. Like the FR-2.10 badge it opens the instrument panel, where the preferred instrument is shown selected; confirming any instrument in the panel ends the temporary tuning. Dismissing the panel without confirming keeps it.
- Q: Does changing key or quality during the temporary view end it? → A: **Default**: no. Key, quality and spelling changes keep the temporary tuning; only leaving CAGED, a page reload, or confirming an instrument end it.
- Q: Is the temporary tuning reflected in the URL or stored anywhere? → A: **Default** (FR-6.14 "without changing the instrument preference"): no. It lives only in the in-memory state of the CAGED view; nothing is written to device storage or the URL.
- Q: Where do Go to Triads and the notice live, and what about key/quality controls in the non-compatible state? → A: **Default** (extends slice-014 interim state): key and quality controls stay visible and keep their values; the notice replaces the fretboard area, its text reads "CAGED depends on the standard relationship between the strings, so its shapes don't exist in [tuning name]." followed by the two actions as buttons in this order: **View in standard tuning**, **Go to Triads**. The notice is announced as status text.
- Q: Sound on the altered string? → A: Constitution Principle I. Any marker's pitch (and sound, when playback applies) comes from the real tuning: Drop D string 6 fret 12 = D3.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Honest CAGED in a non-compatible tuning (Priority: P1)

A guitarist in Open G opens CAGED. Instead of invented shapes, the tool explains that CAGED relies on the standard relationship between strings, and offers two ways forward: view the shapes in standard tuning, or go to Triads.

**Why this priority**: The product's core promise is musical correctness. Drawing shapes that do not exist in such tunings is the worst failure; replacing the interim message with real actions is the main value of this slice.

**Independent Test**: Set the instrument to Open G, open CAGED; verify no shape markers, explanation text, and both actions.

**Acceptance Scenarios**:

1. **Given** the preferred instrument is Open G, **When** the user opens CAGED, **Then** no shapes, tags or count note appear, an explanation states CAGED depends on the standard relationship between the strings, and the actions **View in standard tuning** and **Go to Triads** are shown.
2. **Given** the state above and key C major, **When** the user chooses **View in standard tuning**, **Then** C major's five shapes are drawn as in Standard, a "temporary tuning" badge naming Standard is shown, and the stored instrument preference is still Open G.
3. **Given** the temporary standard view, **When** the user leaves CAGED and comes back, **Then** the non-compatible state appears again (Open G still preferred).
4. **Given** the non-compatible state, **When** the user chooses **Go to Triads**, **Then** Triads opens under the preferred instrument.
5. **Given** CAGED is open in Standard showing shapes, **When** the user switches the instrument to DADGAD, **Then** the tool moves to the non-compatible state without a reload and keeps key and quality.
6. **Given** a 7-string non-compatible preference, **When** the user chooses **View in standard tuning**, **Then** 7-string standard is shown and the badge reads "Temporary tuning: 7-string standard".
7. **Given** the temporary standard view, **When** the user changes key or quality, **Then** the temporary tuning stays; **When** the user reloads the page, **Then** the non-compatible state shows again.
8. **Given** the temporary standard view, **When** the user opens the instrument panel from the badge, **Then** the preferred instrument is selected; confirming any instrument ends the temporary tuning and applies it, dismissing keeps the temporary view.

---

### User Story 2 - Transposed compatible tunings (Priority: P2)

Caio tunes a half step down. CAGED draws the same shapes as in standard tuning, but the notes and sound come from his real tuning, and shape names still describe the drawing.

**Why this priority**: Most common alternative tunings; delivers value with no new UI states.

**Independent Test**: Set Half step down, show C major; check the shape drawing equals Standard and that markers carry the real pitches.

**Acceptance Scenarios**:

1. **Given** Half step down and key E♭ major, **When** CAGED draws the E-shape occurrence at the nut (fret 0), **Then** it is tagged "E shape · roots on strings 6, 4, 1" and its root markers are E♭ (E♭2, E♭3, E♭4).
2. **Given** Half step down, **When** key G♭ major is shown, **Then** the E-shape occurrence starts at fret 3, its markers spell G♭–B♭–D♭, and it is still tagged "E shape · roots on strings 6, 4, 1".
3. **Given** Whole step down, 7-string standard, 7-string half step down, or Drop A, **When** CAGED opens, **Then** shapes are drawn on the six higher strings as in standard and no badge or "altered" mark appears.

---

### User Story 3 - Altered lowest string (Drop D, Drop C) (Priority: P3)

A guitarist in Drop D shows D major. Shapes appear on strings 5 to 1 as usual. String 6 does not show the shape's original note; it shows the chord notes that really exist in that region under the dropped tuning, marked "altered".

**Why this priority**: Narrower audience than the other two classes and the most intricate rule, but required to keep CAGED honest in a very common tuning.

**Independent Test**: Set Drop D, show D major, E shape; check string 6 mark and its notes against the real tuning.

**Acceptance Scenarios**:

1. **Given** Drop D, **When** the user shows D major, E shape, **Then** strings 5–1 match Standard's E shape at frets 10–12, string 6 is marked "altered", and string 6 shows exactly one marker: D (root) at fret 12 — two frets higher than the root at fret 10 in Standard; the tag reads "E shape · roots on strings 4, 1".
2. **Given** an altered-string tuning, **When** shapes are drawn, **Then** strings 5 to 1 look identical to Standard (with real-tuning notes) and string 6 never shows the standard-tuning note of the shape.
3. **Given** Drop D and D major, **When** the G shape is drawn (frets 7–10), **Then** string 6 shows exactly one marker, A (fifth) at fret 7, and no marker at fret 10.
4. **Given** an altered-string tuning, **When** a C, A or D shape (major or minor) is drawn, **Then** string 6 shows no marker for it, as in Standard, and the "altered" mark is present.
5. **Given** an altered-string tuning and a G or E shape whose region on string 6 contains no chord note, **When** the shape is drawn, **Then** string 6 has no markers but keeps the "altered" mark.
6. **Given** Drop C, **When** the user shows any key, **Then** occurrences on strings 5–1 sit where Whole step down puts them for that key and the string-6 rules hold with Drop C's real C2 string.

---

### Edge Cases

- A custom tuning whose open pitches match a compatible or altered class is treated as that class; any other custom tuning is non-compatible.
- Seven-string altered-string case: the lowest string carries no chord marker (as in slice 014); the altered rule applies to string 6, the lowest of the six chord strings, only when strings 5 to 1 keep standard intervals and string 6 does not. Under the FR-2.12 table no 7-string preset is of this class.
- The temporary tuning is active and the user opens the instrument panel: the stored preference is shown as selected; picking any instrument ends the temporary tuning.
- The temporary badge remains visible for as long as the temporary tuning is active, at every viewport width.
- Handedness and string orientation: the "altered" mark and badge follow the existing mapping; musical meaning is unchanged.
- Fret count shortens the region so that no chord note on string 6 fits: handled by the "no markers, mark stays" rule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST classify the active tuning as Compatible, Compatible with an altered string, or Non-compatible from its open-string pitches (FR-2.12).
- **FR-002**: In a Compatible tuning the system MUST draw shapes identically to standard tuning and take every note name, pitch and sound from the real tuning.
- **FR-003**: Shape names MUST describe the drawing and never change with the tuning. In Compatible tunings tag text MUST equal Standard's; in an altered-string tuning the tag's "roots on strings" list MUST omit string 6.
- **FR-004**: In an altered-string tuning the system MUST position and fit occurrences from the real pitches of strings 5 to 1 only, draw them normally on those strings, and on string 6 MUST NOT show the shape's original note.
- **FR-005**: For each G or E shape (major or minor) in an altered-string tuning, the system MUST show on string 6 every chord tone of the key whose real-tuning fret lies within the occurrence's inclusive chord fret span on strings 5 to 1; C, A and D shapes MUST show no string-6 markers. String 6 MUST carry the visible text mark "altered" next to its label whenever shapes are drawn in such a tuning.
- **FR-006**: If no layer note falls in the region of an altered string, the system MUST show no markers there and MUST keep the "altered" mark.
- **FR-007**: In a Non-compatible tuning the system MUST draw no shapes, tags or count note, and MUST explain that CAGED depends on the standard relationship between the strings.
- **FR-008**: In that state the system MUST offer **View in standard tuning** and **Go to Triads**.
- **FR-009**: **View in standard tuning** MUST show Standard (or 7-string standard for 7 strings) in this view only, keeping the preferred string count, fret count, handedness and orientation, with a permanent badge "Temporary tuning: [name]" replacing the FR-2.10 tuning badge, and MUST NOT write to the stored instrument preference or the URL.
- **FR-010**: The temporary tuning MUST be dropped when the user leaves CAGED or reloads, and MUST end when the user confirms an instrument in the panel; key, quality and spelling changes MUST NOT end it. The badge MUST open the instrument panel with the preferred instrument selected.
- **FR-011**: Changing to a Non-compatible tuning while CAGED is open MUST move the tool to the FR-007 state immediately, preserving key and quality; changing to another class MUST redraw accordingly.
- **FR-012**: **Go to Triads** MUST open Triads under the preferred instrument in any tuning.
- **FR-013**: The text description of the fretboard MUST state the tuning in use, name the "altered" string, the temporary tuning, or the absence of shapes, as applicable.
- **FR-014**: The notice, actions, badge and "altered" mark MUST be keyboard-operable and not rely on color alone.
- **FR-015**: The interim non-compatible message from slice 014 MUST be replaced: Non-compatible tunings show the FR-007/FR-008 state, and altered-string tunings (Drop D, Drop C) now draw shapes per FR-004–FR-006.
- **FR-016**: The non-compatible notice MUST read "CAGED depends on the standard relationship between the strings, so its shapes don't exist in [tuning name]." with the buttons **View in standard tuning** then **Go to Triads**; key and quality controls MUST stay visible and keep their values.
- **FR-017**: Every marker's note name and pitch, including on the altered string, MUST come from the real tuning (Drop D string 6 fret 12 = D3).

### Key Entities

- **Tuning class**: Compatible, Compatible with an altered string, or Non-compatible; derived from the open-string pitches.
- **Temporary tuning**: A per-view standard tuning that overrides the preferred instrument in CAGED only; never stored.
- **Altered string**: String 6 in Drop D or Drop C (or a matching custom tuning); carries the "altered" mark and, for G and E shapes, region-computed chord tones instead of the shape's note.
- **Shape region (string 6)**: Inclusive fret span of an occurrence's chord notes on strings 5 to 1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In all 14 preset tunings, CAGED shows the correct class behavior (shapes, altered mark, or explanation with two actions) with no invented shape in any non-compatible tuning.
- **SC-002**: A user in Open G reaches C major's shapes in standard tuning with one action and sees the temporary-tuning badge at all times.
- **SC-003**: In 100% of compatible-tuning checks, shape drawings equal the standard drawings and every note name equals the real tuning's note (verified for Half step down E shape at frets 0 and 3).
- **SC-004**: In Drop D and Drop C, for every key and quality, 100% of string-6 markers are chord tones at their real-tuning fret inside the region (D major: E shape → fret 12 only, G shape → fret 7 only); the "altered" mark is present in 100% of altered-string drawings, including those with no markers.
- **SC-005**: The stored instrument preference is unchanged after any use of the temporary tuning.
- **SC-006**: Switching the instrument while CAGED is open updates the view within the existing instrument-change budget (300 ms).
- **SC-007**: Every state introduced here passes automated accessibility checks with zero violations.

## Assumptions

- Slices 014 (CAGED shapes), 009 (instrument panel and tunings) and 011 (custom tuning) are in place.
- The Chord layer is the only layer in this slice, so "active layer" on an altered string means the chord's root, third and fifth.
- Layers, focus, connections and Listen arrive in later CAGED slices; they are not required here.
- Custom CAGED models for open tunings are out of scope (Q-5).
- Language/notation: English only, as in slice 014.
