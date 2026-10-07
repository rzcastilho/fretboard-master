# Feature Specification: Minimap, Fit to Screen, and Landscape

**Feature Branch**: `feature/025-minimap-fit-and-landscape`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/007-comfort-and-launch-readiness/002-minimap-fit-and-landscape.md (id 002, minimap-fit-and-landscape)." Source sections: FR-3.13, FR-3.14, FR-3.19, EC-3.5, EC-3.6, NFR-2, NFR-3.5, design §4.2 and §5 (responsiveness), FR-2.6 (mirroring).

## Clarifications

### Session 2026-10-06

Each answer derives from a cited source, is an assumed default (marked **Default**), or is an operator decision (marked **Operator decision**). No material question is open.

- Q: When does the minimap show? → A: FR-3.13: only when the fretboard does not fit on screen in full. Whenever the fretboard is scrollable (comfortable mode on a screen too narrow for the whole neck), the minimap shows directly under it. In whole-fretboard mode nothing is off screen, so it is not needed. EC-3.6: 7 strings, 24 frets, 320 wide → comfortable mode is the default and the minimap is always visible.
- Q: What does the minimap show? → A: Design §4.2: the whole neck in miniature, the visible stretch as a window, highlighted positions as dots. Dots follow the highlighted emphasis level only (dimmed and hidden positions are not drawn). Marker shape rules for note function apply to the main fretboard; the minimap dots carry position only. **Default**: dots stay distinguishable from the window by shape and size, not color alone (constitution V).
- Q: What does tapping the minimap do? → A: Brief: jumps there. The fretboard scrolls so the tapped point is centered, clamped at the neck ends. Tapping the far end lands on the last fret (fret 24 for a 24-fret neck). **Default**: dragging the window is not required; tap (and keyboard activation) is the contract. Reduced-motion users get an instant jump, others a short scroll.
- Q: Keyboard and screen readers on the minimap? → A: Constitution V. The minimap is keyboard-operable (focusable; arrow keys move the window by a stretch; Enter/Space not required because arrows act immediately) and exposed as a labeled control whose current value reads as the visible fret range ("Frets 1 to 7 of 24"). Its text lives in the message catalog (en/pt/es).
- Q: What are the two modes? → A: FR-3.14. **Comfortable**: each fret at least 44×44 px touch size, scrolling when the neck is wider than the screen. **Whole**: the whole neck visible, frets narrower. **Fit to screen** toggles between them.
- Q: When is Fit to screen hidden? → A: Brief: when the whole neck already fits comfortably (from about 1280 logical width on desktop for 24 frets). Rule: hidden iff the whole fretboard at comfortable fret size fits the available width. It depends on fret count, string count does not affect width. A 12-fret neck can fit sooner than a 24-fret one, so the rule is "fits", not a fixed breakpoint. On a 1440-wide desktop with 24 frets it is absent.
- Q: Which mode is the default? → A: Comfortable (EC-3.6, design §5.2: five to seven frets visible on a phone). The user's last choice is not stored across sessions. **Default** (YAGNI, no preference field): each session starts comfortable. The choice persists while the user stays in the app, across tool switches, resize and rotation, as long as the mode remains meaningful.
- Q: What does pinch do? → A: EC-3.5/A-10: a pinch on the fretboard toggles the two modes, in either direction (pinch in → whole, pinch out → comfortable). No free zoom. A pinch that happens where Fit to screen is hidden does nothing. **Default**: one toggle per gesture, not per movement increment.
- Q: What happens when a user taps in whole mode and frets are under 44×44? → A: NFR-3.5. The tap selects the nearest position (never a dead gap) and the app shows a one-line, dismissible, non-blocking notice offering comfortable mode. It does not switch modes on its own. **Default**: the notice is not repeated for further taps until dismissed or the mode changes.
- Q: Left-handed mode? → A: Design §4.2: the minimap mirrors too (nut side matches the main fretboard), including the window and dots; tapping resolves to the same fret as in right-handed mode.
- Q: What are the layout ranges? → A: Design §5.1: narrow 320–599, medium 600–1023, wide 1024+. Constitution VII: every function works from 320 to 2560; only the fretboard scrolls horizontally.
- Q: Narrow controls? → A: Brief. Main controls fit in two rows; extra controls overflow into a horizontally scrollable strip with a visible cue (no hidden menu). Order: bar, controls, fretboard, actions, context panel.
- Q: Collapsed context panel summary? → A: One line such as "A major · 1st inversion · C♯ – E – A", built from the view's current content using the notation and language in effect, expandable by the user. **Default**: collapsed by default on narrow, expanded on medium and wide.
- Q: What is "landscape" on a phone? → A: **Default**: a short viewport, height ≤ 499 CSS px and width > height (exact rule in the review session below). The sliding panel opens by a button, closes by the same button, a close action, or Escape; it is not modal (the fretboard stays visible and interactive), and focus returns to its button on close.
- Q: What does the sliding panel contain? → A: Everything leaving the main layout in landscape: the context panel and the actions. No function disappears (C-4).
- Q: Resize and rotation? → A: Brief. No state is lost (tool state, selection, focus, mode, shape in focus). The visible stretch is adjusted so the highlighted region (or the shape in focus in CAGED) stays visible; if no region exists, the stretch keeps its start.
- Q: 200% text size? → A: Constitution VIII/NFR: all of the above works at 200% text without truncation, overlap or hidden functions, including the one-line summary (it may wrap or ellipsize only if a full-text form is reachable, **Default**: allow wrapping).
- Q: Out of scope? → A: Brief. No free-form zoom, custom layouts, or saved layout. Sound, theory and share links are untouched.

### Session 2026-10-06 (clarify review)

- Q: Is the CAGED rotate hint (FR-3.19) part of this slice? → A: No. It already ships (slice 016, `src/lib/state/rotate-hint.ts`, breakdown 004-caged/003). This slice MUST keep it working unchanged: still shown once, only on a portrait phone (width ≤ 599 and height > width), never in phone landscape.
- Q: Exact phone-landscape rule? → A: **Default** (conventional `orientation: landscape` + `max-height` media rule, mirroring the existing portrait rule's 599 cutoff): phone landscape ⇔ viewport height ≤ 499 CSS px **and** width > height. It applies at any width (a phone in landscape is 568–932 wide, so it overrides the narrow/medium/wide class); a short desktop window that meets the rule gets the same compact arrangement, which is acceptable since no function is lost. Testable: 844×390 → landscape layout; 1024×768 and 390×844 → not.
- Q: What is "comfortable fret size" and how is "fits" measured? → A: Derived from the existing geometry (`DEFAULT_METRICS`, fret widths 52 → 44 px, rows 44 px, 16 px root) and constitution "Touch targets MUST be at least 44×44 CSS px in comfortable fretboard mode". The whole neck "fits" ⇔ its comfortable-size layout width ≤ the fretboard zone's available inner width. Fit to screen and the minimap are hidden ⇔ it fits. Text zoom scales the metrics, so at 200% a neck can stop fitting; the rule is evaluated live, not from a breakpoint.
- Q: Where does **Fit to screen** live and how is its state exposed? → A: **Default** (design §4.2 zone E holds view actions such as "view" and "labels"): in zone E (actions), as one toggle button with `aria-pressed` (pressed = whole fretboard), name from the catalog in en/pt/es. In phone landscape zone E lives in the sliding panel, so Fit to screen is reachable there and by pinch.
- Q: Which input counts as a pinch? → A: **Default**: a two-pointer touch pinch whose distance changes by at least 20% from its start; pinch in (closer) → whole, pinch out (apart) → comfortable; a pinch in the direction of the current mode does nothing. Trackpad pinch (ctrl+wheel) is not intercepted (left to the browser). The pinch over the fretboard does not zoom the page; the page's own zoom is never disabled elsewhere (no `user-scalable=no`).
- Q: Minimap size, keyboard keys and role? → A: **Default**: spans the fretboard zone's width, at least 44 px tall (it is a touch target, constitution), one row of dots per string. Exposed as `role="slider"` with `aria-valuetext` = "Frets {first} to {last} of {count}" (catalog). ArrowRight/ArrowLeft move the window by one visible stretch in the visual direction (mirrored in left-handed mode, FR-2.6); Home/End jump to the nut/last fret ends. Focusing the minimap does not move fretboard focus.
- Q: Small-fret notice behavior? → A: NFR-3.5 + **Default**: uses the existing `Notice` component; text from the catalog with one action ("Use comfortable size"). Accepting switches to comfortable mode with the tapped position centered (clamped). It disappears when the mode changes by any means and does not reappear in that whole-mode session after dismissal.
- Q: Narrow zone B: what goes in the two rows? → A: Design §5.1 ("controls in B fit in at most two rows; whatever exceeds them becomes a scrollable strip") + §7 (note selector in two rows of six at 320). **Default** per tool: Notes — note selector in two rows of six (no strip needed). Triads — row 1: root selector; row 2: quality, inversion, string set. CAGED — row 1: key selector; row 2: quality, shape selector. Any row whose content exceeds the width scrolls horizontally on its own (a strip) with a visible cue (a partly visible item or edge fade); B never wraps into a third row and nothing goes behind a menu. Testable at 320 px and 100% text: zone B is exactly two control rows; at 200% text rows may be taller but are still two, with more scrolling.
- Q: Collapsed summary content per tool? → A: **Default**, following the design's example, parts joined by " · ", note lists by " – ", in the notation, accidentals and language in effect: Triads — chord name · inversion · notes ("A major · 1st inversion · C♯ – E – A"). CAGED — chord name · shape ("shape A" or "all shapes") · notes. Notes — selected note name · number of positions shown (or the selected position when one is selected). Collapsed by default on narrow; the expand/collapse control is a button with `aria-expanded`; the user's choice holds for the session across tools and does not persist across reloads. On medium and wide the panel is always expanded and no toggle shows.
- Q: Layout zones by range (from design §5.1 and the existing `ToolLayout` grid)? → A: Narrow: A, B, C, E, D in one column. Medium: A, B, C (full width), then E and D side by side in one row. Wide: A across; B above C in the left column; E below C in the left column; D in the right column (wide-side) when the comfortable neck fits beside D; otherwise wide-stacked (see operator answers, round 1).
- Q: Phone landscape details? → A: Design §5.3 + **Default**: bar A shows icon-only buttons, each keeping its accessible name (and a tooltip on hover/focus); zone B becomes one horizontally scrollable strip, one control row tall, above the fretboard; the fretboard (with minimap when shown) takes all remaining height. A "Panels" button at the end of the strip opens the sliding panel from the trailing (right) edge, at most 50% of the viewport width, overlaying the fretboard; the uncovered fretboard stays interactive. It contains zone E then zone D. It is closed whenever landscape is entered; Escape, its close button, or the opener close it, focus returns to the opener. Leaving landscape while it is open closes it and moves focus to the first control in zone E if focus was inside it.
- Q: Fit mode across availability changes? → A: **Default**: the session choice is kept even while Fit to screen is hidden (the neck then simply shows whole at comfortable size) and reapplies when the neck stops fitting again. First view each session is comfortable.

### Session 2026-10-06 (operator answers, round 1)

- Q: On wide screens, where does the context panel go when the 24-fret neck can't fit beside it at comfortable size? (Comfortable 24-fret neck ≈ 1,230 px; the wide grid's left column is ≈ 1,060 px at 1440, so "D on the right" and "no Fit to screen at 1440" conflicted.) → A: **Operator decision (option A, adaptive wide layout)**. At wide width (1024+) there are two arrangements:
  - **Wide-side**: A across; B above C above E in the left column; D in the right column. Used when the whole neck's comfortable-size layout width ≤ the left column's available width.
  - **Wide-stacked**: A across; B, then C at full width; then E and D side by side in one row below (the medium arrangement). Used otherwise.
  - The arrangement is chosen from the comfortable-size neck width (current fret count and text zoom) against the left column width computed from the viewport, never from the fit mode or the rendered fretboard, so switching modes never changes the arrangement and there is no layout feedback loop. It is re-evaluated live on resize, fret-count change and text zoom.
  - Fit to screen and the minimap then follow FR-008 against the fretboard zone of the chosen arrangement. Frets never go below 44 px in comfortable mode.
  - Testable: 1440 + 24 frets → wide-stacked, whole neck visible at comfortable size, no Fit to screen, no minimap. 1440 + 12 frets → wide-side. 2560 + 24 frets → wide-side. 1024 + 24 frets → wide-stacked, and the neck still does not fit full width, so Fit to screen and the minimap show.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know where you are on a long neck (Priority: P1)

A player with a phone on a music stand opens a 7-string, 24-fret fretboard on a 320-wide screen. Comfortable mode is on and a minimap under the neck shows the whole neck, the visible stretch and the highlighted positions. Tapping the far end takes them to fret 24.

**Why this priority**: Without orientation aids, a scrolling 24-fret neck on a phone is disorienting; this is the core promise.

**Independent Test**: Open the fretboard at 320 px width with 7 strings and 24 frets, check the minimap, tap its far end, and check the main fretboard shows fret 24.

**Acceptance Scenarios**:

1. **Given** 7 strings, 24 frets and a 320-wide screen, **When** the fretboard shows, **Then** comfortable mode is on and the minimap is visible under it.
2. **Given** the minimap, **When** the user taps its far end, **Then** the fretboard scrolls to show fret 24 and the window moves to the end.
3. **Given** highlighted positions across the neck, **When** the minimap shows, **Then** each highlighted position appears as a dot at its fret and string, and the window marks the visible stretch.
4. **Given** the user scrolls the fretboard, **When** scrolling moves, **Then** the minimap window follows.
5. **Given** left-handed mode, **When** the minimap shows, **Then** it is mirrored like the main fretboard and a tap on a given point reaches the same fret as in right-handed mode.
6. **Given** a screen where the whole neck fits comfortably, **When** the fretboard shows, **Then** no minimap appears.
7. **Given** keyboard focus on the minimap, **When** the user presses an arrow key, **Then** the window moves along the neck and the control announces the new fret range.

---

### User Story 2 - Switch between whole neck and comfortable size (Priority: P1)

A player wants a quick overview. They use **Fit to screen** (or pinch) to see the whole neck with narrower frets, and switch back for comfortable playing.

**Why this priority**: Overview and comfort both matter; they must be one gesture apart.

**Independent Test**: At 320 px, toggle Fit to screen and pinch, and check the mode flips each time; at 1440 px with 24 frets, check the command is absent.

**Acceptance Scenarios**:

1. **Given** comfortable mode on a narrow screen, **When** the user activates **Fit to screen**, **Then** the whole neck is visible with narrower frets and the minimap is no longer shown.
2. **Given** whole mode, **When** the user activates it again, **Then** comfortable fret size with scrolling returns, positioned so the previously visible area is still in view.
3. **Given** comfortable mode, **When** the user pinches on the fretboard, **Then** the view switches to the whole fretboard; pinching again returns to comfortable.
4. **Given** a 1440-wide desktop and 24 frets, **When** the fretboard shows, **Then** **Fit to screen** does not appear and a pinch does nothing.
5. **Given** whole mode on a narrow screen with frets under 44×44, **When** the user taps a position, **Then** the nearest position is selected and a one-line dismissible notice offers comfortable mode.
6. **Given** the notice, **When** the user accepts, **Then** comfortable mode returns with the tapped position in view.
7. **Given** a mode choice, **When** the user switches tools or resizes within the same range, **Then** the mode is kept.

---

### User Story 3 - Finish the responsive layouts (Priority: P2)

On every screen width the page arranges itself sensibly. Narrow is a single column, medium puts panels side by side under a full-width fretboard, wide puts the fretboard left and the context panel right when the comfortable neck fits beside it, otherwise uses a full-width fretboard with the panels side by side below.

**Why this priority**: Required for "every function from 320 to 2560", but each width works today in a basic form; this finishes it.

**Independent Test**: Check element order and placement at 320, 800 and 1280 px.

**Acceptance Scenarios**:

1. **Given** 320–599 width, **When** a tool opens, **Then** the order is bar, controls, fretboard, actions, context panel, in one column.
2. **Given** narrow width, **When** the controls render, **Then** the main controls fit in two rows and the rest sit in a horizontally scrollable strip, none behind a menu.
3. **Given** narrow width, **When** the context panel is collapsed, **Then** it shows one line such as "A major · 1st inversion · C♯ – E – A", and the user can expand it.
4. **Given** 600–1023 width, **When** a tool opens, **Then** the fretboard is full width with the panels side by side below.
5. **Given** 1024+ width and a neck whose comfortable size fits beside the context panel (e.g. 1440 with 12 frets, 2560 with 24), **When** a tool opens, **Then** the fretboard is in a left column and the context panel on the right.
6. **Given** 1024+ width and a neck whose comfortable size does not fit beside the context panel (e.g. 1440 with 24 frets), **When** a tool opens, **Then** the fretboard spans the full width with actions and context panel side by side below it; at 1440 the whole 24-fret neck shows at comfortable size with no Fit to screen.
7. **Given** any width, **When** the page renders, **Then** only the fretboard scrolls horizontally.

---

### User Story 4 - Use the whole screen in landscape (Priority: P2)

A player rotates the phone to landscape in the CAGED tool with a shape in focus. The fretboard fills the width and nearly the full height; the shape stays in focus; the panels move to a sliding panel.

**Why this priority**: Landscape is the recommended orientation for CAGED and most useful on a stand.

**Independent Test**: In CAGED with a shape in focus, rotate to landscape and check layout and state.

**Acceptance Scenarios**:

1. **Given** CAGED with a shape in focus, **When** the phone rotates to landscape, **Then** the fretboard fills the width and nearly the full height, and the focus is unchanged.
2. **Given** landscape, **When** the screen renders, **Then** the bar shows icons only, the controls form a thin strip, and the context panel and actions are in a sliding panel opened by a button.
3. **Given** the sliding panel, **When** the user opens and closes it, **Then** the fretboard stays visible and usable, and focus returns to the button on close.
4. **Given** rotation or resize, **When** the layout changes, **Then** all tool state is kept and the highlighted region stays visible.
5. **Given** landscape, **When** the user looks for any function available in portrait, **Then** it is reachable (in the strip or the sliding panel).

---

### User Story 5 - Everything works at 200% text size (Priority: P3)

A user with enlarged text still gets every function, with no truncation, overlap or hidden control.

**Why this priority**: Accessibility requirement spanning all of the above.

**Independent Test**: Set 200% text and check each layout at 320, 800, 1280 px and landscape.

**Acceptance Scenarios**:

1. **Given** 200% text size, **When** each layout renders, **Then** no text is cut off, nothing overlaps, and all controls remain reachable.
2. **Given** 200% text size and a narrow screen, **When** the context summary shows, **Then** its full content can be read.

---

### Edge Cases

- Minimap tapped at the very edges: clamped, never scrolls past the ends.
- 12 or fewer frets: the whole neck fits sooner, so the minimap and Fit to screen may not appear on screens where they would for 24 frets.
- Fret count changes while a view is open: the minimap and mode availability update, the visible stretch is kept.
- Instrument changes from 6 to 7 strings: no layout change in width; the minimap gains a row.
- No highlighted positions: the minimap shows the window only.
- Resizing across a breakpoint while the sliding panel is open: the panel's content moves back into the main layout and focus stays on a sensible element.
- Window shrinks so the neck now fits: minimap and Fit to screen disappear and the neck shows whole.
- A pinch combined with a scroll: only a two-finger pinch toggles; one-finger scrolling never does.
- Reduced motion: scrolling jumps are instant.
- A tablet or desktop window that is short: not treated as phone landscape unless it meets the short-viewport rule.
- Left-handed in landscape: both mirrored consistently; minimap arrow keys follow the visual direction.
- 200% text zoom enlarges fret metrics: a neck that fit at 100% may stop fitting, so Fit to screen and the minimap appear (the rule is live, not a breakpoint).
- Wide window resized or fret count changed across the wide-side / wide-stacked threshold: the context panel moves without losing state, focus or scroll stretch; toggling Fit to screen never changes the wide arrangement.
- Viewport 844×390 (phone landscape) vs. 1024×768 (tablet landscape): only the first uses the landscape arrangement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a minimap directly under the fretboard whenever the fretboard does not fit the screen in full, and MUST NOT show it otherwise.
- **FR-002**: The minimap MUST show the whole neck in miniature, the visible stretch as a window, and highlighted positions as dots.
- **FR-003**: Tapping a point on the minimap MUST scroll the fretboard so that point is centered, clamped at the neck ends; tapping the far end MUST show the last fret. The minimap MUST be at least 44 px tall and span the fretboard zone's width.
- **FR-004**: The minimap window MUST follow fretboard scrolling.
- **FR-005**: The minimap MUST be a focusable `slider` whose `aria-valuetext` reads "Frets {first} to {last} of {count}" (catalog, en/pt/es); ArrowLeft/ArrowRight MUST move the window by one visible stretch in the visual direction, Home/End MUST jump to the ends.
- **FR-006**: The minimap MUST mirror in left-handed mode, with taps resolving to the same frets as in right-handed mode.
- **FR-007**: The system MUST offer **Fit to screen** in zone E as one toggle button with `aria-pressed` (pressed = whole fretboard) to switch between whole-fretboard (narrower frets) and comfortable fret size (scrolling).
- **FR-008**: **Fit to screen** and the minimap MUST be hidden exactly when the whole neck's comfortable-size layout width (existing geometry metrics, frets ≥ 44 px) is ≤ the fretboard zone's available width, evaluated live on resize, fret-count change and text zoom. The fretboard zone is the one of the active arrangement (FR-018). With 24 frets at 1440 width it MUST be hidden (wide-stacked arrangement).
- **FR-009**: Comfortable mode MUST be the default each session (not stored, not in share links); the choice MUST persist for the session across tools, resizes and periods when Fit to screen is hidden. The minimap MUST be visible for 7 strings and 24 frets at 320 width.
- **FR-010**: A two-pointer touch pinch on the fretboard changing finger distance by ≥ 20% MUST switch modes (in → whole, out → comfortable; one switch per gesture); there MUST be no free zoom; the pinch MUST do nothing where Fit to screen is hidden or the mode already matches. The page's own zoom MUST NOT be disabled outside the fretboard.
- **FR-011**: In whole mode, where frets are under 44×44, a tap MUST select the nearest position and a non-blocking, dismissible, one-line notice MUST offer comfortable mode; accepting MUST switch to comfortable with the tapped position centered; the notice MUST NOT reappear in that whole-mode session after dismissal and MUST disappear on any mode change.
- **FR-012**: In comfortable mode every fretboard position MUST have a touch target of at least 44×44.
- **FR-013**: Switching modes, resizing or rotating MUST keep the highlighted region (or shape in focus) visible and MUST NOT lose any tool state, selection, focus or mode.
- **FR-014**: At narrow width (320–599) the layout MUST be one column in the order bar, controls, fretboard, actions, context panel.
- **FR-015**: At narrow width zone B MUST be exactly two control rows (Notes: note selector 6+6; Triads: root / quality, inversion, string set; CAGED: key / quality, shape), each row scrolling horizontally with a visible cue when its content overflows; main controls MUST NOT be behind a menu at any width.
- **FR-016**: At narrow width the context panel MUST start collapsed to a one-line summary that the user can expand (button with `aria-expanded`, choice kept for the session), built with the notation, accidentals and language in effect: Triads "chord · inversion · notes" (e.g. "A major · 1st inversion · C♯ – E – A"), CAGED "chord · shape · notes", Notes "note · positions shown (or selected position)". On medium and wide it MUST be always expanded.
- **FR-017**: At medium width (600–1023) the fretboard MUST be full width with zones E and D side by side below it.
- **FR-018**: At wide width (1024+) the system MUST use the **wide-side** arrangement (fretboard in a left column with B above and E below, context panel D in the right column) when the whole neck's comfortable-size layout width ≤ the left column's available width, and the **wide-stacked** arrangement (B, then fretboard at full width, then E and D side by side) otherwise. The choice MUST depend only on viewport width, fret count and text zoom (never on fit mode or rendered fretboard size), MUST be re-evaluated live on resize, fret-count change and text zoom, and MUST NOT lose state when it changes. Expected: 1440 + 24 frets → wide-stacked; 1440 + 12 frets → wide-side; 2560 + 24 frets → wide-side; 1024 + 24 frets → wide-stacked with Fit to screen and minimap shown.
- **FR-019**: In phone landscape (viewport height ≤ 499 and width > height) the fretboard MUST fill the width and all height left after the bar and strip; the bar MUST show icon-only buttons that keep accessible names; zone B MUST become one horizontally scrollable strip one control row tall; zones E then D MUST move to a non-modal sliding panel (trailing edge, ≤ 50% width, closed on entering landscape) opened by a "Panels" button at the end of the strip. The existing CAGED rotate hint (016) MUST NOT show in landscape.
- **FR-020**: The sliding panel MUST be operable by keyboard, closable with Escape, its close button or its opener, and return focus to the opener on close; leaving landscape while open MUST close it, returning its content to the main layout without losing focus to the document body.
- **FR-021**: No function available in one layout MAY be unavailable in another; only the arrangement changes.
- **FR-022**: At every width from 320 to 2560, only the fretboard MAY scroll horizontally.
- **FR-023**: Every layout, the minimap, the notice and the summary MUST work at 200% text size without truncation, overlap or hidden functions.
- **FR-024**: All new user-facing text MUST come from the message catalog in English, Portuguese and Spanish, and the new interface MUST honor reduced-motion and have no automated accessibility violations.

### Key Entities

- **Fretboard fit mode**: Whole or comfortable; session-only; default comfortable; meaningful only where Fit to screen is available.
- **Visible stretch**: The range of frets currently in view; drives the minimap window.
- **Highlighted positions**: Positions at the highlighted emphasis level; drawn as minimap dots.
- **Layout class**: Narrow, medium, wide-side, wide-stacked, or phone landscape; decides arrangement only, never content.
- **Sliding panel**: Landscape container for the context panel and actions; open or closed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With 7 strings and 24 frets at 320 width, 100% of first views are in comfortable mode with the minimap visible, and one tap at the minimap's far end shows fret 24.
- **SC-002**: A user can switch between whole and comfortable modes in one action (button or pinch), and the highlighted region is still visible after each switch in 100% of tested cases.
- **SC-003**: On a 1440-wide desktop with 24 frets, the layout is wide-stacked and **Fit to screen** and the minimap are absent; with 12 frets at 1440 the layout is wide-side.
- **SC-004**: Rotating a phone to landscape with a CAGED shape in focus keeps the focus, shows the fretboard at full width, and keeps every portrait function reachable, in 100% of tested cases.
- **SC-005**: At widths 320, 600, 1024, 1280 and 2560, and in phone landscape, no function is lost and the page has no horizontal scroll other than the fretboard.
- **SC-006**: At 200% text size, no truncation, overlap or unreachable control occurs in any layout.
- **SC-007**: Tool switching, control changes and scrolling stay within existing performance budgets, with smooth scrolling at 7 strings and 24 frets.
- **SC-008**: Automated accessibility checks report zero violations on every new or changed view.

## Assumptions

- The fretboard from the walking skeleton and the CAGED tool (earlier waves) exist, along with left-handed mode, tunings, 7 strings, and the message catalog in three languages.
- Phone and desktop have equal priority.
- Phone landscape is detected by the short-viewport rule in the clarifications.
- The fit mode is session-only; no new stored preference or share-link field is added.
- The CAGED rotate hint (FR-3.19, first CAGED open in portrait) already ships from slice 016 and is only kept working, not rebuilt.
- No free zoom, custom layouts or saved layouts are part of this feature.
