# Feature Specification: Metronome Tool and Steady Click

**Feature Branch**: `feature/031-metronome-tool-and-click-engine`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/008-ratios-training/001-metronome-tool-and-click-engine.md (id 001, metronome-tool-and-click-engine)."

## Clarifications

### Session 2026-10-29 (clarify reviewer)

Sources: constitution 2.0.0 (C), breakdown brief 008-ratios-training/001 (B), macro-spec `specs/autonomous/metronome-trainer-spec.md` (M), existing code (X). "Default" marks an assumed conventional choice where no source decides.

- Q: The brief says "orange" Start Training / Resume and lit dots, but the app's accent token is blue (`--color-accent`, X `tokens.css`). Which wins? → A: The app accent. B says "follows the app's themes, using the accent for active and lit states", and C VII requires every colour to come from design tokens. Wherever B or M says orange, the spec means `--color-accent` (with `--color-accent-text` for text on it). No literal orange ships (FR-004, FR-005, FR-006, FR-008).
- Q: How does a red Reset fit with C VII ("Error red MUST NOT be used for normal situations"; root, third and fifth colours never reused)? → A (default): Reset is a destructive control, not an error, so it gets a new design token `--color-danger` (light and dark values, plus forced-colours and high-contrast handling). Its hue is distinct from `--fb-color-root`, and it meets 3:1 non-text contrast against the surface. Reset is never conveyed by colour alone: it carries the ↺ icon and the accessible name "Reset", and the name shows as a tooltip on hover or focus. `--color-danger` is used only by the Reset control. The plan's Constitution Check MUST record this as a reading of C VII (FR-013, FR-021).
- Q: The brief mentions iOS, phone locks and narrow screens, but C VII (2.0.0) targets desktop only. → A: Derived from C. The supported target is evergreen desktop browsers, in windows 1024–2560 CSS px wide, with the zoom reflow down to 320 CSS px (C V). "Never cut off, iOS included" becomes: never cut off in desktop Chromium, Firefox and Safari (WebKit, which shares iOS's autoplay policy). Phone lock and iOS are best-effort only: not blocked, not tested. "When space is tight" means every width from 320 to 2560 CSS px (FR-003, FR-015, FR-016).
- Q: Route and navigation? → A (default): The tool lives at `/metronome`. It is the fourth entry in the tool list (`TOOLS`), after CAGED, so it appears as the fourth home card and in the app nav in that order. It participates in the existing `lastTool` preference ("continue" card): `'metronome'` is added to the `lastTool` picklist. This is backward-compatible, because older builds already fall back to `null` for unknown values (C IX) (FR-001, FR-022).
- Q: Which shared tool-shell features apply to a tool with no fretboard? → A (default): Only the app bar (sound control, language, theme, About) and the nav. The Metronome shows no instrument panel or tuning badge, no Share, no "describe this view" or legend, no print view and no fretboard shortcuts (P . , L N). It has no share-link format. The panel shows the heading **Ratios Training** and no mode tabs (B scope boundary) (FR-001, FR-023).
- Q: Mute and volume (the brief's open question)? → A (default, B open question): The existing app-wide mute and volume control governs the click, applied to every click scheduled after the change, mid-run included. Muting does not pause: the dots and status keep stepping silently. A dedicated metronome volume is a later additive change (FR-018).
- Q: Does the app-bar Stop button govern the metronome? → A (default): No. The Stop button reflects `playback.sequencePlaying` for note sequences only. The metronome's own Pause and Reset are its stop controls, and the app-bar Stop does not appear for the click (FR-024).
- Q: Hidden-page rule? → A: Derived from B. The existing `PlaybackHost` rule (a hidden page stops playback) MUST NOT stop the metronome. Every other tool keeps the rule. While hidden, the scheduler MUST keep clicks gap-free even when the browser throttles main-thread timers to once per second (FR-016, SC-004).
- Q: Where exactly is the beat position when pausing, and when does Resume's click sound? → A (default): Pause freezes on the last beat that has *sounded* (displayed). Clicks scheduled ahead but not yet sounded are cancelled and do not count, so no click sounds after the Pause instant. Resume plays the next beat (frozen beat + 1, wrapping to accented beat 1 after the last beat) within 50 ms of the press, like Start, and re-anchors the timing grid at that moment (FR-009, FR-025).
- Q: How is timing measured and how are dots kept in step? → A (default, M "measured against the AudioContext clock"): Click *n* of a run segment is scheduled at exactly `anchor + n × 60 / BPM` on the audio clock, computed from the anchor and never by accumulating intervals. The scheduled time of each click is within 2 ms of that ideal, and after 10 min at 300 BPM (3000 clicks) the last one is within 2 ms of it. The dot and status line change when the click's audio time is reached, within one animation frame (≤ 20 ms), never at scheduling time. Verified with an injectable clock or audio context (C IV), not real time (FR-014, FR-006, SC-001, SC-002).
- Q: What is a "live text equivalent" at up to 300 BPM, where announcing every beat would flood a screen reader? → A (default, accessibility convention): The status text (`BEAT n/N`, BPM) is always present as real text in the DOM, so a screen reader can read it on demand. A separate polite live region announces only run-state changes: "Started, 85 BPM, 4 beats"; "Paused on beat 3 of 4"; "Resumed"; "Reset". The dot row is `aria-hidden`, and its information is in the status text (FR-011).
- Q: Scope of Space and Esc? → A (default, matching X `shortcuts.ts` guards): Both are handled at page level while the Metronome route is shown. The handler ignores events with Ctrl, Meta or Alt, repeats (`repeat`), composing, `defaultPrevented`, focus in a text field or select, and Escape that an open app-bar disclosure (sound, language) owns. When a button has focus, Space activates that button natively and the page handler does not act a second time, so one press is exactly one toggle. On a focused slider, Space toggles the run. Esc in the settings view does nothing. The About page's shortcut list gains "Space: Start / Pause / Resume (Metronome)" and "Esc: Reset (Metronome)" (FR-010).
- Q: How do the slider and the pill behave? → A (default, matching X `FretStepper`): The slider is a native range input (arrows ±1, PageUp/PageDown ±10, Home/End to min/max) and exposes min, max and current value. The pill's value is a read-only readout, not a text field. − and + step by 1 and are disabled (greyed, never red) at the limit. The slider and pill stay in sync. Both are available only in the settings view (FR-002, FR-003).
- Q: Are values kept when the user leaves and comes back? → A (default, B "no remembered settings"): Reset keeps the values (B). Leaving the route stops the click, and reopening the tool, whether by in-app navigation or a reload, starts at 85 / 4 in the settings view (FR-017, FR-019).
- Q: What if the platform suspends audio in the background, then the page returns? → A (default): No catch-up burst. On return, the scheduler skips missed beats and continues on the same grid at the next due beat. Beat numbering still follows the clock: the beat shown is the one whose slot is due. If the audio context was suspended or interrupted and does not resume, the run moves to Paused at the last sounded beat (FR-026).
- Q: What if Web Audio is unavailable or the context cannot start? → A: Derived from C X ("never blank; adjust and tell"). The run proceeds visually (dots and status step on the clock) and a one-line non-blocking notice says the sound is unavailable. Sound is never the only carrier of the beat (C V) (FR-027).
- Q: What does the click sound like? → A (default): A short synthesized tick generated in `src/lib/audio` with no sample files (C II, no network). The accent is higher-pitched and louder than the normal click. No user sound choice in this slice (FR-007).
- Q: What happens when Start, Pause or Space is pressed rapidly? → A (default): At most one click stream exists at any time. The run state machine (settings → running ⇄ paused → settings) ignores a transition already in progress. Ten alternating presses within one second never produce overlapping clicks or a double click on one beat (FR-028).
- Q: What does # of Beats = 1 do? → A (default): One dot, lit on every click. Every click is accented, because it is beat 1. The status reads `BEAT 1/1`.
- Q: Budgets? → A: Derived from C VI. The new tool stays within the single bundle's ≤ 150 KB gzip initial-JS budget and opens in ≤ 300 ms. The tool-screen budget is ≤ 3.5 s. Lighthouse covers `/metronome`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a steady, trustworthy click (Priority: P1)

A guitarist building speed opens the new **Metronome** tool from its home card. It opens on the **Ratios Training** practice panel. They set a tempo (BPM) and a number of beats per loop, press **Start Training**, and hear a click they can trust: beat 1 of each loop is accented, the other beats are a normal click, and the click never stutters or drifts.

**Why this priority**: A reliable click is the whole product. Without it every later exercise (subdivisions, count-in, loop alternation) is useless.

**Independent Test**: Open the tool, keep the defaults (85 BPM, 4 beats), press Start Training, and check that the first click sounds almost immediately and that clicks repeat at the set tempo with an accent on every fourth click.

**Acceptance Scenarios**:

1. **Given** the settings view with 85 BPM and 4 beats, **When** the user taps Start Training, **Then** the running view opens with four dots, and the status line steps `BEAT 1/4` … `4/4` in step with the clicks, with beat 1 accented.
2. **Given** # of Beats is 2, **When** the user starts training, **Then** two dots show and the status line reads `BEAT n/2`.
3. **Given** a running session at 300 BPM, **When** it runs for 10 minutes, **Then** the last click lands where the clock says it should, with no cumulative drift.
4. **Given** Start Training was just pressed, **When** the first beat is due, **Then** its click sounds within 50 ms of Start and is never cut off.
5. **Given** a running session in a desktop browser, **When** the tab is hidden (or the window minimised), **Then** the clicks keep going gap-free while the platform allows audio, even with main-thread timers throttled to once per second; phone lock is best-effort and untested.

---

### User Story 2 - Pause, resume and reset (Priority: P2)

While training, the user can stop at any moment, pick up exactly where they left off, or go back to the settings.

**Why this priority**: Practice is interrupted constantly; controls must be predictable, but they only matter once the click works.

**Independent Test**: Start a session, press Pause on beat 3, press Resume, and confirm the next click is beat 4; then press Reset and confirm the settings view returns with the same values.

**Acceptance Scenarios**:

1. **Given** a running session, **When** the user presses Pause, **Then** sound stops at once, and the dots and status line freeze; the button becomes an accent-coloured **Resume**; no click sounds after the Pause instant.
2. **Given** a session paused on beat 3, **When** the user presses Resume, **Then** the next click is beat 4, sounding within 50 ms, with no count-in; after beat 4 the loop wraps to accented beat 1.
3. **Given** a running or paused session, **When** the user presses Reset (small red square), **Then** sound stops and the settings view returns with the same BPM and # of Beats values.
4. **Given** the Metronome route is shown and focus is not in a text field or an open app-bar disclosure, **When** the user presses Space, **Then** it toggles Start / Pause / Resume exactly once (also when a button has focus); **When** the user presses Esc in the running view, **Then** it resets (Esc does nothing in the settings view).

---

### User Story 3 - Choose tempo and beats per loop (Priority: P2)

On the settings view, the user sets **BPM** (30–300, default 85, step 1) and **# of Beats** (1–16, default 4, step 1) using either a slider or a −/value/+ pill, then starts training.

**Why this priority**: The settings define the session, and the layout must stay usable on small screens.

**Independent Test**: Adjust each row by slider and by pill, confirm limits and defaults, then start and check that the running view shows the chosen values.

**Acceptance Scenarios**:

1. **Given** the settings view on first open, **Then** BPM shows 85 and # of Beats shows 4.
2. **Given** BPM is 300, **Then** + is disabled and the value stays 300 (likewise − at 30, and + at 16 / − at 1 for # of Beats); the slider moves in sync with the pill.
3. **Given** any width from 320 CSS px (zoom reflow) to 2560 CSS px, **Then** each row keeps its −/value/+ pill at least 96 px wide, the slider shrinks first, and there is no horizontal page scroll.
4. **Given** the chosen values, **When** the user starts training, **Then** the status box shows the BPM in large accent digits on the right and one dot per beat.

---

### User Story 4 - Reach the tool, in my language and theme, accessibly (Priority: P3)

The Metronome appears as a fourth home card and works in English, Portuguese and Spanish, in every theme, with reduced motion and with a screen reader or keyboard only.

**Why this priority**: Required for consistency with the rest of the app but not the core value.

**Independent Test**: Switch language, theme and reduced-motion setting, then complete a full start/pause/resume/reset flow by keyboard only.

**Acceptance Scenarios**:

1. **Given** the home screen, **Then** a Metronome card is the fourth card, after Notes, Triads and CAGED, and opens `/metronome`; the app nav lists it fourth.
2. **Given** any of the three languages, **Then** every label (including the status line) is translated.
3. **Given** any theme (including high contrast and forced colours), **Then** active and lit states use `--color-accent`, and `--color-danger` is used only for Reset, which also carries an icon and an accessible name.
4. **Given** a screen reader, **Then** sliders expose value and range, the status text (`BEAT n/N`, BPM) is readable on demand, and a polite live region announces run-state changes (started with BPM and beats, paused on beat n of N, resumed, reset), never every beat.
5. **Given** keyboard-only use, **Then** every control is reachable and operable.

---

### Edge Cases

- Beat dots: the current beat is lit, beats already played in the loop are dimmed, upcoming beats are grey.
- Pausing and resuming repeatedly must not accumulate timing error or double-click.
- Changing BPM or # of Beats is only possible in the settings view, not mid-run.
- # of Beats = 1: one dot, lit on every click, every click accented, status `BEAT 1/1`.
- Audio not yet unlocked (first gesture): pressing Start Training is the gesture; the first click is scheduled only after the audio context is running, sounds within 50 ms of the press and is never cut off (desktop Chromium, Firefox, Safari).
- Leaving the tool (navigating to another route) stops the click; reopening shows the settings view at 85 / 4.
- If the platform suspends audio in the background, no catch-up burst plays: missed beats are skipped and the run continues on the same grid; if audio cannot resume, the run moves to Paused at the last sounded beat.
- Web Audio unavailable: the run is visual-only, with a one-line non-blocking notice.
- Muted: the run continues silently with dots and status stepping.
- Rapid taps on Start/Pause or Space never start duplicate click streams.
- Reduced motion: no animated beat transitions beyond instant lit/dim state changes.
- Narrow widths (zoom reflow down to 320 CSS px): the slider shrinks before the pill does.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a fourth tool, **Metronome**, at `/metronome`, with its own home card (fourth, after CAGED) and nav entry, opening on a panel headed **Ratios Training** (no mode tabs).
- **FR-002**: The settings view MUST offer a **BPM** row (30–300, default 85, step 1) and a **# of Beats** row (1–16, default 4, step 1).
- **FR-003**: Each row MUST consist of a label on the left, a slider in the middle and a −/value/+ pill on the right; the pill MUST keep at least 96 px width at every width from 320 to 2560 CSS px, with the slider shrinking first. The slider is a native range control (arrows ±1, PageUp/PageDown ±10, Home/End); the pill value is a read-only readout; − / + step by 1 and are disabled (greyed) at the limits.
- **FR-004**: The settings view MUST have a full-width accent-coloured (`--color-accent`) **Start Training** button with a play icon that opens the running view.
- **FR-005**: The running view MUST show a bordered status box with the position in small caps on the left (e.g. `BEAT 2/4`), the BPM in large `--color-accent` tabular digits with a small `BPM` unit on the right, and a centred row with one dot per beat.
- **FR-006**: The current beat's dot MUST be lit, already-played beats dimmed, upcoming beats grey; the status line and dots MUST change when each click's audio time is reached, within one animation frame (≤ 20 ms), never at scheduling time; the dot row is `aria-hidden`.
- **FR-007**: Beat 1 of each loop MUST play an accented click; all other beats a normal click. Both are short synthesized ticks made on the device (no sample files); the accent is higher-pitched and louder.
- **FR-008**: The running view MUST show a full-width **Pause** button that becomes an accent-coloured **Resume** (play icon) when paused, and a small **Reset** square in `--color-danger` with a ↺ icon and the accessible name "Reset".
- **FR-009**: Pause MUST cancel every click not yet sounded (no click sounds after the Pause instant) and freeze dots and status line on the last sounded beat; Resume MUST play the next beat within 50 ms, with no count-in, re-anchoring the timing grid; Reset MUST stop sound and return to the settings view with the same values.
- **FR-010**: While the Metronome route is shown, Space MUST toggle Start / Pause / Resume exactly once per press and Esc MUST reset from the running view. Both are ignored with Ctrl/Meta/Alt, on key repeat, while composing, when already handled, when focus is in a text field or select, and (Esc) when an open app-bar disclosure owns it. The About shortcut list MUST include both.
- **FR-011**: All controls MUST work by keyboard; sliders MUST expose value and range; the status text MUST be real DOM text, and a polite live region MUST announce run-state changes (started with BPM and beats, paused on beat n of N, resumed, reset), not every beat.
- **FR-012**: All labels MUST be available in English, Portuguese and Spanish.
- **FR-013**: The tool MUST follow the app's themes and reduced-motion setting, using `--color-accent` for active and lit states and a new `--color-danger` token (hue distinct from the root colour, ≥ 3:1 non-text contrast, forced-colours aware) only for Reset.
- **FR-014**: Click *n* MUST be scheduled at `anchor + n × 60 / BPM` on the audio clock (never by accumulating intervals), within 2 ms of that ideal, with no cumulative drift over 10 minutes at any BPM from 30 to 300. Verified through an injectable clock / audio context.
- **FR-015**: The first click MUST be scheduled no more than 50 ms after the Start press, only once the audio context is running, and MUST NOT be cut off, in desktop Chromium, Firefox and Safari (WebKit). iOS is best-effort.
- **FR-016**: Clicks MUST continue while the tab is hidden, as far as the platform allows. The scheduler MUST stay gap-free when main-thread timers fire only once per second. The app's hidden-page stop rule (`PlaybackHost`) MUST NOT stop the Metronome and still applies to every other tool. Phone lock is best-effort.
- **FR-017**: Leaving the Metronome route MUST stop the click; reopening it MUST show the settings view at defaults (85 BPM, 4 beats).
- **FR-018**: The existing app-wide mute and volume control MUST govern the metronome click, including mid-run (it applies to every click scheduled after the change). Muting MUST NOT pause the run.
- **FR-019**: Out of scope: subdivisions, count-in, Loop 2, mode tabs, remembered BPM / beats, practice timer, tap tempo, and a dedicated metronome volume.
- **FR-020**: With # of Beats = 1, the single dot MUST light on every click and every click MUST be accented.
- **FR-021**: `--color-danger` MUST be defined in the design tokens for light, dark, high-contrast and forced-colours, and MUST be used only by the Metronome Reset control.
- **FR-022**: `'metronome'` MUST be added to the tool list and the `lastTool` preference picklist, so the home screen can mark it as the tool to continue. Unknown or invalid values keep falling back to `null`.
- **FR-023**: The Metronome MUST NOT show the instrument panel, tuning badge, Share, "describe this view" or legend, print view, or fretboard shortcuts. It has no share-link format.
- **FR-024**: The app-bar Stop button MUST NOT appear for, or act on, the metronome click.
- **FR-025**: The loop MUST wrap from the last beat to beat 1 with no gap: beat 1 is accented again, and the played dots reset to grey.
- **FR-026**: After a background suspension, the scheduler MUST NOT play missed clicks. It continues on the same grid at the next due beat. If audio cannot resume, the run MUST move to Paused at the last sounded beat.
- **FR-027**: If Web Audio is unavailable or the context fails to start, the run MUST proceed visually, and a one-line, non-blocking, dismissible notice MUST say that sound is unavailable.
- **FR-028**: At most one click stream MUST exist at any time. Rapid or repeated Start, Pause, Resume or Space input MUST NOT produce overlapping clicks or a double click on one beat.

### Key Entities

- **Metronome settings**: BPM (30–300) and beats per loop (1–16).
- **Session state**: idle (settings view), running, or paused; current beat position within the loop.
- **Click**: a scheduled sound at a precise time, either accented (beat 1) or normal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At every tempo from 30 to 300 BPM, each click's scheduled audio-clock time is within 2 ms of `anchor + n × 60 / BPM` (unit test with an injected clock).
- **SC-002**: After 10 minutes at 300 BPM, the last click lands within 2 ms of its ideal time (no cumulative drift).
- **SC-003**: In 100% of runs, the first click (and the first click after Resume) is scheduled ≤ 50 ms after the press, at or after the audio context's current time once it is running, so it is never truncated.
- **SC-004**: With the page hidden, the hidden-page stop rule does not stop the click. With scheduler timers firing only once per 1000 ms (simulated), no beat in a 60 s run is missed or late by more than 2 ms.
- **SC-005**: A user can go from the home screen to a running click in at most 2 taps/clicks (card, Start Training).
- **SC-006**: Pausing on beat 3 and resuming always yields beat 4 as the next click (100% of trials).
- **SC-007**: The whole flow (settings, start, pause, resume, reset) is completable by keyboard only, and all text appears in all three languages.
- **SC-008**: The Metronome page has zero axe violations in the settings, running and paused views, in light and dark themes. The initial-JS gzip budget (≤ 150 KB) and the tool-open budget (≤ 300 ms) still pass.

## Assumptions

- The app's existing mute and volume control governs the metronome rather than a separate volume (resolves the brief's open question); a dedicated metronome volume can follow later.
- Target platform is desktop browsers (constitution 2.0.0). Where the brief and macro-spec mention phones and iOS, those behaviours are best-effort.
- Where the brief and macro-spec say "orange", the app accent token is meant.
- Prerequisite features (app shell and home cards, sound unlock and mute/volume, three languages, themes and reduced motion) are already delivered.
- Settings are not remembered between visits in this slice.
- "As far as the platform allows" means best-effort background playback. Platform-imposed suspension is not a defect, but timer throttling to once per second is expected and MUST be handled (FR-016).
- The click sound design is a short synthesized tick; the accent is higher-pitched and louder (FR-007).
- Performance budgets and accessibility conformance follow the project constitution.
