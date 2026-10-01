# Feature Specification: Fretboard Notes Tool

**Feature Branch**: `feature/004-fretboard-notes-tool`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/004-fretboard-notes-tool.md (id 004, fretboard-notes-tool)." Source sections: Area 4 (FR-4.1–4.9, 4.11, 4.13), Edge cases Area 4 (EC-4.1–4.6), UJ-2, design doc §4.3 (controls per tool), TM-9 sample for teacher review.

## Clarifications

### Session 2026-10-01

Resolutions marked **[source]** are derived from an authoritative document; those marked **[default]** are conventional defaults chosen by the clarify reviewer because no source settles them. All are binding and reflected in the requirements below.

- Q: How are positions classified into the four emphasis levels? → A: **[source: FR-3.9, FR-4.1, FR-4.3, FR-4.4, FR-4.5, FR-4.9]** plus **[default for precedence]** Each position gets exactly one level, evaluated in this order: (1) while a position card is open, the tapped position and its unisons are *highlighted* and every other non-hidden position is at most *dimmed* (see card rules); (2) a position whose pitch class is neither selected nor in the background set is *hidden*; (3) a non-hidden position outside the active strings or the region is *dimmed* and unlabeled; (4) a position of a selected note is *highlighted*; (5) a background position is *normal* when nothing is selected and *dimmed* when at least one note is selected. Background set: naturals = the seven natural pitch classes; all = twelve; none = empty. Selection-dimmed positions (rule 5) keep their label; filter-dimmed positions (rule 3) never show a label.
- Q: Which marker shape and colors does the Notes tool use? → A: **[source: constitution VII, FR-3.8]** Every Notes marker uses the `neutral` note function (no root/third/fifth shape). Highlight and octave-tone colors MUST come from dedicated design tokens distinct from the root, third, and fifth colors.
- Q: How is the "highlight tone" per octave made testable and not color-only? → A: **[source: FR-4.6, constitution V]** plus **[default]** Octave = the sounding-pitch octave (changes at C; TM-1.3; C4 = middle C). Octave distinction is ON when exactly one note is selected, or when the label type is Octave (any selection size), and Hide names is off. When ON, highlighted positions of the same octave share one tone token (`--octave-tone-1` … `--octave-tone-7`, assigned by octave number from a fixed ramp, so the same octave always gets the same token), and each highlighted label carries the octave number (small number beside the name for one note with Name labels; full "G3" form with Octave labels). The octave number is always present when tones are on, so tone is never the only carrier. With "No label" or Hide names, tones are off and all highlighted positions share the single highlight token. Example (standard tuning, 22 frets, G selected): G2 = string 6 fret 3; G3 = s6f15, s5f10, s4f5, s3f0; G4 = s5f22, s4f17, s3f12, s2f8, s1f3; G5 = s2f20, s1f15 — four distinct tones.
- Q: What does the Octave label type show on non-highlighted positions? → A: **[source: FR-3.7]** Every labeled position (highlighted, normal, or selection-dimmed) shows name plus octave number, e.g. "A3". Tones apply only to highlighted positions.
- Q: Which positions can be tapped? → A: **[source: EC-4.1 "Pick a note or tap a fret", FR-4.8]** Every position on the instrument is activatable regardless of its emphasis level (including hidden and filter-dimmed positions). Activation plays the note (FR-7.1) and opens the card.
- Q: Which positions count as unisons and how are they shown? → A: **[source: TM-1.4, FR-4.7]** plus **[default]** Unisons = every other position on the whole instrument (all strings, frets 0–fretCount, ignoring string/region filters and background) whose calculated pitch equals the tapped position's pitch. The card lists them ordered by string number ascending, each as "String N, fret F". While the card is open, the tapped position and its unisons are *highlighted* and labeled even if they would otherwise be hidden or filter-dimmed; every other non-hidden position is *dimmed* (so unisons stand out even when the note is also selected). Closing the card restores the normal classification.
- Q: How does the position card open, change, and close? → A: **[source: design §4.2 zone D, constitution VII (no modals)]** plus **[default]** The card is a non-modal panel in zone D (beside the fretboard on wide screens, below it on narrow), never covering the fretboard. Tapping another position replaces the card's content; tapping the same position again replays the note and keeps the card. The card closes via its Close button or Escape (focus returns to the fretboard position). Selection, label, background, and filter changes keep the card open; **Clear** and **Reset tool** close it. The card shows: name (sharp spelling, plus "C♯ / D♭" form if altered), octave, string, fret, the unison list or "This pitch exists only at this position", and **See every occurrence**.
- Q: Does **See every occurrence** replace or add to the selection? → A: **[default]** It adds the card's pitch class to the selection (appended in selection order); if already selected, the selection is unchanged (it never toggles off). The card stays open. Non-destructive is the conventional choice.
- Q: How do string filter controls behave? → A: **[source: FR-4.4, EC-4.2]** plus **[default]** One toggle button per string (`aria-pressed`), labeled with the string number and open-string name, ordered like the fretboard rows. Default all on. Turning off the last active string is a no-op: that toggle is rendered pressed and `aria-disabled="true"` while it is the only active string.
- Q: What are the region filter's valid values and push rule? → A: **[source: FR-4.5, EC-4.3, FR-2.8]** plus **[default]** Start and end are integers in 0…fretCount, inclusive; start = end (a one-fret region) is allowed. Controls: two labeled fret steppers (spinbutton semantics, −/+ buttons, keyboard arrows) plus shortcut buttons 0–4, 5–9, 10–14, Whole neck (0–fretCount). Setting start above end sets end = start; setting end below start sets start = end. Values outside 0…fretCount are clamped. With fretCount 12–24 every shortcut is in range except 10–14 when fretCount < 14, which clamps to 10–fretCount. Default region = whole neck, which counts as "no region filter". The region shows as a lit background band (design §6), and changing it scrolls the fretboard so the region is visible (FR-3.15; UJ-2 step 5a).
- Q: When exactly does the "There is no [note] in this region" guidance show, and what does **Widen region** do? → A: **[source: EC-4.4]** plus **[default]** It shows when at least one selected note has zero positions within the active strings and region. The message names every such note in selection order using the locale's list format ("There is no C♯ in this region"; "There is no C♯ or D in this region"), up to three notes; when more than three selected notes are missing it states the count instead ("5 selected notes are not in this region") so the notice stays within two lines at 320 px and 200 % zoom. It is a non-blocking notice (constitution VII). **Widen region** repeats until every selected note has ≥ 1 position inside the filters: among the missing notes' positions on active strings, take the one closest to the region (fewest frets outside it) and move the nearer limit just far enough to include it (ties extend the end). It never changes the string filter or selection. Because fretCount ≥ 12, every string contains all twelve pitch classes, so it always succeeds within whole neck. Example: C♯, string 1 only, region 0–4 → region becomes 0–9 (C♯5 at string 1 fret 9).
- Q: What does **Hide names** change exactly? → A: **[source: FR-4.8, FR-3.16]** plus **[default]** It is a toggle (`aria-pressed`). While on, every position is unlabeled, the hover hint is suppressed, and octave tones are off (tones would hint at the answer and would become color-only). The chosen label type is remembered and restored when Hide names is turned off; the label control stays operable but has no visible effect while Hide names is on. Selection highlighting, filters, the card (which still shows the name), and Listen work normally. The text description of the view omits note names of unselected positions while on, and nothing is stored or scored.
- Q: What does **Listen** play, at what tempo, and when is it available? → A: **[source: FR-4.13, FR-7.6, FR-7.9, 003 playback contract]** plus **[default]** Steps = all positions of selected notes inside the active strings and region, sorted by ascending pitch; positions sharing the same pitch (unisons) form one chord step and light together; equal-pitch order inside a step is by string number. Uses the playback `sequence` request at 120 bpm (0.5 s per step). Listen is enabled only when 1–3 notes are selected **and** at least one such position exists; otherwise it is rendered disabled (`aria-disabled`, not removed) with a reason in its accessible description. Pressing Listen while a sequence plays restarts it. Each sounding position pulses (FR-7.6), also when muted.
- Q: What stops playback in this tool? → A: **[source: 003 clarification "any change to view state … stops whatever is playing"]** Any change to selection, label type, background, Hide names, string filter, or region, and Clear and Reset tool, call `playback.stop('view')`. Opening, replacing, or closing the card does not stop playback by itself, but the tap that opens it issues a new `note` request, which interrupts any sequence (FR-7.9).
- Q: What exactly do **Clear** and **Reset tool** reset? → A: **[source: FR-4.11, FR-4.1]** plus **[default]** Clear: selection → empty, strings → all active, region → whole neck, card → closed; label type, background, and Hide names unchanged. Reset tool: everything back to the FR-001 initial state (no selection, Name labels, background naturals, all strings, whole neck, Hide names off, card closed). Both are always enabled; on an already-matching state they are no-ops.
- Q: Does Notes view state survive leaving the tool? → A: **[default]** View state lives in an in-memory store outside the tool component (constitution III) and survives in-app navigation away from and back to `/notes` within the page session; a reload starts from the initial state. Persistence to storage and share links are out of scope.
- Q: What if the instrument changes while filters are set? → A: **[default]** Filters are re-validated against the new instrument: strings above the new string count are dropped from the active set (if none remain, all strings become active); region limits are clamped to 0…fretCount, then the push rule applies. The selection is unchanged.
- Q: What is the text description of a Notes view? → A: **[source: FR-3.18, constitution V]** plus **[default]** The summary sentence states the selected notes in full words in selection order ("G" / "C sharp and E"), the number of highlighted positions, the active strings, and the region, e.g. "G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22." Followed by the highlighted positions as "string N, fret F, G3". With nothing selected it states the background set. It is announced politely on change.
- Q: How do the TM-9 Notes fixtures get non-default instruments when the instrument panel ships later? → A: **[source: TM-9, constitution IV]** plus **[default]** Screenshot fixtures cover TM-9 views 1–5 only (the Notes views). Views needing AF-21 (7 strings) or AF-7 (DADGAD) set the instrument through a test-only harness (in the spirit of ADR 0004 test-only fault injection), not through product UI. View 1: F♯ selected, octave tones on; View 2: background naturals, region 0–12; View 3: card open on string 3 fret 2; View 4: background all, region 0–5, 7 strings; View 5: D selected, DADGAD.
- Q: How does the selector look and behave on narrow screens? → A: **[source: FR-4.2, design §4.3, §7, constitution V]** Twelve toggle buttons (`aria-pressed`) from C, each ≥ 44×44 px; naturals vs altered distinguished by fill style *and* the two-spelling label (not color alone); altered buttons read "F♯ / G♭" and are announced "F sharp or G flat". At widths < 600 px they form two rows of six; wider, one row. The selector never scrolls horizontally.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find every occurrence of a note (Priority: P1)

A beginner who counts fret by fret opens Fretboard Notes and sees the neck in its simplest state: no note selected, natural notes labeled with their names, altered notes hidden, no filters. They pick a note from the selector (twelve notes in chromatic order from C, altered notes showing both spellings such as F♯ / G♭) and every occurrence lights up while the rest dims. Tapping the note again removes it. With one note selected, occurrences in the same octave share a highlight tone and carry a small octave number.

**Why this priority**: This is the tool's reason to exist ("where is every note?") and the core of journey UJ-2. It is a complete, demonstrable MVP on its own.

**Independent Test**: Open the tool, select G, and verify every G on all six strings is highlighted with octave tones and all other positions are dimmed.

**Acceptance Scenarios**:

1. **Given** the tool is freshly opened, **When** it renders, **Then** no note is selected, labels show names, natural notes show at normal emphasis, altered notes are hidden, and no string or region filter is active.
2. **Given** the initial state, **When** the user selects G, **Then** all 12 G positions (standard tuning, 22 frets) are highlighted, grouped into four octave tones G2–G5 each with its octave number, and the other visible positions are dimmed.
3. **Given** G is selected, **When** the user taps G in the selector again, **Then** it is removed from the selection.
4. **Given** two or more notes are selected, **When** they are highlighted, **Then** octave distinction (shared tones and numbers) is off unless the user chose the Octave label type.
5. **Given** the selector, **When** it is shown, **Then** it lists the twelve notes from C in chromatic order, naturals visually distinct from altered notes, each altered note showing both spellings, in two rows of six on narrow screens.
6. **Given** one to twelve notes, **When** the user selects them, **Then** the selection accepts all of them, and with twelve selected the display equals "all notes highlighted".

---

### User Story 2 - Tap a position to hear it and learn about it (Priority: P1)

The user taps any fret position. It sounds and a position card opens showing the note name (both spellings if altered), octave, string, fret, and a list of other positions with the same pitch (unisons), which are emphasized on the fretboard while the card is open. The card offers **See every occurrence**, which selects that note.

**Why this priority**: Connects the visual map to sound and to the idea that one pitch lives in several places; the second half of UJ-2.

**Independent Test**: Tap string 3, fret 2 (A3) and verify the sound plays and the card lists string 4 fret 7, string 5 fret 12, and string 6 fret 17 as unisons.

**Acceptance Scenarios**:

1. **Given** the tool is open, **When** the user taps string 3, fret 2, **Then** A3 plays and the card shows A, octave 3, string 3, fret 2, and lists string 4 fret 7, string 5 fret 12, string 6 fret 17 as unisons, emphasized on the fretboard.
2. **Given** the card is open, **When** it is closed (Close button or Escape), **Then** the unison emphasis is removed and focus returns to the fretboard position.
3. **Given** the card is open on an altered note, **When** it renders, **Then** both spellings are shown (for example C♯ / D♭).
4. **Given** a position whose pitch exists nowhere else on the instrument, **When** the card opens, **Then** it states "This pitch exists only at this position".
5. **Given** the card is open, **When** the user activates **See every occurrence**, **Then** that note is added to the selection (never toggled off) and highlighted as in Story 1, and the card stays open.
6. **Given** keyboard use, **When** the user activates a focused position with Enter or Space, **Then** it behaves exactly like a tap.

---

### User Story 3 - Narrow the view with string and region filters (Priority: P2)

The user turns individual strings on and off and sets a start and end fret (with shortcuts for 0–4, 5–9, 10–14, and whole neck) to focus on part of the neck. Positions outside the filters are dimmed and unlabeled. The last active string cannot be turned off, and the two fret limits push each other instead of crossing.

**Why this priority**: Makes the tool usable for practicing one area or one string; valuable but secondary to finding and hearing notes.

**Independent Test**: Select C♯, keep only string 1 active and set the region to 0–4, and verify the guidance "There is no C♯ in this region" with **Widen region** appears.

**Acceptance Scenarios**:

1. **Given** all strings active, **When** the user turns strings off one by one, **Then** inactive strings are dimmed and unlabeled and the last active string cannot be turned off.
2. **Given** a region of frets 5–9, **When** the user moves the start fret past the end fret, **Then** the end fret is pushed to match (and likewise in the other direction); the limits never cross.
3. **Given** the region shortcuts, **When** the user picks 0–4, 5–9, 10–14, or whole neck, **Then** start and end frets are set accordingly.
4. **Given** C♯ selected, only string 1 active, and region 0–4, **When** the view renders, **Then** it shows "There is no C♯ in this region" with **Widen region**; activating it sets the region to 0–9 so C♯5 (string 1, fret 9) appears.
5. **Given** filters are set, **When** positions fall outside them, **Then** they are dimmed and unlabeled.

---

### User Story 4 - Control what the neck shows (labels and background) (Priority: P2)

The user chooses the label type (Name, Octave, No label) and the **Show** background (naturals only by default, all notes, none). Selected notes always show, even if altered and the background is "naturals only". With background "none" and nothing selected, the neck shows "Pick a note or tap a fret".

**Why this priority**: Core reading controls from the controls-per-tool design, needed for both learning and self-testing.

**Independent Test**: Set the background to none with nothing selected and verify the guidance "Pick a note or tap a fret"; select C♯ and verify it appears although altered notes are hidden by default.

**Acceptance Scenarios**:

1. **Given** the default background, **When** the user selects an altered note, **Then** its occurrences show though other altered notes stay hidden.
2. **Given** the user picks "all notes", **When** it renders, **Then** naturals and altered notes all show; picking "none" shows only selected notes.
3. **Given** background "none" and nothing selected, **When** it renders, **Then** the fretboard is empty and shows "Pick a note or tap a fret".
4. **Given** several notes selected, **When** the user picks the Octave label type, **Then** octave numbers show on positions.
5. **Given** "No label", **When** it renders, **Then** no position shows a label.

---

### User Story 5 - Listen, self-test, clear, and reset (Priority: P3)

**Listen** plays the highlighted occurrences within the filters in rising pitch, lighting each one as it sounds, when 1–3 notes are selected. **Hide names** removes every label and the hover hint so names show only on the position card, for informal self-testing; nothing is recorded. **Clear** removes selection and filters but keeps label type and background. **Reset tool** returns everything to the initial state.

**Why this priority**: Valuable aids that build on the core stories.

**Independent Test**: Select A, press Listen, and verify each A in the filters sounds in ascending pitch and lights in turn; press Hide names and verify no labels or hover hint remain until a position is tapped.

**Acceptance Scenarios**:

1. **Given** 1–3 notes selected, **When** the user presses **Listen**, **Then** the highlighted occurrences within active filters play in ascending pitch, each lighting while it sounds.
2. **Given** 0 or 4–12 notes selected, **When** the controls render, **Then** **Listen** is unavailable.
3. **Given** **Hide names** is on, **When** the user hovers or looks at the neck, **Then** no labels and no hover hint show; tapping a position shows its name on the card only.
4. **Given** a selection, filters, label type Octave, and background "all notes", **When** the user presses **Clear**, **Then** selection and filters are removed and label type and background stay.
5. **Given** any changed state, **When** the user presses **Reset tool**, **Then** the tool returns to its initial state.
6. **Given** a Listen is playing, **When** the user changes the selection or filters, **Then** playback stops (existing playback rules).

---

### Edge Cases

- Background "none" with no selection: empty neck with "Pick a note or tap a fret".
- Last active string: cannot be turned off; the control stays on.
- Start fret above end fret: limits push each other.
- Selected note with no occurrence inside the filters: "There is no [note] in this region" with **Widen region**.
- Twelve notes selected: equivalent to all notes highlighted; **Listen** unavailable.
- Position with no unison: card says "This pitch exists only at this position".
- Hide names on and a selection active: selection still highlights positions but without labels.
- Narrow screens: selector wraps to two rows of six; only the fretboard scrolls horizontally.
- Audio unavailable or muted: tapping still opens the card and pulses; sound is never the only carrier of information.
- Tapping a hidden or filter-dimmed position (e.g. an altered note under "naturals only", or any fret with background "none"): it plays and opens the card like any other position.
- Several selected notes missing from the filters: one notice names all of them in selection order (up to three; more than three → the count form, keeping the notice within two lines).
- 10–14 shortcut with fretCount < 14: clamps to 10–fretCount.
- Instrument changes while filtered: strings beyond the new count are dropped (all strings if none remain); region clamped to the new fret count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The tool MUST open in its simplest state: no note selected, Name labels, naturals at normal emphasis, altered notes hidden, no string or region filter.
- **FR-002**: The note selector MUST list the twelve notes in chromatic order from C, visually distinguishing naturals from altered notes, each altered note showing both spellings (for example F♯ / G♭), in two rows of six on narrow screens.
- **FR-003**: Users MUST be able to select 1 to 12 notes (selection order preserved); every occurrence of selected notes is highlighted and other visible positions are dimmed. Selecting a selected note again removes it. Each position's emphasis level MUST follow the precedence in Clarifications (card > background-hidden > filter-dimmed > selected-highlighted > background normal/dimmed); selection-dimmed positions keep labels, filter-dimmed ones do not. Notes markers use the neutral function shape and dedicated highlight/octave-tone tokens, never root/third/fifth colors.
- **FR-004**: Octave distinction (sounding-pitch octave, changing at C) MUST be on when exactly one note is selected or the label type is Octave, and Hide names is off; it MUST be off with "No label" or Hide names. When on, highlighted positions of the same octave share one octave-tone token (fixed per octave number) and every highlighted label carries the octave number, so tone is never the sole carrier.
- **FR-005**: Label types MUST be Name, Octave, and No label (default Name). Octave shows name plus octave number (e.g. "A3") on every labeled position.
- **FR-006**: The **Show** control MUST offer naturals only (default), all notes, and none; selected notes MUST always show.
- **FR-007**: A string filter MUST offer one toggle per string (string number and open-string name, `aria-pressed`); the last active string MUST NOT be turnable off (its toggle is pressed and `aria-disabled`). Default: all active.
- **FR-008**: A region filter MUST let users set integer start and end frets in 0…fretCount (start = end allowed) via two steppers, with shortcuts 0–4, 5–9, 10–14 (clamped to fretCount), and whole neck (0–fretCount, the default, meaning no region filter). Setting start above end sets end = start and vice versa; out-of-range values clamp. The region MUST show as a lit band, and a region change MUST scroll the fretboard so the region is visible.
- **FR-009**: Positions outside the active string or region filters MUST be dimmed and unlabeled.
- **FR-010**: Tapping or keyboard-activating any position (whatever its emphasis) MUST play it and open a non-modal position card in zone D with name (both spellings if altered), octave, string, fret, the list of unisons — every other position on the whole instrument with the same pitch, ignoring filters and background, ordered by string ascending — and **See every occurrence**. While open, the tapped position and unisons are highlighted and labeled and all other non-hidden positions are dimmed. If no unison exists, the card MUST say "This pitch exists only at this position". Tapping another position replaces the card; the same position replays and keeps it; Close or Escape closes it and returns focus to the position; Clear and Reset tool close it.
- **FR-010a**: **See every occurrence** MUST add the card's note to the selection (no change if already selected, never removes it) and keep the card open.
- **FR-011**: **Hide names** MUST be a toggle that removes every label, the hover hint, and octave tones, so names appear only on the position card; the chosen label type is restored when it is turned off. It MUST NOT record hits, misses, or any result.
- **FR-012**: **Listen** MUST play the selected notes' positions within the active filters as a 120 bpm sequence in ascending pitch, same-pitch positions sounding together as one step, each pulsing as it sounds (also when muted). It MUST be enabled only when 1 to 3 notes are selected and at least one such position exists; otherwise it is shown disabled with its reason. Pressing it during playback restarts it.
- **FR-012a**: Any change to selection, label type, background, Hide names, string filter, or region, and Clear and Reset tool, MUST stop current playback and clear pulses.
- **FR-013**: **Clear** MUST empty the selection, activate all strings, set the region to whole neck, and close the card, keeping label type, background, and Hide names.
- **FR-014**: **Reset tool** MUST return the tool to the FR-001 initial state, with Hide names off and the card closed.
- **FR-015**: When one or more selected notes have no position inside the active filters, the tool MUST show one non-blocking notice "There is no [notes] in this region" naming them in selection order (locale list format) — or, when more than three are missing, "[count] selected notes are not in this region" — no longer than two lines at 320 px and 200 % zoom, with **Widen region**, which repeatedly moves the nearer region limit just enough to include the closest missing position (ties extend the end) until every selected note appears, without touching the string filter. When the background is "none" and nothing is selected, the tool MUST show "Pick a note or tap a fret".
- **FR-016**: Altered notes MUST be spelled with sharps in labels and selection; the position card shows both spellings. The accidental preference is out of scope.
- **FR-017**: Notes MUST be positioned and sounded at their calculated pitch for the configured tuning, string count, and fret count, and every position state MUST use only the four emphasis levels (highlighted, normal, dimmed, hidden).
- **FR-018**: All controls MUST be keyboard-operable, convey state by more than color, meet 44×44 px touch targets in comfortable mode, expose a text description of the current view to screen readers (accidentals read in full, "F sharp"), and have all user-facing text in the message catalog.
- **FR-019**: Tool state MUST live outside the tool component as in-memory view state that survives in-app navigation within the session and resets on reload; on instrument change, filters are re-validated (strings beyond the count dropped, all strings if none remain; region clamped). A control change MUST update the fretboard within 100 ms.
- **FR-019a**: The view's text description MUST state the selected notes in full words, the number of highlighted positions, active strings, and region (e.g. "G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22"), then list highlighted positions; with nothing selected it states the background set; with Hide names on it omits names of unselected positions.
- **FR-020**: The tool MUST provide TM-9 views 1–5 as Playwright screenshot fixtures; non-default instruments (AF-21, AF-7) are set through a test-only harness, not product UI.

### Key Entities

- **Notes selection**: ordered set of 1–12 pitch classes the user chose (first-selected order preserved).
- **Label type / Background set**: how positions are labeled (Name, Octave, No label) and which unselected notes show (naturals, all, none).
- **String filter / Region filter**: active strings and inclusive start–end fret range.
- **Position**: string, fret, resulting note name, octave, and pitch.
- **Position card**: the detail view for one tapped position, including unisons.
- **Hide-names flag**: whether labels and hover hint are suppressed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Selecting any one note highlights 100% of its occurrences on the neck within 100 ms, verified for all twelve notes.
- **SC-002**: For every position tapped, the card's unison list matches the calculated same-pitch positions exactly (A3 at string 3 fret 2 lists string 4 fret 7, string 5 fret 12, string 6 fret 17).
- **SC-003**: A new user finds all occurrences of a given note in under 10 seconds without counting frets.
- **SC-004**: Each of the four acceptance examples (G with octave tones; A3 unisons; C♯ empty-region guidance with **Widen region**; "Pick a note or tap a fret") passes as an automated test.
- **SC-005**: Every control works by keyboard alone and passes automated accessibility checks with zero violations at 320 px and desktop widths.
- **SC-006**: No filter combination ever leaves the user without a visible view or message (never blank).
- **SC-007**: Tool opens or switches in under 300 ms and a tapped position sounds within 100 ms after audio is unlocked.

## Assumptions

- Depends on 002-interactive-fretboard (shared fretboard rendering, activation events) and 003-note-playback (sound, pulse, playback rules).
- Instrument is the default six-string guitar in standard tuning unless the shared instrument state says otherwise; counts adapt to it.
- Out of scope: "View as triad" and the Triads and CAGED shortcuts (later waves), the accidental preference and "both" spelling option (005-languages-and-notation/002), and persistence of tool state or share links.
- "Widen region" behavior: see FR-015 and Clarifications.
- Listen uses the playback slice's `sequence` request at a fixed 120 bpm (FR-012).
- Octave numbering follows the theory reference (C4 = middle C pitch convention used by the existing theory module).
- "Highlight tone" per octave is a design-token tone always paired with the octave number, never color alone (FR-004).
