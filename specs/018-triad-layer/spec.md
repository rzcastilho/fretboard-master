# Feature Specification: CAGED Triad Layer

**Feature Branch**: `feature/018-triad-layer`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/004-caged/005-triad-layer.md (id 005, triad-layer)." Source sections: FR-6.11, FR-6.12, FR-5.5, FR-5.6, FR-5.8, FR-1.6, FR-6.13 to FR-6.16, EC-6.7, TM-5, TM-8, UJ-4.

## Clarifications

### Session 2026-10-05

Each answer cites a source or is marked **Default** (conventional choice no source settles). No material question remains open, so there is no NEEDS HUMAN section.

- Q: What is the Triad layer? → A: FR-6.11. A fifth row in the CAGED layer list (after Chord, Arpeggio, Pentatonic, Scale). With a shape in focus, the user picks a string set; the close-position triad on that set that sits inside the shape is highlighted with function markers (root square, third circle, fifth diamond, as elsewhere in the product).
- Q: How is a set's triad found? → A: FR-6.11, TM-5.1, TM-5.2, TM-5.3. For each set of three adjacent strings, find the close-position triad (one note per string, ascending in pitch, within an octave) whose three notes are all positions of the focused occurrence's **Arpeggio** layer (the layer defined in slice 017, including string 7 and the altered string 6 rules). If there is none, the set is unavailable. "Close position" is exactly TM-5.2/TM-5.3: the three notes are the root, third and fifth (each function once), and each note above the lowest is the **next** triad tone above the one below it, in one of the three TM-5.2 orders. Equivalently, the found triad is identical (same strings, same frets) to the shape the Triads tool draws for that root, quality, inversion and set at some occurrence (FR-5.8), so the hand-off always lands on a real Triads shape. "The region of the shape" (FR-6.11 layer table) is the occurrence's scale region from slice 017 (`region`, clipped to fret 0 … last fret), the same window the Arpeggio layer uses; neither the chord's own fret span nor neighbouring occurrences' regions count. **Default**: if more than one such triad exists on a set, the one with the smallest fret span wins, then the lowest on the neck. The triad is computed from the real tuning, never looked up.
- Q: Does it need focus? → A: FR-6.12. Yes. Turning Triad on without focus puts the first drawn occurrence (nearest the nut) in focus exactly as slice 017 does for Pentatonic and Scale (band, dimming, centring, announcement), then turns the layer on. Triad is a "drawable layer" only while a shape is in focus; the slice 017 base-layer rule (the view always has one drawable layer; a switch that would leave none is disabled; clearing focus with no drawable layer left turns Chord back on, announced) applies to it unchanged. If Triad is on and focus is cleared, its switch stays on and the triad is not drawn; focusing a shape draws it again.
- Q: Which string set is selected when the layer turns on? → A: **Default**: the Triads initial set 3-2-1 if it is available in the shape, otherwise the first available set in list order (6-5-4, 5-4-3, 4-3-2, 3-2-1, with 7-6-5 first on seven strings). The selection is kept while the focused shape changes if the set is still available there, otherwise it moves to the default above. If no set is available, the layer stays on, every set is disabled with the explanation, and no triad is drawn.
- Q: The selector? → A: FR-6.11, task text. The **same small string diagram as the Triads tool** (FR-5.5 sets: four on six strings, five on seven strings), shown in the layers panel under the Triad row when the layer is on. Unavailable sets are disabled (kept in the tab order, announced as unavailable) and carry "In this shape there is no close-position triad on these strings" (EC-6.7), readable on focus or hover and by assistive technology, not by color alone. The selected set is shown as selected.
- Q: How is the triad drawn? → A: FR-6.9 extended, constitution V and VII. The three notes get the highest emphasis of any layer: `highlighted`, with function markers and the current label (Interval or Name from slice 017). They are drawn once per position (slice 017 one-marker rule), with priority Triad > Chord > Arpeggio > Pentatonic > Scale, so a triad note that is also a chord note shows the triad treatment. **Default**: the triad treatment is a distinct marker variant (for example a larger glyph with a heavier outline) that is perceivable without color and is **not** the connection ring: the `ring` marker flag already means "connection" in CAGED (slice 016) and keeps that meaning; a triad note that is also a connection keeps its connection ring in addition to the triad treatment. In the display model, exactly the three triad positions carry the triad treatment flag; tests assert that flag, not pixel styling. All other layers that are on keep their normal treatment inside the shape. Notes of the triad count under Triad in the text description.
- Q: Does the triad depend on whether Arpeggio is on? → A: **Default**: no. The Triad layer uses the arpeggio positions as its source regardless of the Arpeggio switch. Turning Arpeggio off does not hide or change the triad.
- Q: Triad and Chord off? → A: The triad's three positions are drawn even if Chord is off, because Triad is itself an on layer. With Chord off the chord notes outside the triad follow the slice 017 Chord-off rule.
- Q: Which inversion and which fingering is shown? → A: TM-5.2. The inversion is the one that the found triad has (the order of root, third, fifth from the lowest string), and is stated in the layer's text (for example "C major, root position, strings 3-2-1, frets 5-5-3").
- Q: **Open in Triads**? → A: FR-6.11, FR-1.6, FR-5.4, FR-5.8. A shortcut in the Triad layer's panel, available while the layer is on, a shape is in focus, and a triad is selected and drawn. It opens the Triads tool with root = the key, quality = the CAGED quality (major or minor), inversion = the found triad's, and set = the selected set, in the Isolated view. If the found triad is the higher occurrence (the Triads lowest occurrence is an octave below), Triads opens on that higher occurrence (the Octave up state). The instrument and tuning are shared product-wide, so Triads shows the same strings and tuning. Spelling follows the key's spelling. It is not offered when no triad is drawn. It does not change the CAGED state, and returning to CAGED reopens it as it was left (FR-1.7). The occurrence handed over is the Triads occurrence index whose shape equals the drawn triad (0 = lowest; each step is 12 frets higher). **Default** (FR-1.6 "keep the last value used in Triads"): every other Triads setting (label type, Compare) keeps its last value in the session; Compare's quality invariant is kept the same way the existing Notes → Triads carry keeps it. The existing CAGED **Go to Triads** button (which only navigates, carrying nothing today) is unchanged by this slice; the general CAGED → Triads carry-over and Triads' **View in CAGED** with the Triad layer on (FR-5.16) belong to slice 004-caged/006.
- Q: Tunings? → A: FR-6.13 to FR-6.16, slice 015 rules, task text. In compatible and altered-string tunings, the layer works: sets whose strings include the altered string 6 use that string's arpeggio positions computed from the real tuning (slice 017). In transposed tunings (Half step down, Whole step down, 7-string half step down), the note names follow the real pitch. In a non-compatible tuning no shapes are drawn, so the Triad switch is disabled beside the existing message, like the other layer switches, and its state is kept.
- Q: Seven strings? → A: FR-6.13, FR-5.5. The set 7-6-5 is offered. Chord never draws on string 7, but the Arpeggio positions do (slice 017), so a triad on 7-6-5 or on 6-5-4 may use string 7 and string 6 positions from the arpeggio.
- Q: State and storage? → A: Constitution III, slice 017 FR-014. Whether Triad is on, and the selected set, are part of the CAGED view state in the existing store: survive navigation within a visit, reset on reload, never written to device storage. **Reset tool** turns Triad off and clears the selected set. Key, quality, spelling, instrument, tuning or focus changes keep the layer on and recompute the triad; a changed focus follows the set rule above.
- Q: Announcements and text? → A: Constitution V and VIII. Each Triad switch change is announced politely ("Triad layer on"). A set change is announced ("Strings 3-2-1: C major triad, root position, frets 5-5-3", or "unavailable in this shape" if not). The fretboard text description names the triad (notes, inversion, set, frets) while it is drawn. Every new string is in the message catalog (en, pt, es). Controls are keyboard-operable with visible focus and at least 44×44 px targets.
- Q: Motion? → A: Slice 017 FR-013. Turning the layer on, and selecting a set, shows the triad notes from low to high pitch within the short motion duration, and at once under reduced motion.
- Q: Listen? → A: Out of scope (FR-6.17, a later slice), as are triads that cross the shape's region and open-voiced triads (task scope boundary).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the triad inside the shape I am holding (Priority: P1)

Bruna holds C major's A shape and wants to know which three notes carry the harmony on the top strings.

**Why this priority**: This is the point of the slice: it reveals the triad inside a barre shape.

**Independent Test**: Open CAGED in C major, standard tuning, focus the A shape, turn on Triad, pick set 3-2-1, and check the highlighted frets.

**Acceptance Scenarios**:

1. **Given** C major, standard tuning, 6 strings and the A shape in focus, **When** the user turns on Triad and picks set 3-2-1, **Then** frets 5-5-3 (C, E, G, root position) are highlighted with root, third and fifth markers, and no other triad is highlighted.
2. **Given** the same state, **When** the user changes the label to Name, **Then** the three notes show C, E and G.
3. **Given** the layer on, **When** the user picks another available set, **Then** the highlight moves to that set's triad, which is announced.
4. **Given** the Triad layer on and Arpeggio off, **When** the view renders, **Then** the triad still shows.
5. **Given** a triad note that is also a chord note, **When** the layer is on, **Then** exactly one marker shows there, with the triad treatment.
6. **Given** layers just turned on, **When** the notes appear, **Then** they appear from low to high (instantly under reduced motion).

---

### User Story 2 - Know which string sets have no triad (Priority: P1)

The user needs to see which sets can show a triad in this shape and why the others cannot.

**Why this priority**: Without this, a disabled option looks like a bug.

**Independent Test**: In a shape where some set has no close-position triad, open the selector and check the disabled entries and their explanation.

**Acceptance Scenarios**:

1. **Given** a focused shape and Triad on, **When** the selector renders, **Then** it shows the same string-set diagram as the Triads tool (four sets on six strings, five on seven).
2. **Given** a set that holds no close-position triad inside the focused shape, **When** the selector renders, **Then** the set is disabled, stays reachable by keyboard, and explains "In this shape there is no close-position triad on these strings" to sighted and assistive-technology users.
3. **Given** the selected set becomes unavailable (the user focuses another shape), **When** the view updates, **Then** the selection moves to the default available set and this is announced.
4. **Given** a shape where no set has a triad, **When** Triad is on, **Then** every set is disabled with the explanation, no triad is drawn, and **Open in Triads** is not offered.

---

### User Story 3 - Jump to the Triads tool (Priority: P1)

The user wants to study the triad found in the shape in the Triads tool.

**Why this priority**: It connects CAGED back to Triads (UJ-4).

**Independent Test**: In C major, A shape, set 3-2-1, activate **Open in Triads** and check the Triads state.

**Acceptance Scenarios**:

1. **Given** C major, A shape in focus, Triad on, set 3-2-1 selected, **When** the user activates **Open in Triads**, **Then** the Triads tool opens on C major, root position, set 3-2-1, Isolated view.
2. **Given** a minor key, **When** the user activates it, **Then** Triads opens with the minor quality; the inversion is the found triad's.
3. **Given** the found triad is the higher occurrence on the neck, **When** the user activates it, **Then** Triads shows that occurrence.
4. **Given** the user returns to CAGED, **When** it opens, **Then** CAGED is as it was left, with Triad on and the same set.

---

### User Story 4 - Turn on Triad without a shape in focus (Priority: P2)

**Why this priority**: Follows the product-wide focus rule and avoids a dead switch.

**Independent Test**: With all shapes visible, turn on Triad.

**Acceptance Scenarios**:

1. **Given** all shapes visible and no focus, **When** the user turns on Triad, **Then** the first drawn occurrence takes focus (as if its tag had been activated) and the layer turns on with its default set.
2. **Given** Triad on and focus then cleared with another layer on, **When** the view renders, **Then** no triad is drawn and the Triad switch stays on; focusing a shape draws it again.
3. **Given** Chord off, only Triad on and a shape in focus, **When** the user chooses **See all**, **Then** Chord turns back on and is announced, and the Triad switch stays on.
4. **Given** Triad is the only drawable layer, **When** the user views its switch, **Then** it is disabled (the base-layer rule).

---

### User Story 5 - Right notes in any tuning (Priority: P2)

**Why this priority**: The layer must obey the tuning rules from slice 015.

**Independent Test**: E major, A shape, Triad on, in Half step down; and a Drop D check.

**Acceptance Scenarios**:

1. **Given** E major, A shape, Triad layer on in Half step down, **When** the triad is drawn, **Then** note names are spelled from the real pitch and the shape is the same drawing as in standard tuning.
2. **Given** an altered-string tuning (Drop D), **When** Triad is on for a shape and a set that includes string 6, **Then** the triad uses string 6 positions computed from the real tuning, if one exists in the shape, and otherwise the set is unavailable.
3. **Given** a 7-string instrument, **When** the selector renders, **Then** set 7-6-5 is offered and follows the same rules.
4. **Given** a non-compatible tuning, **When** CAGED renders, **Then** the Triad switch is disabled beside the existing message and its state is kept.

---

### Edge Cases

- Fewer frets (12, 22, 24): triad notes past the last fret or below the open string are never drawn; a set whose triad would need them is unavailable, with no other notice.
- Open-position occurrences (for example C shape in C major): sets whose only candidate would fall below the nut are unavailable.
- Two sets give the same pitch classes (unison strings in a custom tuning): each set is evaluated on its own; EC-2.1 and EC-2.2 apply, and sets with no close-position triad are unavailable.
- Spelling change (F♯ to G♭): the layer stays on and the names respell; the selection stays.
- Key, quality, tuning or instrument change while the layer is on: recomputed; selection kept if still available, else defaulted.
- Next/Previous shape and tag changes with the layer on: the triad moves with the focus; the selection follows the set rule.
- Rapid toggling of the switch and of sets: each change retargets the appearance, no stale markers.
- Left-handed and mirrored orientation: "low to high" refers to pitch; the string diagram keeps the same string order as Triads.
- Diminished or augmented: not applicable, since CAGED is major or minor only.
- Triads that cross the shape's region and open-voiced triads are never shown.
- Keyboard and screen reader: switch, selector entries and shortcut are operable, announced politely, with visible focus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CAGED layers list MUST include a **Triad** row after Scale, with a name, a switch and a sample marker matching the triad's treatment, so the list stays the legend.
- **FR-002**: For each set of three adjacent strings (FR-5.5), the system MUST find the close-position triad (one note per string; root, third and fifth each once; each note the next triad tone above the one below, per TM-5.2/TM-5.3) whose three notes are all positions of the focused occurrence's Arpeggio layer (inside its slice 017 region, clipped to the fretboard), computed from the real tuning, and MUST mark the set unavailable if none exists. If several exist, the smallest fret span wins, then the lowest bass fret. The found triad MUST equal the Triads tool's shape for the same root, quality, inversion and set at one of its occurrences.
- **FR-003**: The Triad layer MUST require a shape in focus. Turning it on without focus MUST put the first drawn occurrence in focus first. When focus is cleared while it is on, its state MUST be kept and no triad drawn.
- **FR-004**: The slice 017 base-layer rule MUST treat Triad as a drawable layer only while a shape is in focus: a switch that would leave no drawable layer MUST be disabled, and clearing focus with no drawable layer left MUST turn Chord back on with a polite announcement.
- **FR-005**: With the layer on, the user MUST be able to pick a string set with the same string diagram as the Triads tool. On turn-on, the default set MUST be 3-2-1 if available, else the first available set. On a change of focus, tuning, key, quality or instrument, the selection MUST be kept if still available, else moved to the default and announced.
- **FR-006**: A set with no triad in the focused shape MUST be disabled but remain reachable by keyboard, and MUST show "In this shape there is no close-position triad on these strings" visibly and to assistive technology, not by color alone.
- **FR-007**: The selected triad MUST be drawn `highlighted` with root, third and fifth markers and the current label (Interval or Name), once per position, with priority Triad > Chord > Arpeggio > Pentatonic > Scale. The triad treatment MUST be perceivable without color, MUST be a marker property distinct from the connection ring (which keeps its slice 016 meaning and still shows on a triad note that is a connection), and MUST be carried by exactly the three triad positions. Other layers that are on MUST keep their treatment elsewhere in the shape.
- **FR-008**: The Triad layer MUST NOT depend on the Arpeggio switch, and MUST draw its notes even if Chord is off.
- **FR-009**: An **Open in Triads** shortcut MUST be available while the layer is on, a shape is in focus and a triad is drawn. It MUST open the Triads tool in the Isolated view with root = key, quality = the CAGED quality, inversion = the drawn triad's inversion, and set = the selected set, on the occurrence whose shape equals the drawn triad (including a higher occurrence), in the current tuning and instrument, keeping every other Triads setting (label type, Compare) at its last session value. It MUST NOT be offered when no triad is drawn, and MUST NOT alter CAGED's state.
- **FR-010**: The layer MUST work in compatible tunings, in altered-string tunings (string 6 positions from the real tuning, as in slice 017), and on seven strings (set 7-6-5 included). In transposed tunings, note names MUST follow the real pitch. In a non-compatible tuning the switch MUST be disabled and its state kept.
- **FR-011**: Triad notes past the last fret, or below the open string, MUST never be drawn, with no notice.
- **FR-012**: Triad on and the selected set MUST be CAGED view state: kept across tool navigation in a visit, reset on reload, never written to device storage, and cleared by **Reset tool** (layer off, no set selected).
- **FR-013**: Newly shown triad notes (layer turned on, or a set selected) MUST appear from low to high pitch within the short motion duration, and instantly under reduced motion. Other redraws MUST NOT stagger.
- **FR-014**: Every control (switch, set entries, shortcut) MUST be operable by keyboard and touch (44×44 px targets) with visible focus. Switch changes and set changes MUST be announced politely. The fretboard text description MUST name the drawn triad (notes, inversion, set, frets). All new strings MUST be in the message catalog (en, pt, es).
- **FR-015**: The layer MUST NOT show triads that cross the shape's region or open-voiced triads.
- **FR-016**: Triad detection, set availability, default and retained set selection, priority resolution, the base-layer rule with Triad, the inversion and frets reported, and the data handed to **Open in Triads** MUST live in pure, unit-tested logic, with the UI only presenting it (constitution III and IV).

### Key Entities

- **Triad layer**: A fifth layer with an on or off state and a selected string set, part of the CAGED view state.
- **Shape triad**: For an occurrence and a string set, the close-position triad (three positions, root/third/fifth, inversion) whose notes are all in the occurrence's arpeggio, or none.
- **String-set availability**: For each set of the instrument, available (with its shape triad) or unavailable (with the explanation).
- **Triads hand-off**: Root, quality, inversion, set and occurrence passed to the Triads tool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from a focused shape to the triad highlighted on a chosen set in two actions (turn on Triad, pick a set), and from there to the Triads tool in one more.
- **SC-002**: In C major, A shape, standard tuning, set 3-2-1 highlights frets 5-5-3 (C, E, G) and **Open in Triads** opens C major, root position, 3-2-1, in 100% of runs.
- **SC-003**: Across every key, both qualities and tested fret counts (12, 22, 24) in standard tuning, every highlighted triad has three notes that all belong to the shape's arpeggio, is close position and equal to a Triads tool shape for the same root, quality, inversion and set, and no set that has such a triad is ever shown as unavailable.
- **SC-004**: 100% of unavailable sets are disabled and carry the explanation, and none is selectable.
- **SC-005**: In Half step down, every note name drawn by the layer matches the real pitch in 100% of tested keys.
- **SC-006**: In every tested toggle sequence the base-layer rule holds, and no position ever shows more than one marker.
- **SC-007**: Every Triad control passes keyboard-only operation and automated accessibility checks with zero violations at phone, phone-touch and desktop viewports, and existing performance budgets do not regress.

## Assumptions

- Features 005 (Triads), 014 to 017 (CAGED shapes, tunings, focus and connections, other layers) are in place; their band, tags, dimming, centring, notices, view-state store, label control and layer list are reused.
- The Listen command on layers (FR-6.17), share-link encoding of layers, triads crossing the region and open-voiced triads are out of scope.
- The Triads view state already holds root, spelling, quality, inversion, set, occurrence and view, but the existing CAGED **Go to Triads** button only navigates and carries nothing; this slice adds a pure carry transition for **Open in Triads** (root, spelling, quality, inversion, set, occurrence, Isolated view) next to the existing carries.
- **View in CAGED** from Triads opening with the Triad layer on (FR-5.16) and the general CAGED ↔ Triads carry-over are delivered by slice 004-caged/006, not here.
- Where this spec chooses a default (several triads on a set, default set, ring styling), tests assert the observable rule, not exact pixel styling.
- "Low to high" means ascending pitch, ties between strings broken by the higher string number (thicker string) first, as in slice 017's layer ordering.
