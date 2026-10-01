# Feature Specification: Interactive Fretboard

**Feature Branch**: `feature/002-interactive-fretboard`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/001-mvp/002-interactive-fretboard.md (id 002, interactive-fretboard)." Source sections: Area 3 (Interactive fretboard), Edge cases Area 3, Design §3.3 Markers, Design §6 The fretboard in detail, TM-1, TM-3, ARCH-5.

## Clarifications

### Session 2026-09-30 (clarify reviewer)

Derived from authoritative sources:

- Q: How are unspelled note names written (open strings, hover, unmarked positions)? → A: Through a minimal `src/lib/notation` module created by this feature (constitution VIII): English letters, sharps by default (FR-8.6 "sharps (default)"; TM-3 table), accidentals as ♯ ♭ 𝄪 𝄫. A marker MAY carry an explicit spelling (letter + accidental, including double accidentals) supplied by the tool, which notation formats instead of the sharp default (FR-8.6: in Triads/CAGED theory decides spelling). Spoken form comes from the message catalog ("F sharp", "B double flat") (NFR-3.9).
- Q: Which key is "next fret", and what do the other arrows do? → A: Right-handed, nut on the left (breakdown prompt): ArrowRight = next fret (fret + 1), ArrowLeft = previous fret, ArrowUp = string above on screen (string number − 1, higher pitch), ArrowDown = string below (string number + 1). Enter and Space are the action keys (FR-3.17). Arrow moves change focus only; they never activate.
- Q: Where do fret numbers go? → A: Below the fretboard (design §6: opposite edge from shape tags, which sit above). Frets 1–22 are numbered at comfortable size; numbers of inlay frets (3, 5, 7, 9, 12, 15, 17, 19, 21) are visually emphasized by weight (FR-3.3). The open column carries no number.
- Q: Is fret spacing uniform? → A: No. Fret columns narrow slightly toward the body (FR-3.6, A-9) without any column dropping below 44 logical units at comfortable size (NFR-3.5).
- Q: How do emphasis levels differ by more than color? → A: By opacity plus size (constitution V, NFR-3.3, design §3.3). Highlighted: full opacity, marker scaled up (token, ≈1.15×) plus an elevation outline/shadow token. Normal: full opacity, base size. Dimmed: reduced opacity token (≈0.4) and slightly smaller size token (≈0.85×), same shape, no label. Hidden: nothing drawn.
- Q: Which marker is "largest"? → A: Relative sizes per design §3.3: root largest; third, fifth, neutral medium (equal); scale degree smallest. Root/third/fifth colors are reserved tokens used for nothing else (constitution VII).
- Q: What does the text description contain? → A: Per FR-3.18/NFR-3.4: an optional leading summary sentence supplied by the tool, then each highlighted and normal marked position as "string N, fret F, <note spoken in full>, <function>", ordered by string number descending (6→1), then fret ascending. Dimmed and hidden positions are omitted. With no marked positions it reads a catalog line meaning "No positions marked." It lives in a polite live region, announced when it changes (not on first render), and a "Show text description" toggle below the fretboard (collapsed by default) makes it visible on demand.
- Q: Reduced motion and auto-scroll duration? → A: Auto-scroll animates within the "short" motion token (≤300 ms, design §3.5); with `prefers-reduced-motion: reduce` it jumps instantly (NFR-3.6).
- Q: Must the fretboard block pinch? → A: No. Pinch-to-switch modes (EC-3.5) belongs with fit-to-screen (out of scope). In this feature the fretboard does not intercept pinch, and browser page zoom stays available (WCAG 1.4.4).

Assumed defaults (no source decides; conventional choice, constitution-consistent):

- Q: Movement threshold for "drag counts as scroll"? → A: 10 CSS px of pointer travel from pointerdown (common touch-slop convention). Movement < 10 px then release = tap; ≥ 10 px = scroll, and no activation occurs on release.
- Q: When exactly is a tap an activation? → A: On release (pointerup) of the primary button/first touch, if the threshold was not exceeded. Non-primary mouse buttons are ignored. A second simultaneous touch cancels the pending tap. Every activation is reported, including repeated taps on the already-focused position.
- Q: Nearest-position rule and tie-break? → A: Nearest position center by Euclidean distance in rendered geometry (EC-3.3). Exact ties go to the lower fret, then the lower string number. Taps beyond the nut/open column or past the last fret clamp to the nearest valid position; never an error.
- Q: Does a tap show the focus indicator? → A: Yes. A tap moves DOM focus to the tapped position and its focus indicator (outline token, drawn independently of the marker so hidden/unmarked positions show it) is visible, same as keyboard focus.
- Q: Which position receives focus when tabbing into the fretboard? → A: The fretboard is one tab stop (roving focus). Entering it focuses the last focused position of this fretboard instance; if none, string 1, fret 0. Tab / Shift+Tab leave the fretboard. Arrow keys at the neck edges (fret 0 left, last fret right, string 1 up, string 6 down) leave focus in place, no wrap. Moving keyboard focus to an off-screen position scrolls it into view.
- Q: Comfortable geometry that yields 5–7 frets on a 320-wide phone? → A: At 100% text size: string row height ≥ 44 px; open column 44 px; fret 1 column 52 px narrowing linearly to 44 px at fret 22; string-label column scrolls with the board (not sticky). All sizes are rem-based design tokens, so text zoom enlarges the board (it then scrolls). Measure: at a 320-px viewport, visible fretboard width ÷ column width gives 5–7 columns (open column counts) at every scroll position.
- Q: What happens on screens wider than the natural fretboard? → A: The fretboard fills its container width; columns widen proportionally (never below comfortable size) and it does not scroll. Fit-to-screen (narrower than comfortable) is out of scope.
- Q: Does a mouse drag scroll? → A: Yes. Touch, pen, and mouse drags past the threshold scroll horizontally; wheel/trackpad horizontal scroll also works. Horizontal overscroll does not chain to the page. Vertical drags pass through to page scroll.
- Q: Auto-scroll target when highlighted positions span distant regions? → A: Triggered only when the set of highlighted positions changes (FR-3.15), never on unrelated re-renders or after a manual scroll. If every highlighted position is already fully visible, no scroll. Otherwise, if the span from lowest to highest highlighted fret fits, scroll the minimum distance to show the whole span; if not, align the lowest highlighted fret's column to the start of the visible area. One scroll per change.
- Q: What does hover show and when? → A: Mouse pointers only (`pointerType === "mouse"`): a hint with the note name (notation default spelling, or the marker's spelling) appears while hovering any position, including hidden and unmarked ones, and disappears on leave. Touch and pen get no hover hint. The hint is supplementary; the accessible name already carries the note.
- Q: Accessible name of a position? → A: "<note spoken in full>, string N, fret F" plus ", <function>" when marked (catalog-templated). Fret 0 is spoken as "open". Hidden and unmarked positions keep their accessible names.
- Q: A position with no marker? → A: Behaves like hidden: nothing drawn, still tappable, focusable, hoverable. The display model holds at most one marker per position (keyed by string, fret); overlap resolution (EC-3.1) belongs to tools.
- Q: Label sizing? → A: Note-name labels (no octave) appear on highlighted and normal markers of every function; text shrinks to a minimum-legible-size token when needed (EC-3.2). English names are at most two glyphs, so no abbreviation is needed in this feature.
- Q: What do the tool screens show before 004/005 ship? → A: Zone C of `/notes` and `/triads` replaces its placeholder with the plain interactive fretboard (no markers, label mode none). Activations move focus only; tools react in later features. No user-facing demo route is added; marker, emphasis, label, and auto-scroll acceptance are exercised with test fixtures.
- Q: What do the home-card thumbnails show? → A: The same fretboard component in thumbnail mode: frets 0–12 of the current instrument, no markers, no labels, no fret/string text, decorative (`aria-hidden`), no focus stops or pointer handling. The card remains a single link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See an accurate, instrument-like fretboard (Priority: P1)

A guitarist opens a tool screen and sees a fretboard that looks like their instrument: six strings with the highest on top (as in tablature), lower strings thicker, 22 frets, a thick light nut, position inlays, fret numbers along the edge, and each string's number and open-string note beside the nut. Every position shows the correct pitch.

**Why this priority**: Every later study tool draws on this fretboard. If it is not accurate, nothing built on it can be trusted.

**Independent Test**: Render the fretboard with no tool attached and check the layout and the pitch of sample positions.

**Acceptance Scenarios**:

1. **Given** the fretboard is drawn, **When** the user inspects string 2, fret 1, **Then** it is C4.
2. **Given** the fretboard is drawn, **When** the user inspects string 6 open, **Then** it is E2.
3. **Given** the fretboard is drawn, **Then** open strings read E2 A2 D3 G3 B3 E4 (string 6 to string 1), and each position's pitch equals the open-string pitch plus the fret number in semitones, with octaves numbered by sounding pitch.
4. **Given** the fretboard is drawn, **Then** inlays appear at frets 3, 5, 7, 9, 15, 17, 19, 21, double inlays at 12 and 24, fret numbers run along the edge, and the open string (fret 0) sits in its own column before the nut and behaves like any other position.
5. **Given** the home screen, **Then** each tool card shows a thumbnail drawn by the same fretboard component (frets 0–12, no markers or labels), hidden from assistive technology, with no focus stop or pointer handling inside the card link.
6. **Given** the fretboard is drawn, **Then** fret numbers 1–22 appear below it with inlay-fret numbers emphasized by weight, and each string shows its number and open-string note (E, A, D, G, B, E) beside the nut.

---

### User Story 2 - Read markers by shape and emphasis (Priority: P1)

A tool marks positions with a function (root, third, fifth, other scale degree, neutral note), an emphasis level, and an optional label. The user tells functions apart by shape alone, with no reliance on color.

**Why this priority**: The marker code is the product's teaching vocabulary and must be consistent and accessible.

**Independent Test**: Render one marker of each function and each emphasis level, in grayscale, and confirm each is distinguishable.

**Acceptance Scenarios**:

1. **Given** markers of every function, **Then** root is a filled rounded square (largest), third a filled circle, fifth a filled diamond (third, fifth, neutral the same medium size), other scale degree a small outlined circle (smallest), and neutral note a light filled circle with a solid outline ring (the third circle has no outline), so third and neutral differ by more than color.
2. **Given** a position set to highlighted or normal, **Then** it is drawn at full opacity; highlighted is larger than normal and carries an elevation outline, so it is distinguishable without color.
3. **Given** a position set to dimmed, **Then** it is drawn with the same shape at reduced opacity and slightly smaller size, with no label, and remains visible.
4. **Given** a position set to hidden, **Then** nothing is drawn but the position can still be tapped.
5. **Given** label mode is note name, **Then** each highlighted or normal marker shows its note name (sharps by default, or the spelling the tool supplied, e.g. E♯ or B𝄫); **Given** label mode is none, **Then** no labels appear.

---

### User Story 3 - Tap or click a position and have the tool hear about it (Priority: P1)

A user taps or clicks any position, including hidden ones. It takes focus and the tool is told which string and fret were chosen, in musical terms, never screen coordinates.

**Why this priority**: This is the only way tools receive input from the fretboard.

**Independent Test**: Click positions in a harness tool and assert the reported (string, fret) pairs.

**Acceptance Scenarios**:

1. **Given** any position (visible, dimmed, hidden, or unmarked), **When** the user taps it and releases without moving 10 px, **Then** it takes focus with a visible focus indicator and the tool receives (string, fret); a repeat tap reports again.
2. **Given** a tap lands between two positions, **When** released, **Then** the position with the nearest center is chosen (exact tie: lower fret, then lower string number); a tap beyond the nut or past fret 22 selects the nearest edge position.
3. **Given** a touch or mouse drag starts on a position and moves 10 CSS px or more, **When** released, **Then** it counted as a scroll and no position is activated.
4. **Given** a mouse pointer hovers over any position, including hidden or unmarked ones, **Then** its note name is shown, and it disappears when the pointer leaves; touch input shows no hover hint.

---

### User Story 4 - Navigate a wide fretboard on a phone (Priority: P1)

On a 320-wide portrait phone, 5–7 frets are visible at a time. Dragging horizontally scrolls only the fretboard, a vertical drag still scrolls the page, and the fretboard automatically scrolls to bring highlighted positions into view.

**Why this priority**: Phones are equal-priority devices, and an unreachable part of the neck makes the tool unusable.

**Independent Test**: Use a 320-wide phone profile, drag horizontally and vertically, and set highlighted positions off-screen.

**Acceptance Scenarios**:

1. **Given** a 320-wide screen, **When** the user drags horizontally on the fretboard, **Then** only the fretboard scrolls and the page does not.
2. **Given** a 320-wide screen, **When** the user drags vertically on the fretboard, **Then** the page scrolls.
3. **Given** a 320-wide portrait screen at 100% text size, **Then** the visible fretboard width spans 5–7 fret columns (open column counts) at every scroll position.
4. **Given** the set of highlighted positions changes and some lie outside the visible area, **Then** the fretboard scrolls once: minimally to show the whole highlighted span if it fits, otherwise aligning the lowest highlighted fret to the start of the visible area; with reduced motion the scroll is instant.
5. **Given** the container is wider than the fretboard's comfortable width, **Then** the fretboard fills the container width and does not scroll.

---

### User Story 5 - Operate the fretboard by keyboard (Priority: P2)

A keyboard or screen-reader user moves focus with arrow keys between neighboring frets and strings and activates a position with an action key. Focus is always visible.

**Why this priority**: Required for accessibility, and builds on positions already existing.

**Independent Test**: Tab into the fretboard, press arrows and the action key, and assert focus location and reported events.

**Acceptance Scenarios**:

1. **Given** focus on string 3, fret 5, **When** the user presses ArrowRight (next fret), **Then** focus moves to string 3, fret 6; ArrowLeft, ArrowUp, ArrowDown move to fret 4, string 2, and string 4 respectively, without activating.
2. **Given** focus on any position, **When** the user presses an arrow key toward the edge of the neck, **Then** focus stays put (no wrap, no trap) and the user can still Tab away.
3. **Given** focus on a position, **When** the user presses Enter or Space, **Then** the tool receives (string, fret) as with a tap.
4. **Given** focus is on a hidden position, **Then** a visible focus indicator still appears.
5. **Given** any focused position, **Then** a screen reader announces "<note>, string N, fret F" (fret 0 as "open"), plus the function when marked, with accidentals spoken in full (for example, "F sharp").
6. **Given** the user Tabs into the fretboard, **Then** focus lands on the last focused position of that fretboard, or string 1, fret 0 if none; the fretboard is a single tab stop.

---

### Edge Cases

- A tap exactly between two positions, or between strings: nearest center wins; exact ties go to the lower fret, then the lower string number.
- A tap beyond the nut or past the last fret: nearest valid position, never an error.
- A drag that starts on a hidden position past the 10 px threshold: scrolls, does not activate.
- Non-primary mouse button, or a second simultaneous touch: no activation.
- Pinch on the fretboard: not intercepted; browser zoom remains available.
- Highlighted positions in several distant regions: one scroll per change of the highlighted set, aligning the lowest highlighted fret to the start of the visible area when the whole span does not fit; no scroll after manual scrolling or unrelated re-renders.
- Reduced-motion preference: auto-scroll happens without animation.
- Thumbnail size: frets 0–12, no focus, hover, or tap behavior, no labels or text, hidden from assistive technology.
- Keyboard focus moved to an off-screen position: the fretboard scrolls it into view.
- Text zoom to 200% and 320–2560 px widths: nothing overlaps, only the fretboard scrolls horizontally.
- No positions marked: a plain fretboard still shows strings, frets, inlays, and numbers; every position stays tappable, focusable, and hoverable; the text description reads "No positions marked."
- Touch targets below 44×44 at compact sizes: comfortable size always meets 44×44.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fretboard MUST draw a 6-string, 22-fret, right-handed guitar in standard tuning (E2 A2 D3 G3 B3 E4) with the highest string on top.
- **FR-002**: Strings MUST be drawn thicker for lower strings; frets as lines; the nut thick and light. Fret columns MUST narrow slightly toward the body (fret 1 widest, fret 22 narrowest) without any column falling below 44 logical units at comfortable size.
- **FR-003**: Inlays MUST appear at frets 3, 5, 7, 9, 15, 17, 19, 21, with double inlays at 12 and 24.
- **FR-004**: Fret numbers 1–22 MUST run below the fretboard, with inlay-fret numbers emphasized by weight and no number under the open column. Each string MUST show its number and open-string note (notation module) next to the nut; these labels scroll with the board.
- **FR-005**: The open string (fret 0) MUST occupy its own column before the nut and behave like any other position.
- **FR-006**: Each position's pitch MUST equal the open-string pitch plus the fret in semitones, with octaves numbered by sounding pitch (string 2 fret 1 is C4; string 6 open is E2).
- **FR-007**: Markers MUST encode function by shape: root filled rounded square (largest), third filled circle, fifth filled diamond, other scale degree small outlined circle (smallest), neutral note light filled circle with a solid outline ring (third has no outline); third, fifth, and neutral share the medium size. Color MUST NOT be the only differentiator; root/third/fifth colors are reserved tokens. The display model holds at most one marker per position; a position without a marker behaves like hidden.
- **FR-008**: Every position MUST have an emphasis level: highlighted (full opacity, larger, elevation outline), normal (full opacity, base size), dimmed (reduced opacity, slightly smaller, same shape, no label, visible), or hidden (not drawn, still tappable, focusable, hoverable). Opacity and size factors come from tokens.
- **FR-009**: Labels MUST support note name (without octave) or none, set per fretboard. Note names and accidentals MUST come from `src/lib/notation`, created minimally by this feature: English letters, sharps by default, or the explicit spelling a marker carries (including double accidentals), rendered as ♯ ♭ 𝄪 𝄫. Labels shrink to a minimum-legible token size when they do not fit.
- **FR-010**: Tap or click (primary button, released without exceeding the drag threshold) on any position, including hidden and unmarked ones, MUST give it DOM focus with a visible focus indicator and report (string, fret) to the tool, on every activation including repeats. The fretboard MUST NOT report screen coordinates. A second simultaneous touch cancels the pending tap.
- **FR-011**: A tap between positions MUST choose the position whose center is nearest (Euclidean); exact ties go to the lower fret, then the lower string number. Taps outside the position grid clamp to the nearest valid position.
- **FR-012**: A drag starting on any position MUST count as a scroll once pointer travel reaches 10 CSS px, and MUST NOT activate a position.
- **FR-013**: When wider than its container, the fretboard MUST scroll horizontally by touch, pen, or mouse drag and by wheel/trackpad; horizontal overscroll MUST NOT chain to the page; a vertical drag MUST still scroll the page; pinch MUST NOT be intercepted. When the container is wider than the comfortable width, the fretboard MUST fill it and not scroll.
- **FR-014**: When the set of highlighted positions changes and any lies outside the visible area, the fretboard MUST scroll once: minimally to show the whole highlighted fret span if it fits, otherwise aligning the lowest highlighted fret to the start of the visible area. It MUST NOT auto-scroll on unrelated re-renders. The scroll animates within the short motion token (≤300 ms), or is instant under `prefers-reduced-motion`.
- **FR-015**: The fretboard MUST be a single tab stop with roving focus, entering at the last focused position or string 1, fret 0. ArrowRight/ArrowLeft MUST move to the next/previous fret and ArrowUp/ArrowDown to the string above/below on screen (string number −1/+1), without wrapping or activating; Enter and Space MUST activate the focused position; focus MUST always be visible (including on hidden positions); a focused off-screen position MUST scroll into view; Tab/Shift+Tab MUST leave the fretboard.
- **FR-016**: Hovering with a mouse (not touch or pen) over any position, including hidden and unmarked ones, MUST show its note name until the pointer leaves.
- **FR-017**: At comfortable size, touch targets MUST be at least 44×44 logical units.
- **FR-018**: On a 320-wide portrait phone at 100% text size, the visible fretboard MUST span 5–7 fret columns (open column counts) at every scroll position. Comfortable geometry: string rows ≥ 44 px, open column 44 px, fret columns 52 px at fret 1 narrowing linearly to 44 px at fret 22, all as rem-based tokens.
- **FR-019**: The same fretboard component MUST draw the home-card thumbnails in a thumbnail mode: frets 0–12 of the current instrument, no markers, labels, or text, `aria-hidden`, no focus stops or pointer handling.
- **FR-020**: The fretboard MUST expose a text description of its current view: an optional tool-supplied summary sentence, then each highlighted and normal marked position as "string N, fret F, <note>, <function>", ordered by string 6→1 then fret ascending, or "No positions marked." when none. It MUST be announced through a polite live region when it changes (not on first render), with accidentals read in full, and be visible on demand through a "Show text description" toggle (collapsed by default). Each position's accessible name MUST be "<note>, string N, fret F" (fret 0 spoken as "open"), plus the function when marked.
- **FR-021**: All user-facing text MUST come from the message catalog, and all visual values from design tokens.
- **FR-022**: Handedness and string orientation concerns MUST stay inside the fretboard rendering; tools receive and send only musical terms (string, fret).
- **FR-023**: Until tools ship (004, 005), zone C of `/notes` and `/triads` MUST show the plain interactive fretboard (no markers, label mode none) in place of its placeholder; activations only move focus. No user-facing demo route is added; marker, emphasis, label, and auto-scroll acceptance use test fixtures.

### Key Entities

- **Instrument**: Number of strings, fret count, and open-string pitches. For this feature: 6 strings, 22 frets, standard tuning.
- **Position**: A (string, fret) pair, with fret 0 as the open string. Derives a pitch.
- **Pitch**: Note name plus octave, from the open-string pitch plus semitones.
- **Marker**: What a position displays: function (root, third, fifth, scale degree, neutral), emphasis (highlighted, normal, dimmed, hidden), and optional explicit spelling (letter + accidental). At most one per position. Label mode (note name or none) is set per fretboard.
- **Focus**: The single position currently focused (roving tab stop), shown visibly; remembered per fretboard instance for re-entry.
- **Position event**: A report to the tool that a position was activated, as (string, fret).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 6 × 23 positions show the pitch defined by open-string pitch plus fret semitones, including string 2 fret 1 = C4 and string 6 open = E2.
- **SC-002**: On a 320-wide screen, a horizontal drag scrolls only the fretboard in 100% of test runs, and a vertical drag scrolls the page.
- **SC-003**: Focus on string 3 fret 5 plus the next-fret key lands on string 3 fret 6, and every position is reachable by keyboard alone.
- **SC-004**: Every marker function and emphasis level is distinguishable in a grayscale rendering.
- **SC-005**: On a 320-wide portrait screen at 100% text size, the visible fretboard spans 5–7 fret columns at every scroll position.
- **SC-006**: Tapping any of the 138 positions reports the correct (string, fret) with no error, including hidden ones.
- **SC-007**: A tap or key press produces a visible focus change in under 100 ms.
- **SC-008**: Zero accessibility violations in automated checks on the fretboard in phone and desktop sizes.
- **SC-009**: The fretboard stays smooth while scrolling at phone sizes.

## Assumptions

- Prerequisite: the app shell and tool screens from 001-walking-skeleton exist, with a message catalog and design tokens. No notation module exists yet; this feature creates a minimal `src/lib/notation` (English letters, sharps default, explicit spellings, spoken forms). Solfège and the accidental preference arrive with 005-languages-and-notation/002.
- The instrument is fixed for this feature: 6 strings, 22 frets, standard tuning, right-handed. Alternate tunings, left-handed mode, and more strings come in later waves, so the instrument is data, not hard-coded layout.
- Fret 24 inlay is specified for later fretboards; at 22 frets only the 12-fret double inlay and single inlays up to 21 are visible.
- Hover is a mouse-only enhancement; touch users get note names through focus and labels. Hide-names suppression of hover (FR-4.8) arrives with the Notes tool.
- Comfortable size is the default fretboard size; compact sizes (such as thumbnails) are not required to meet the 44×44 target.
- Out of scope: sound (001-mvp/003), minimap and fit-to-screen (007-comfort-and-launch-readiness/002), alternate tunings and left-handed mode (wave 003).
