# Feature Specification: Triads Full Neck and All Notes Views

**Feature Branch**: `feature/006-full-neck-and-all-notes`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/002-triads-across-the-neck/001-full-neck-and-all-notes.md (id 001, full-neck-and-all-notes)." Source sections: Area 5 (FR-5.9, FR-5.10, FR-5.12 tag rule, FR-5.17 view-following Listen), Edge cases Area 5 (EC-5.1 and EC-5.2 **See all notes** / **Another set** actions, EC-5.3, EC-5.8), TM-5 (TM-5.3, TM-5.6), UJ-3 step 7.

**Prerequisite**: The Triads tool with the Isolated view (feature 005-triads-isolated-view).

## Clarifications

### Session 2026-10-02 (clarify reviewer)

Each item is marked **derived** (settled by a cited source) or **Default** (conventional choice, constitution-consistent). Clarifications C1–C14 of feature 005 remain in force unless overridden below.

- **C1 — Extent of the Full neck chain (derived: FR-5.9 "every inversion of the triad that fits on the fretboard"; breakdown "all the way up the neck"; TM-5.3 step 5 "Other occurrences lie 12 frets higher"; EC-5.3; EC-6.6 analog).** Full neck shows **every occurrence of every inversion** on the chosen string set: for each of the three inversions, its TM-5.3 lowest occurrence plus k×12 frets for every k ≥ 0 whose highest fret ≤ fret count. It is **not** capped at one octave of the cycle. The breakdown's acceptance example lists the first four shapes of the chain; with 22 frets two more fit and are shown. Reference: A major, set 3-2-1, standard tuning, 22 frets → exactly six shapes: Root position 2-2-0, 1st 6-5-5, 2nd 9-10-9, Root position 14-14-12, 1st 18-17-17, 2nd 21-22-21. C major on 3-2-1 → 2nd 0-1-0, Root 5-5-3, 1st 9-8-8, 2nd 12-13-12, Root 17-17-15, 1st 21-20-20. This supersedes the earlier assumption that the chain stops after one octave.
- **C2 — Chain order (Default; "in order along the frets", FR-5.9).** Shapes are ordered by the fret on the lowest string of the set, ascending (equivalently, by bass pitch). Tags, the text description, and Full neck **Listen** all use this order.
- **C3 — Highlight and selection with repeated inversions (derived: FR-5.9 "the inversion selected in FR-5.4 is highlighted").** Every shape whose inversion equals the selected inversion is at *highlighted* emphasis; every other chain shape is *normal*; positions that belong to no chain shape are *hidden*. Activating any tag sets the inversion to that tag's inversion **and** sets the stored occurrence index (005 C9) to that shape's octave index (0 = lowest occurrence of that inversion), so returning to Isolated shows the shape the user picked. Activating a tag of the already selected inversion only updates the occurrence index (no other change, no playback restart unless the occurrence index changed — then playback stops per FR-014). Changing the inversion with the inversion control resets the occurrence index to 0 (005 C9) and highlights all shapes of that inversion.
- **C4 — Octave commands outside Isolated (Default; 005 C9 "disabled, not hidden").** **Octave up** / **Octave down** apply only to the Isolated view. In Full neck and All notes they are shown disabled (`aria-disabled`, no error styling) and the stored occurrence index is kept unchanged.
- **C5 — Tag content and placement (Default; design spec "Shape and inversion tags: above the fretboard, aligned with the region; they are tappable"; Constitution V, VIII).** Visible tag text is the short inversion name from the message catalog: "Root position", "1st", "2nd". A tag's accessible name is the full inversion name plus frets, low to high (e.g. "2nd inversion, frets 9-10-9"), and it exposes its selected state (`aria-pressed="true"` on tags of the selected inversion). Each tag is horizontally centered over the fret range its shape occupies (lowest to highest fret, open strings included) and moves with the fretboard when it scrolls. Tags never overlap: when two would overlap, the later one in chain order is placed on a second tag row. Tags are at least 44×44 CSS px in comfortable mode. Tag focus order follows chain order.
- **C6 — Wide stretch in Full neck (derived: FR-5.14, 005 FR-025).** A chain shape with span ≥ 5 carries the same "wide stretch" mark as in Isolated, shown on its tag (text or icon plus text, never color alone) and included in the tag's accessible name and the description. It is never hidden.
- **C7 — "No shape fits" in Full neck (derived: EC-5.1, EC-5.2, EC-5.3).** If the set does not close → the does-not-close guidance with **Another set** (005 C11) and **See all notes**. If it closes but no occurrence of any of the three inversions fits within the fret count → the beyond-fret guidance "This shape lies beyond fret [n]" (n = fret count, 005 C6) with **See all notes**. If at least one shape fits → those shapes, with no message (EC-5.3). In Full neck and All notes the guidance and tags row are never shown together.
- **C8 — See all notes / Another set (derived: EC-5.1, EC-5.2; 005 C11).** **See all notes** sets the view to All notes and changes nothing else (inversion, set, and occurrence index are kept). **Another set** applies 005 C11 and keeps the current view. Both actions now appear in the Isolated guidance (completing 005's deferred **See all notes**).
- **C9 — All notes content (derived: FR-5.10).** Every (string, fret) with fret 0…fret count whose pitch class equals the root, third, or fifth is shown at *normal* emphasis with its function marker and the current label type (interval or triad spelling, 005 C5); every other position is hidden. No shape outline, no tags, no wide-stretch mark. All notes is shown even when the chosen set does not close or the chosen shape lies beyond the last fret (it does not depend on the set), so it never shows guidance.
- **C10 — Composition panel in All notes (Default; FR-5.7 "describes the current selection", inversion control disabled).** In All notes the panel name omits the inversion (e.g. "A major") and the low-to-high order line is not shown; notes, intervals, stacking, sounds-as lines, spelling switch, and the augmented/diminished statements are shown as in other views. In Full neck the panel describes the selected inversion exactly as in Isolated.
- **C11 — Full neck Listen (derived: FR-5.17, FR-7.3; Default timing from 005 C10).** One `sequence` request at `LISTEN_BPM` = 120 containing, for each chain shape in chain order (C2), the three single notes low → middle → high string followed by one chord step of all three. For A major on 3-2-1 with 22 frets this is 6 shapes × 4 steps = 24 steps. Repeated inversions are played each time they occur. Sounding positions pulse, also when muted.
- **C12 — All notes Listen: "lowest available octave" (Default; FR-5.17).** Three single-note steps, ascending, no chord step: the root at the lowest pitch at which the root occurs on the instrument (any string, fret 0…fret count); then the third at the nearest pitch above that root; then the fifth at the nearest pitch above that third. Each note is played and pulsed at the position with that pitch that has the lowest fret; ties → the lower-pitched (thicker) string. Reference, standard tuning 22 frets, A major: A2 at string 5 fret 0, C♯3 at string 5 fret 4, E3 at string 4 fret 2.
- **C13 — Playback stop (derived: FR-5.17, EC-7.4; 005 FR-028).** Playback stops on any change of view, root, spelling, quality, inversion, string set, occurrence index, or label type, and on activating **See all notes** or **Another set**.
- **C14 — View state, persistence, reset (derived: FR-5.1, FR-1.7, FR-1.11, data model §Triads "view (isolated, full neck, all notes)").** The view is a new field of `TriadsViewState` with values `isolated | full-neck | all-notes`, initial `isolated`. It lives for the session only (FR-1.7); it is not written to local storage in this slice. **Reset tool** returns it to `isolated`. Share-link encoding of the view is out of scope (no link codec exists yet) and belongs to the share-link feature.
- **C15 — Fretboard scroll on entering a view (Default; Constitution VII "fretboard is the protagonist", reduced motion).** On switching to Full neck the fretboard keeps its current scroll position if any highlighted shape is fully visible; otherwise it scrolls the lowest highlighted shape into view (instant under `prefers-reduced-motion`). Tag activation never scrolls.
- **C16 — Set-pattern teaching points as testable facts (derived: TM-5.5, TM-5.6, standard tuning intervals).** "Pattern" = a shape's frets minus its lowest fret. In standard tuning, for every root, quality, and inversion: the pattern on 6-5-4 equals the pattern on 5-4-3 (e.g. C major root position 8-7-5 and 3-2-0 → both 3-2-0); the pattern on 4-3-2 differs from the one on 3-2-1 (e.g. 10-9-8 → 2-1-0 vs 5-5-3 → 2-2-0).
- **C17 — Augmented chain (derived: FR-5.12, EC-5.8).** For augmented triads consecutive chain shapes have the same pattern and lie exactly 4 frets apart. Tags name the inversion computed for the chosen root (TM-5.2 bass function), never re-rooted. Reference, C augmented, 3-2-1, standard tuning, 22 frets: 2nd 1-1-0, Root 5-5-4, 1st 9-9-8, 2nd 13-13-12, Root 17-17-16, 1st 21-21-20.
- **C18 — Text description (Default; Constitution V; FR-016).** Full neck: one polite announcement listing the triad name, the string set, then each chain shape in order as "<inversion name>, frets a-b-c" (plus "wide stretch" when marked), and which inversion is selected. All notes: triad name, then for each function (root, third, fifth) the note name read in full and its positions grouped by string ("A: string 6 frets 5, 17; string 5 frets 0, 12; …"). Re-announced on each change, not on scroll.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how the inversions chain along a string set (Priority: P1)

An intermediate player knows a triad in one spot but cannot find its inversions in real time. In the Triads tool they switch from **Isolated** to **Full neck** with a segmented control. On the chosen string set the fretboard shows every occurrence of every inversion that fits, in order along the frets, all the way up the neck: the cycle root position → 1st → 2nd → root position an octave higher, continuing while shapes fit (C1). Each shape carries a tappable tag above the fretboard with its inversion name. The selected inversion is highlighted and the others are at normal emphasis, so the player can grab the one nearest their hand.

**Why this priority**: This is the core of the feature and the reason the player opens it: finding the nearest inversion without recalculating.

**Independent Test**: Choose A major, set 3-2-1, 22 frets, Full neck. Check the six shapes, their frets, and their tags against the reference (C1).

**Acceptance Scenarios**:

1. **Given** A major on set 3-2-1 with 22 frets, **When** the user selects Full neck, **Then** the fretboard shows root position at 2-2-0, 1st inversion at 6-5-5, 2nd inversion at 9-10-9, root position again at 14-14-12, 1st inversion at 18-17-17, and 2nd inversion at 21-22-21 — exactly these six shapes — each with a tag naming its inversion, in that order along the frets (C1, C2).
2. **Given** that view with root position selected, **When** the user taps the "2nd" tag, **Then** 2nd inversion becomes the selected inversion, both 2nd-inversion shapes (9-10-9 and 21-22-21) are highlighted, the other four shapes are at normal emphasis, the inversion control shows 2nd, and the stored occurrence index is that tag's octave index (C3).
3. **Given** Full neck is shown, **When** the user changes root, quality, or string set, **Then** all shapes and tags update together, the selected inversion stays selected, and the view stays Full neck.
4. **Given** Full neck is shown, **When** the user changes the inversion with the inversion control, **Then** the highlight moves to every shape of that inversion and the occurrence index resets to 0 (C3).
5. **Given** a keyboard-only user, **When** they tab to the tags, **Then** each tag is focusable in chain order with a visible focus indicator, activates with Enter or Space, and exposes its selected state to assistive technology (C5).

---

### User Story 2 - See every occurrence of the three notes (Priority: P2)

The player wants the whole map of the triad rather than one shape. They switch to **All notes**. Every occurrence of the root, third, and fifth appears on every string, each with its function marker and label, without shape outlines. The inversion and string-set controls are visibly disabled because they do not apply here.

**Why this priority**: It completes the three-view picture and is the destination of the two guidance actions in Story 3, but the player can already learn inversions from Story 1.

**Independent Test**: Choose A major, switch to All notes, and verify that every A, C♯, and E on every string and fret has the correct function marker and that the two controls are disabled.

**Acceptance Scenarios**:

1. **Given** A major in Full neck, **When** the user switches to All notes, **Then** the inversion and string-set controls are disabled (greyed out and not operable) and every A, C♯, and E on every string up to the last fret is marked by function: root as rounded square, third as circle, fifth as diamond, each with its label.
2. **Given** All notes, **Then** no shape outline or inversion tag is shown.
3. **Given** All notes, **When** the user changes root or quality, **Then** the marked notes update. **When** the user switches back to Full neck or Isolated, **Then** the controls become enabled again and keep their previous values.
4. **Given** All notes with a note-name label type, **Then** markers use the triad's own spelling (for example F𝄪, not G).

---

### User Story 3 - Recover from guidance by seeing all notes or another set (Priority: P2)

When the Isolated view shows "This shape lies beyond fret [n]" or "This triad does not close on this string set with the current tuning", the guidance offers **See all notes**, which switches to the All notes view. The does-not-close guidance also offers **Another set**.

**Why this priority**: These actions already appear in guidance from the earlier feature; this story makes them lead somewhere useful, so the user is never stranded on an empty fretboard.

**Independent Test**: With an instrument that triggers each guidance, activate each action and check the resulting view.

**Acceptance Scenarios**:

1. **Given** the beyond-fret guidance is shown, **When** the user activates **See all notes**, **Then** the view becomes All notes with the occurrences of the three notes visible, and inversion, string set, and occurrence index are unchanged (C8).
2. **Given** the does-not-close guidance is shown, **When** the user activates **See all notes**, **Then** the view becomes All notes.
3. **Given** the does-not-close guidance is shown, **When** the user activates **Another set**, **Then** the nearest string set that closes is selected (same behavior as in the Isolated view) and the current view stays.
4. **Given** Full neck on a string set whose triad does not close, **Then** the same guidance and actions appear in place of the shapes.

---

### User Story 4 - Listen follows the view (Priority: P3)

The player taps **Listen**. In Full neck it plays every displayed inversion one after another from lowest to highest, each arpeggiated (low, middle, high) and then blocked. In All notes it plays the three notes once, in the lowest available octave.

**Why this priority**: Sound reinforces the shapes, but all information is already visible without it.

**Independent Test**: Trigger Listen in each view using the injectable audio clock and compare the sequence of pitches.

**Acceptance Scenarios**:

1. **Given** A major, set 3-2-1, Full neck, **When** the user taps **Listen**, **Then** six shapes play in chain order (2-2-0, 6-5-5, 9-10-9, 14-14-12, 18-17-17, 21-22-21), each as three single notes low to high and then the three together: 24 steps in total (C11).
2. **Given** All notes, **When** the user taps **Listen**, **Then** the three notes play once as single notes, ascending: for A major in standard tuning, A2 (string 5 fret 0), C♯3 (string 5 fret 4), E3 (string 4 fret 2) (C12).
3. **Given** playback is running, **When** the user changes view, root, spelling, quality, inversion, string set, occurrence index, or label type, or activates **See all notes** or **Another set**, **Then** playback stops (C13).
4. **Given** sound is muted, **When** Listen runs, **Then** the sounding positions still pulse visually.

---

### User Story 5 - Understand the special cases in Full neck (Priority: P3)

A teacher or learner reads the chain and sees what the teaching points predict. Sets 6-5-4 and 5-4-3 show identical shapes; sets 4-3-2 and 3-2-1 differ. For augmented triads the three inversions have the same drawing four frets apart, and the tags still name inversions relative to the chosen root. When only one or two inversions fit, those are shown with no message.

**Why this priority**: These are correctness and teaching details; the base views work without extra treatment, so they validate rather than add capability.

**Independent Test**: Compare displayed frets for each case with the reference tables.

**Acceptance Scenarios**:

1. **Given** C major root position in Full neck, **When** the user switches between set 6-5-4 and set 5-4-3, **Then** the pattern (frets minus lowest fret) of each inversion is the same on both sets (e.g. root position 8-7-5 and 3-2-0, both 3-2-0); on 4-3-2 and 3-2-1 the patterns of the same inversion differ (e.g. 10-9-8 → 2-1-0 vs 5-5-3 → 2-2-0) (C16).
2. **Given** C augmented in Full neck, **Then** consecutive shapes have the same pattern and lie exactly four frets apart — on 3-2-1 with 22 frets: 2nd 1-1-0, Root 5-5-4, 1st 9-9-8, 2nd 13-13-12, Root 17-17-16, 1st 21-21-20 — and the tags name inversions relative to C (C17).
3. **Given** a fretboard so short that only one or two inversions fit, **When** Full neck is shown, **Then** those shapes and their tags are shown and no message, notice, or empty-state text appears.

---

### Edge Cases

- **Repeated inversion in the chain**: each inversion can occur more than once (every 12 frets), so several shapes carry the same tag. Selecting that inversion highlights every shape that carries it; tapping any of those tags selects it and sets the occurrence index to that shape's octave (C3).
- **Chain starting at a non-root inversion**: when the lowest shape on the neck is a 1st or 2nd inversion (for example C major on set 3-2-1, where 2nd inversion sits at 0-1-0), the chain starts there and continues the cycle root → 1st → 2nd up to the last fret (C1, C2).
- **Open strings**: shapes using fret 0 appear normally and are included in the chain.
- **Wide stretch**: a shape with a span of five or more frets keeps its "wide stretch" mark in Full neck; shapes are never hidden for difficulty.
- **No shape fits** (does-not-close or all shapes beyond the last fret): the guidance with its actions replaces the shapes; the tags row is absent (C7). All notes never shows guidance (C9).
- **Overlapping tags**: when two tags would overlap horizontally, the later one goes to a second tag row (C5).
- **Octave commands**: disabled in Full neck and All notes; the occurrence index is kept (C4).
- **View change while an inversion is selected**: the selected inversion, string set, and other selections survive switching among Isolated, Full neck, and All notes.
- **Double-accidental spellings** (for example D♯ major): markers and tags show the spelling the theory requires.
- **Augmented symmetry**: the tag for a shape names the inversion relative to the chosen root, never relative to the note that happens to be its bass for another root.
- **Narrow screens (320 px)**: tags remain at least 44×44 CSS px touch targets, and the fretboard scrolls horizontally while the tags stay aligned with their shapes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Triads tool MUST offer a segmented view control with three options: Isolated, Full neck, and All notes. Isolated remains the default, and exactly one option is active at a time.
- **FR-002**: In Full neck, the fretboard MUST show, on the chosen string set, every occurrence of every inversion (TM-5.3 lowest occurrence plus k×12 frets) whose highest fret does not exceed the fret count, ordered by the fret on the lowest string of the set (C1, C2). Positions belonging to no chain shape MUST be hidden.
- **FR-003**: Every Full neck shape MUST be calculated from the configured tuning, string count, and fret count using the same shape calculation as the Isolated view; no pre-drawn shapes.
- **FR-004**: Each Full neck shape MUST have a tag above the fretboard, centered over its shape's fret range, naming its inversion ("Root position", "1st", "2nd"), always relative to the chosen root, with a full accessible name and selected state; tags MUST NOT overlap (C5). A shape with span ≥ 5 MUST show the wide-stretch mark on its tag (C6).
- **FR-005**: The selected inversion's shape(s) MUST be at highlighted emphasis and all other shapes at normal emphasis. Emphasis MUST NOT depend on color alone (opacity plus size, per the design system).
- **FR-006**: Tapping or activating a tag MUST select that inversion and set the occurrence index to that shape's octave index, updating the inversion control, the highlight, and the composition panel together (C3). Octave commands MUST be disabled outside Isolated (C4).
- **FR-007**: When one or two inversions fit, Full neck MUST show them without any message.
- **FR-008**: For the augmented triad, the three inversions MUST appear as the same drawing four frets apart, with tags naming inversions relative to the chosen root.
- **FR-009**: In All notes, the fretboard MUST show, at normal emphasis and regardless of whether the chosen set closes (C9), every occurrence of the three triad notes on every string up to the fret count, each with its function marker (root rounded square, third circle, fifth diamond) and the label type in use, and MUST NOT outline shapes or show inversion tags.
- **FR-010**: In All notes, the inversion and string-set controls MUST be disabled (visibly greyed, not operable, communicated to assistive technology as disabled), and MUST return to enabled with their prior values when another view is chosen.
- **FR-011**: The **See all notes** action in the "shape lies beyond fret [n]" guidance and in the "triad does not close on this string set" guidance MUST switch the view to All notes. The does-not-close guidance MUST also offer **Another set**, which behaves as already defined for the Isolated view.
- **FR-012**: In Full neck, when no shape fits on the chosen string set, the same guidance and actions as in Isolated MUST appear, never a blank fretboard (C7). **See all notes** MUST change only the view; **Another set** MUST keep the view (C8).
- **FR-013**: **Listen** MUST follow the view. In Full neck it plays every displayed shape in chain order, each as an arpeggio (low, middle, high) followed by the block (C11). In All notes it plays root, third, fifth once as single notes, ascending from the lowest root on the instrument, at the positions defined in C12. In Isolated its behavior is unchanged.
- **FR-014**: Playback MUST stop when the view, root, spelling, quality, inversion, string set, occurrence index, or label type changes, or when **See all notes** or **Another set** is activated (C13).
- **FR-015**: The composition panel MUST stay visible in every view and describe the current selection (name, notes, intervals, stacking), including the augmented symmetry statement when the quality is augmented. In All notes the name omits the inversion and the low-to-high line is hidden (C10).
- **FR-016**: Every Full neck and All notes view MUST have a text description announced politely to screen readers, listing the shapes with their inversion names and frets (Full neck) or the occurrences of each note (All notes), with accidentals read in full, in the format of C18.
- **FR-017**: Every note shown or played MUST be at its calculated pitch and spelled as the music theory reference requires (alternate letters; double accidentals where needed).
- **FR-018**: All new user-facing text (view names, tag names, disabled-control hints, descriptions, action labels) MUST come from the message catalog, and note names MUST come from the notation layer.
- **FR-019**: The selected view MUST be a field of the tool's view state (`isolated | full-neck | all-notes`, initial `isolated`), kept outside the tool component, so that it survives navigation within the app session and can later be driven by other features. It MUST NOT be persisted to local storage in this slice, and **Reset tool** MUST return it to `isolated` (C14).
- **FR-020**: The view control, tags, and disabled controls MUST be keyboard-operable with visible focus, and tags and view options MUST meet the 44×44 CSS px touch-target minimum in comfortable mode.
- **FR-021**: Switching views and selecting a tag MUST update the fretboard within the control-change budget (100 ms), and only the notes that change MUST animate; reduced-motion preferences MUST be honored.

### Key Entities

- **View**: which of Isolated, Full neck, or All notes the Triads tool is showing. Part of the tool's view state.
- **Inversion chain**: the ordered list of shapes on one string set, along the neck, each with its inversion, its frets per string, its span, and whether it carries the "wide stretch" mark. Derived from root, quality, string set, tuning, and fret count.
- **Shape tag**: the label for one shape in the chain; names an inversion relative to the chosen root; selectable.
- **Note occurrence**: one place (string, fret) where one of the three triad notes sounds, with its function (root, third, fifth). The All notes view shows all of them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For A major on set 3-2-1 with 22 frets, Full neck shows exactly six shapes at 2-2-0, 6-5-5, 9-10-9, 14-14-12, 18-17-17, and 21-22-21, each tagged with the correct inversion, and tapping a "2nd" tag makes 2nd inversion the only selected inversion with both 2nd-inversion shapes highlighted.
- **SC-002**: For all 12 roots × 4 qualities × 4 string sets in standard tuning with 22 frets, the Full neck shapes are exactly the set {TM-5.3 lowest occurrence + k×12 that fits} for each of the three inversions, and the chain is ordered by lowest-string fret. Property tests over random tunings and fret counts confirm the same.
- **SC-003**: In All notes, 100% of occurrences of the three notes are marked and no other note is, verified for all 12 roots × 4 qualities in standard tuning.
- **SC-004**: In All notes, both controls are disabled in 100% of states, and in every other view neither is disabled.
- **SC-005**: A player can find and select the inversion nearest a given fret in under 5 seconds, with a single tap on a tag.
- **SC-006**: The view switch and tag selection both appear complete in under 100 ms on the reference device profile.
- **SC-007**: Both new views pass the automated accessibility checks with zero violations, and are fully usable by keyboard alone.
- **SC-008**: Both new views work without horizontal page scroll (only the fretboard scrolls) from 320 to 2560 CSS px, and at 200% text zoom without truncation or overlap.
- **SC-009**: Every guidance state that offers **See all notes** leads to the All notes view in one activation, so no guidance state leaves the user on a blank fretboard.

## Assumptions

- The Triads tool, its selection state, the composition panel, the Isolated view, the guidance messages, the fretboard emphasis levels, and the playback engine already exist from feature 005 and are reused.
- "All the way up the neck" means every occurrence that fits within the fret count (C1); the breakdown's acceptance example names the first four of the six A major shapes.
- When the same inversion appears more than once in the chain, all its shapes are highlighted when it is selected. Playback and tags treat them as separate shapes (C3, C11).
- Switching to Full neck keeps the current inversion selected; switching to All notes does not change stored values for inversion or string set, it only disables the controls.
- The **Compare** feature in these views is out of scope and covered by 002-triads-across-the-neck/002. The view control does not offer anything for it here.
- The Listen tempo, arpeggio-then-block pattern, and pulsing behavior are the same as in the Isolated view.
- Each new view is verified at least on the reference tunings and fret counts of the music theory reference, plus injected instruments for short-fretboard and does-not-close cases.
