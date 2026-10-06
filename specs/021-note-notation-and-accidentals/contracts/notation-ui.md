# Contract: Notation UI Behavior

**Feature**: `021-note-notation-and-accidentals` | Observable behavior, asserted by Vitest
component tests and Playwright specs (`e2e/notation.spec.ts`, `e2e/notation-layout.spec.ts`).

## 1. Panel groups (`src/lib/shell/NotationSelector.svelte` inside `LanguagePanel.svelte`) — FR-005

- The panel region's accessible name is "Language and notation" (translated).
- Below the language selector there are two native radio fieldsets:
  - **Note names**: Letters / Solfège. The checked option is `notation.effective`.
  - **Accidentals**: Sharps / Flats / Both. The checked option is `notation.accidentals`.
- Keyboard: Tab enters each group, arrow keys move within it, and the change applies on
  selection. Each label is at least `--target-min` (44 px) tall.
- The panel is reachable from Home (the inline selector area) and from every tool and About, as
  in 020. The notation groups appear wherever the panel appears.

## 2. Bar toggle (`src/lib/shell/NotationToggle.svelte` in `ToolLayout.svelte`) — FR-005

- It is present in the application bar of Notes, Triads, and CAGED only. It is absent on Home and
  About.
- It is a `role="group"` with accessible name "Note names" and two `<button>` elements:
  - "C D E": `aria-pressed="true"` iff letters.
  - "Do Re Mi" (pt-BR "Dó Ré Mi"): `aria-pressed="true"` iff solfège.
- The option texts come from `noteName` and never differ from the names on the board. Each
  button is ≥ 44×44 CSS px, and the focus ring is visible.
- The toggle and the panel radios always agree. Changing either one updates the other within the
  same frame (US2-2).

## 3. Switch effects — FR-006, SC-002

After a notation change:
- Every note name on the page is in the new notation:
  - marker labels, hover hint, position card, selector buttons and their accessible names;
  - composition panel, Triads root/quality, CAGED key name, notices, and enharmonic lines;
  - nut labels, string filter, instrument panel rows and summary, tuning badge;
  - preset tuning names ("Drop Re", "Aberta em Sol"; "DADGAD" stays literal);
  - the live region description.
- Tool state is unchanged: selection, card position, root, quality, inversion, shape focus,
  layers, tuning, and scroll position. Focus stays on the toggle. There is no reload, no
  navigation, and no network request.
- The fretboard updates within 100 ms (`e2e/perf.spec.ts` gains one measurement).
- These stay letters in every notation:
  - CAGED shape tags ("E shape · roots on strings …");
  - CAGED shape-focus buttons (C A G E D);
  - "DADGAD";
  - interval labels (♭3, 5, R/T).

## 4. Accidental preference effects — FR-007 – FR-010, SC-003

| Surface | sharps | flats | both |
|---|---|---|---|
| Notes selector button label | C♯ / D♭ | D♭ / C♯ | C♯ / D♭ |
| Notes marker (altered) | C♯ | D♭ | C♯ over D♭ (medium/root, fits) or C♯ |
| Notes hover hint | C♯ | D♭ | C♯ |
| Position card | C♯ / D♭ | D♭ / C♯ | C♯ / D♭ |
| Missing-notes notice, detected triad | C♯ | D♭ | C♯ |
| Unmatched custom open string | C♯ | D♭ | C♯ |
| Preset open string (e.g. Half step down) | E♭ | E♭ | E♭ |
| Triads / CAGED markers, composition, key | theory | theory | theory |

- Example: Triads A major reads A–C♯–E under every policy (US3-2).
- Screen readers hear a Notes altered note under "both" as "C sharp or D flat", preferred first
  (FR-013).

## 5. Labels and glyphs — FR-011, FR-012, SC-004, SC-007

- Visible text and accessible names never contain `#`, and never contain a note name followed by
  `b` (the spec regex). This is checked over 3 languages × 2 notations × 3 policies × 3 tools.
- Marker labels follow `fitMarkerLabel` ([notation-api §6](./notation-api.md)):
  - "Sol♯" renders at the minimum label size;
  - "Sol♯3" renders as "So♯3";
  - the position card and hover hint show the full name.
- Screenshot fixture "accidental glyphs": F♯, Sol♯, F𝄪, and B𝄫 on root and medium markers, for
  the phone, phone-touch, and desktop projects.
- At 320 px and 200 % text, in pt-BR and es solfège with flats and both, no note label is
  truncated or overlapping (`expectNoTruncationOrOverlap`), and only the fretboard scrolls
  horizontally.

## 6. CAGED one-time note — FR-015, SC-006

- The note shows when CAGED is displayed with solfège and the note was never shown, either on
  opening or on a switch while CAGED is open.
- It is the existing `Notice` (non-blocking, dismissible, ≤ 2 lines, not error red). Its text is
  "The shapes are named after the open chords C (Do), A (La), G (Sol), E (Mi), and D (Re)", with
  pt-BR syllables "Dó, Lá, Sol, Mi, Ré".
- It is recorded as shown when it appears. It never shows again after a reload, a dismissal, or a
  letters → solfège round trip.
- It is independent of the rotate hint, and both may be visible.
- After "Erase preferences" it may show again.

## 7. Persistence and defaults — FR-004, FR-016, SC-001, SC-008

- First visit:
  - es device: solfège ("Do Re Mi Fa Sol La Si" on Notes naturals);
  - en and pt-BR: letters.
- Before an explicit notation pick, changing the language moves the notation. After a pick, it
  does not.
- Choices survive a reload. A corrupt `notation` or `accidentals` value loads the defaults
  without an error screen, and the other prefs are kept.
- Notation and accidentals never appear in share-link URLs. "Reset tool" does not change them.
- Prerendered HTML is English letters. The client applies the stored notation before hydration,
  and no hydration warning is logged.
