# Feature Specification: Modern Minimalist UI Refinement

**Feature Branch**: `feature/029-act-as-a-ui-ux`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Act as a UI/UX specialist and improve the UI in a modern, minimalist and functional way"

## Clarifications

### Session 2026-10-07 (clarify reviewer)

Sources: constitution v1.11.0 (Principles V, VI, VII, VIII, X), `specs/autonomous/fretboard-master/12-design-and-experience.md` (doc 12), ADR 0006 (fonts), ADR 0024 (shared board palette), and the current `src/` code. "Default" marks an assumed conventional choice where no source decides.

- Q: What does "refine the UI" cover, and what stays untouched? → A: **Chrome only.** In scope: zones A, B, D and E of doc 12 §4.2, the home screen, the about page, the instrument, language and sound panels, notices and failure views. Out of scope: the fretboard drawing (SVG geometry, board palette, markers, emphasis, tags, arrows, minimap content). The `--fb-*`, `--marker-*`, `--emph-*`, `--minimap-*`, `--connection-*`, `--pulse-*` and `--print-*` token **values** MUST NOT change (Constitution VII, ADR 0024, FR-007). The element screenshots `all-markers-grayscale` and `accidental-glyphs` MUST pass **without** a baseline update.
- Q: Can "only elements needed for the task are visible" remove or hide controls? → A: **No.** No control or function is removed, moved behind a menu, or moved to another zone. The five-zone anatomy (doc 12 §4.2), the per-tool control placement (§4.3) and the width-range arrangements (§5.1–5.3) stay as they are (doc 12 §5.5, Constitution VII). Minimalism comes from visual weight: no decorative elements, fewer boxes and borders, and consistent spacing and type. The existing advanced-options-off defaults and the narrow-width zone D collapse stay unchanged.
- Q: How is "equivalent controls look the same" made real and testable? → A: Each control family gets **one shared style**, defined once in the global stylesheet and used by every tool and shell panel. The families are: action button, segmented/exclusive option (including the note selector buttons), on/off switch row, stepper, and text link-button. Component `<style>` blocks MUST NOT redeclare a family's size, padding, border, radius, font or state rules. (Constitution X is met: every family has two or more real uses.) Test: for each family, an e2e test reads the computed `min-block-size`, `padding`, `border-radius`, `border-width`, `font-size` and `font-weight` of one instance in each of Notes, Triads and CAGED (and in a shell panel where present). In default and selected state, the values MUST be equal across tools.
- Q: How strictly does FR-004 ("all values from tokens") apply? → A: An automated unit test scans every `src/**/*.svelte` `<style>` block and fails on:
  1. colour literals (hex, `rgb()`/`hsl()`, named colours other than `transparent`, `currentColor`, `inherit`, `Canvas`, `CanvasText`, `GrayText`);
  2. length or time literals with a unit (`px`, `rem`, `em`, `ms`, `s`) other than `0`, including literal fallbacks inside `var(--x, <literal>)`;
  3. references to custom properties that `tokens.css` does not define. Known cases today: `--radius-sm`, `--touch-target-min`, and `--landscape-bar-height` fallbacks.

  Percentages, unitless numbers and `calc()` built only from tokens are allowed. Visually-hidden helpers use the global `.sr-only` class instead of per-component `1px` rules. Where a fretboard component has a literal (for example `stroke-width: 1px`), it becomes a token with the **same value**, so the rendering is pixel-identical.
- Q: May the token set change, and within what limits? → A: **Default:** tokens may be added or refined: a radius scale (for example `--radius-sm`, `--radius-pill`), extra spacing steps, a medium font weight, and subtler border/surface tones for the chrome. The limits are:
  - every colour token is defined for light and dark (`light-dark()`) and overridden in the `prefers-contrast: more` block when it carries contrast;
  - the existing accent hue family (blue) is kept, and only its lightness may change;
  - `tests/unit/a11y/palette-contrast.test.ts` and `tests/unit/reserved-colors.test.ts` pass, so root, third and fifth colours are never used in the chrome (Constitution VII).

  Rationale: this is the smallest change that still delivers a new look, and the accent is one token if the owner wants it revisited.
- Q: What exactly distinguishes interactive states (FR-005)? → A: **Default:**
  - **hover:** background moves to `--color-surface-raised`, or one tone stronger when already raised;
  - **focus:** the existing two-tone focus ring, unchanged;
  - **pressed/selected:** accent fill with `--color-accent-text`, **plus** bold weight, **plus** the matching ARIA state (`aria-pressed`, `aria-checked`, `aria-selected` or `aria-current`);
  - **disabled:** the disabled tokens, never error red, and not focus-trapping.

  Test: in each family, the selected and unselected computed `font-weight` differ, and so do the background colours. The current nav item keeps `aria-current="page"` + bold + the `--indicator-width` bar.
- Q: Shadows, borders and depth? → A: **Default (flat, minimalist):** depth comes from the surface tokens and spacing. Borders appear only on interactive controls, cards and panel edges. A box shadow is allowed only on overlay panels (bottom sheet, side panel), through one shadow token. No gradients or decorative imagery (doc 12 §4.1, §8).
- Q: Home screen cards (US2-AS3)? → A: Each card stays a single link and a single tab stop. Cards in the same row have equal block size and are separated by one spacing token. Hover and focus states follow the rules above. No intro text or images are added (doc 12 §4.1).
- Q: Chrome motion (FR-010)? → A: **Default:** chrome state changes may transition only colour, background and border, over at most `--duration-fast` with `--ease-standard`. They never use movement, scaling or opacity entrances. Under `prefers-reduced-motion` they are instant. No new fretboard motion kinds are added.
- Q: How is SC-001 measured? → A: In each tool's default state, at viewports 320×568, 768×1024 and 1440×900 (portrait/desktop arrangements; landscape is covered by feature 025):
  - the bounding-box area of zone C is larger than the area of each other zone (A, B, D, E) taken one at a time;
  - zone C's top edge lies inside the initial viewport, with no scrolling.
- Q: SC-005 ("within 10 seconds") is not automatable — what replaces it? → A: At the same three viewports, in each tool's default state, every zone B control is fully inside the initial viewport, visible without scrolling and without opening any menu, panel or disclosure.
- Q (implementation, 2026-10-07): At 320×568, Triads and CAGED zone B alone is 443–557 px of 44 px targets, so the first-screen rules of SC-001 and SC-005 cannot hold without moving or hiding controls. What applies there? → A (owner): **Relax at the narrow width.** At 320×568, zone C must still have the largest area, and every zone B control must lie within the viewport width (rows wrap, no menu, no sideways strip), reached by vertical page scroll. The first-screen rules stay strict at 768×1024 and 1440×900.
- Q (implementation, 2026-10-08): Wrapped, Triads zone B (~500 px) still outgrows zone C (451 px) at 320×568; passing would need 4 px option padding. What applies? → A (owner): at 320×568, zone C is compared only with zones A, D and E; option padding stays comfortable.
- Q: Screenshot baselines? → A: Full-page and chrome screenshots that change are regenerated on purpose for phone, phone-touch and desktop. This includes the TM-9 views, `arrangement-*`, `theme-dark-*` and `sound-control-*`. The fretboard-only element snapshots stay frozen (see the first answer). All non-screenshot assertions in the existing e2e suites pass unchanged.
- Q: Performance and dependencies? → A: The change is markup and CSS only. No new runtime dependency, icon library or web font is added (ADR 0006). The initial JS stays ≤ 150 KB gzip, and the Lighthouse and interaction budgets pass (Constitution VI).
- Q: New text? → A: None is expected. Any new visible or accessible text (for example an `aria-label`) goes through the message catalog in en, pt and es, and `tests/unit/no-raw-text.test.ts` passes (Constitution VIII).
- Q: Print, preferences and links? → A: Print output and `print.spec.ts` pass unchanged. No preference key, share-link field or format version changes. The link-compatibility fixtures pass untouched (Constitution IX).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calmer, fretboard-first tool screens (Priority: P1)

A player opens any tool (Notes, Triads, CAGED) on a phone or desktop. The fretboard dominates the screen. Controls are grouped logically, use consistent spacing and sizing, and carry no decorative clutter. The player finds the main control for the task at a glance and never has to hunt for it.

**Why this priority**: The fretboard is the product's protagonist and tool screens are where players spend nearly all their time.

**Independent Test**: Open each tool at 320, 768 and 1440 px wide. Confirm the fretboard is the largest element, controls sit around it without covering it, and the same control types look and are spaced the same in every tool.

**Acceptance Scenarios**:

1. **Given** any tool at its default state, **When** it opens, **Then** zone C (the fretboard) has the largest bounding-box area of all zones, and advanced options stay off as they are today.
2. **Given** two different tools, **When** compared, **Then** equivalent controls (selectors, toggles, steppers) have equal computed size, padding, radius, border and state styling.
3. **Given** a phone-width screen, **When** a tool is shown, **Then** all primary controls are reachable without a menu and without horizontal page scroll.

---

### User Story 2 - Clear hierarchy and consistent navigation (Priority: P2)

A player moves between the home screen, tools, the instrument/language panels, and the about page. Navigation, headings, cards and panels follow one clear visual hierarchy. The current location and the active state of every control are unmistakable, without relying on color alone.

**Why this priority**: Consistent shell chrome reduces effort on every visit, but it supports rather than carries the tools.

**Independent Test**: Walk through home → each tool → instrument panel → language panel → about, checking that the active tool, focus, hover and pressed states are visible and consistent.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the player looks at navigation, **Then** the current tool or page is clearly marked by more than color alone.
2. **Given** keyboard use, **When** moving through controls, **Then** focus is always visible and the order is logical.
3. **Given** the home screen, **When** it loads, **Then** tool cards are scannable, evenly spaced and clearly clickable.

---

### User Story 3 - Polished across themes, languages and settings (Priority: P3)

A player using dark or light theme, high contrast, reduced motion, Portuguese or Spanish, or 200% text zoom sees the same refined layout with no truncation, overlap or lost affordance.

**Why this priority**: Refinement must not regress the supported environments, but it adds value only after the base look is improved.

**Independent Test**: Render key screens in each theme, each language, with reduced motion and contrast preferences, and at 200% zoom; check for truncation, overlap or contrast loss.

**Acceptance Scenarios**:

1. **Given** a longer-text language, **When** any control row renders, **Then** labels are not truncated and nothing overlaps.
2. **Given** reduced-motion or high-contrast preference, **When** the UI renders, **Then** it honors both without losing any state indicator.

---

### Edge Cases

- 320 px width with 200% text zoom: controls wrap rather than overflow; only the fretboard scrolls horizontally.
- Seven-string, 24-fret instruments keep the fretboard dominant and smooth.
- Notices and failure views remain non-blocking, short and legible after restyling.
- Printing and existing saved preferences/share links behave exactly as before.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every screen MUST present a minimalist layout: no decorative elements, fewer boxes and borders, and spacing only from the spacing tokens. No control or function may be removed, moved behind a menu, or moved to another zone (doc 12 §4–5).
- **FR-002**: The fretboard MUST remain the visually dominant element on tool screens; controls MUST NOT cover it.
- **FR-003**: Each control family (action button, segmented/exclusive option, switch row, stepper, link-button) MUST have one shared style, defined once globally and used by all tools and shell panels. Computed size, padding, radius, border, font size and weight MUST be equal across tools for the same family and state.
- **FR-004**: All visual values (color, spacing, type, radius, motion) MUST come from the shared design tokens. An automated test MUST reject colour literals, unit length/time literals other than `0` (including `var()` fallbacks), and references to undefined tokens in component styles. The chrome token set MAY be refined within the limits in Clarifications. Fretboard, marker, emphasis and minimap token values MUST NOT change.
- **FR-005**: Interactive states (hover, focus, pressed, selected, disabled) MUST be distinct and MUST NOT rely on color alone. Selected/pressed states MUST combine accent fill, bold weight and the matching ARIA state. The current nav item MUST combine `aria-current`, bold weight and the indicator bar.
- **FR-006**: Touch targets MUST be at least 44×44 px in comfortable mode, and focus MUST be visible everywhere.
- **FR-007**: The note-function marker code (root, third, fifth, degree shapes and colors) and the four emphasis levels MUST remain unchanged.
- **FR-008**: The UI MUST work from 320 to 2560 px; only the fretboard may scroll horizontally.
- **FR-009**: The refined UI MUST hold in light, dark, high-contrast, reduced-motion, English/Portuguese/Spanish, and 200% text zoom without truncation or overlap.
- **FR-010**: Fretboard motion MUST stay unchanged. Chrome state changes MAY transition only colour, background and border, over at most `--duration-fast`, and MUST be instant under reduced motion.
- **FR-011**: The change MUST NOT alter musical behavior, saved preferences, share-link formats or message keys' meaning; any new text MUST go through the message catalog.
- **FR-012**: Accessibility checks MUST report zero violations and performance budgets MUST still pass. No new runtime dependency, icon library or web font may be added.

### Key Entities

- **Design tokens**: The shared named values for color, spacing, type scale, radius and motion that all screens consume.
- **Shell chrome**: Navigation, panels, cards, notices and control groups surrounding the fretboard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every tool at default state, at 768×1024 and 1440×900, zone C's bounding-box area is larger than that of each other zone and its top edge is inside the initial viewport. At 320×568, zone C's area is larger than that of zones A, D and E (zone B's wrapped rows are not compared).
- **SC-002**: For every control family, an automated computed-style comparison shows identical size, padding, radius, border, font size and weight across Notes, Triads, CAGED and shell panels, in default and selected state. The token-literal unit test passes with zero findings.
- **SC-003**: Zero accessibility violations and zero text truncation/overlap across all supported themes, languages and 200% zoom on key screens.
- **SC-004**: Existing functional tests, share-link fixtures, print tests and performance budgets pass with no regression. The `all-markers-grayscale` and `accidental-glyphs` snapshots pass without a baseline update.
- **SC-005**: In every tool at default state, with no menu, panel or disclosure opened: at 768×1024 and 1440×900 every zone B control is fully inside the initial viewport with no scrolling; at 320×568 every zone B control lies within the viewport width (rows wrap) and is reached by vertical page scroll only.

## Assumptions

- Scope is visual refinement of the shell chrome around the fretboard. The fretboard drawing itself, the five-zone structure, and the tools' features and control placement do not change.
- The existing design document and constitution rules remain the authority; where this refinement conflicts, they win.
- Existing full-page and chrome screenshot baselines (TM-9 views, arrangement, theme-dark, sound-control) will be regenerated on purpose for phone, phone-touch and desktop. Fretboard-only element snapshots stay frozen.
- Both phone and desktop have equal priority.
