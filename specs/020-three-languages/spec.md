# Feature Specification: English, Portuguese, and Spanish

**Feature Branch**: `feature/020-three-languages`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Implement the feature specified in specs/autonomous/breakdown/005-languages-and-notation/001-three-languages.md (id 001, three-languages)."

## Clarifications

### Session 2026-10-05 (clarify reviewer)

Derived from sources (constitution, macro-spec, existing code):

- Q: Which locale identifiers and catalog files? → A: Three locales: `en` (base), `pt-BR`, `es`, one Paraglide catalog each (`messages/en.json`, `messages/pt-BR.json`, `messages/es.json`), registered in `project.inlang/settings.json`. The page's `<html lang>` is `en`, `pt-BR`, or `es` (constitution stack: Paraglide JS; FR-8.2 "Portuguese (Brazil)").
- Q: Where is the language stored, and is it carried by share links? → A: As an optional `language` field (`'en' | 'pt-BR' | 'es'`) in the existing v1 preferences record (DM-14), parsed with the Valibot schema; absent or invalid → treated as no stored choice (constitution IX). Language is NEVER written into share links or any URL (DM-17). The preferences format version stays 1 (additive optional field, same pattern as slices 013–019).
- Q: Does the URL change per language? → A: No. Routes stay `/`, `/notes`, `/triads`, `/caged`, `/about` in every language; no locale prefix, no cookie, no query parameter (constitution "Source layout", DM-17, constitution II no cookies needed). Switching changes no URL and adds no history entry.
- Q: Are all three catalogs loaded up front? → A: Yes. All three languages ship in the initial bundle; switching language makes zero network requests (constitution II "once loaded, no feature may depend on the network"). The initial JS total stays ≤ 120 KB gzip (constitution VI).
- Q: Is native-speaker glossary review a merge gate? → A: No. It is a pre-launch gate (constitution "Pre-launch gates"). This slice drafts Portuguese and Spanish texts from the glossary (file 10 §4) and records every musical term used in the interface, per language, in a reviewable glossary list in the repository; review status does not block merge (resolves the Q-12 dependency for this slice).
- Q: What is "logged" when a text is missing? → A: An on-device console warning `[fretboard-master] missing text` with the message key and the active locale, emitted at most once per key per locale per session; nothing is sent over the network and no storage is written (constitution II; matches `recordFailure` console-only logging; NFR-8.1 transport is subject to Q-1 and out of scope).
- Q: What if a text is missing in English (the base)? → A: Not a runtime situation: English is the source of all message keys, and a key referenced in code but absent from `messages/en.json` fails `pnpm check` (typecheck of compiled messages). Acceptance scenario 5.2 is realigned to this build-time check.
- Q: Does this slice change note names? → A: No. Letter note names (C D E…) and accidentals ♯ ♭ 𝄪 𝄫 stay as today in all three languages (constitution VIII; notation and accidental preference are slice 002). Spoken note names in screen-reader text translate only the accidental word, keeping the letter: "C sharp" → pt "C sustenido", es "C sostenido" (glossary terms).

Assumed defaults (conventional choices; testable):

- Q: How is the device language matched? → A: Read `navigator.languages` in order (fall back to `navigator.language` when empty); for each tag, compare the primary subtag case-insensitively: `en` → `en`, `pt` → `pt-BR`, `es` → `es`; the first match wins; malformed/empty tags are skipped; no match → `en`. Detection runs only when no valid stored choice exists. Examples: `pt-PT` → `pt-BR`; `es-419`, `es-AR` → `es`; `EN-au` → `en`; `["fr-FR","es-MX"]` → `es`; `["ja"]` → `en`.
- Q: When is a language stored? → A: Only when the user explicitly picks one. Device detection never writes the preference, so a user who never chose follows their device language on each visit. Picking the already-active language still stores it.
- Q: What does the selector look like? → A: The same single-choice control of exactly three options, always in the order English, Português, Español, each labelled by its own name (autonym) with a matching `lang` attribute on the option (WCAG 3.1.2), regardless of the active language. The currently active language is shown as selected. The control's own label is translated ("Language" / "Idioma" / "Idioma").
- Q: Where is the language panel in a tool? → A: A "Language" control in the app navigation bar, present on `/notes`, `/triads`, `/caged`, and `/about`, opens a non-modal, dismissible panel (Escape and an explicit close button; focus returns to the opener) containing the selector. Choosing a language applies immediately and leaves the panel open. Opening the panel + choosing = 2 interactions (SC-006). The home screen shows the selector inline without opening a panel. Slice 002 will add notation and accidentals to this same panel.
- Q: What exactly is preserved on switch? → A: Every view state (DM-15) of every tool, instrument configuration, open panels/notices (their text updates in place), focus (stays on the selector option that was activated), scroll position, and sound playback in progress (it continues uninterrupted). Only text, `<html lang>`, and the document `<title>` change.
- Q: Is the switch announced to screen readers? → A: No extra announcement. The focused selector reports its new checked state; the fretboard text description region updates to the new language.
- Q: Which tuning names stay in English? → A: The "Drop" family and DADGAD stay identical in every language: "Drop D", "Drop C", "Double Drop D", "Drop A", "DADGAD" (extends the source's examples to the same naming family). All other preset names are translated with the language's usual phrasing, keeping note letters as letters (e.g. "Standard" → "Afinação padrão" / "Afinación estándar"; "Open G" → "Aberta em G" / "Abierta en G"; "Half step down" → "Meio tom abaixo" / "Medio tono abajo"). These names are flagged in the glossary list for native review.
- Q: Product name across languages (Q-2)? → A: "Fretboard Master" is identical in all three languages until Q-2 is decided; it is on the allowlist of strings permitted to equal English.
- Q: Register and regional variety? → A: Portuguese is Brazilian, addressing the user as "você"; Spanish is neutral Latin-American-friendly Spanish addressing the user as "tú", avoiding country-specific slang, using glossary terms (e.g. "diapasón", "cuerda al aire", ordinals "1.ª"). Both follow the calm-teacher voice (file 12 §2).
- Q: How is "no mixed languages" tested? → A: (a) A unit test asserts every key in `en.json` exists with a non-empty value in `pt-BR.json` and `es.json`, and neither has keys absent from English (SC-001); (b) a unit test asserts every `pt-BR`/`es` value differs from its English value, except an explicit allowlist (product name, interval labels other than root, the English-kept tuning names, CAGED shape letters, purely symbolic/placeholder-only strings); (c) Playwright visits every screen in each language and asserts `<html lang>` matches and a per-language sample of known texts is present.
- Q: How are dynamic texts with values handled? → A: Every sentence with a value (fret number, tuning name, root, count) is one catalog message with named parameters, so each language orders words its own way; no concatenation of translated fragments. Counts use message variants for singular/plural where the number varies. Lists use `Intl.ListFormat` with the active locale (existing `spokenNoteList`).
- Q: How are layout limits measured? → A: "200% browser text size" is emulated by doubling the root font size; "truncation" means a text element whose content overflows its box (scrollWidth/scrollHeight greater than client size) or uses ellipsis; "overlap" means two interactive controls' bounding boxes intersect. Checked on home, Notes, Triads, CAGED, About, the instrument panel, and the language panel, at 320 CSS px width, in each language, at 100% and 200%. Only the fretboard may scroll horizontally. No translatable text uses `text-overflow: ellipsis`.
- Q: How is the two-line notice limit measured? → A: At 320 CSS px width and 100% text size, each notice's text height is ≤ 2 × its computed line height, in every language. At 200% text size notices may wrap further (they must still not truncate or overlap).
- Q: What happens before JavaScript runs? → A: Prerendered HTML is English (the no-JS fallback stays English). With JavaScript, the resolved language (stored choice, else device) is applied in client init before hydration, so the first interactive render, `<html lang>`, and `<title>` are already in that language, with no hydration error.
- Q: What does "Erase preferences" do to language? → A: It removes the stored choice with the rest of the record; the interface immediately re-resolves from the device language (as on a first visit).
- Q: What counts as "adding a fourth language with only text files"? → A: A new catalog file plus data-only registrations (the locale list in `project.inlang/settings.json` and the supported-language list holding locale tag and primary subtag; the autonym is a message in the new catalog file). No change to theory, state, rendering, or component logic.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First visit speaks my language (Priority: P1)

A guitarist opens the app for the first time. The interface appears in their device language when it is English, Portuguese, or Spanish (any regional variant); otherwise English.

**Why this priority**: A beginner quits at the first untranslated theory term. Correct first-visit language is the entry point of the whole feature.

**Independent Test**: Open the app with different device language settings and no stored preference; check the interface language.

**Acceptance Scenarios**:

1. **Given** a device set to pt-PT and no stored preference, **When** the app opens, **Then** the interface is in Portuguese.
2. **Given** a device set to French, **When** the app opens, **Then** the interface is in English.
3. **Given** a device set to es-MX (or en-GB, pt-BR), **When** the app opens, **Then** the interface uses Spanish (or English, Portuguese).
4. **Given** a device listing `["fr-FR", "es-MX"]`, **When** the app opens with no stored choice, **Then** the interface is in Spanish (first supported language wins).
5. **Given** a device set to pt-PT and no stored choice, **When** the app opens, **Then** no language preference is written to storage.

---

### User Story 2 - Switch language anywhere without losing work (Priority: P1)

A user changes language from the home screen or from a language panel reachable from every tool. The change is instant, with no page reload, and every tool keeps its state. The choice is remembered.

**Why this priority**: Core of FR-8.1 and FR-8.3; a switch that resets work would be unusable.

**Independent Test**: Set up a Triads comparison, switch English → Spanish, verify state and text.

**Acceptance Scenarios**:

1. **Given** a comparison on screen in Triads in English, **When** the user switches to Spanish, **Then** the comparison stays on screen, all text is Spanish, and root labels read "T".
2. **Given** any tool open, **When** the user opens the language panel from the navigation bar and picks a language, **Then** the page does not reload, the URL is unchanged, no network request is made, and tool selections, positions, settings, focus, and any playback in progress are unchanged.
3. **Given** the user chose Portuguese, **When** they return later, **Then** the app opens in Portuguese regardless of device language.
4. **Given** the home screen, **When** it loads, **Then** a language selector with the options English, Português, Español (in that order, each with its own `lang`) is visible there without opening a panel.
5. **Given** a language switch, **When** it completes, **Then** `<html lang>` is `en`, `pt-BR`, or `es` accordingly and the document title is in the new language.
6. **Given** a notice or panel open, **When** the language is switched, **Then** its text updates in place and it stays open.

---

### User Story 3 - Every text and term is correct in each language (Priority: P2)

Every user-facing text exists in all three languages: controls, card questions, composition panel, tuning names, notices, empty states, and screen-reader descriptions. Musical terms follow the trilingual glossary. No screen mixes languages.

**Why this priority**: Completeness and quality of the translation deliver the value; depends on the mechanism from stories 1–2.

**Independent Test**: Visit every screen in each language and check for foreign-language text; compare terms against the glossary.

**Acceptance Scenarios**:

1. **Given** any language, **When** the user visits any screen, **Then** all visible and screen-reader text is in that language, except the product name, the English-kept tuning names ("Drop D", "Drop C", "Double Drop D", "Drop A", "DADGAD"), CAGED shape letters, and letter note names.
2. **Given** English, **When** intervals are shown, **Then** the root is "R"; **Given** Portuguese or Spanish, **Then** the root is "T". Other labels (♭3, 3, 5, ♭5, ♯5) are identical in all languages.
3. **Given** any notice, **When** shown in any language at 320 CSS px width and 100% text size, **Then** it is at most two lines.
4. **Given** the catalogs, **When** the completeness test runs, **Then** every English key exists non-empty in Portuguese and Spanish, and no non-English value equals the English value outside the allowlist.

---

### User Story 4 - Layout survives longer text (Priority: P2)

Portuguese and Spanish texts are often longer than English. Layout shows them with no truncation or overlap, including at 320 logical width and 200% browser text size.

**Why this priority**: Accessibility and constitution principles V and VIII.

**Independent Test**: Render every screen in each language at 320 width and at 200% text size; check for clipping or overlap.

**Acceptance Scenarios**:

1. **Given** the longest translations, **When** shown at 320 width, **Then** nothing is truncated or overlapping and no horizontal page scroll appears.
2. **Given** 200% browser text size, **When** any screen is shown in any language, **Then** nothing is truncated or overlapping.

---

### User Story 5 - Missing text falls back gracefully (Priority: P3)

If a text is missing in the active language through a content error, English shows at that spot and the gap is logged.

**Why this priority**: Resilience; rare path.

**Independent Test**: Remove one entry from a non-English language and open the screen using it.

**Acceptance Scenarios**:

1. **Given** Portuguese active and one text absent, **When** the screen renders, **Then** the English text shows there, the rest stays Portuguese, and a console warning `[fretboard-master] missing text` with the key and locale is emitted once (no network, no storage write).
2. **Given** a message key used in code but absent from the English catalog, **When** `pnpm check` runs, **Then** it fails (English is the source of keys; this never reaches runtime).

---

### Edge Cases

- Unsupported device language (e.g. French, Japanese) → English.
- Regional variants map to base language by primary subtag, case-insensitive (pt-PT → Portuguese, es-AR/es-419 → Spanish, en-AU → English).
- Empty `navigator.languages` → `navigator.language`; malformed tags skipped; nothing usable → English.
- Stored preference unreadable or invalid → treated as no preference (device language rule); other valid preference fields are kept.
- "Erase preferences" → stored language removed; interface re-resolves from device language immediately.
- Preference storage unavailable → language still switches for the session.
- Language switched while a dialog, panel, or notice is open → its text updates in place.
- Dynamic text with names/numbers (tuning names, fret numbers) follows each language's grammar, not string concatenation of English.
- Screen-reader announcements and the page's declared language change with the interface language.
- Note-name notation and accidental preference are out of scope (feature 002); this feature must not alter them. Letter note names and ♯ ♭ 𝄪 𝄫 are identical in every language.
- No JavaScript → prerendered English content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide complete interface coverage in English, Portuguese (Brazil), and Spanish.
- **FR-002**: With no valid stored language, the app MUST walk `navigator.languages` in order (else `navigator.language`) and use the first tag whose primary subtag (case-insensitive) is `en`, `pt`, or `es`, mapping to `en`, `pt-BR`, `es`; otherwise English. Detection MUST NOT write the preference.
- **FR-003**: A language selector MUST be visible inline on the home screen, and a "Language" control in the navigation bar of every other screen MUST open a non-modal, dismissible language panel containing the same selector. The selector lists English, Português, Español in that fixed order, labelled by autonym, each with its own `lang` attribute.
- **FR-004**: Switching language MUST be immediate, MUST NOT reload the page, change the URL, or make a network request, and MUST preserve every tool's view state, instrument, open panels and notices, focus, scroll position, and playback in progress.
- **FR-005**: An explicitly chosen language MUST be stored as an optional `language` field (`en`, `pt-BR`, `es`) in the v1 preferences record and take precedence over device language on later visits. Invalid values MUST be ignored. Language MUST NOT appear in share links or URLs. If storage is unavailable, the switch still applies for the session.
- **FR-006**: Every user-facing text (controls, card questions, composition panel, tuning names, notices, empty states, screen-reader descriptions) MUST exist in all three languages, and no screen MUST mix languages.
- **FR-007**: The tuning names "Drop D", "Drop C", "Double Drop D", "Drop A", "DADGAD", the product name "Fretboard Master", and CAGED shape letters MUST stay unchanged in every language; all other tuning names MUST be translated (keeping note letters as letters).
- **FR-008**: Musical terms MUST follow the trilingual glossary (file 10 §4). Every musical term used in the interface MUST be listed per language in a glossary list in the repository for native-speaker review; that review is a pre-launch gate, not a merge gate.
- **FR-009**: Interval labels MUST be identical across languages except the root: "R" in English, "T" in Portuguese and Spanish.
- **FR-010**: Layouts MUST show all languages with no truncation (content overflowing its box, or ellipsis) and no overlap of interactive controls, at 320 CSS px width at 100% and at 200% root text size; only the fretboard may scroll horizontally.
- **FR-011**: Voice MUST be a calm, experienced teacher (pt-BR "você", es "tú", neutral Spanish); no notice may exceed two lines at 320 CSS px width and 100% text size.
- **FR-012**: A text missing in the active non-English language MUST display the English text and emit one console warning `[fretboard-master] missing text` with key and locale per key per locale per session, with no network request or storage write. A key missing from English MUST fail `pnpm check`.
- **FR-013**: Adding a fourth language MUST require only a new catalog file plus data-only registrations (inlang locale list; supported-language list of tag and primary subtag; the autonym lives in the new catalog file), with no change to musical rules, state, rendering, or component logic.
- **FR-014**: `<html lang>` and the document title MUST follow the active interface language, already correct at the first interactive render (resolved in client init before hydration). Without JavaScript, prerendered content is English.
- **FR-015**: All three catalogs MUST ship in the initial bundle; the initial JS MUST stay within 120 KB gzip.
- **FR-016**: Every sentence containing a value MUST be a single parameterized catalog message (no concatenation of translated fragments), with plural variants where a count varies.

### Key Entities

- **Language**: a supported interface language — locale tag (`en`, `pt-BR`, `es`), matching primary subtag (`en`, `pt`, `es`), and autonym (English, Português, Español), held as catalog text in its own language.
- **Language preference**: optional `language` field of the v1 preferences record; absent until the user explicitly picks one.
- **Text catalog**: per-language set of all user-facing texts keyed by stable identifier, with English as fallback.
- **Trilingual glossary**: agreed equivalents of musical terms in the three languages.
- **Gap log entry**: console-only warning carrying the message key and locale; never persisted or transmitted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-facing texts exist in all three languages; the catalog completeness unit test finds zero missing, empty, extra, or English-identical (outside the allowlist) entries.
- **SC-002**: For device languages pt-PT, pt-BR, es-ES, es-MX, es-419, en-GB, en-US, fr, ja, and `["fr-FR","es-MX"]`, first visit shows Portuguese, Portuguese, Spanish, Spanish, Spanish, English, English, English, English, Spanish respectively in 100% of tested cases.
- **SC-003**: Switching language on every tool changes all text with no page reload and zero change in tool state.
- **SC-004**: On home, Notes, Triads, CAGED, About, instrument panel, and language panel, in each language, at 320 CSS px width at 100% and 200% root text size: zero truncated or overlapping elements and no horizontal page scroll.
- **SC-005**: No notice exceeds two lines in any language at 320 CSS px width and 100% text size.
- **SC-006**: A language is selectable in at most two interactions from any tool (open panel, pick) and one from home.
- **SC-008**: Switching language makes zero network requests and zero URL changes.
- **SC-007**: A deliberately removed text always shows English at that spot and produces exactly one console gap warning per key per locale per session.

## Assumptions

- Open question Q-12 (native reviewers for Portuguese and Spanish) is resolved outside this feature; texts are drafted from the glossary and listed for review before launch (pre-launch gate, constitution).
- Open question Q-2 (product name across languages) is resolved by keeping the same name in all three languages until decided otherwise.
- "Portuguese" means Brazilian Portuguese texts.
- Preferences storage from 003-your-instrument/002-remembered-preferences is reused.
- Note-name notation (letters/solfège) and accidental preference are delivered in 005-languages-and-notation/002; existing note-name output is untouched here.
- All tools from waves 001–004 exist and their texts are already in the English catalog (constitution VIII).
- Gap logging stays on-device (console only), consistent with the app's privacy principles.
