# Feature Specification: Count In

**Feature Branch**: `feature/033-count-in`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/008-ratios-training/003-count-in.md (id 003, count-in)."

## Clarifications

### Session 2026-10-30 (clarify reviewer)

Sources: constitution (C), breakdown brief 008-ratios-training/003 (B), macro-spec `specs/autonomous/metronome-trainer-spec.md` (M), the 031/032 specs and code (X). "Default" marks an assumed conventional choice where no source decides.

- Q: Where do the Count In switch and rows sit? → A: Derived from M's Ratios settings table: BPM, # of Beats, **Count In**, Initial Count In, Repeat Count In, then the Loop 1 dropdown and Start Training (FR-001).
- Q: What control is the switch? → A (default, X precedent `role="switch"` in CagedTool/ShortcutList): A `<button role="switch" aria-checked>` with the visible label **Count In** as its accessible name, toggled by click, Enter and Space, at least 24 × 24 CSS px, standard focus ring. Space on the switch toggles it and does not start training (X MetronomePanel already excludes `[role="switch"]` from the Space shortcut) (FR-001, FR-005).
- Q: How are count-in and loop click times computed? → A: Derived from X 031/032 (integer index from one anchor, never accumulated). With *k* count-in clicks and beat length *T* = 60 / BPM, count-in click *i* (0-based) is at `anchor + i × T`. The first loop's beat 1 is at `anchor + k × T`, and its grid click *j* is at `anchor + k × T + j × T / n`. With *k* = 0 this is exactly the 032 schedule. After Resume the same rule applies from the new anchor, with the remaining count-in clicks first (FR-007, FR-014).
- Q: What does the single dot look like, and what is a "pulse"? → A (default, C motion and tokens, M "pulses on each click"): One dot, the same size and tokens as a beat-row dot. On each count-in click it shows the lit (current-beat, `--color-accent`) state with a short scale/opacity pulse whose duration comes from the motion tokens and never exceeds one beat at 300 BPM (200 ms). Under `prefers-reduced-motion: reduce` there is no scale or opacity animation: the dot simply switches to the lit state at each click. The dot is decorative (`aria-hidden`); the status line carries the information (FR-009).
- Q: What does the status show before the first count-in click, and when paused before it? → A (default, X `metronome_status_beat_none`): `COUNT IN –/k`. Pausing before click 1 has sounded freezes on `COUNT IN –/k`, and Resume plays click 1 within 50 ms (FR-010, FR-011).
- Q: Is `· SUB n` shown during a count-in? → A (default, M sequence shows `COUNT IN 1/4` with no suffix): No. The count-in status is exactly `COUNT IN n/k`. The `· SUB n` suffix comes back with the first loop's `BEAT 1/N · SUB n` (FR-010).
- Q: Translations? → A (default, standard terms; X keeps `SUB` untranslated but translates `BEAT`): en: Count In, Initial Count In, Repeat Count In, `COUNT IN n/k`. pt-BR: Contagem, Contagem inicial, Contagem de repetição, `CONTAGEM n/k`. es: Cuenta previa, Cuenta inicial, Cuenta de repetición, `CUENTA n/k`. The −/+ buttons are named "Fewer/More initial count-in clicks" and "Fewer/More repeat count-in clicks" (translated) (FR-017).
- Q: Announcements during a count-in? → A (default, X 031 announcement set): Start with a count-in appends ", count in k" ("contagem k" / "cuenta k"). Start without one is unchanged from 032. Pause during a count-in announces "Paused on count-in click n of k" (pt-BR "Pausado na contagem n de k", es "En pausa en la cuenta n de k"), or "Paused before the count-in" for the `–` state. Resumed and Reset are unchanged. Individual clicks are never announced (FR-016).
- Q: Background suspension that skips past the whole count-in? → A: Derived from X 031 (skip forward, no burst). The scheduler continues at the next due grid slot on the combined count-in + loop grid. If that slot is in the first loop, the view switches straight to the dot row and `BEAT n/N · SUB n`. Missed count-in clicks are never replayed (FR-019).
- Q: Can the count-in values be changed while running or paused? → A: Derived from M (settings panel shown before Start) and X (settings only on the settings view). No. The running view shows no count-in controls (FR-005).
- Q: How is it stored for the later remembered-settings slice (005)? → A (default): As three fields on the run settings: `countIn: boolean` (true), `initialCountIn: integer 0–8` (4), `repeatCountIn: integer 0–8` (2), clamped and rounded like `beats`; NaN gives the default. Nothing is persisted in this slice (FR-013).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear a count-in before the first loop (Priority: P1)

A guitarist needs a moment to get their hands on the strings and feel the tempo before the exercise starts. With Count In on (the default), pressing Start Training plays a few accented clicks at the running BPM, then the first loop begins exactly one beat after the last count-in click.

**Why this priority**: The count-in is the feature. Without it the exercise starts with no warning.

**Independent Test**: Keep 85 BPM, 4 beats, 8th Triplets and the defaults (Count In on, Initial Count In 4). Press Start Training and check that four accented clicks sound at 85 BPM with a single pulsing dot and `COUNT IN 1/4` … `4/4`, and that `BEAT 1/4 · SUB 3` begins one beat after the fourth count-in click, with no gap.

**Acceptance Scenarios**:

1. **Given** Count In on, Initial Count In 4 and 85 BPM, **When** the user starts training, **Then** four accented clicks sound one beat apart, the status line reads `COUNT IN 1/4`, `COUNT IN 2/4`, `COUNT IN 3/4`, `COUNT IN 4/4` in turn, and `BEAT 1/4 · SUB 3` begins on the next beat.
2. **Given** a count-in is playing, **Then** the running view shows a single dot instead of the beat dot row, and the dot pulses on each count-in click.
3. **Given** the user prefers reduced motion, **When** a count-in click sounds, **Then** the dot changes state (for example lit for the click) without animated motion.
4. **Given** Initial Count In 0 with Count In on, **When** the user starts training, **Then** the run starts on beat 1 directly, with no count-in clicks and no count-in status.
5. **Given** a count-in has finished, **Then** the dot row returns with the beat count the user chose.

---

### User Story 2 - Turn the count-in on or off and set its length (Priority: P1)

The settings view gains a **Count In** on/off switch (on by default). When on, two rows appear beneath it, **Initial Count In** (0–8 clicks, default 4) and **Repeat Count In** (0–8 clicks, default 2), each with a slider and a −/value/+ pill. Turning the switch off hides both rows and plays no count-in at all.

**Why this priority**: The user must be able to skip the count-in or tune its length; without this the feature would be forced on everyone.

**Independent Test**: Open the tool, confirm the switch is on and both rows show 4 and 2. Move each slider and press −/+ and confirm the value follows within 0–8. Turn the switch off, confirm both rows vanish, press Start Training and confirm the run goes straight to `BEAT 1/4`.

**Acceptance Scenarios**:

1. **Given** the settings view on first open, **Then** Count In is on, Initial Count In shows 4 and Repeat Count In shows 2.
2. **Given** Count In is off, **Then** the two rows are not shown and not reachable by keyboard or screen reader.
3. **Given** Count In is off, **When** the user starts training, **Then** no count-in click sounds and the status line goes straight to `BEAT 1/4`.
4. **Given** a slider or the −/+ buttons, **When** the user changes the value, **Then** the slider and the value stay in sync, and the value cannot go below 0 or above 8 (− is disabled at 0 and + at 8).
5. **Given** the user turns Count In off and back on, **Then** the rows reappear with the values they had before.
6. **Given** a keyboard-only user, **Then** the switch, sliders and −/+ buttons are all operable without a pointer.
7. **Given** a running or paused session, **Then** the count-in controls are not available. They change only on the settings view.

---

### User Story 3 - Pause and resume during a count-in (Priority: P2)

A player who pauses during the count-in and resumes continues from the frozen count-in click. Resuming from Pause never starts a new count-in.

**Why this priority**: It keeps Pause trustworthy. It builds on Story 1.

**Independent Test**: Start with Initial Count In 4, pause after `COUNT IN 2/4`, check that the status stays frozen at `COUNT IN 2/4`, then resume and check that the next click is count-in click 3 and the count-in completes.

**Acceptance Scenarios**:

1. **Given** a count-in paused after click 2 of 4, **Then** the display stays on the single dot and `COUNT IN 2/4`, and no click sounds after the Pause instant.
2. **Given** that paused state, **When** the user resumes, **Then** the next click is count-in click 3 (within 50 ms), then click 4, then the first loop one beat later.
3. **Given** a pause during the first loop (after the count-in), **When** the user resumes, **Then** no count-in plays and the run continues with the next beat.
4. **Given** a running count-in, **When** the user presses Reset, **Then** the tool returns to the settings view with Count In, Initial Count In and Repeat Count In unchanged. Starting again plays a full count-in.

---

### User Story 4 - Keep the Repeat Count In value ready (Priority: P3)

The Repeat Count In value is set and kept now, even though nothing plays it yet. A later slice (alternating loops) will insert that many clicks before each change of loop.

**Why this priority**: It only stores a value, but doing it now means the later slice needs no settings change.

**Independent Test**: Set Repeat Count In to 6, start training and reset; the value still reads 6, and no repeat count-in plays during the run.

**Acceptance Scenarios**:

1. **Given** Repeat Count In set to any value 0–8, **When** the user starts, runs and resets, **Then** the value is unchanged.
2. **Given** a single-loop run, **Then** the Repeat Count In value has no audible or visible effect.

---

### Edge Cases

- Count In on with Initial Count In 0: behaves exactly like Count In off for playback; the rows stay visible.
- Count In off: stored Initial and Repeat values are kept, hidden, and return when the switch is turned on again.
- BPM 30 or 300: count-in clicks follow the running BPM, one per beat, with the same timing accuracy as beat clicks.
- Count-in clicks are all accented, whatever # of Beats is chosen (even when it is 1 or 16).
- Subdivisions: no soft clicks play during the count-in, only the accented count-in click on each beat. Subdivision soft clicks start with the first loop.
- Background suspension: missed clicks are not replayed (as for beat clicks); the count-in continues from the next due click, and the status shows the last count-in click reached. If the next due slot is already in the first loop, the view goes straight to the dot row and `BEAT n/N · SUB n`.
- Mute: the app-wide mute and volume govern count-in clicks, and muting does not pause the run.
- Web Audio unavailable: the run proceeds visually with the existing notice, and the count-in still shows its dot and status.
- Rapid Start, Pause, Resume or Space presses never produce overlapping click streams or a doubled count-in.
- Leaving the tool and reopening it shows the defaults (Count In on, 4, 2).
- Narrow widths (down to 320 CSS px at zoom) and every theme: the switch, rows and `COUNT IN n/N` text must not be cut off or overflow.
- Reading `COUNT IN n/N` with N up to 8 must fit on the status line at every width.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ratios Training settings view MUST show a **Count In** on/off switch, on by default, placed below the # of Beats row and above the Loop 1 dropdown and Start Training. It is a `role="switch"` button with the accessible name "Count In" and `aria-checked` showing its state.
- **FR-002**: When Count In is on, the view MUST show two rows beneath it, **Initial Count In** and **Repeat Count In**, each with a slider and a −/value/+ pill, range 0–8 whole clicks, step 1. Defaults are 4 and 2.
- **FR-003**: When Count In is off, both rows MUST be hidden (not reachable by keyboard or assistive technology) and no count-in MUST play. Their values MUST be kept and restored when the switch is turned on again.
- **FR-004**: The slider and the −/value/+ pill of a row MUST stay in sync, clamp to 0–8, disable − at 0 and + at 8, and expose accessible names ("Initial Count In", "Repeat Count In") and the current value to assistive technology. All targets MUST be at least 24 × 24 CSS px.
- **FR-005**: The controls MUST be changeable only in the settings view, and MUST be fully operable by keyboard with the app's standard focus ring.
- **FR-006**: When Count In is on and Initial Count In is *k* > 0, starting training MUST play *k* count-in clicks at the running BPM, one per beat, before the first loop. Every count-in click MUST use the accent sound, regardless of # of Beats. No subdivision clicks play during a count-in.
- **FR-007**: The first loop MUST begin exactly one beat (60 / BPM seconds) after the last count-in click, with no gap and no overlap, and its beat 1 MUST play on that grid time. The first count-in click MUST sound within 50 ms of Start, as the first beat click does today.
- **FR-008**: When Count In is off, or Initial Count In is 0, starting training MUST go straight to beat 1 with no count-in display, as before this feature.
- **FR-009**: During a count-in the running view MUST replace the dot row with a single dot that pulses on each count-in click (lit accent state plus a token-timed pulse of at most 200 ms). Under reduced motion the dot MUST switch to the lit state on each click with no scale or opacity animation. The dot is `aria-hidden`. After the count-in the dot row MUST return.
- **FR-010**: During a count-in the status line MUST read `COUNT IN n/k`, with *n* going from 1 to *k*, updating when each count-in click's audio time is reached. The text MUST stay real text in the page. Before the first count-in click sounds the status MUST show `COUNT IN –/k`. No `· SUB n` suffix is shown during a count-in. The words `COUNT IN` use the existing translations pattern (English, Portuguese, Spanish).
- **FR-011**: Pause MUST cancel every click not yet sounded and freeze on the last count-in click that sounded (single dot and `COUNT IN n/k`). Resume MUST continue with the next count-in click within 50 ms, then the rest of the count-in, then the first loop one beat later. A pause before click 1 freezes on `COUNT IN –/k` and Resume plays click 1. Resume from a pause after the count-in MUST NOT play a count-in.
- **FR-012**: Reset MUST return to the settings view and keep Count In, Initial Count In and Repeat Count In. Starting again MUST play a full count-in. Reopening the tool MUST show the defaults.
- **FR-013**: The run settings MUST gain `countIn` (boolean, default true), `initialCountIn` and `repeatCountIn` (integers 0–8, defaults 4 and 2, clamped and rounded; NaN gives the default). Repeat Count In MUST be stored with the settings, but it MUST have no effect in this feature, because no run changes loop here. The count-in before a loop change is part of a later slice.
- **FR-014**: Count-in click timing MUST meet the same accuracy as beat clicks: each within 2 ms of its ideal time on the audio clock, with count-in click *i* at `anchor + i × 60/BPM` and the first loop's grid click *j* at `anchor + k × 60/BPM + j × (60/BPM)/n`, from integer indices, with no accumulated drift.
- **FR-015**: The app-wide mute and volume MUST apply to count-in clicks, and muting MUST NOT pause the run.
- **FR-016**: The live-region start announcement MUST mention the count-in when one will play (for example "Started, 85 BPM, 4 beats, 8th Triplets, count in 4", translated). Pause during a count-in MUST announce "Paused on count-in click n of k" (or "Paused before the count-in"), translated. Individual count-in clicks MUST NOT each be announced. Other announcements are unchanged.
- **FR-017**: All new labels and texts (Count In, Initial Count In, Repeat Count In, `COUNT IN`, −/+ names, announcements) MUST be available in English, Portuguese and Spanish, using the terms in Clarifications (pt-BR `CONTAGEM n/k`, es `CUENTA n/k`).
- **FR-018**: The new controls and the single dot MUST follow the app's themes, including high contrast and forced colours, using only design tokens for colour. The settings view and status line MUST not be cut off from 320 to 2560 CSS px wide.
- **FR-019**: Existing behaviour MUST be unchanged: BPM, # of Beats and subdivision ranges and defaults, beat and subdivision click timing, background and hidden-page behaviour, Space and Esc shortcuts, and Pause/Resume/Reset semantics, apart from the count-in phase added before the first loop.

### Key Entities

- **Count-in settings**: Whether Count In is on (default on), Initial Count In (whole clicks 0–8, default 4) and Repeat Count In (whole clicks 0–8, default 2). They are part of the run settings, together with BPM, # of Beats and subdivision.
- **Count-in phase**: The stretch of a run before the first loop, made of *k* accented clicks at the running BPM, each with a position *n* of *k*.
- **Count-in click**: One accented, scheduled sound with an exact time on the audio clock, shown by the single pulsing dot and `COUNT IN n/k`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the defaults (Count In on, Initial Count In 4) at 85 BPM, a user hears exactly four accented clicks with a single pulsing dot and `COUNT IN 1/4` … `4/4`, and `BEAT 1/4 · SUB 3` begins on the next beat in 100% of runs.
- **SC-002**: The gap between the last count-in click and the first loop's beat 1 equals one beat (60 / BPM) within 2 ms, at any BPM from 30 to 300 and any count of 1 to 8 clicks.
- **SC-003**: With Count In off, or with Initial Count In 0, the first beat click sounds within 50 ms of Start with no count-in shown, in 100% of runs.
- **SC-004**: After Pause during a count-in, no click sounds after the Pause instant, and after Resume the count-in finishes with the expected remaining clicks (never a repeated or extra count-in) in 100% of runs.
- **SC-005**: A user can switch the count-in off, or change its length, and start training in under 10 seconds from opening the tool, with keyboard or pointer.
- **SC-006**: The Count In switch, both rows, the single dot and the status line remain fully visible and usable at every width from 320 to 2560 CSS px in every theme, with no accessibility violations on the settings or running view.

## Assumptions

- This builds on the Metronome tool and click engine (031) and subdivisions (032), and changes only what the brief lists. It applies to the Ratios Training view.
- Count-in clicks use the existing accent sound and level; no new sound is introduced.
- Count-in clicks are spaced one beat apart at the running BPM, with no subdivision clicks, as the brief says "a few clicks at the running BPM".
- The count-in phase is not counted as a loop beat: the dot row and `BEAT n/N` start only when the first loop starts.
- Settings are not remembered across reloads in this slice (a later slice, 008-ratios-training/005, adds that); they reset to the defaults on reopening, like BPM and # of Beats.
- Repeat Count In is out of scope for playback: the repeat count-in between loops is 008-ratios-training/004, and Speed Training's count-in is 009-more-modes/002.
- The switch is shown as an on/off switch, with the same on-state accent colour as other controls, via the theme tokens.
