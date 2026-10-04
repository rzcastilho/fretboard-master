# Feature Specification: Remembered Preferences, No Account

**Feature Branch**: `feature/010-remembered-preferences`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/003-your-instrument/002-remembered-preferences.md (id 002, remembered-preferences)." Source sections: FR-9.1–9.6 (Area 9), FR-1.4 (Area 1), EC-9.1–9.6, DM-14, INT-4, ARCH-8, NFR-5, Assumption A-4.

## Clarifications

### Session 2026-10-03

Derived from a source (cited) or assumed default (marked **Default**, with rationale). No material question remains open. Where a later session contradicts an earlier bullet, the later one wins and the requirement text below is aligned to it.

- Q: Which items are remembered in this slice? → A: The FR-9.1/DM-14 items whose controls exist today: tuning preset, fret count, muted, volume, last tool, and label type for Notes and Triads. Custom tuning, string count, handedness, orientation, tempo, one-time notices, language, notation, accidental preference, and theme join the same record in the slices that introduce them, without discarding existing data. See the clarify review session below.
- Q: Are the musical states of the tools remembered? → A: No (FR-9.2, A-4). Notes, root, key, quality, inversion, string set, shape in focus, layers, region, and comparison always start in each tool's initial state.
- Q: What happens when a stored value is invalid? → A: Each item is checked independently against its allowed set or range. Valid items are kept; invalid ones take the default; nothing is shown (FR-9.6, EC-9.2). An invalid item never invalidates its neighbours. Tuning and fret count are validated independently. (Custom-tuning and string-count consistency rules arrive with 003-your-instrument/003–004.)
- Q: What does a record from a newer or unknown format do? → A: **Default**: handled like unreadable data: valid recognizable items are kept, the rest default, no notice. The next write replaces it with a version-1 record (see the clarify review session).
- Q: When is stored data read? → A: Once, at startup, before the first screen is shown. Later changes made in another tab are not adopted during use; they are picked up at the next opening (EC-9.4).
- Q: When is data written? → A: On every change of a remembered item, without blocking or delaying the interface. A failed write (storage full, blocked) is silent; the in-session settings keep working until the session ends (EC-9.3).
- Q: What does the "not remembered" notice say and when is it shown? → A: **Default**: "Preferences won't be remembered on this device." (catalog string, one line). Shown at most once per session, when storage is detected unavailable at startup (FR-9.5, EC-9.1, EC-9.5). It is non-blocking, dismissible, and not shown when storage works. A write failure alone (storage full) shows no notice.
- Q: Does Private browsing count as unavailable? → A: Behaviour follows what the browser does (EC-9.5): if storage is blocked, the not-remembered notice applies; if storage works but is discarded at session end, nothing special happens.
- Q: Does "Continue" change the home order? → A: No. The tool cards (Notes and Triads today) keep their order; the card of the last tool used shows a "Continue" mark (FR-1.4). With no last tool recorded (first visit, erased, or invalid value), no card has the mark. The mark is text, not color alone.
- Q: When is "last tool used" updated? → A: **Default**: when a tool screen is opened (Notes, Triads; CAGED once it exists), including through in-app carry navigation and, once 006-sharing ships, through a shared link. Visiting Home, About, or the not-found page does not change it.
- Q: Does opening a link change preferences? → A: **Default**: a link's own values (tool, instrument, label type) apply to that session as FR-10.4 says, but do not overwrite the person's stored preferences, except "last tool used".
- Q: How does Erase work? → A: On the About page, **Erase my preferences** asks for confirmation in one line, inline (no blocking dialog; Constitution VII). On confirm: everything the app stored on the device is removed, instrument/sound/label types return to defaults (and one-time notices become eligible again, once any exist), and the app returns to the home screen with no "Continue" mark. On cancel nothing changes. Erasing does not trigger the not-remembered notice and stored data stays erased until the next change is made.
- Q: Does Erase also stop sound? → A: **Default**: yes; restoring sound defaults (volume, mute) takes effect immediately, and any playing note stops.
- Q: Is anything sent anywhere? → A: Never (FR-9.3, NFR-5). No preference, including last tool, is transmitted; there is no account or identifier.

### Session 2026-10-03 (clarify review)

Reconciles the spec with what the codebase exposes today (`src/lib/state/instrument-config.ts`, `src/lib/state/playback.svelte.ts`, `src/lib/shell/tools.ts`, `src/lib/state/listen.ts`) and with the later slices in `specs/autonomous/breakdown/`. Supersedes any earlier bullet it contradicts.

- Q: Which items does this slice actually store, given several settings don't exist yet? → A: Only items a user can change in the app today: **tuning preset** (`AF-1`…`AF-11`, which also fixes string count at 6), **fret count** (integer 12–24), **sound muted**, **volume**, **last tool**, and **label type for Notes and Triads**. Items whose controls arrive later join the same record **in the slice that adds the control**, without discarding existing data. Same pattern the breakdown sets for language/theme (Constitution X, YAGNI): custom tuning → 003-your-instrument/003, string count 7 → 003/004, handedness and string orientation → 003/005 ("both are stored as preferences"), tempo (slow/medium/fast) → 004-caged/006 ("stored as a preference"), CAGED last tool and label type → 004-caged, one-time notices list → the first slice that adds a one-time notice (FR-8.9 explanation). Today the app has no one-time notice and listen tempo is the fixed constant `LISTEN_BPM`, so neither is stored yet. Testable: the record written by this slice holds exactly `version`, `tuning`, `frets`, `muted`, `volume`, `lastTool`, `labels.notes`, `labels.triads`.
- Q: How is volume stored when the control works on 0–100 in steps of 5 (default 80) and DM-14 says 0–1? → A: **Default**: stored as DM-14 says, a number from 0 to 1 (control value ÷ 100; default 0.8). On load, a finite number in [0, 1] is accepted and mapped to the nearest control step (× 100, rounded to the nearest 5). Anything else (NaN, negative, > 1, text, `null`) → 0.8. Follows the data model; the mapping is lossless for every value the control can produce.
- Q: What are the exact defaults? → A: From the current code: tuning `AF-1` (Standard, 6 strings), 22 frets (`DEFAULT_FRETS`), not muted, volume 0.8, no last tool, Notes label type `name`, Triads label type `interval`.
- Q: What are the exact allowed sets? → A: Tuning: one of the 11 preset ids (`isTuningId`). Fret count: integer 12 ≤ n ≤ 24, no clamping (13.5 or 99 → 22). Muted: boolean only (`"true"`, 0, 1 → default `false`). Last tool: `notes` or `triads` (anything else → none). Notes label type: `name`, `octave`, `none`. Triads label type: `interval`, `name`. Version: positive integer; this slice writes `1`.
- Q: Tuning and fret count are validated as a pair in the panel; are they independent in storage? → A: **Default**: independent. A valid tuning with an invalid fret count keeps the tuning and uses 22 frets, and the reverse. No notice is shown (EC-9.2: no notice), including no "instrument adjusted" notice.
- Q: How do the remembered label type and the tool's "initial state" combine? → A: **Default**: a tool opens in its initial view state (`initialNotesView` / `initialTriadsView`) with only `labelType` replaced by the stored preference. Changing the label type in a tool updates the preference. Notes "hide names" (hidden mode, DM-15) is musical/view state, not a label type: it is not remembered and starts off. Context carried between tools (008 linked tools) does not change the label type: the target tool uses its stored label type.
- Q: Share links don't exist yet (006-sharing); what do the link clauses mean now? → A: They don't apply yet; 006-sharing applies them. This slice keeps the rule as a constraint on that slice: a link's values apply to that session only and never overwrite stored instrument, sound, or label preferences. In-app context carry (008) is not a link: it changes no preference. Opening a tool through a carry action does record that tool as last used (it is opening a tool).
- Q: How many home cards are there? → A: The cards that exist: Notes and Triads today (`TOOLS`); CAGED joins when its slice ships. "Three cards" in the source means the full product. The order stays `TOOLS` order whatever the last tool.
- Q: What does a newer or unknown format version do on the next write? → A: **Default** (replaces the earlier "not overwritten destructively" wording, which wasn't testable): valid recognizable items are kept and the next write replaces the whole record with a version-1 record of the current values. Unknown fields are dropped. A record with no version, or a version that isn't a positive integer, is read the same way. Records from earlier versions don't exist; this is the first persisted format.
- Q: How is "storage unavailable" detected? → A: **Default**: at startup, one guarded write + read + remove of a probe key. Any thrown exception, or a read-back mismatch, means unavailable for the whole session (EC-9.1). The probe never runs again in the session, even if storage starts working later.
- Q: Where does the not-remembered notice appear? → A: **Default**: at shell level, on whichever screen opens first (Home, a tool, or About), in the existing `Notice` component (non-blocking, dismissible, one line, not error red). It is dismissed by its button or cleared by navigating; it is never shown again that session.
- Q: When exactly is data read relative to rendering, given pages are prerendered? → A: **Default**: the record is read and validated once, synchronously, when the client app starts and before hydration, so the first interactive frame already shows stored values. The prerendered HTML before hydration may briefly show defaults, which is acceptable. Testable: once the page is interactive, no control or summary shows a default where a valid stored value exists, and no later screen re-reads storage.
- Q: Which storage key, and what does Erase remove? → A: **Default**: one `localStorage` key, `fretboard-master:prefs`, holds the JSON record; the availability probe uses `fretboard-master:probe` and removes it right away. Erase removes every key starting with `fretboard-master:`. Testable: after Erase, no key with that prefix remains.
- Q: How large a stored value is accepted? → A: **Default**: a raw value longer than 16 384 characters is discarded without parsing (all defaults, no notice). The real record is under 300 characters.
- Q: What happens to focus around Erase? → A: **Default**: choosing **Erase my preferences** replaces it inline with a one-line question ("Erase all preferences on this device?") plus **Erase** and **Cancel** buttons, and focus moves to **Cancel** (the safe choice). Escape or Cancel closes it and returns focus to **Erase my preferences**. Confirming navigates to Home and focus goes to the home heading (`h1`, existing `tabindex="-1"`). All three strings are catalog messages.
- Q: Are writes debounced? → A: **Default**: no. Each committed change (tuning/frets applied from the panel, mute toggle, volume step, label type change, tool open) does one synchronous write of the small record inside a guarded try/catch, with an empty catch commented as fire-and-forget (constitution Code quality). Pending, unapplied panel edits are not written.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Come back and find my instrument and sound as I left them (Priority: P1)

A guitarist who set Drop D tuning and muted sound closes the app and returns the next day. The instrument is still Drop D, sound is still muted, and their last tool's card on the home screen says "Continue". They open it and the tool starts in its initial state, not where they left off.

**Why this priority**: This is the whole value of the slice: no re-configuring every visit, with no account.

**Independent Test**: Set Drop D, mute sound, open a tool, reload the app (new session), and check the instrument summary, mute state, "Continue" card, and the tool's initial state.

**Acceptance Scenarios**:

1. **Given** a user who set Drop D and muted sound and later reloads, **When** the home screen appears, **Then** the instrument summary shows Drop D, sound is muted, and no setup is needed.
2. **Given** the user last used Triads, **When** the home screen appears, **Then** the Triads card shows "Continue", and the Notes and Triads cards remain in their usual order.
3. **Given** the user had selected a root, quality, and layers before leaving, **When** they open that tool again, **Then** it opens in its initial state.
4. **Given** the user changes fret count, volume, the Notes label type, or the Triads label type, **When** they reload, **Then** each is restored (handedness, orientation, and tempo join through their own slices).
5. **Given** a first visit with nothing stored, **When** the home screen appears, **Then** defaults apply and no card shows "Continue".

---

### User Story 2 - Works when storage is blocked, damaged, or full (Priority: P1)

A user whose browser blocks storage (including some private modes), or whose stored data is damaged, uses the app without errors. If storage is blocked, one line says preferences won't be remembered.

**Why this priority**: Stored data is untrusted input and the app must never be blank or broken because of it (Constitution IX, X).

**Independent Test**: Load with storage blocked; load with a record having valid tuning and corrupt volume; load with garbage text; load with an unknown newer format; simulate full storage on write.

**Acceptance Scenarios**:

1. **Given** storage is blocked, **When** the app starts, **Then** it works with defaults and shows the not-remembered notice once per session, and not again on navigation.
2. **Given** a stored record with a valid tuning and an invalid volume, **When** the app starts, **Then** the tuning is kept, volume is the default, and no error is shown.
3. **Given** unreadable or non-record stored text, **When** the app starts, **Then** all defaults apply, no error or notice appears, and the app is fully usable.
4. **Given** a record in an unknown or older format version, **When** the app starts, **Then** recognizable valid items are kept, the rest default, and no error is shown.
5. **Given** storage is full, **When** the user changes a setting, **Then** nothing visible fails and the setting holds until the session ends.
6. **Given** a stored value outside its allowed set or range (for example, volume 3, fret count 99, fret count 13.5, tuning `AF-99`, muted `"true"`, last tool `caged` or `home`, Triads label `octave`), **When** the app starts, **Then** that item alone uses its default and the other items are kept.
7. **Given** a stored value longer than 16 384 characters, **When** the app starts, **Then** all defaults apply, without parsing and with no notice.

---

### User Story 3 - Erase my preferences (Priority: P2)

A user on a shared device opens About, chooses **Erase my preferences**, confirms in one line, and the app clears everything it stored, restores defaults, and returns to the home screen.

**Why this priority**: Required for user control and privacy (Constitution II, FR-9.4), but secondary to remembering.

**Independent Test**: Set non-default preferences, erase from About, confirm, and verify defaults, no "Continue", home screen shown, and storage empty of app data.

**Acceptance Scenarios**:

1. **Given** non-default preferences exist, **When** the user chooses Erase and confirms, **Then** defaults return and the home screen opens with no "Continue" mark.
2. **Given** the confirmation is showing, **When** the user cancels, **Then** nothing changes.
3. **Given** erase was confirmed, **When** the user reloads without changing anything, **Then** defaults still apply.
4. **Given** the confirmation, **When** operated by keyboard only, **Then** it can be confirmed or cancelled and focus is handled predictably.

---

### User Story 4 - Two tabs stay predictable (Priority: P3)

A user with two tabs open changes settings in both. The last write wins, and the other tab does not change during use; it adopts the stored values at its next opening.

**Why this priority**: Edge behavior; prevents surprising jumps while someone is using the fretboard.

**Independent Test**: Open two sessions, change a setting in each, verify neither changes live, and a new opening shows the last written value.

**Acceptance Scenarios**:

1. **Given** two tabs with different settings, **When** one changes a setting, **Then** the other tab is unchanged until reopened.
2. **Given** both tabs wrote values, **When** a new tab opens, **Then** it shows the most recent write.

### Edge Cases

- Storage blocked at startup but works later: the session continues on defaults; the notice has already been shown once.
- Storage works at startup but a write is rejected: silent; in-session state is intact.
- Stored tuning that isn't one of the 11 preset ids (including custom-tuning-shaped objects, before 003-your-instrument/003 ships): tuning falls back to `AF-1`; the fret count is kept if valid.
- Stored last tool is not one of the existing tools (`notes`, `triads` today): treated as none, and no card shows "Continue".
- Stored fields this version doesn't know (for example, a `notices`, `handedness`, or `tempo` field from a newer version): ignored on read and dropped on the next write.
- Stored values of the wrong type (text where a number is expected, `null`, arrays): treated as invalid for that item only.
- Very large stored text: rejected without freezing the interface; defaults apply.
- Preferences stored by an earlier slice's session state (in-memory only) do not exist; no migration needed.
- Stored text containing markup or script: never rendered as HTML or executed.
- Erase when storage is unavailable: defaults are restored in-session and the user returns home; no error.
- The not-remembered notice is dismissed: it does not reappear until the next session.
- CAGED doesn't exist as a tool yet: `caged` is not a valid last tool and has no label preference until its slice adds them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST remember on this device, with no account: the tuning preset (one of `AF-1`…`AF-11`), the fret count (integer 12–24), sound muted (boolean), volume (stored 0–1, mapped to the control's 0–100 step-5 scale), last tool used (`notes`, `triads`, or none), and the label type for Notes (`name`/`octave`/`none`) and Triads (`interval`/`name`). Custom tuning, string count, handedness, string orientation, tempo, one-time notices, language, notation, accidental preference, and theme MUST be added to this same record by the slices that introduce their controls.
- **FR-002**: The app MUST NOT remember the musical state of the tools (notes, root, key, quality, inversion, string set, shape in focus, layers, region, comparison); every visit MUST start each tool in its initial state, except when opened by link.
- **FR-003**: Preferences MUST stay on the device and MUST NOT be sent anywhere.
- **FR-004**: The stored record MUST carry an integer format version (this slice writes `1`) so new items can be added later without breaking older records, and records written by earlier versions MUST keep loading. Records with a missing, unknown, or newer version MUST be read item by item (FR-006) and replaced by a current-version record on the next write.
- **FR-005**: Stored data MUST be read once, synchronously, when the client app starts and before hydration (prerendered HTML may briefly show defaults), and MUST NOT be re-read during the session. It is untrusted: every item MUST be validated by a Valibot schema against its allowed set or range, and raw values over 16 384 characters MUST be discarded unparsed.
- **FR-006**: Unreadable, partly invalid, or unknown-format data MUST keep the valid items, use defaults for the rest, and show no error.
- **FR-007**: Reading stored data MUST NOT throw into the interface or leave any screen blank.
- **FR-008**: Stored content MUST NOT be rendered as HTML or executed.
- **FR-009**: Every change of a remembered item MUST be written immediately without blocking or delaying the interface.
- **FR-010**: A failed write (storage full or rejected) MUST be silent, and settings MUST keep working for the rest of the session.
- **FR-011**: If storage is unavailable or blocked (determined once at startup by a guarded probe write/read/remove of `fretboard-master:probe`), the app MUST work normally on defaults and MUST state once per session, in the existing non-blocking dismissible `Notice` on the first screen opened, the catalog text "Preferences won't be remembered on this device."
- **FR-012**: The not-remembered notice MUST NOT appear when storage works, and MUST NOT appear more than once per session.
- **FR-013**: When a last tool is recorded, its home card MUST show "Continue" (as text); every existing tool card (Notes and Triads today; CAGED when it ships) MUST stay available and in `TOOLS` order; with no valid last tool, no card shows the mark.
- **FR-014**: The last tool MUST be recorded when a tool screen is opened by any route (home card, navigation, carry action, direct address); visiting Home, About, or the not-found page MUST NOT change it.
- **FR-015**: With two tabs open, the last write MUST win; a tab MUST NOT change its settings during use because of another tab's write and MUST adopt stored values at its next opening.
- **FR-016**: The About page MUST offer **Erase my preferences**, which asks for a one-line inline confirmation (question + **Erase** + **Cancel**) without a blocking dialog. Focus MUST move to **Cancel** when the confirmation opens. Cancel or Escape MUST close it and return focus to **Erase my preferences**.
- **FR-017**: On confirmation, the app MUST remove every `localStorage` key starting with `fretboard-master:`, restore all defaults at once (including sound: unmuted, volume 80, and stop any playing note), and navigate to the home screen with focus on its heading and no "Continue" mark. On cancel nothing MUST change. Erase MUST NOT write a fresh record; storage stays empty until the next change.
- **FR-018**: The remembered items' defaults MUST be: tuning `AF-1` (Standard), 22 frets, not muted, volume 0.8 (control 80), no last tool, Notes label type `name`, Triads label type `interval`.
- **FR-019**: In-app context carry between tools MUST NOT change any stored preference except last tool. When shared links arrive (006-sharing), opening one MUST NOT overwrite the stored instrument, sound, or label preferences.
- **FR-020**: The notice, confirmation, "Continue" mark, and Erase command text MUST live in the message catalog, be keyboard-operable, meet WCAG 2.2 AA, not rely on color alone, and fit 320 to 2560 CSS px and 200% text zoom.
- **FR-021**: The app MUST NOT introduce accounts, identifiers, cookies, or any network request for preferences.

### Key Entities

- **Preferences record**: the single per-device, per-browser JSON record under `localStorage` key `fretboard-master:prefs`. Attributes in this slice: `version` (1), `tuning` (preset id), `frets` (12–24), `muted` (boolean), `volume` (0–1), `lastTool` (`notes` | `triads` | absent), `labels.notes` (`name` | `octave` | `none`), `labels.triads` (`interval` | `name`). Written on the first change (not on first visit), updated on every change, erased by the user or by browser data clearing. Custom tuning, string count, handedness, orientation, tempo, notices shown, language, notation, accidental preference, and theme join it in later slices.
- **Instrument configuration**: today `InstrumentConfig` = tuning preset id + fret count (6 strings, right-handed, highest string on top implied). Extended by 003-your-instrument/003–005.
- **Not-remembered notice**: a per-session, one-time message when storage is unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning user finds their instrument, sound, and label settings restored in 100% of returns where storage works, with zero setup actions.
- **SC-002**: In 100% of tested corrupt, partial, out-of-range, or unknown-format records, the app starts, keeps every valid item, and shows no error.
- **SC-003**: With storage blocked, the app is fully usable and the notice appears exactly once per session.
- **SC-004**: A user can erase all stored preferences in two actions (choose, confirm) from the About page and ends on the home screen with defaults.
- **SC-005**: No tool ever opens with remembered musical state; each opens in its initial state in 100% of visits.
- **SC-006**: Writing a preference never visibly delays a control: the control change to fretboard update stays within the existing 100 ms budget.
- **SC-007**: No preference or identifier is transmitted anywhere; zero network requests are made for preferences.
- **SC-008**: Home screen usable time stays within the existing 3 s budget with stored preferences present.

## Assumptions

- Language, notation, accidental preference, and theme features do not exist yet; their remembered values are added by those slices, using the same versioned record.
- The CAGED tool doesn't exist yet; its label preference and "Continue" card apply once it exists, and unknown tool names are treated as invalid.
- Instrument panel (preset tunings, fret count), mute, and volume controls from earlier slices exist and expose the values to be remembered. No tempo, handedness, orientation, custom-tuning, or one-time-notice controls exist yet (verified in `src/lib`).
- Defaults are those shown by the app on a first visit today (FR-018 lists them).
- No sync across devices, cloud backup, or remembered study state is in scope (scope boundary).
- Anonymous measurement (Q-1) is out of scope and never carries preferences.
