# Feature Specification: Instrument Panel and Preset Tunings

**Feature Branch**: `feature/009-instrument-panel-and-tunings`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/003-your-instrument/001-instrument-panel-and-tunings.md (id 001, instrument-panel-and-tunings)." Source sections: FR-2.1, FR-2.2 (tuning and fret count only), FR-2.4, FR-2.8–2.11 (Area 2), TM-2 (tunings), UJ-5 (Configure the instrument), UJ-1, EC-2.3, EC-2.4, EC-2.7, ARCH-3.

## Clarifications

### Session 2026-10-02 (clarify reviewer)

Derived from a source (cited) or assumed default (marked **Default**, with rationale). No material question remains open.

- Q: Does the home instrument summary already exist? → A: No. The current home screen has no summary; this slice adds it (FR-1.3, design §4.1 "Bottom"). Text: "6 strings · standard tuning · right-handed" for Standard, and "6 strings · {preset name} · right-handed" otherwise (e.g. "6 strings · Drop D · right-handed"). Fret count is not part of the summary (FR-1.3 lists string count, tuning, handedness only). The whole summary is one activatable control that opens the panel.
- Q: Where is the tool entry point in the application bar? → A: **Default**: an always-visible "Instrument" button in zone A of every tool. Design §4.2 lists instrument under a bar menu, but no menu exists yet and building one for a single item is speculative (Constitution X); a visible button also satisfies FR-2.1 and is trivially moved into a menu later. The tuning badge (when shown) is a second entry point.
- Q: Which widths get the bottom sheet vs the side panel? → A: Derived from design §5.1/§5.5: side panel at ≥ 1024 CSS px ("Wide"); bottom sheet below 1024 px (Narrow and Medium, both one-column layouts). Uses the existing breakpoint in `tokens.css`.
- Q: Is the panel modal? → A: **Default** (WAI-ARIA dialog pattern): `role="dialog"` with an accessible name; on open, focus moves to the first control (the selected preset); Tab stays inside the panel while open; Escape, the close control, activating outside the panel, and browser Back all dismiss it without applying (EC-2.7) and return focus to the opener. Escape always exits, so this is not a keyboard trap (WCAG 2.1.2). Browser Back while open closes the panel and leaves the user on the same screen. This is the panel surface mandated by design §5.5, not an interrupting modal (Constitution VII).
- Q: What does the preview fretboard show? → A: **Default**: a non-interactive, compact fretboard drawn from the *pending* configuration (pending tuning and pending fret count) with each open string labelled by its preset name (preset spelling, ♯/♭ glyphs). It updates on every pending change and does not play sound. It is presentational only and is hidden from the screen reader's fretboard description; the preset list item already announces the string notes.
- Q: How is the fret count entered? → A: **Default**: a stepper (− / value / +) exposed as a spinbutton (`aria-valuemin=12`, `aria-valuemax=24`, `aria-valuenow`), Arrow Up/Down change by 1, Home/End jump to 12/24. The − control is disabled at 12 and + at 24 (no error message, mirrors EC-2.6). Targets ≥ 44×44 CSS px. No free-text entry, so out-of-range values cannot be entered.
- Q: What does Confirm do when nothing changed? → A: **Default**: Confirm is always enabled; it closes the panel. If the pending configuration equals the active one, nothing is recalculated, playback is not stopped, and no notice appears.
- Q: Does a fret-count-only change show the badge? → A: No. Derived from FR-2.10: the badge depends only on the tuning (shown iff tuning ≠ Standard). Standard at any fret count shows no badge.
- Q: When exactly is "We adjusted the view to the new instrument" shown? → A: **Default**: after a confirmed change, each tool's view state is revalidated against the new instrument. The notice appears in the currently displayed tool iff revalidation changed that tool's view state (Notes region clipped or position card closed because its position no longer exists; Triads occurrence clamped). Tools not currently displayed are revalidated silently. Scroll correction alone (FR-014) does not show the notice. Tuning-only recalculation that keeps the same view state (same root/quality/inversion/string set/occurrence index, new frets) is not an adjustment. The notice uses the existing non-blocking, dismissible notice (Constitution VII), is announced politely, and is replaced by any later notice.
- Q: Notes region set to the whole neck and fret count changes? → A: **Default**: a region that covered the whole neck (0 to the old last fret) keeps covering the whole neck (0 to the new last fret), with no notice. Any other region is clipped to the new last fret (EC-2.3); if both ends exceed it, the region becomes the last fret only (start = end = new last fret) with the notice.
- Q: What is "same shape in another octave" in Triads? → A: Derived from EC-2.3 and existing Triads state: the shape keeps root, quality, inversion, string set and view; only the occurrence index changes. If the old index no longer exists, it moves to the highest remaining occurrence (the nearest one below), with the notice. When the combination has no shape at all on the new instrument, the existing no-shape behavior (EC-5.1) applies.
- Q: How is the scroll correction done? → A: **Default**: the fretboard scrolls so the new last fret is at the trailing edge of the viewport, using the documented motion duration, instantly under `prefers-reduced-motion`.
- Q: Does confirming stop playing sound? → A: Derived from existing behavior (tools stop playback with reason `instrument` when the instrument changes): yes, iff the instrument actually changed.
- Q: How long does the configuration last? → A: Derived from the breakdown scope boundary (storage is slice 003/002): in memory only, shared across tools and navigation within the page session; a full page reload starts again at the default instrument.
- Q: How are tuning names and string notes produced? → A: Derived from Constitution VIII: preset names live in the message catalog; string note names come from `src/lib/notation` using the preset's own spelling (TM-2), rendered with ♯ ♭, and read in full by screen readers (e.g. "E flat"). The badge shows the same catalog name as the list.
- Q: How is the active tuning identified? → A: **Default**: the configuration holds the preset id (AF-1 … AF-11) plus its open-string pitches; name, badge and summary derive from the id. Restore default sets AF-1, 22 frets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play in a different tuning and see matching views (Priority: P1)

A guitarist who tunes down or plays Drop D opens the instrument panel from the home screen's instrument summary or from any tool's application bar, picks a preset tuning, sees a preview fretboard, and confirms. Every tool then shows, calculates, and plays notes and triad shapes for the real tuning, without a page reload.

**Why this priority**: This is the core value: diagrams match what is under the player's fingers, with no mental translation. Without it the product only serves standard tuning.

**Independent Test**: Open the panel from a tool, pick Drop D, confirm. String 6 shows and plays D2, a "Drop D" badge appears, and Triads C major root position on strings 6-5-4 reads 10-7-5 with a "wide stretch" tag (standard reads 8-7-5).

**Acceptance Scenarios**:

1. **Given** Standard tuning and any tool open, **When** the user opens the panel, picks Drop D, and confirms, **Then** string 6 shows and plays D2 and a "Drop D" badge appears on every tool.
2. **Given** Drop D confirmed, **When** the user views Triads C major root position on strings 6-5-4, **Then** the shape reads 10-7-5 and is tagged "wide stretch" (standard: 8-7-5).
3. **Given** the user selects a preset in the panel, **When** the selection changes, **Then** a preview fretboard for that tuning is shown before anything is applied.
4. **Given** the user confirms a new tuning, **When** the current view is recalculated, **Then** it updates without a page reload within 300 ms and the home thumbnails reflect the new instrument.
5. **Given** a non-Standard tuning is active, **When** the user activates the tuning badge in any tool, **Then** the instrument panel opens.
6. **Given** Standard tuning at 22 frets, **When** any tool is shown, **Then** no tuning badge is displayed.

---

### User Story 2 - Change the fret count (Priority: P2)

The user sets how many frets their instrument has, from 12 to 24 (default 22), and every tool follows.

**Why this priority**: Many instruments (classical, travel, vintage) differ from 22 frets; views and regions must not show frets that do not exist.

**Independent Test**: Set frets to 12, confirm; the fretboard in every tool ends at fret 12 and no note, shape, or region appears past it.

**Acceptance Scenarios**:

1. **Given** the panel is open, **When** the user sets the fret count anywhere from 12 to 24 and confirms, **Then** every tool shows exactly that many frets.
2. **Given** the panel is open, **When** the user tries a value below 12 or above 24, **Then** it is not accepted.
3. **Given** the default configuration, **When** the panel opens, **Then** it shows 6 strings, Standard, 22 frets.

---

### User Story 3 - Cancel and restore default safely (Priority: P2)

The user can experiment in the panel without consequence: closing without confirming discards changes, and **Restore default** returns to the default instrument.

**Why this priority**: Safe experimentation encourages configuring; no accidental changes to the user's study view.

**Independent Test**: Change tuning, close the panel without confirming; previous tuning remains. Then with Drop D and 16 frets active, use Restore default and confirm; Standard and 22 frets apply.

**Acceptance Scenarios**:

1. **Given** the user changed the tuning or fret count in the panel, **When** the panel is closed without confirming, **Then** the previous instrument remains and nothing is recalculated.
2. **Given** a non-default instrument, **When** the user uses **Restore default**, **Then** the panel shows 6 strings, Standard, 22 frets, and after confirming every tool uses them and the badge disappears.
3. **Given** the panel was cancelled, **When** it is reopened, **Then** it shows the confirmed instrument, not the discarded edits.

---

### User Story 4 - View adjusts when the new instrument makes it impossible (Priority: P3)

When a change would leave the current view invalid, the system moves to the nearest equivalent and says so.

**Why this priority**: Prevents broken or empty views after reconfiguration; lower frequency than the main flow.

**Independent Test**: In Notes, set region 10–14, cut frets to 12, confirm: region becomes 10–12 and the message "We adjusted the view to the new instrument" appears.

**Acceptance Scenarios**:

1. **Given** Notes with region 10–14, **When** the user confirms a fret count of 12, **Then** the region clips to 10–12 and "We adjusted the view to the new instrument" is shown.
2. **Given** a Triads shape that no longer fits on the instrument, **When** the change is confirmed, **Then** the same shape in another octave (or the nearest equivalent) is shown with the same message.
3. **Given** the fretboard is scrolled past the new last fret, **When** the change is confirmed, **Then** it scrolls back to the last fret.
4. **Given** the change leaves the view valid, **When** confirmed, **Then** no adjustment message appears.

---

### User Story 5 - Reach the panel from the home screen and every tool (Priority: P1)

The home screen shows the instrument summary ("6 strings · standard tuning · right-handed") and every tool's application bar has an entry point; both open the panel. It is a bottom sheet on narrow screens and a side panel on wide screens.

**Why this priority**: Without a discoverable entry point the configuration is unusable; first-visit users also see the summary and expect it to be tappable.

**Independent Test**: From the home screen activate the summary; the panel opens. From each tool activate the application bar control; the panel opens in the layout suited to the screen width.

**Acceptance Scenarios**:

1. **Given** the home screen, **When** the user activates the instrument summary, **Then** the panel opens.
2. **Given** any tool, **When** the user activates the instrument control in the application bar, **Then** the panel opens.
3. **Given** a narrow screen, **When** the panel opens, **Then** it appears as a bottom sheet; on a wide screen, as a side panel.
4. **Given** a confirmed non-Standard tuning, **When** the home screen is shown, **Then** the summary reflects it (for example "6 strings · Drop D · right-handed") and thumbnails use the new tuning.

---

### Edge Cases

- Panel closed by any dismissal means (close control, Escape, tapping outside, back gesture) without confirming: changes are discarded (EC-2.7).
- Confirming with no changes: no recalculation message, no adjustment notice.
- Fret count reduced while the fretboard is scrolled beyond the new limit: scrolls to the last fret (EC-2.4).
- Region filter extends past the new last fret: clipped to the new last fret (EC-2.3).
- Shape in focus no longer fits after reducing frets: nearest equivalent (same shape in another octave, or neighboring shape) with the notice (EC-2.3).
- Preset string names keep their own spelling (flats in Half step down, F♯ in Open D); not respelled by any preference.
- Selected tuning name is shown in the badge exactly as in the preset list (for example "Drop D", "DADGAD").
- A previously chosen preset is highlighted when the panel reopens.
- Triads views already calculated for Standard are recalculated for the new tuning, including "wide stretch" tags.
- Sounds follow the real tuning: playing a note after the change uses the new pitch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The instrument panel MUST be reachable from the home screen's instrument summary (added by this slice) and from an always-visible "Instrument" button in the application bar of every tool; the tuning badge (FR-011) is an additional entry point.
- **FR-002**: The panel MUST open as a bottom sheet below 1024 CSS px and as a side panel at 1024 CSS px or wider (design §5.1, §5.5).
- **FR-003**: The panel MUST let the user choose a tuning from these 6-string presets, each listed by name with the note of each string from lowest to highest: Standard (E A D G B E), Half step down (E♭ A♭ D♭ G♭ B♭ E♭), Whole step down (D G C F A D), Drop D (D A D G B E), Drop C (C G C F A D), Double Drop D (D A D G B D), DADGAD (D A D G A D), Open G (D G D G B D), Open D (D A D F♯ A D), Open E (E B E G♯ B E), Open A (E A E A C♯ E).
- **FR-004**: Exact pitches (note and octave) of each preset MUST follow the tuning reference (TM-2); for example Drop D is D2 A2 D3 G3 B3 E4.
- **FR-005**: Preset string names MUST keep their own spelling (flats in Half step down, F♯ in Open D).
- **FR-006**: The panel MUST show a non-interactive preview fretboard drawn from the pending tuning and pending fret count, with each open string labelled in the preset's spelling; it MUST update on every pending change, MUST NOT play sound, and MUST NOT apply anything.
- **FR-007**: The panel MUST let the user set the fret count between 12 and 24 inclusive with a stepper exposed as a spinbutton (− / value / +; Arrow Up/Down ±1; Home/End to 12/24); the default MUST be 22; − MUST be disabled at 12 and + at 24, with no error message; no free-text entry.
- **FR-008**: **Confirm** MUST close the panel and apply the configuration to every tool, recalculate the current view without a page reload within 300 ms, and update the home screen thumbnails (drawn with the active instrument, not a fixed Standard instrument) and instrument summary. If the instrument actually changed, any playing sound MUST stop; if the pending configuration equals the active one, Confirm MUST only close the panel (no recalculation, no notice, playback untouched).
- **FR-009**: Closing the panel without confirming — close control, Escape, activating outside the panel, or browser Back — MUST discard all pending changes, keep the previous instrument, and leave the user on the same screen. Reopening MUST show the active configuration with its preset selected.
- **FR-010**: **Restore default** MUST reset the pending configuration to 6 strings, Standard tuning, 22 frets (applied on confirm).
- **FR-011**: Whenever the active tuning is not Standard, every tool MUST show a badge with the tuning name exactly as in the preset list; activating the badge MUST open the panel. With Standard, no badge is shown, regardless of fret count.
- **FR-012**: Notes shown, triad shapes calculated, and sounds played MUST all follow the active tuning and fret count. No view may use standard-tuning-only data.
- **FR-013**: After a confirmed change, every tool's view state MUST be revalidated against the new instrument, moving to the nearest equivalent: (a) Notes: a region covering the whole neck stays the whole neck (0 to new last fret) with no notice; any other region is clipped to the new last fret (start = end = last fret if both ends exceed it); a position card on a position that no longer exists closes; (b) Triads: root, quality, inversion, string set and view are kept; an occurrence index that no longer exists moves to the highest remaining occurrence; with no shape at all, EC-5.1 applies. The message "We adjusted the view to the new instrument" MUST appear, as the existing non-blocking dismissible notice, in the currently displayed tool iff revalidation changed that tool's view state; tools not displayed revalidate silently; a new fret layout for an unchanged view state is not an adjustment.
- **FR-014**: When the fretboard is scrolled past a reduced last fret, it MUST scroll so the new last fret is at the trailing edge of the viewport (documented motion duration; instant under `prefers-reduced-motion`). Scroll correction alone does not show the notice.
- **FR-015**: The panel MUST be operable by keyboard and screen reader as a labelled dialog: focus moves to the selected preset on open, Tab stays inside the panel while it is open, Escape always closes it, focus returns to the opener on close; preset list, fret count, Confirm, Restore default, and close are labeled; each preset item announces its name and string notes read in full (e.g. "E flat").
- **FR-016**: The adjustment message and the badge MUST be exposed to assistive technology.
- **FR-017**: The home screen MUST show an instrument summary as one activatable control: "6 strings · standard tuning · right-handed" with Standard, "6 strings · {preset name} · right-handed" otherwise (e.g. "6 strings · Drop D · right-handed"). Fret count is not shown.
- **FR-018**: The active configuration MUST persist across tool and home navigation within the page session and MUST reset to the default (6 strings, Standard, 22 frets) on full page reload; nothing is written to storage in this slice.
- **FR-019**: Preset names MUST come from the message catalog and string note names from the notation module using each preset's own spelling (TM-2), never respelled by any preference, rendered with ♯ ♭.

### Key Entities

- **Instrument configuration**: The active tuning (preset id AF-1…AF-11 plus ordered string pitches; name, badge and summary derive from the id) and fret count; consumed by every tool. In this slice string count is fixed at 6.
- **Tuning preset**: Named, ordered list of string pitches (note and octave) from lowest to highest, with its display spelling.
- **Pending configuration**: Uncommitted edits in the panel (tuning, fret count) until confirmed or discarded.
- **View adjustment notice**: Transient message shown after an instrument change forced the view to move.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After confirming, the current view reflects the new instrument within 300 ms and without a page reload.
- **SC-002**: For all 11 presets, the notes and sounds on every string match the tuning reference exactly (100% of strings, verified by table).
- **SC-003**: With Drop D confirmed, Triads C major root position on strings 6-5-4 reads 10-7-5 with "wide stretch"; with Standard it reads 8-7-5.
- **SC-004**: A user can open the panel, pick a tuning, and confirm in under 30 seconds from any screen.
- **SC-005**: In 100% of cancelled sessions, the previous instrument is unchanged.
- **SC-006**: Reducing frets below an active region or shape always yields a valid view with the adjustment notice; no view ever shows frets past the last fret.
- **SC-007**: The panel works at phone and desktop widths with keyboard-only and screen-reader use.

## Assumptions

- Persistence between visits is out of scope (handled by a later storage slice); the configuration lasts for the current session.
- Out of scope: custom tuning, 7 strings, handedness, and string orientation; the panel is structured so these can be added later, and the instrument summary shows right-handed as fixed text.
- The 6 strings and Standard tuning at 22 frets, right-handed, are the defaults. The home instrument summary does not exist yet; this slice adds it (FR-017).
- Fret-count entry is a bounded stepper (FR-007) rather than free text, so out-of-range values cannot be entered.
- "Nearest equivalent" for an impossible view follows the rules in EC-2.3: clip a region, keep the same shape in another octave, or choose the neighboring shape.
- Prerequisites: the whole MVP (home, Notes, Triads isolated, full neck, linked tools) and the triads shape calculation exist and take tuning and fret count as inputs.
- Theory correctness is governed by the constitution: tuning-dependent shapes are calculated, never hand-drawn.
