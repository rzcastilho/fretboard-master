# Feature Specification: Mode Tabs and Plain Metronome

**Feature Branch**: `feature/036-mode-tabs-and-plain-metronome`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/009-more-modes/001-mode-tabs-and-plain-metronome.md (id 001, mode-tabs-and-plain-metronome)."

## Clarifications

### Session 2026-10-31 (clarify reviewer)

- Q: How many clicks per beat does plain Metronome mode play, and does its status line carry `· SUB`? → A (derived, breakdown 001 "plain click … no training logic", status `BEAT n/4`; 009-more-modes/003 brings subdivisions): one click per beat (clicks per beat = 1), no soft subdivision clicks, and the Ratios Training Loop 1 value (default 8th Triplets) is never used. The status line is `BEAT n/N` with no `· SUB` part; before the first loop click it reads `BEAT –/N` (existing `metronome_status_beat_none`), and during the count-in it reads `COUNT IN n/M` exactly as in Ratios Training (FR-006, FR-010).
- Q: Which sounds are used? → A (derived, existing engine): beat 1 uses the same accented click as Ratios Training's beat 1, beats 2..N use its regular beat click, and count-in clicks use its count-in sound. With 1 beat every loop click is the accented click (FR-009).
- Q: Are BPM and # of Beats shared between modes? → A (derived, breakdown 001 "Each mode keeps its own remembered settings"): No. Each mode has its own four (plain) or eight (Ratios) values; nothing is copied between them on switch (FR-005).
- Q: What does "resetting one mode" mean in FR-005? → A (derived, 035 FR-002): the run's Reset button. Reset stops the run and returns to that mode's settings view with its values unchanged; it never resets values to defaults. Only "Erase preferences" clears values, and it clears both modes and the selected mode (FR-005, FR-013).
- Q: What does the Start button say in plain mode? → A (default — the mode has no training, so "Training" would be wrong; a one-string change): `Start` (new catalog string, all three languages). Ratios Training keeps `Start Training`. Pause, Resume and Reset labels are shared (FR-011).
- Q: What is announced to screen readers on Start in plain mode? → A (default, mirrors the existing polite announcements minus the subdivision): `Started, {bpm} BPM, {beats} beats`, and with a count-in `Started, {bpm} BPM, {beats} beats, count in {count}`. Pause, Resume and Reset announcements reuse the existing strings (FR-015).
- Q: Where does the tab bar sit, and does it replace the card heading? → A (derived, source § UI layout row 1): the tab bar is the first row inside the metronome card, above the settings rows and above the running view's status box. It replaces the visible `Ratios Training` panel heading; the active tab's label names the mode. It stays visible and operable in the settings, running and paused views (FR-001).
- Q: How does the tab bar behave for keyboard and assistive technology? → A (default, WAI-ARIA Tabs pattern with manual activation, chosen because activating a tab stops playback and moving focus must not): a `tablist` of `tab` elements with `aria-selected`, controlling one `tabpanel` (the mode's view). Only the selected tab is in the Tab sequence (roving tabindex); Left/Right arrows move focus between tabs and wrap, Home/End go to the first/last tab; Enter or Space selects the focused tab. Space pressed on a focused tab selects the tab and does NOT toggle Start/Pause (it already activates natively, per the existing key rule). No new global shortcut is added for switching modes, and the shortcut list is unchanged (FR-012).
- Q: What is "the phone width breakpoint"? → A (default, reuses the existing `30rem` breakpoint used by the value rows; the constitution targets desktop and only requires phones not be blocked): at window widths of 30rem (480 CSS px) and below, the tabs show text only; above it they show `♩` / `+` before the text. The icons are decorative (hidden from assistive technology), so each tab's accessible name is the text alone (`Metronome`, `Ratios Training`) at every width. At 375 px and at 320 px the two labels fit without truncation, overlap or horizontal page scrolling in all three languages (FR-003, SC-005).
- Q: How are the selected mode and the plain settings stored? → A (default, extends the 035 per-mode record exactly as 035 anticipated; format version stays 1): the existing `metronome` object gains two optional keys: `plain` (fields in fixed order `bpm`, `beats`, `countIn`, `initialCountIn`) and `mode` (`"plain"` or `"ratios"`). `ratios` is unchanged. Each of `ratios` and `plain` is omitted when all its values equal the defaults (and otherwise holds all its fields); `mode` is omitted when it is `"ratios"`; `metronome` is omitted when all three are omitted, so a record for a user who never touched the plain mode or the tabs stays byte-identical to what 035 writes. On read: an unknown or invalid `mode` gives `"ratios"`; each invalid `plain` value gives its default; a missing or non-object `plain` gives all plain defaults; none of these affect `ratios`, and vice versa (FR-013).
- Q: When are the selected mode and plain values written? → A (derived, 035 Clarification "write on change"): the mode is written when a different tab is selected; plain values are written as soon as they change in the settings view (each step, committed typed value, switch flip). Writes are synchronous, fire-and-forget and skipped when unchanged (FR-013).
- Q: Does the privacy text change? → A (derived, current `about_privacy_stored` lists "metronome settings"): No. The selected mode and plain values are metronome settings, so the existing text stays accurate (FR-013).
- Q: Which tab is active on a first visit? → A (derived, FR-016 "existing behaviour unchanged" and the source, where Ratios Training is the mode in use): Ratios Training, although Metronome is the first tab in order (FR-014).
- Q: Is the selected mode part of share links or anonymous measurement? → A (default, the metronome has neither today; YAGNI): No share-link field and no new measurement event are added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plain click to play along with (Priority: P1)

Not every practice session is a drill. A player opens the Metronome tool, picks the **Metronome** mode, sets a BPM and a number of beats, and starts. They get a steady click with beat 1 accented and no training logic.

**Why this priority**: This is the new capability; the tabs exist to reach it.

**Independent Test**: Open the Metronome tab, set 100 BPM and 3 beats, press Start, and listen and watch the running view.

**Acceptance Scenarios**:

1. **Given** the Metronome tab is active with 100 BPM, 3 beats and Count In on (initial 4), **When** the user presses Start, **Then** they hear 4 count-in clicks, then a repeating 3-beat loop at 100 BPM with beat 1 accented, and three dots cycle through the loop.
2. **Given** the plain Metronome is running, **Then** the status line reads `BEAT n/3` for the current beat, where the total is the chosen # of Beats (`BEAT n/4` with the default 4).
3. **Given** the plain Metronome settings view, **Then** it shows BPM, # of Beats, Count In and Initial Count In, with the same ranges and defaults as Ratios Training (85 BPM, 4 beats, Count In on, Initial Count In 4), and does not show Repeat Count In, the ratio switch, or Loop 1 / Loop 2.
4. **Given** the plain Metronome is running, **When** the user uses Pause/Resume, Reset or the keyboard shortcuts, **Then** they behave exactly as in Ratios Training: Pause holds position, Resume continues, and Reset stops and returns to the settings view.
5. **Given** the plain Metronome runs for any length of time, **Then** the BPM and the beat count never change on their own and no count-in plays between loops.

---

### User Story 2 - Mode tab bar (Priority: P1)

A tab bar at the top of the metronome card lets the player choose the mode. Tabs are `♩ Metronome` and `+ Ratios Training`, equal in width. The active tab has accent-coloured text and a 2 px accent underline; inactive tabs are muted.

**Why this priority**: Without the bar there is no way to reach the plain mode, and later modes (Speed Training) need the same bar.

**Independent Test**: Open the Metronome tool, check the tabs and which is active, switch between them with pointer and keyboard.

**Acceptance Scenarios**:

1. **Given** the Metronome tool opens, **Then** a tab bar sits at the top of the card with two equal-width tabs, `♩ Metronome` and `+ Ratios Training`, and no Speed Training tab (that mode arrives in 009-more-modes/002).
2. **Given** a tab is active, **Then** its text uses the accent colour and it has a 2 px accent underline, and the other tab is muted with no underline.
3. **Given** the user selects the other tab, **Then** that mode's settings view shows and that tab becomes active.
4. **Given** the tab bar, **Then** it is operable with the keyboard, announces tab semantics and the selected state to assistive technology, and keeps a visible focus indicator.
5. **Given** the window is 375 px wide (any width of 480 px or less), **Then** the tab labels show text only, without the `♩` and `+` icons, and at 1024 px they show the icons; the accessible names are `Metronome` and `Ratios Training` at both widths.
6. **Given** a first visit with nothing remembered, **Then** Ratios Training is the active tab, as before this feature.

---

### User Story 3 - Switching modes stops playback and keeps each mode's settings (Priority: P1)

A player can switch tabs at any time. Playback stops at once, and each mode shows its own saved values.

**Why this priority**: Prevents stray sound and lost settings; part of the acceptance case.

**Independent Test**: Change settings in both modes, start one, switch tabs mid-run, then read both settings views.

**Acceptance Scenarios**:

1. **Given** Ratios Training is running (or paused), **When** the user selects the Metronome tab, **Then** sound stops at once, the Metronome settings view shows, and no run position carries over. The same holds in the other direction.
2. **Given** the user switched from a running Ratios Training session, **When** the Ratios Training tab is selected again, **Then** its settings view shows its own saved values, unchanged by anything done in Metronome mode.
3. **Given** the user sets 100 BPM and 3 beats in Metronome mode and 120 BPM in Ratios Training, **When** the user switches back and forth, **Then** each mode shows its own values; changing one mode's BPM never changes the other's.
4. **Given** a switch while stopped, **Then** the target mode's settings view shows with no sound.
5. **Given** the user reloads the page or leaves and returns to the tool in the same visit, **Then** each mode's settings are remembered, and the tool opens on the settings view of the last selected mode.

---

### Edge Cases

- Switching tabs during the count-in: sound stops at once, and the next Start begins from the initial count-in.
- Switching tabs while paused: it behaves like a stop; the pause is not remembered.
- Pressing the already active tab changes nothing and does not stop a running session.
- Plain Metronome with 1 beat: every click is beat 1 and is accented; the single dot stays lit.
- Count In off: Start goes directly into the loop. Initial Count In 0 behaves the same as in Ratios Training.
- Stored settings for the plain mode that are missing or invalid take that mode's defaults without affecting Ratios Training's values.
- Leaving the Metronome route while running stops the click, as today.
- Window narrower than 1024 px: the tab bar still works, without truncation of its text labels at 375 px or 320 px, in all three languages.
- Arrow keys on the tab bar only move focus; a running session keeps playing until Enter or Space selects the other tab.
- A stored `metronome.mode` that is unknown opens Ratios Training; a stored `plain` entry from this version is ignored (and dropped on the next write) by a 035-era build, without harm to `ratios`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The metronome card MUST show a mode tab bar at its top with equal-width tabs `♩ Metronome` and `+ Ratios Training`, in that order, and MUST NOT show a Speed Training tab in this slice.
- **FR-002**: The active tab MUST have accent-coloured text and a 2 px accent underline; inactive tabs MUST be muted. Colours and sizes MUST come from the design tokens.
- **FR-003**: At window widths of 30rem (480 CSS px) and below, tab labels MUST show text without icons; above that width they MUST show `♩` / `+` before the text. Icons MUST be hidden from assistive technology, so each tab's accessible name is its text at every width. At 375 px and 320 px the labels MUST fit without truncation, overlap or horizontal page scroll in English, Portuguese and Spanish.
- **FR-004**: Selecting a different tab MUST stop playback at once (including count-in and paused states), discard the run position, and show the selected mode's settings view. Selecting the active tab MUST do nothing.
- **FR-005**: Each mode MUST keep its own settings; BPM and # of Beats are not shared and nothing is copied on a switch. Editing values in one mode, or pressing Reset during its run (which stops the run and keeps the values), MUST NOT change the other's values.
- **FR-006**: The plain Metronome mode MUST play exactly one click per beat at a fixed BPM, with no soft subdivision clicks and no change of BPM, beat count or pattern during a run. Ratios Training's Loop 1 / Loop 2 values MUST NOT affect it.
- **FR-007**: The plain Metronome settings view MUST offer BPM, # of Beats, Count In and Initial Count In, with the same ranges, defaults, steppers and typed-entry validation as Ratios Training, and MUST NOT show Repeat Count In, the Subdivision ratio switch or Loop 1 / Loop 2.
- **FR-008**: In plain Metronome mode, Start MUST play the initial count-in (when Count In is on and Initial Count In is above 0), then loop the chosen number of beats indefinitely. No count-in plays between loops.
- **FR-009**: In each loop, beat 1 MUST use Ratios Training's accented beat-1 click, the other beats its regular beat click, and count-in clicks its count-in sound; the beat dots MUST cycle through the loop in step with the clicks. With 1 beat every click is accented.
- **FR-010**: The running view of plain Metronome mode MUST show the status line `BEAT n/N` (current beat of the chosen # of Beats) with no `· SUB` part, `BEAT –/N` before the first loop click, and `COUNT IN n/M` / `COUNT IN –/M` during the count-in as in Ratios Training, localised like other status text.
- **FR-011**: Start, Pause/Resume and Reset, their keyboard shortcuts (Space toggles, Escape resets), and the running view layout MUST behave in plain Metronome mode as they do in Ratios Training. The plain mode's start button reads `Start`; Ratios Training keeps `Start Training`. On Start, plain mode announces `Started, {bpm} BPM, {beats} beats` (adding `, count in {count}` when a count-in plays).
- **FR-012**: The tab bar MUST follow the WAI-ARIA Tabs pattern with manual activation: `tablist`/`tab`/`tabpanel` roles and `aria-selected`; only the selected tab in the Tab sequence; Left/Right arrows move focus with wrap, Home/End to first/last; Enter or Space selects the focused tab. Moving focus alone MUST NOT switch mode or stop playback, and Space on a focused tab MUST NOT toggle Start/Pause. It MUST show a visible focus indicator and meet the contrast rules. No new global shortcut is added. The tab bar MUST be the first row inside the card, replace the visible `Ratios Training` panel heading, and stay visible and operable in the settings, running and paused views.
- **FR-013**: The selected mode and each mode's settings MUST persist across reloads and tool changes under the existing remembered-settings rules (preferences record `version: 1` unchanged). The `metronome` object gains optional `plain` (`bpm`, `beats`, `countIn`, `initialCountIn`, in that order, all written when any differs from default, omitted otherwise) and `mode` (`"plain"`; omitted when `"ratios"`); `metronome` stays omitted when everything is default, so untouched records stay byte-identical to 035's. The mode is written when a different tab is selected; plain values are written when they change in the settings view, skipped when unchanged. On read, an invalid `mode` gives `"ratios"`, an invalid plain value its default, and a missing or malformed `plain` all plain defaults, never affecting `ratios` (and vice versa). Erase preferences clears both modes and the selected mode. A device-storage failure MUST NOT block the tool. The privacy text (`metronome settings`) stays as is.
- **FR-014**: With nothing remembered, the tool MUST open on Ratios Training so existing behaviour is unchanged.
- **FR-015**: All new visible text and accessible names MUST be available in English, Brazilian Portuguese and Spanish.
- **FR-016**: Existing Ratios Training behaviour, timing accuracy and settings MUST be unchanged by this feature.
- **FR-017**: The selected mode MUST NOT be added to share links, and no new anonymous-measurement event is added.

### Key Entities

- **Mode**: One of the metronome's practice modes (Metronome, Ratios Training; Speed Training later). Has its own settings view and its own remembered settings.
- **Plain Metronome settings**: BPM, # of Beats, Count In on/off and Initial Count In. Ranges and defaults match Ratios Training's.
- **Selected mode**: Which tab is active; remembered with the settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from opening the tool to a plain click playing in no more than 3 interactions (choose tab, adjust, Start), and in the 100 BPM / 3 beat case hears exactly 4 count-in clicks followed by a repeating 3-beat loop with one accented beat per loop.
- **SC-002**: In 100% of tab switches during a run, sound stops with no further click after the switch and the target settings view shows.
- **SC-003**: After switching modes any number of times, both modes show exactly the values last set in each, with no cross-mode leakage.
- **SC-004**: Over a 5-minute plain run, the BPM and the number of beats per loop never change, and the click timing stays as accurate as in Ratios Training.
- **SC-005**: At a 375 px window width, 100% of tab labels show text only with no icons and no truncation.
- **SC-006**: Every function of the tab bar and plain mode is reachable and operable by keyboard alone, and automated accessibility checks report no new violations.
- **SC-007**: All Ratios Training acceptance behaviour from earlier slices continues to pass unchanged.

## Assumptions

- The tab bar is built for extension: Speed Training (009-more-modes/002) will add its tab to the same bar. Its tab is simply not shown now.
- Plain Metronome mode shares the Start, Pause/Resume, Reset and shortcut behaviour, audio scheduling and running view of Ratios Training, as the source states.
- The plain mode's four settings use the same ranges as Ratios Training: BPM 30–300 (default 85), # of Beats 1–16 (default 4), Initial Count In 0–8 (default 4), Count In on by default.
- "Switching tabs stops playback at once" includes the count-in and paused states, and the run position is not remembered, consistent with Reset.
- Remembering the selected mode and the plain mode's settings extends the existing local preferences record in a backwards-compatible way, so an older record gives the defaults.
- The phone label rule applies at 480 px and below (tested at 375 px); phones are not a supported target (constitution), but the layout is not blocked there.
- Tap tempo and subdivisions in plain Metronome mode are out of scope (009-more-modes/003), as is the Speed Training mode itself (009-more-modes/002).
