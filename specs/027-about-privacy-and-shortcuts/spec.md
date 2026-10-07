# Feature Specification: About Page, Privacy, and Keyboard Shortcuts

**Feature Branch**: `feature/027-about-privacy-and-shortcuts`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/007-comfort-and-launch-readiness/004-about-privacy-and-shortcuts.md (id 004, about-privacy-and-shortcuts)."

## Clarifications

### Session 2026-10-07

Sources: constitution v1.11.0; breakdown `007-comfort-and-launch-readiness/004`; macro-spec FR-1.10, FR-9.4, design §5.4, NFR-5, NFR-6, NFR-8, INT-2, Q-1/Q-2/Q-3/Q-11, EC-8.3; existing code (`src/routes/about`, `src/lib/prefs/{schema,storage}.ts`, `src/lib/state/{triads-view,caged-view,caged-focus,notation.svelte}.ts`, `src/lib/tools/ChoiceGroup.svelte`, `svelte.config.js` CSP, `static/_headers`, `vite.config.ts` missing-text wiring). "Derived" = settled by a source; "Default" = assumed conventional choice.

**Shortcut keys and safety**

- Q: Which keys? → A (default; spec 12 §5.4 names the actions, not keys): single printable characters, the same in every language, matched on the produced character (`KeyboardEvent.key`, letters case-insensitive), so they follow the user's keyboard layout: **P** = play / Listen; **.** (period) = next; **,** (comma) = previous; **L** = switch label type; **N** = switch notation. These characters are unshifted keys on US, ABNT2 (pt-BR) and Spanish layouts; Shift is tolerated so layouts that need it (e.g. AZERTY period) still work. Arrow keys, Space, Enter, Escape, Tab, Home/End, PageUp/PageDown and function keys are never shortcuts (they already belong to the fretboard grid, radio groups, buttons and page scroll).
- Q: What counts as a browser / screen-reader clash, testably? → A (derived, FR-009 + Principle V; default for the exact set): a shortcut fires only when **none** of Ctrl, Meta (Cmd), Alt or AltGr is held (AltGr reports as Ctrl+Alt and is therefore ignored), when `event.repeat` is false, when `event.defaultPrevented` is false, and when the event target is not an editable or type-ahead field (`input` other than checkbox/radio/range/button types, `textarea`, `select`, or `contenteditable`). Screen readers in browse/virtual mode consume single-letter keys before the page sees them, so these keys reach the page only in focus/forms mode, where the reader expects the page to handle them.
- Q: WCAG 2.2 AA 2.1.4 (Character Key Shortcuts) requires single-key shortcuts to be turn-off-able. How? → A (derived, constitution Principle V; default mechanism — the GitHub/Gmail convention): About has a **Keyboard shortcuts** on/off switch next to the shortcut list, **on** by default. It is remembered as an additive optional preferences field `shortcuts` (stored only when `false`, picklist/boolean with fallback to `true`, `PREFS_VERSION` unchanged — same pattern as `tempo`, `theme`) and is reset by **Erase my preferences**. While off, no shortcut fires anywhere.
- Q: Key repeat? → A (default): events with `repeat === true` are ignored; holding a key performs the action once.
- Q: Are shortcuts listed only on About? → A (derived, spec 12 §5.4: "The list of shortcuts is on the About page"; default for discoverability): the full list is on About; additionally each matching on-screen control (Listen, Next/Previous shape, inversion group, label-type group, notation toggle) carries `aria-keyshortcuts` with its key while shortcuts are on. No help overlay or `?` key (YAGNI, Principle VII forbids overlay tutorials).
- Q: Touch / phone? → A (default): no visual change on phone; shortcuts work wherever a hardware keyboard sends key events. The About shortcut list is shown on every device (one page, no device sniffing).

**Shortcut semantics per screen** (every shortcut calls the same handler as the on-screen control and is a no-op exactly when that control is absent or disabled — FR-010/FR-011)

- Q: Play? → A (derived, FR-5.17, slice 019): Triads → **Listen** (Isolated: the shape; Full neck: inversions in sequence; All notes: three notes once). With Compare on, it triggers the main Listen, not Listen comparison. CAGED → **Listen** (disabled with no occurrence drawn → no-op). Pressed during a sequence it restarts from the beginning, like the button (FR-7.9, no stacked sounds). The keypress counts as the user gesture that unlocks audio. Muted → same as the button (no sound, pulses as the button does). Notes → **Listen** of the Notes actions (disabled → no-op). Home, About → no-op (no Listen exists there). *(Corrected during planning, research R-14: Notes has a Listen button, so FR-010/FR-011 require `P` to mirror it.)*
- Q: Next / previous in Triads — wrap? → A (default; the on-screen inversion control is a radio group whose arrow keys wrap, `ChoiceGroup.svelte`): **.** selects the next inversion root → 1st → 2nd → root; **,** the reverse; it wraps. Disabled inversion control (All notes view, FR-5.10) → no-op. Result is identical to choosing that inversion in the control (same view state, motion, announcement, link).
- Q: Next / previous in CAGED — wrap? → A (derived, slice 016 clarifications): same as **Next shape** / **Previous shape**: neighbors in start-fret order, **no wrap**; at the first/last occurrence or with no shape in focus (buttons disabled) → no-op. The connection-ring transition window applies as for the buttons.
- Q: Switch label type? → A (derived, existing per-tool label types and prefs `labels.*`): cycles the current tool's label options in control order — Notes: name → octave → none → name; Triads and CAGED: interval ↔ name — and is remembered per tool exactly like the control. Home and About → no-op.
- Q: Switch notation? → A (derived, `notation.choose`, slice 021): toggles the effective notation letters ↔ solfège and remembers it as an explicit choice; accidental policy is unchanged. Works on every screen (including Home and About), since notation is app-wide.
- Q: Feedback? → A (default): a shortcut produces exactly the feedback the matching control produces (view change, existing polite announcement, remembered preference). Focus does not move. No extra notice.

**About page content and layout**

- Q: Section order? → A (default; source order in FR-1.10, with erase grouped with the data it erases): `h1` page title; then `h2` sections in order: **What this app is** (intro), **Marker legend**, **Keyboard shortcuts** (list + on/off switch), **Privacy** (policy text followed by **Erase my preferences**), **Version**. The Privacy section has a stable fragment id `privacy` so `/about#privacy` lands on it.
- Q: Legend content? → A (derived, FR-1.10, Principle VII): exactly three entries — root (filled rounded square), third (filled circle), fifth (filled diamond) — each drawn with the existing shared marker component (`MarkerSample`/legend code) plus its localized function name. Scale degree is not listed.
- Q: Version format? → A (derived, existing `about_version` + `__APP_VERSION__`): "Version X.Y.Z" from `package.json`, localized label, unchanged mechanism.
- Q: Product name in texts? → A (derived, Q-2 unresolved): the current catalog name "Fretboard Master". No owner, maintainer or contact details (Q-3 unresolved).

**Privacy text**

- Q: Is anything measured? → A (derived, existing code: no measurement or error reporting exists; INT-2/NFR-8.1 are conditional on Q-1, which is not adopted): the policy states plainly that **nothing is measured and no usage or error data is sent**. It does not mention a hypothetical future measurement. Adopting Q-1 later requires updating this text in that slice.
- Q: What exactly does "what's stored on this device" list? → A (derived, `Preferences` in `src/lib/prefs/schema.ts`; only storage used is `localStorage` key `fretboard-master:prefs`, no cookies, sessionStorage or IndexedDB): the policy names the categories in plain words — language and note notation; instrument (strings, tuning including a custom one, number of frets, left-handed/orientation); sound on/off, volume and tempo; theme; label choices and the last tool used; whether one-time hints were shown; the keyboard-shortcuts switch. It states: no cookies; it never leaves the device; clearing browser data (or **Erase my preferences**) erases it; if the browser blocks storage, nothing is kept and the app still works.
- Q: Must the policy mention the hosting provider and share links? → A (default; GDPR/LGPD transparency convention, NFR-5.4 "plain language"): yes, one sentence each — the service that delivers the app's files receives the technical data any website receives (such as the IP address) only to deliver them, and the app does not use it to identify anyone; a share link contains only the view settings (tool, notes, instrument), no personal data, and goes only to whoever the user chooses to send it to.
- Q: Required statements, testably? → A (derived, FR-005, NFR-5, constitution II): the policy includes, in every language: (1) no personal data is collected; no account, sign-up, email, name or identifier; (2) what is stored and where (above); (3) clearing browser data / Erase removes it; (4) nothing is measured; (5) no advertising, no trackers, no third-party content; (6) no device permissions are requested; (7) hosting and share-link sentences; (8) suitable for all ages — no contact between users, no user content.
- Q: Consent / cookie banner? → A (derived, scope boundary + Q-11): none. Local storage holds only settings the user chose (strictly functional). The wording is subject to the constitution's pre-launch legal review gate (Q-11); that gate, not this slice, decides any change.
- Q: "General-audience level, one scrolling page" (SC-006) testably? → A (default): the privacy text is short sentences in a list or short paragraphs, no legal citations or jargon (no "data controller", "processing", "lawful basis"), ≤ 220 words in English and ≤ 280 words in pt-BR and es (unit test on the catalog strings).

**Translation completeness**

- Q: Missing translation "fails the build"? → A (derived, EC-8.3 keeps English fallback at runtime; default for the gate): runtime behavior is unchanged (English fallback + report). The merge gate is a unit test that fails when any About key (intro, legend, shortcut, switch, privacy, version, erase) is missing or empty in pt-BR or es, using the existing `findMissingKeys`.

**Privacy and security enforcement (FR-019)**

- Q: How is "no third-party request" checked? → A (default): a Playwright test in a fresh browser context visits `/`, `/notes`, `/triads`, `/caged`, `/about`, exercises Listen, Share and the instrument and language panels, and records every request; all must be same-origin (`data:`/`blob:` excluded). The existing CSP (`default-src 'self'`, `script-src 'self'`, `connect-src 'self'`) stays as is and a test asserts no external origin appears in it.
- Q: How are "no permission prompts" checked? → A (default): the same test installs init-script spies on `navigator.mediaDevices.getUserMedia`, `navigator.geolocation.getCurrentPosition`/`watchPosition`, `Notification.requestPermission`, `navigator.permissions.query` and `navigator.requestMIDIAccess`, and asserts none is called; Playwright's `dialog` event must not fire. Clipboard writes on Share are user-initiated and do not prompt; `_headers` `Permissions-Policy` stays as is.
- Q: How is "no identifier" checked? → A (default): a unit test asserts the stored preferences record contains only known `Preferences` fields (no id/uuid/timestamp-like field); the e2e test asserts no `input[type=email|password|tel]`, no cookies set (`context.cookies()` empty) and only `fretboard-master:`-prefixed `localStorage` keys after the full pass.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read what the app does with my data (Priority: P1)

A user, parent or teacher opens About and reads, in plain words and in their own language, what the app is, what it stores, and what it does not collect. They can see the marker legend, the keyboard shortcut list, and the app version on the same page.

**Why this priority**: The public launch depends on users and parents trusting the app. Privacy text is the launch blocker; the other About content is small and rides with it.

**Independent Test**: Open About in each of the three languages. Confirm the intro, marker legend (root, third, fifth), shortcut list, version, and privacy text are all present and in that language.

**Acceptance Scenarios**:

1. **Given** the app language is Spanish, **When** the user opens About, **Then** the intro, legend, shortcut list, version, and privacy text all appear in Spanish.
2. **Given** the user opens About in any supported language, **When** they read the privacy text, **Then** it contains statements (1)–(8) listed in Clarifications → Privacy text, including that nothing is measured.
3. **Given** the user has saved preferences, **When** they activate **Erase my preferences** on About, **Then** their preferences are erased as before.
4. **Given** the user switches language while on About, **When** the language changes, **Then** all About content updates without losing the page.

---

### User Story 2 - Use keyboard shortcuts for frequent actions (Priority: P2)

A desktop user triggers common actions from the keyboard: play or Listen, next and previous (shape in CAGED, inversion in Triads), switch label type, and switch notation.

**Why this priority**: A comfort feature for desktop users. Useful, but the launch does not depend on it.

**Independent Test**: On desktop in Triads and CAGED, press each shortcut and confirm the action happens. Confirm shortcuts do nothing while typing in a text field and do not override browser or screen-reader key combinations.

**Acceptance Scenarios**:

1. **Given** the user is in Triads with a shape shown, **When** they press **P**, **Then** the current shape plays exactly as with **Listen**.
2. **Given** the user is in Triads, **When** they press **.**, **Then** the next inversion is selected; **,** selects the previous inversion.
3. **Given** the user is in CAGED with a shape in focus, **When** they press **.** or **,**, **Then** focus moves to the next or previous shape exactly as with **Next shape** / **Previous shape**.
4. **Given** a tool screen, **When** the user presses **L** or **N**, **Then** the label type or notation switches and the choice is remembered like other preferences.
5. **Given** focus is in a text, number or select field, or the user holds Ctrl, Cmd (Meta), Alt or AltGr, **When** they press a shortcut key, **Then** the app shortcut does not fire and the browser's own behavior is untouched.
6. **Given** a screen reader is running, **When** the user uses its navigation keys, **Then** no app shortcut intercepts them (arrows, Tab, Enter, Space, Escape, Home/End, PageUp/PageDown, function keys and modifier combinations are never shortcuts).
7. **Given** the user turns **Keyboard shortcuts** off on About, **When** they press any shortcut key on any screen, **Then** nothing happens; after reload it stays off; **Erase my preferences** turns it back on.
8. **Given** the user is in Triads on the 2nd inversion, **When** they press **.**, **Then** root position is selected (wrap); **Given** CAGED with the last occurrence in focus, **When** they press **.**, **Then** nothing changes (no wrap, like the disabled Next shape button).
9. **Given** the user is in Notes, **When** they press **L**, **Then** the label type cycles name → octave → none → name and is remembered; **When** they press **N** on any screen, **Then** notation toggles letters ↔ solfège and is remembered.

---

### User Story 3 - Trust the app on first load (Priority: P1)

A user opens the app in a fresh browser profile. It asks for no device permissions, shows no prompts, and talks only to its own origin.

**Why this priority**: This is the verifiable proof of the privacy promise and suitability for minors.

**Independent Test**: Load every screen in a fresh profile and record permission prompts and network requests.

**Acceptance Scenarios**:

1. **Given** a fresh browser profile, **When** the user loads and uses every screen, **Then** no permission prompt appears (microphone, camera, location, notifications).
2. **Given** a fresh browser profile, **When** the app loads and runs, **Then** no request goes to a third-party origin (Q-1 measurement is not adopted, so there is no exception).
3. **Given** any screen, **When** inspected, **Then** there is no sign-up, email, name, user identifier, advertising, user-generated content, or third-party tracking content.

---

### Edge Cases

- A shortcut pressed while audio is already playing: **P** restarts the sequence from the beginning, like **Listen** (FR-7.9), without stacking sounds; other shortcuts stop a sequence exactly when the matching control would (slice 019 stop rules).
- Next/previous at the first or last item: Triads inversions wrap (like the inversion radio group); CAGED shapes do not wrap and do nothing at the ends or with no shape in focus (like the disabled Next/Previous shape buttons).
- A shortcut pressed on a screen where the action does not exist (e.g. next inversion in Notes): nothing happens, no error.
- Key repeat (holding a key) is ignored (`event.repeat`): one action per press.
- Non-US keyboard layouts: shortcuts match the produced character, not the physical key; Shift is tolerated, Ctrl/Alt/AltGr/Meta are not. About lists the characters P . , L N.
- Missing translation for an About string (including the policy): a unit test fails the merge gate; at runtime the existing English fallback (EC-8.3) still applies.
- Local storage unavailable: the privacy text (static) already says that nothing is kept when the browser blocks storage; the app and the shortcut switch keep working for the session (switch state not remembered).
- The Erase confirmation is open and the user presses a shortcut: shortcuts still act normally; Escape keeps closing the confirmation.
- A shortcut while a share fallback or a panel (language, instrument, sound) is open: shortcuts act on the underlying view unless focus is in an editable field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: About MUST show a short plain-language description of what the app is, with sections in this order: intro, marker legend, keyboard shortcuts, privacy (followed by **Erase my preferences**), version; each section has an `h2`, and the privacy section has fragment id `privacy`.
- **FR-002**: About MUST show the marker legend with exactly three entries — root, third, fifth — each drawn with the shared fretboard marker component plus its localized function name.
- **FR-003**: About MUST list every keyboard shortcut with its key and localized action (P play/Listen; . next; , previous; L label type; N notation), and MUST offer a **Keyboard shortcuts** on/off switch (default on) next to the list.
- **FR-004**: About MUST show the app version.
- **FR-005**: About MUST include a plain-language privacy policy containing statements (1)–(8) of Clarifications → Privacy text: no personal data collected and no account/identifier; the categories of preferences stored only in this browser on this device (no cookies); that clearing browser data or **Erase my preferences** erases them and that nothing is kept when storage is blocked; that nothing is measured and no usage or error data is sent; no ads, trackers or third-party content; no device permissions; the hosting and share-link sentences; suitability for all ages.
- **FR-006**: All About content, including the policy, MUST be available in all three supported languages and follow the active language.
- **FR-007**: **Erase my preferences** MUST remain on About, placed in the privacy section, and keep its current behavior; it also resets the **Keyboard shortcuts** switch to on.
- **FR-008**: The app MUST provide these shortcuts, identical in every language: **P** = Listen (Notes, Triads, CAGED); **.** / **,** = next / previous inversion in Triads (wrapping root → 1st → 2nd → root) and next / previous shape in CAGED (no wrap, as the buttons); **L** = cycle the current tool's label type in control order (Notes: name → octave → none; Triads/CAGED: interval ↔ name), remembered per tool; **N** = toggle notation letters ↔ solfège on any screen, remembered as an explicit choice (accidental policy unchanged). Letters match case-insensitively on `KeyboardEvent.key`.
- **FR-009**: Shortcuts MUST NOT clash with browser or screen-reader shortcuts: they MUST NOT fire when Ctrl, Meta, Alt or AltGr is held, on key repeat, when the event was already handled (`defaultPrevented`), or when focus is in an editable or type-ahead field (`input` other than checkbox/radio/range/button types, `textarea`, `select`, `contenteditable`); arrows, Space, Enter, Escape, Tab, Home/End, PageUp/PageDown and function keys MUST NOT be shortcuts.
- **FR-009a**: The **Keyboard shortcuts** switch MUST disable every shortcut while off (WCAG 2.2 SC 2.1.4). Its state MUST be stored as an additive optional preferences field `shortcuts`, written only when `false`, validated with fallback to `true`, with `PREFS_VERSION` unchanged.
- **FR-009b**: While shortcuts are on, each matching on-screen control MUST expose its key via `aria-keyshortcuts`; while off, the attribute MUST be absent.
- **FR-010**: Every shortcut action MUST also remain available through an on-screen control (no function is shortcut-only).
- **FR-011**: Shortcuts MUST only act on the screen where the action exists, MUST call the same handler as the matching on-screen control (same state, motion, announcement, stored preference, playback stop/restart), MUST be a no-op exactly when that control is absent or disabled (e.g. **P** on Home or About, or in Notes while its Listen is disabled, **.** in Triads All notes view, **.** in CAGED with no focus), and MUST NOT move focus.
- **FR-012**: The app MUST NOT contain sign-up, email, name, or any user identifier.
- **FR-013**: The app MUST NOT show advertising or load third-party content that tracks users.
- **FR-014**: The app MUST NOT load executable content or make any request to origins other than its own delivery. Q-1 measurement is not adopted, so no exception applies in this slice; the CSP stays `'self'`-only.
- **FR-015**: The app MUST NOT request device permissions (microphone, camera, location, notifications).
- **FR-016**: The app MUST have no user interaction between users, no user-generated content, and no data collection, so that it is suitable for minors.
- **FR-017**: The privacy design MUST comply with Brazilian (LGPD) and European (GDPR) data-protection law for this audience.
- **FR-018**: No cookie banner or consent flow is added unless the legal review (Q-11) requires one.
- **FR-019**: Privacy and security posture MUST be enforced by automated checks that fail the merge gate: (a) fresh-context Playwright pass over `/`, `/notes`, `/triads`, `/caged`, `/about` (including Listen, Share, instrument and language panels) with every request same-origin; (b) spies on getUserMedia, geolocation, Notification.requestPermission, permissions.query and requestMIDIAccess never called, and no dialog event; (c) no cookies, only `fretboard-master:`-prefixed `localStorage` keys, no email/password/tel inputs; (d) CSP lists no external origin; (e) stored preferences contain only known fields; (f) every About key present and non-empty in pt-BR and es.

### Key Entities

- **Shortcut**: a character key, the action it triggers, the screens where it applies, the on-screen control it mirrors, and its localized description shown in About.
- **Shortcuts switch**: on/off; optional preferences field `shortcuts` (stored only when off).
- **Privacy policy text**: localized plain-language statements covering collection, local storage, erasure, and anonymous measurement.
- **Preference list**: the settings stored only on the device (one `localStorage` record, `fretboard-master:prefs`) and erasable from About; this slice adds `shortcuts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In each of the 3 languages, 100% of About sections (intro, legend, shortcuts, version, privacy) appear fully translated, with no untranslated strings.
- **SC-002**: A first-time reader reaches the privacy section from any screen in at most 2 activations (open About from the app bar, then the privacy section is on that page with `h2` and `#privacy`).
- **SC-003**: Each of the 5 shortcut actions (P, period, comma, L, N) works on first press in 100% of automated desktop checks, with the shortcut and the on-screen control producing the same result.
- **SC-004**: In a fresh browser profile, a full pass through every screen produces 0 permission prompts and 0 requests to third-party origins.
- **SC-005**: Automated axe checks report 0 violations on About; a unit test confirms no shortcut fires for any reserved key or modifier combination listed in FR-009, and that none fires with the switch off.
- **SC-006**: The privacy text uses short sentences without legal jargon ("data controller", "processing", "lawful basis" absent) and is ≤ 220 words in English and ≤ 280 words in pt-BR and es (catalog unit test).

## Assumptions

- Depends on remembered preferences (003-your-instrument/002) and the translated texts from 005-languages-and-notation/001, already shipped as slices 010 and 020.
- The About page, version display, and **Erase my preferences** already exist; this slice completes and localizes them.
- Q-1 (anonymous measurement) is not adopted and no measurement or error reporting exists in code: the policy states plainly that nothing is measured. A later slice adopting Q-1 must update the policy, the CSP and the FR-019 checks.
- Q-11 (legal need for a notice or consent) is unresolved: no consent flow is built; the plain-language notice is provided regardless. The wording is subject to legal review before launch.
- Q-2 (final product name) and Q-3 (maintainer and funding) are unresolved: the policy uses the current product name and carries no contact or owner details until answered.
- Shortcuts are for desktop keyboards; touch and phone layouts are unchanged.
- Key assignments are fixed in FR-008 (P . , L N); planning may change a key only if a documented conflict is found, and must then update FR-008 and About.
