# Feature Specification: Linked Tools

**Feature Branch**: `feature/008-linked-tools`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/002-triads-across-the-neck/003-linked-tools.md (id 003, linked-tools)." Source sections: FR-1.6–1.8, FR-1.11 (Area 1), FR-4.7 and FR-4.10 (Area 4), TM-4 (spelling) and TM-4.5 (detection), the overall navigation map (UJ), EC-4.7, ARCH-4.

## Clarifications

### Session 2026-10-02

Resolved by the clarify reviewer from the constitution, the breakdown file (002/003), the macro-spec (FR-1.5–1.8, FR-1.11, FR-4.2, FR-4.7, FR-4.10, FR-4.12, FR-5.3, FR-8.6, TM-4.3–4.5, DM-15, EC-4.7) and the current code (`src/lib/state/notes-view.ts`, `triads-view.ts`). No material ambiguity remains, so nothing is escalated.

- Q: How is the root spelled when a **single note** carries from Notes to Triads (switch or **Triads from this note**)? → A: **Derived** (FR-8.6: "in Triads, theory determines the spelling, not this preference"; FR-5.3/TM-4.3). Only the pitch class carries; Triads spells it with the TM-4.3 default for the kept quality (spelling override cleared), and the user can switch spelling as usual. Test: Notes with only G♯/A♭ selected and Triads last on augmented → Triads opens on **A♭ augmented** (A♭–C–E); last on minor → **G♯ minor**.
- Q: How are the detected triad's name and the **View as triad** root spelled? → A: **Derived** (breakdown acceptance "G♯, C, E (G♯ first) → G♯ augmented", which overrides the TM-4.3 default A♭). The root takes the primary spelling Notes shows for that pitch class: the sharp spelling today (FR-4.2/FR-4.12: sharp is the default and the "both" fallback); once the accidental preference (FR-8.6) ships, the flat spelling when it is set to flats. **View as triad** opens Triads with that explicit root spelling, and the other two notes follow TM-4.1 from it (G♯–B♯–D𝄪). Naturals are unaffected. Test: C♯, F, G♯ selected → "C♯ major" → Triads C♯–E♯–G♯; G♯, C, E (G♯ first) → "G♯ augmented".
- Q: What does Triads → Notes carry, given the Notes selection is a set of pitch classes (DM-15, code `selection: PitchClass[]`)? → A: **Default** (only representation the Notes model has). It carries the three pitch classes in the order root, third, fifth, replacing the Notes selection; Notes displays them with its own spelling rules (FR-4.12), not the Triads spelling. Because the root is first, an augmented triad round-trips to the same root through **View as triad**. Test: Triads E augmented → Notes selection order [E, G♯, C]; **View as triad** → E augmented. A flat-spelled Triads root (D♭ major) comes back from Notes as C♯ major; this spelling change is accepted.
- Q: Which triad carries from Triads when **Compare** is on? → A: **Default**: only the main triad (root and quality), never the comparison quality.
- Q: What counts as "the user's action of opening the other tool"? → A: **Default**: activating the persistent tool navigation (FR-1.5) or a shortcut (**Triads from this note**, **View as triad**). Not a carry-over: the home-screen cards (including "Continue"), Back/Forward, typing or reloading a URL, or a deep link. Reloading clears session state (FR-012), so the tool opens in its initial state.
- Q: What if the carried root equals the root Triads already has? → A: **Default**: Triads keeps its state unchanged, including a spelling the user switched (FR-5.3: the chosen spelling holds until the root changes). Otherwise a carried root resets the occurrence/octave index as a normal root change does. View, compare, and label type are kept.
- Q: Where do the triad name and **View as triad** appear, and do they show in hidden mode? → A: **Default** (constitution VII: controls never cover the fretboard): in the Notes control area next to the note selector, never over the fretboard. They show in hidden mode (FR-4.8) too, because the selector already names the selected notes. When they appear, the name is part of the Notes polite text description, read in full ("G sharp augmented").
- Q: Does the position card show **CAGED in this key** (FR-4.7)? → A: **Derived** (breakdown scope boundary): no, it is added by the CAGED slice (004-caged/006). The card gets only **Triads from this note** in this slice.
- Q: What else in Notes changes on Triads → Notes? → A: **Default** (FR-005): only the note selection. Filters, label type, background set, hidden mode, and the open position card are kept. If the carried notes have no position inside the active filters, the existing EC-4.4 guidance shows.
- Q: Do shortcut navigations add history entries? → A: **Default** (FR-1.8: screens are history entries): yes, one entry for the screen change (Notes → Triads), like the persistent navigation. The carry-over itself adds none.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a triad from the notes I selected (Priority: P1)

A guitarist selects three notes in Fretboard Notes. When they form a major, minor, diminished, or augmented triad, Notes names the triad and offers **View as triad**. Activating it opens Triads on that root and quality.

**Why this priority**: It is the new capability that turns Notes findings into Triads study, and it carries the detection rules where musical-correctness risk is highest.

**Independent Test**: Select note sets in Notes and check the name shown and the Triads state reached through **View as triad**.

**Acceptance Scenarios**:

1. **Given** C, E, and G are selected in Notes, **When** the user looks at the tool, **Then** it shows "C major" and **View as triad**; activating it opens Triads on C major.
2. **Given** G♯, C, and E are selected with G♯ first, **When** the user activates **View as triad**, **Then** Triads opens on G♯ augmented.
3. **Given** C, D, and E are selected, **When** the user looks at the tool, **Then** no shortcut and no message appear.
4. **Given** a supported triad is selected and the user removes or adds a note, **When** the selection is no longer exactly three notes forming a supported triad, **Then** the name and shortcut disappear without a message.
5. **Given** E, G♯, and C are selected in that order (an augmented triad), **When** the name is shown, **Then** the root is E (the first selected), not C or G♯.
6. **Given** C♯, F, and G♯ are selected, **When** the name is shown, **Then** it reads "C♯ major" (Notes primary spelling) and **View as triad** opens Triads on C♯ major (C♯–E♯–G♯).

---

### User Story 2 - Notes carry into Triads and back (Priority: P1)

When the user switches between Notes and Triads, what they found in the origin tool is waiting in the destination, so the two feel like one study.

**Why this priority**: It is the core promise of the slice: context moves with the guitarist.

**Independent Test**: Set up each origin state, switch tools, and compare the destination state with the carry-over rules.

**Acceptance Scenarios**:

1. **Given** A is the only note selected in Notes and the user last used 1st inversion on string set 4-3-2 in Triads, **When** the user switches to Triads, **Then** it opens on A major, 1st inversion, 4-3-2 (root from Notes; quality, inversion, and string set kept from Triads).
2. **Given** a Triads selection of C major, **When** the user switches to Notes, **Then** C, E, and G are selected in Notes, in that order, and Notes shows "C major" with **View as triad**.
3. **Given** nothing is selected in Notes (or the selection is anything other than exactly one note), **When** the user switches to Triads, **Then** Triads opens in its last session state, or its initial state if it was never visited.
4. **Given** the user returns to a tool already visited and no carry-over brings new context, **When** the tool opens, **Then** it shows exactly what the user left (selection, filters, labels, and view).
5. **Given** the user opens a tool from the home screen, **When** it opens, **Then** no context carries over and the tool opens in its last session state or initial state.
6. **Given** a carry-over brings a new root or new notes, **When** the destination opens, **Then** the carried context replaces the matching part of the destination state and the rest of the destination state is kept.
7. **Given** only G♯/A♭ is selected in Notes and Triads was last on augmented, **When** the user switches to Triads, **Then** it opens on A♭ augmented (TM-4.3 default), not G♯ augmented.
8. **Given** Triads is on E augmented, **When** the user switches to Notes and activates **View as triad**, **Then** Triads opens on E augmented again.
9. **Given** Triads already has root D♭ (spelling switched by the user) and Notes has only C♯/D♭ selected, **When** the user switches to Triads, **Then** Triads is unchanged and still shows D♭.

---

### User Story 3 - Triads from this note (Priority: P2)

On the position card in Notes, **Triads from this note** opens Triads with the note of the focused position as the root.

**Why this priority**: A direct shortcut from a single fretted note, and it reuses the same carry-over.

**Independent Test**: Focus a position, activate the shortcut, and check the Triads root and the kept settings.

**Acceptance Scenarios**:

1. **Given** the position card is open for an F♯ position, **When** the user activates **Triads from this note**, **Then** Triads opens with root pitch class F♯/G♭, spelled by the TM-4.3 default for the kept quality (F♯ for major, minor, and diminished; G♭ for augmented), and keeps the last quality, inversion, and string set used in Triads.
2. **Given** the Notes selection holds other notes, **When** the user uses the shortcut, **Then** the focused note is the root, whatever the selection holds.

---

### User Story 4 - Each tool remembers its session; Reset tool starts it over (Priority: P2)

Each tool keeps its state for the session. **Reset tool** returns the current tool to its initial state without touching instrument, language, or notation.

**Why this priority**: Remembered state is what makes returning to a tool useful, and Reset tool is the safe way out of it.

**Independent Test**: Change a tool, leave and return, then reset; check state and settings each time.

**Acceptance Scenarios**:

1. **Given** the user changed Triads and visited Notes, **When** the user returns to Triads without a carry-over, **Then** Triads shows the state the user left.
2. **Given** a tool with changed state, **When** the user activates **Reset tool**, **Then** that tool shows its initial state and the other tool's remembered state is untouched.
3. **Given** a non-default instrument, language, and notation, **When** the user resets a tool, **Then** those settings keep their values.
4. **Given** a tool was reset, **When** the user switches to the other tool and back, **Then** the reset tool opens in its initial state (the reset is what it remembers).

---

### User Story 5 - Browser history only follows screens (Priority: P3)

Back and forward move through screens visited. Changes inside a tool, including carry-over targets reached by changing the selection, add no history entries.

**Why this priority**: It keeps Back predictable but needs no new capability beyond the rest.

**Independent Test**: Make many in-tool changes, then use Back and count screens.

**Acceptance Scenarios**:

1. **Given** the user changes selection, filters, quality, inversion, string set, or presses **Reset tool**, **When** the user uses Back, **Then** the previous screen is reached with no stop on those changes.
2. **Given** the user went Home → Notes → Triads through a carry-over, **When** the user uses Back, **Then** Notes is reached, and then Home.

### Edge Cases

- Three notes that form no supported triad: no shortcut, no message (EC-4.7).
- Exactly three selected notes that are not three distinct pitch classes cannot occur (a note is selected once); two or four or more selected notes never show the shortcut, even if a subset forms a triad.
- Selected notes whose pitch classes fit a supported triad with more than one root: only the augmented triad (three roots) does; the first-selected note is the root. Major, minor, and diminished triads have a unique root, whatever the selection order.
- The Triads quality kept by a carry-over is whatever Triads used last, so "Notes → Triads" from one note can open minor, diminished, or augmented.
- **View as triad** sets the root and quality from the detection and keeps the inversion and string set last used in Triads.
- Triads → Notes replaces the previous Notes note selection but keeps Notes filters, label type, background set, hidden mode, and the open position card. Carried notes with no position inside the active filters show the existing EC-4.4 guidance.
- Triads with Compare on → Notes: only the main triad carries.
- Spelling round trip: a flat-spelled Triads triad (D♭ major) appears in Notes in Notes spelling and comes back through **View as triad** as C♯ major. This is accepted (FR-008).
- A shape for the carried context may be unavailable on the string set kept (for example, beyond the last fret). The destination shows its usual "never blank" guidance; carry-over does not change that behavior.
- Storage failure or a first visit with no remembered state: the destination opens in its initial state.
- A failed tool (EC-1.3): **Reset tool** from the failure view returns the tool to its initial state.

## Requirements *(mandatory)*

### Functional Requirements

**Carry-over**

- **FR-001**: When the user switches from Notes to Triads with exactly one note selected, the system MUST open Triads with that note's pitch class as the root and the quality, inversion, and string set last used in Triads (or Triads' initial values if never used). The root MUST be spelled by the TM-4.3 default for that quality (any user spelling override cleared), per FR-8.6 and FR-5.3. If the carried pitch class equals the current Triads root, Triads MUST stay unchanged (spelling override kept). A changed root resets the occurrence/octave index as a normal root change does.
- **FR-002**: When the user switches from Triads to Notes, the system MUST replace the Notes selection with the three pitch classes of the main triad shown in Triads (never the comparison quality), in the order root, third, fifth. Notes MUST display them with its own spelling rules (FR-4.12), not the Triads spelling.
- **FR-003**: When the origin tool has no selection to carry (Notes with no note selected, or with two or more notes selected, or arrival from the home screen), the destination MUST open in its last session state, or in its initial state if it has none.
- **FR-004**: Returning to a tool already visited MUST reopen it as it was left, except for the part replaced by a carry-over.
- **FR-005**: A carry-over MUST replace only the context it carries (root in Triads; note selection in Notes). Every other part of the destination state MUST be kept as left.
- **FR-006**: Carry-over MUST happen only when the user opens the other tool with the persistent tool navigation (FR-1.5) or a Notes shortcut (**Triads from this note**, **View as triad**). It MUST NOT happen on the browser's Back and Forward commands, the home-screen cards (including "Continue"), or a typed, reloaded, or deep-linked URL. Those reopen each tool as it was left (or in its initial state after a reload).

**Notes shortcuts**

- **FR-007**: The Notes position card MUST include **Triads from this note**, which opens Triads with the focused position's pitch class as the root (spelled as in FR-001) and the last-used quality, inversion, and string set, whatever the Notes selection holds. **CAGED in this key** is not part of this slice (it ships with 004-caged/006).
- **FR-008**: When the Notes selection is exactly three notes that form a major, minor, diminished, or augmented triad, Notes MUST show the triad's name and **View as triad** in the Notes control area next to the note selector (never over the fretboard), also when hidden mode is on. The root MUST use the primary spelling Notes shows for that pitch class: sharp today, flat when the accidental preference (FR-8.6) is set to flats once that ships. Examples: "C major", "C♯ major", "G♯ augmented". **View as triad** MUST open Triads with that root, with that explicit spelling (the other notes spelled by TM-4.1 from it), and that quality, keeping the last-used inversion and string set. The name MUST be part of the Notes polite text description.
- **FR-009**: Detection MUST follow TM-4.5: three distinct pitch classes form a supported triad when, taking one as the root, the other two sit at (4, 7) major, (3, 7) minor, (3, 6) diminished, or (4, 8) augmented semitones above it. For major, minor, and diminished the root is unique. For augmented the root MUST be the first-selected note.
- **FR-010**: When three notes form no supported triad, or the selection is not exactly three notes, the shortcut and the name MUST NOT appear and no message MUST be shown.
- **FR-011**: The system MUST remember the order in which the Notes selection was made, so the first-selected note is known; removing and re-adding a note makes it the last selected.

**Session state and reset**

- **FR-012**: Each tool (Notes and Triads) MUST keep its full state for the duration of the browser session, in memory only. Closing or reloading the page MUST NOT restore it (only preferences persist).
- **FR-013**: **Reset tool** MUST return the current tool to its initial state, and the reset state MUST be what the tool remembers for the rest of the session.
- **FR-014**: **Reset tool** MUST NOT change instrument, language, or notation preferences, nor the other tool's remembered state.
- **FR-015**: In-tool changes, carry-over, and **Reset tool** MUST NOT add browser history entries. Only moving between screens does: each switch between Notes and Triads, through the navigation or a shortcut, adds exactly one entry.

**Quality**

- **FR-016**: All new text (the triad name format, **View as triad**, **Triads from this note**) MUST come from the message catalog, note names from the notation layer, with accidentals as ♯ ♭ 𝄪 𝄫. The new controls MUST be keyboard-operable, have visible focus, and be announced to screen readers with accidentals read in full.
- **FR-017**: Switching tools with a carry-over MUST stay within the tool-open budget, and the destination MUST show the carried context on its first render.

### Key Entities

- **Tool session state**: Everything a tool shows and the user can change (selection, filters, labels, view, kept settings), held for the session and replaceable by Reset tool.
- **Carry-over context**: The musical context moved at a switch: a root (with spelling) and quality, or an ordered set of notes. It replaces only the matching part of the destination state.
- **Detected triad**: Root (with spelling) and quality derived from exactly three selected notes; exists only while the selection forms a supported triad.
- **Ordered note selection**: The Notes selection together with the order of selection, which decides the root of an augmented triad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a single note, a detected triad, or a Triads shape gets it in the other tool with one action and no re-entry, in 100% of the four acceptance examples (C–E–G → C major; A with 1st inversion on 4-3-2 → A major, 1st inversion, 4-3-2; G♯–C–E → G♯ augmented; C–D–E → no shortcut).
- **SC-002**: Triad detection gives the correct name and root for every one of the 12 roots × 4 qualities, in every selection order of the three notes, with the augmented root always the first-selected note.
- **SC-003**: Across 20 consecutive in-tool changes, carry-overs, and resets, Back returns to the previous screen in one step every time.
- **SC-004**: After any sequence of tool switches, a tool opened without a carry-over matches the state the user left in 100% of checks, and **Reset tool** never changes instrument, language, or notation.
- **SC-005**: Opening the other tool with a carry-over completes within the existing 300 ms tool-switch budget, with the carried context visible at first display.
- **SC-006**: The new shortcuts pass the automated accessibility checks with zero violations and work by keyboard alone.

## Assumptions

- Notes and Triads already exist and already have **Reset tool** and session-lived state in the current build. This slice adds the links, the shortcuts, the detection, and the guarantee of session memory and history behavior across the two tools.
- Links to and from CAGED come with the CAGED slice (004-caged/006) and are out of scope. A selection state carried across visits (page reload) is out of scope by design: only preferences persist.
- **Selection spelling**: see Clarifications. A detected triad uses the Notes primary spelling (breakdown: G♯–C–E reads "G♯ augmented" even though TM-4.3 defaults to A♭). A single carried note uses the TM-4.3 default for the kept quality (FR-8.6). The user can switch spelling in Triads as usual.
- The ordered Notes selection (FR-011) already exists: `NotesViewState.selection` is an ordered list, and toggling a note off and on appends it at the end.
- **Notes with two or more notes selected (Default)**: Triads → Notes → Triads with a multi-note selection counts as "no carry-over", so Triads opens in its last session state. Only the exact-triad shortcut moves such a selection.
- **Back/Forward (Default)**: a carry-over is a result of the user's switching action, so history navigation reopens each tool as left (FR-006).
- Triads → Notes always carries, since Triads always holds a shape to carry.
- Dependencies: slice 004-fretboard-notes-tool and slice 005-triads-isolated-view (with later Triads slices on the same branch), including their view state, notation layer, and triad theory code.
