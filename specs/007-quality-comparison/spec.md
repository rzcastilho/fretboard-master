# Feature Specification: Triads Quality Comparison

**Feature Branch**: `feature/007-quality-comparison`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/002-triads-across-the-neck/002-quality-comparison.md (id 002, quality-comparison)." Source sections: Area 5 (FR-5.11 Compare, FR-5.12 augmented symmetry, FR-5.17 Listen), Area 7 (FR-7.4 comparison playback), FR-2.6 (mirroring of comparison arrows), Edge cases Area 5 (EC-5.4, EC-5.5, EC-5.9, EC-3.1), Design 3.5 Motion and §1 Principles, TM-5 triad shapes.

**Prerequisites**: The Triads tool with the Isolated view (feature 005-triads-isolated-view) and the Full neck and All notes views (feature 006-full-neck-and-all-notes).

## Clarifications

### Session 2026-10-02 (clarify reviewer)

No material ambiguity remains; no human escalation needed. Each item is either derived from a source (cited) or an assumed default (marked **Default**), and is reflected in the requirement text below.

- **C1 — Which triad is "first" (derived: FR-5.11, FR-7.4, UJ-2 steps 8–9).** The *first* triad is the current selection (root, quality, inversion, set) and is drawn with solid markers. The *second* (comparison) triad uses the comparison quality and is the one whose differing notes get the dashed outline. Arrows point from the first triad's position to the second's. **Listen to comparison** plays first, then second.
- **C2 — Root spelling of the comparison triad (derived: FR-5.11 "the two triads of the same root"; TM-4.2; 005 C1).** The comparison triad uses the *first triad's effective root spelling* (spelling override or the TM-4.3 default for the **current** quality), not the TM-4.3 default for the comparison quality. Its other notes are spelled from that root by TM-4.2. Example: D♭ major compared with minor shows D♭–F♭–A♭ (not C♯–E–G♯), so the root letter never changes and only the altered notes differ. If the user swaps the current quality (C5), the existing 005 C1 rule for the new current quality applies.
- **C3 — Initial comparison quality (Default; DX-2 "one tap away", J-6 "major and minor (or diminished and augmented)").** Turning Compare on selects, without further input, the last comparison quality used in this session if it differs from the current quality; otherwise the *one-note partner* of the current quality: major → minor, minor → major, diminished → minor, augmented → major. The comparison is drawn immediately (never an empty "pick a quality" state). The list (FR-002) lets the user change it.
- **C4 — Comparison list presentation (Default).** The list offers the three other qualities in the fixed product order major, minor, diminished, augmented (skipping the current one), as a single-select control with the chosen one marked, visible next to the fretboard while Compare is on (design §4 zone E). Quality names come from the existing catalog entries.
- **C5 — Current quality becomes the comparison quality (derived: constitution X "adjust and tell"; refines User Story 4 sc. 2).** The two are swapped: the new comparison quality is the previous current quality. A one-line non-blocking notice states it (catalog text, e.g. "Now comparing with major"). Any other quality change keeps the comparison quality.
- **C6 — The pair's octave and "falls below the open string" (derived: FR-5.11, TM-5.3, 005 C9).** The comparison triad is the first triad's shape with each differing note moved by its interval difference on the same string (third: ±1 fret; fifth: ±1 fret, or ±2 for diminished ↔ augmented); shared notes keep their frets. A *pair occurrence* is an octave (first-triad occurrence + k×12) at which every note of both triads lies within 0…fret count. In Isolated:
  - If the first triad's occurrence k has a comparison note at fret < 0, the pair is shown at k+1 (12 frets up) when that pair occurrence fits fully. Reference: G major vs minor, 2nd inv., set 4-3-2, standard 22 frets → major 12-12-12, minor 12-12-11, arrow on string 2 (TM-9 sample 10).
  - **Octave up / Octave down** move between pair occurrences while Compare is on; the stored occurrence index indexes the pair occurrences and is clamped to the last valid one when Compare turns on, the comparison quality changes, or Compare turns off (index then refers to first-triad occurrences again). Quality, root, inversion, and set changes keep resetting it to 0 (005 C9).
- **C7 — No pair occurrence fits fully (derived: EC-5.4; Default for the octave shown).** When no octave holds both triads entirely, the pair is shown at the first triad's occurrence (the first triad is always complete; the user's selection is never cut). Each comparison note outside 0…fret count is not drawn; instead an off-fretboard arrow at the edge of its string, pointing past the nut (fret < 0) or past the last fret (fret > fret count), labelled with the note's name (notation layer). This covers both "below the open string with the octave above past the last fret" and "comparison note one or two frets past the last fret". Both triads stay in the same octave (never one in each). If the first triad itself has no occurrence (beyond-fret or does-not-close), the 005 guidance shows and no comparison is drawn (FR-5.11 + EC-5.2).
- **C8 — Full neck octave rule (Default; 006 C1 chain already contains every +12 occurrence).** In Full neck, each chain shape is paired with its comparison counterpart at the *same* frets region; shapes are not shifted, because the octave-up counterpart is already its own chain shape. A chain shape whose comparison note falls below fret 0 or past the last fret shows the C7 off-fretboard arrow for that note; other shapes are unaffected. No chain shape is hidden or added by Compare. Reference: G major vs minor, 2nd inv., set 4-3-2, 22 frets → 0-0-0 shape shows an off-nut arrow labelled B♭ on string 2; 12-12-12 shape shows minor at 12-12-11 with a one-fret arrow.
- **C9 — Arrow label wording (Default; design §5 "number of frets of the movement").** Each on-board arrow carries the size as "1 fret" / "2 frets" (catalog plural rules). Direction is shown by the arrowhead (screen) and stated in words only in the text description ("toward the nut" / "toward the body"), which is orientation-independent; the arrowhead follows handedness (FR-2.6). Off-fretboard arrows carry the note name only (EC-5.4).
- **C10 — Shared-position rule (derived: EC-3.1, FR-5.11).** With same root, inversion, and set, every unchanged note lies at the identical position in both triads, so it is a single solid marker with its function; there is never a cross-function collision. Differing notes always land on different frets of the same string.
- **C11 — Composition panel difference emphasis (Default; constitution V "not by color alone").** The panel shows two columns, first triad then comparison triad, each with name ("A major — 1st inversion" / "A minor — 1st inversion"), the three notes, and the interval formula (R – 3 – 5 / R – ♭3 – 5). In both columns the differing interval(s) and note(s) are bold and carry a visible "changed" text marker (catalog), and the comparison column's heading carries the dashed-outline swatch. The FR-5.12 / FR-5.13 notes appear in the column of the quality they concern. At narrow widths (320 px, 200% zoom) the columns stack, first above second, without truncation.
- **C12 — Listen to comparison timing (Default; reuses 005 C10 tempo `LISTEN_BPM` = 120 and the slice-003 sequence request).** One `sequence` request with three steps at 120 bpm: step 0 = first triad's displayed positions (block), step 1 = rest (no positions, 500 ms pause), step 2 = comparison triad's displayed positions (block). Time marks: first block 0–500 ms, second block 1000–1500 ms. Sync pulses per FR-7.6. Omitted off-fretboard notes (C7) do not sound; the one-line notice names them (e.g. "B♭ is off the fretboard and was not played"). The plan must confirm the engine accepts an empty rest step (or add it).
- **C13 — Listen to comparison in Full neck (Default).** It plays only the *selected shape's* pair: the chain shape of the selected inversion at the stored occurrence index (006 C3), or, if that occurrence is not displayed, the lowest displayed shape of the selected inversion. It does not walk the whole chain (that remains the plain **Listen**, FR-5.17).
- **C14 — Listen vs Listen to comparison (Default).** While Compare is on both commands are offered; plain **Listen** plays only the first triad exactly as before (FR-5.17). **Listen to comparison** is not rendered when Compare is off or in All notes.
- **C15 — Motion on quality change (derived: design §3.5).** On a quality change or comparison-quality change, markers whose (string, fret, function) is unchanged are not re-created or moved; each changing marker slides from old fret to new fret over the token "short" motion duration (≤ 300 ms); arrows and dashed outlines appear at the end of the slide. On turning Compare on/off, comparison markers and arrows fade in/out (short) while first-triad markers stay still. With `prefers-reduced-motion`, all of these are instant.
- **C16 — Compare state lifecycle (derived: ARCH view state, 04 data model "comparison quality (optional)"; Default for persistence).** View state gains `compare: { on: boolean; quality: Quality }` (quality kept when off, for C3). Not persisted to local storage and not in share links in this slice. **Reset tool** sets `on = false` and clears the remembered quality. Switching to All notes keeps the state untouched (paused); the Compare control and Listen to comparison are hidden there.
- **C17 — Screen-reader description (derived: constitution V; FR-016).** Example (polite live region, accidentals in full): "Comparing G major with G minor, 2nd inversion, strings 4-3-2, shown one octave up. Shared: G on string 4 fret 12, D on string 3 fret 12. Changed: the third, B on string 2 fret 12 moves 1 fret toward the nut to B flat on fret 11." Off-fretboard notes: "B flat is off the fretboard, below the nut." Announced once per comparison change, not per animation frame.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See that quality is one altered note (Priority: P1)

A guitarist has memorized major and minor as two separate shapes. In the Triads tool, in the Isolated view, they turn on **Compare** and pick a second quality from a list that leaves out the current one. The fretboard overlays the two triads that share the same root, inversion, and string set. Notes the two triads share appear once. Each note that differs appears at both positions: the comparison triad's note has a dashed outline in the same function color. A short arrow joins the two positions and states the direction and size of the move in frets. The composition panel shows both formulas side by side and emphasizes the difference. The player sees that major becomes minor by moving a single note one fret toward the nut.

**Why this priority**: This is the lesson the feature exists to teach. Everything else extends it to another view, adds sound, or handles limits.

**Independent Test**: In Isolated, with C major in root position on set 3-2-1, turn Compare on and pick minor. Check that two of the three notes appear once, the third appears at two frets one apart, the comparison position has a dashed outline, and a one-fret arrow joins them.

**Acceptance Scenarios**:

1. **Given** a major triad in Isolated, **When** the user compares with minor, **Then** exactly one note (the third) appears at two positions, the comparison position is one fret closer to the nut, and an arrow labelled one fret points toward the nut.
2. **Given** a minor triad, **When** the user compares with diminished, **Then** only the fifth moves, one fret toward the nut.
3. **Given** a major triad, **When** the user compares with augmented, **Then** only the fifth moves, one fret toward the body.
4. **Given** any current quality, **When** the user opens the list of comparison qualities, **Then** it offers the other three qualities and never the current one (EC-5.5).
5. **Given** a comparison is shown, **When** the user turns Compare off, **Then** the fretboard returns to the single triad of the current quality with no dashed outlines or arrows.
6. **Given** a comparison is shown, **When** the user inspects the markers, **Then** the meaning is carried by the dashed outline and the arrow as well as by color: a user who cannot tell the colors apart can still tell which notes are shared, which are the comparison notes, and which way they moved.
7. **Given** a comparison is shown, **When** the user reads the composition panel, **Then** both formulas appear side by side with the differing interval emphasized by more than color (for example weight plus a marker).

---

### User Story 2 - Compare in the Full neck view (Priority: P2)

The player wants to see the same lesson everywhere along the neck. In Full neck they turn on **Compare** and pick a second quality. Every shape in the chain is overlaid with its counterpart of the second quality, with the same root, inversion, and string set, so the player can find the changing note near whichever shape is under their hand.

**Why this priority**: It extends P1 to the chain, which is the reason Compare lives in both views, but P1 already delivers the lesson alone.

**Independent Test**: In Full neck, A major on set 3-2-1 with Compare on minor: every displayed shape shows one note at two positions with a one-fret arrow, and the other notes once.

**Acceptance Scenarios**:

1. **Given** Full neck with Compare on, **When** the fretboard is shown, **Then** each chain shape is overlaid in place with the second quality's shape of the same inversion, with arrows and dashed outlines per shape; a shape whose comparison note falls outside the fretboard shows an off-fretboard arrow for that note instead of shifting (C8). Example: G major vs minor, 2nd inv., set 4-3-2 → the 0-0-0 shape shows an off-nut arrow labelled B♭ on string 2, and the 12-12-12 shape shows minor at 12-12-11 with a one-fret arrow.
2. **Given** Compare is on in Isolated, **When** the user switches to Full neck, **Then** Compare stays on with the same second quality. **Given** the user switches to All notes, **Then** Compare is not offered and no comparison is drawn.
3. **Given** the user returns from All notes to Isolated or Full neck, **When** the view appears, **Then** the previous comparison is restored.

---

### User Story 3 - Handle octave and fretboard limits (Priority: P2)

Some comparisons need a note that does not exist at the lowest position. G major, 2nd inversion, on set 4-3-2 sits at open strings (0-0-0), but the minor's B♭ would need fret −1. The tool moves both triads one octave up and shows them there: major at 12-12-12, minor at 12-12-11, with a one-fret arrow on string 2. If even that octave runs past the last fret, the notes that fit are shown and the missing note gets an arrow pointing off the fretboard, labelled with the note name. The player never sees a blank fretboard or a partial, unexplained overlay.

**Why this priority**: Without it the lesson breaks for common triads. It is a correctness edge of P1 rather than a separate goal.

**Independent Test**: Compare G major with G minor, 2nd inversion, set 4-3-2, standard tuning: verify 12-12-12 and 12-12-11 and the arrow on string 2.

**Acceptance Scenarios**:

1. **Given** G major in 2nd inversion on set 4-3-2 in standard tuning, **When** the user compares with minor, **Then** both triads appear an octave up, major at 12-12-12 and minor at 12-12-11, with a one-fret arrow on string 2 toward the nut.
2. **Given** a comparison for which no octave holds both triads entirely, **When** the comparison is shown, **Then** the first triad is shown complete at its occurrence, the comparison notes that fit are displayed, and each comparison note that does not fit has an arrow pointing off the fretboard (past the nut or past the last fret) labelled with its note name, with the direction following the fretboard orientation (EC-5.4, C7).
3. **Given** the first triad alone fits at the lowest position, **When** the comparison triad does not, **Then** both triads are shown in the same octave, never one in each.

---

### User Story 4 - Keep the comparison when the root changes (Priority: P2)

While comparing G major with G minor, the player changes the root to A. The comparison stays on, with the same second quality, recalculated for A. The same applies to inversion and string set: Compare is a mode of the view, not a one-time result.

**Why this priority**: Players explore the lesson by moving the root. Dropping the comparison at each change would make the tool tedious.

**Independent Test**: With G major vs G minor, 2nd inversion, set 4-3-2, change the root to A and verify the overlay recalculates for A major vs A minor.

**Acceptance Scenarios**:

1. **Given** G major compared with G minor (2nd inversion, set 4-3-2), **When** the user changes the root to A, **Then** Compare stays on and shows A major with A minor recalculated, with correct spelling (EC-5.9).
2. **Given** a comparison is on (e.g. major compared with minor), **When** the user changes the current quality to the comparison quality (minor), **Then** the two swap (minor compared with major) and a one-line non-blocking notice states it (C5). The list still excludes the new current quality.
3. **Given** a comparison is on, **When** the user changes the inversion or string set, **Then** the comparison is recalculated for the new inversion or set.

---

### User Story 5 - Watch only the changing note move (Priority: P3)

When the user changes quality, with or without Compare, only the note that changes slides to its new fret; the notes that do not change stay still. The motion lasts up to 300 ms and is instant when the user prefers reduced motion.

**Why this priority**: It reinforces the lesson but is not required for the lesson to work.

**Independent Test**: With a triad shown, change quality from major to minor and verify only the third's marker moves, and the other two do not move or redraw.

**Acceptance Scenarios**:

1. **Given** a triad is shown, **When** the user changes quality from major to minor, **Then** only the third slides one fret toward the nut, and the root and fifth do not move.
2. **Given** a comparison is shown, **When** the user changes the comparison quality, **Then** only the comparison notes that change slide.
3. **Given** the user prefers reduced motion, **When** any such change happens, **Then** it is instant.
4. **Given** a root, inversion, or string set change, **When** the shape changes, **Then** the existing motion rules for those changes apply (this feature only constrains quality changes and comparisons).

---

### User Story 6 - Listen to the comparison (Priority: P3)

The player taps **Listen to comparison**. The tool plays the first triad as a block, a short pause, then the second triad as a block, so the ear can hear the one altered note.

**Why this priority**: Hearing the difference confirms what the eye sees, but sound never carries information that the display lacks.

**Independent Test**: With a comparison on, activate Listen to comparison and verify the sequence of two blocks with a pause between, at the calculated pitches.

**Acceptance Scenarios**:

1. **Given** a comparison is shown, **When** the user activates **Listen to comparison**, **Then** the first triad sounds as a block, then a short pause, then the second triad as a block, each note at its calculated pitch in the octave shown.
2. **Given** a comparison with a note that does not fit on the fretboard, **When** the user activates Listen, **Then** only the notes that are displayed on the fretboard sound with the others omitted, and the omission is stated in one line (never silent adjustments).
3. **Given** the comparison is playing, **When** the user changes the root, quality, comparison quality, inversion, string set, view, or turns Compare off, **Then** playback stops.
4. **Given** Compare is off, **When** the user looks at the actions, **Then** **Listen to comparison** is not offered, and the standard **Listen** command behaves as before.

---

### Edge Cases

- Comparison quality equals the current quality: never offered (EC-5.5). When a change of the current quality would make them equal, see User Story 4, scenario 2.
- A shared note sits at the same position in both triads: shown once, using the single marker with the function of highest priority (EC-3.1); no arrow, no dashed outline.
- Quality pairs that differ in both third and fifth (for example minor with augmented, major with diminished, diminished with augmented) show two arrows, one per moving note. The root never moves.
- Comparison note falls below the open string: in Isolated both triads move up one octave when both fit there (User Story 3, C6); in Full neck the shape stays and gets an off-nut arrow (C8).
- No octave holds both triads: the first triad is shown complete, the missing comparison note has an off-fretboard arrow with its name (EC-5.4, C7). This includes a comparison note one or two frets past the last fret.
- Comparison notes with unusual spellings (augmented fifth, diminished fifth, double accidentals on altered roots): each note's name follows the spelling rules of the music theory reference, never respelled to look simpler.
- Left-handed mode: the arrow's direction, the off-fretboard arrow, and the "toward the nut" and "toward the body" wording follow the mirrored orientation (FR-2.6).
- Open strings are involved in either triad: shown normally; an arrow may start or end at fret 0.
- Wide stretch: the wide-stretch mark applies independently to each triad's shape; a comparison never hides a shape for difficulty.
- Compare in All notes: not offered. A comparison already on is paused, not discarded, and returns when the user goes back to Isolated or Full neck.
- Guidance states (set does not close, shape beyond the last fret): no comparison is drawn over guidance; the guidance for the first triad applies and Compare stays on.
- Narrow screens and 200% text zoom: the side-by-side formulas, the quality list, and the arrow labels remain readable without truncation or overlap; only the fretboard scrolls horizontally.
- The comparison list in Portuguese and Spanish: quality names and the arrow wording come from the message catalog.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Triads tool MUST offer a **Compare** control in the Isolated and Full neck views, off by default. In All notes it MUST NOT be offered (FR-5.11, FR-5.10). Switching to All notes MUST pause the comparison without discarding it.
- **FR-002**: When Compare is on, the tool MUST offer a list of second qualities that contains every quality except the current one, in the order major, minor, diminished, augmented. The list MUST never offer the current quality (EC-5.5). Turning Compare on MUST immediately show a comparison with the last comparison quality used in the session if valid, otherwise the one-note partner (major → minor, minor → major, diminished → minor, augmented → major) (C3).
- **FR-003**: The tool MUST overlay two triads having the same root, inversion, and string set, calculated from the configured tuning, string count, and fret count. Hand-drawn shapes are forbidden. The comparison triad MUST use the first triad's effective root spelling, with its other notes spelled by TM-4.2 from that root (C2: D♭ major vs minor → D♭–F♭–A♭).
- **FR-004**: The two triads MUST always be shown in the same octave. In Isolated, if any note of the comparison triad would fall below the open string, both triads MUST be shown one octave higher (12 frets) when both fit there; the octave commands move between octaves where both triads fit (C6). If no octave holds both triads entirely, the first triad MUST be shown complete at its occurrence, the comparison notes that fit MUST be shown, and each missing comparison note MUST be marked with an arrow pointing off the fretboard (past the nut or the last fret), labelled with its note name (EC-5.4, C7). If the first triad itself has no occurrence, the existing guidance shows and no comparison is drawn.
- **FR-005**: Notes shared by both triads MUST appear once, with the function marker of highest priority (EC-3.1).
- **FR-006**: Each note that differs MUST appear at both positions. The comparison triad's marker MUST have a dashed outline and keep the note's function color and marker shape (root rounded square, third circle, fifth diamond).
- **FR-007**: An arrow MUST join each pair of positions and state the direction and size of the move in frets. It MUST follow handedness and string orientation, and MUST be the only added element needed to read the move.
- **FR-008**: Comparison MUST NOT rely on color alone: the dashed outline and the arrow carry the meaning.
- **FR-009**: The composition panel MUST show both formulas side by side and emphasize the difference with more than color. The panel MUST still state the augmented symmetry (FR-5.12) and the diminished characteristic note (FR-5.13) for whichever qualities are shown.
- **FR-010**: Comparisons MUST produce these moves, in standard and any other valid tuning: major with minor moves exactly one note (the third) one fret toward the nut; minor with diminished moves only the fifth one fret toward the nut; major with augmented moves only the fifth one fret toward the body. Every other quality pair MUST show the moves its intervals imply.
- **FR-011**: Changing the root, spelling, quality, inversion, or string set while Compare is on MUST keep the comparison and recalculate it, with correct note spelling (EC-5.9). If a quality change makes the current quality equal the comparison quality, the two MUST swap and a one-line notice MUST state it (C5).
- **FR-012**: In Full neck, every displayed chain shape MUST be overlaid in place with its comparison counterpart. Shapes are not shifted by octave (the octave-up counterpart is already its own chain shape); a comparison note outside 0…fret count gets the FR-004 off-fretboard arrow. Compare MUST NOT add or hide chain shapes (C8).
- **FR-013**: When quality or comparison quality changes, with or without Compare, only the note or notes that change MUST move; the others MUST stay still and not be re-created. The motion MUST use the short motion token (no more than 300 ms) and MUST be instant when the user prefers reduced motion. Turning Compare on or off fades comparison markers and arrows only (C15).
- **FR-014**: A **Listen to comparison** command, offered only while Compare is on, MUST play the first triad as a block, a 500 ms pause, then the second triad as a block (one sequence at 120 bpm: block, rest, block; marks 0–500 ms and 1000–1500 ms), each note at its calculated pitch in the octave shown (FR-7.4, C12). In Full neck it plays the selected shape's pair only (C13). Notes that do not fit on the fretboard MUST be omitted and the omission stated in one line naming them. Plain **Listen** keeps playing only the first triad (C14).
- **FR-015**: Playback MUST stop when the root, spelling, quality, comparison quality, inversion, string set, view, or Compare state changes.
- **FR-016**: The comparison MUST have a text description for screen readers, announced politely, stating both triads' names, the notes that differ, the direction and size of each move, any octave shift, and any note that does not fit; with accidentals read in full.
- **FR-017**: The Compare control, the quality list, and **Listen to comparison** MUST be operable by keyboard, with visible focus and a logical order, and every touch target MUST be at least 44×44 CSS px in comfortable mode.
- **FR-018**: The Compare state (on/off and second quality) MUST be part of the tool's view state, kept outside the tool component, so that it survives navigation in the app session and can be driven by other features. It MUST NOT be persisted to local storage or share links in this slice, and **Reset tool** MUST turn Compare off and clear the remembered comparison quality (C16).
- **FR-019**: All new user-facing text (control names, arrow wording, "toward the nut", "toward the body", notices, descriptions, action labels) MUST come from the message catalog. Note names MUST come from the notation layer and accidentals MUST render as ♯ ♭ 𝄪 𝄫.
- **FR-020**: Comparison drawing MUST use only existing design tokens. Dashed outlines, arrows, and motion durations MUST NOT introduce hard-coded values or reuse the root, third, or fifth colors for another purpose.
- **FR-021**: The comparison MUST update within the control-change budget (100 ms) on the reference device profile.

### Key Entities

- **Comparison state**: whether Compare is on and which second quality is chosen. Part of the Triads view state. Always differs from the current quality.
- **Comparison pair**: the two triads (current and second) that share root, inversion, and string set, with the octave shift applied to both.
- **Note move**: for each note that differs, the two positions, the direction (toward the nut or body, after orientation), and the size in frets. A move may be off-fretboard, in which case it has only one position and the note name.
- **Comparison playback sequence**: first triad block, pause, second triad block.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Comparing major with minor moves exactly one note, one fret toward the nut, in 100% of the combinations of root (all twelve), inversion, and string set that fit within the fret count; comparing minor with diminished moves only the fifth one fret toward the nut, and major with augmented moves only the fifth one fret toward the body, in 100% of such combinations.
- **SC-002**: G major with G minor, 2nd inversion, set 4-3-2 in standard tuning shows major at 12-12-12 and minor at 12-12-11 with a one-fret arrow on string 2; changing the root to A recalculates the comparison for A without turning Compare off.
- **SC-003**: In every comparison, a first-time user can say which note changes and in which direction without relying on color: verified by checking that every comparison note has both a dashed outline and an arrow with its size.
- **SC-004**: No comparison, in any tuning, string count, or fret count, produces a blank or half-drawn fretboard: every case shows both triads, the fitting notes with an off-fretboard arrow, or the guidance of the first triad.
- **SC-005**: A change of quality moves only the note that changes, in 100% of cases, within 300 ms and instantly when reduced motion is on.
- **SC-006**: Compare, the quality list, and Listen to comparison are fully operable by keyboard alone, and automated accessibility checks report zero violations on the comparison states.
- **SC-007**: Each comparison appears within 100 ms of the control change on the reference device profile.
- **SC-008**: **Listen to comparison** sounds exactly two blocks separated by a pause, with the same pitches as the displayed notes, and stops on any change listed in FR-015.

## Assumptions

- The Isolated and Full neck views, the Triads view state, the Listen command, the notation layer, and the message catalog already exist from features 005 and 006; this feature extends them.
- Compare shows one second quality at a time; comparing three or more qualities, or comparing across roots or string sets, is out of scope (scope boundary).
- The comparison is not part of share links and is not persisted in this slice; the share-link feature will add it.
- The comparison arrow's size is expressed as a number of frets (for example "1 fret"); a shift of more than one fret is shown with the same wording.
- When the quality pair differs in both third and fifth, two arrows are shown, one per moving note.
- The octave shift applies to the pair as a whole: either both triads are at the first triad's occurrence or both are an octave up (C6, C7).
- In Full neck, a shape whose comparison note falls outside the fretboard shows the off-fretboard arrow for that note only; other shapes are unaffected and no shape is shifted (C8).
- The pause in Listen to comparison is 500 ms (one rest beat at 120 bpm), the same timing in every view (C12).
- Dashed outline styling, arrow styling, and the formula-difference emphasis follow the existing design system tokens.
