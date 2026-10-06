# Implementation Plan: Letters or Solfège, Sharps or Flats

**Branch**: `feature/021-note-notation-and-accidentals` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-note-notation-and-accidentals/spec.md`

## Summary

Every note name in the product can read in **letters** (C D E) or **fixed-do solfège** (Do Re
Mi; pt-BR Dó Ré Mi). For single notes (the Notes tool and open-string names) the user can choose
**sharps, flats, or both**. Accidentals stay real glyphs (♯ ♭ 𝄪 𝄫), are spoken in full, and
shrink then abbreviate on small markers under a pure grapheme rule. CAGED keeps its letter shape
names, and a one-time note explains them to solfège users.

**Technical approach** (see [research.md](./research.md)):

1. **One reactive notation source (R-01).** `src/lib/notation/notation.ts` already formats every
   note name. It gains a replaceable context getter, `overwriteNotationSource`, which mirrors the
   Paraglide `overwriteGetLocale` pattern from 020. A new runes store,
   `src/lib/state/notation.svelte.ts`, installs it, so the about 60 existing `noteLabel` and
   `spokenNote` call sites inside `$derived` re-render in place with no signature changes.
2. **Syllables from catalogs (R-02).** There are 7 keys × 3 locales, so a fourth language stays
   catalog-only. The default notation per language is a data field on `LANGUAGES` (es → solfège),
   derived until the user picks explicitly (R-03).
3. **Accidental policy is per-surface opt-in (R-04–R-06).** The policy-aware helpers are
   `singleSpelling`, `spellingPair`, `markerSpellings`, `stringSpelling`, and `spokenPair`. Opt-in
   flows through two narrow pieces:
   - `DisplayModel.spellingPolicy = 'preference'`, which only the Notes model sets;
   - `Instrument.fixedSpelling`, which is true for presets.

   Triads and CAGED stay theory-spelled, untouched.
4. **Preset tuning names parameterized (R-07).** "Drop {note}" and "Open {note}" follow notation,
   and "DADGAD" stays literal. The CAGED store stops caching a tuning-name string.
5. **Pure label fit (R-09).** `src/lib/fretboard/label-fit.ts` applies the size rules (≤ 3
   graphemes normal, 4 min, ≥ 5 abbreviated "Sol" → "So", then the octave dropped) and stacks
   "both" on medium and root markers.
6. **Controls (R-10).** "Note names" and "Accidentals" radio groups go in the existing language
   panel, now named "Language and notation". A two-button "C D E | Do Re Mi" toggle goes in the
   tool app bar (`ToolLayout`).
7. **Storage (R-12).** There are three additive optional v1 prefs fields: `notation`,
   `accidentals`, and `cagedNote`. Older records load unchanged.
8. **CAGED note (R-11).** The note is recorded the moment it shows, which copies the 016 rotate
   hint lifecycle.

**Recorded assumptions** (headless plan; no human input):
- **Abbreviation rule.** It is generic: "truncate the note-name part to 2 graphemes". It yields
  exactly the specified "Sol" → "So" and needs no per-language keys. The rejected alternative was
  per-language short-form catalog keys (YAGNI).
- **Grapheme counting.** It uses `Array.from` (code points), not `Intl.Segmenter`, because
  catalog syllables are NFC-precomposed. A unit test asserts NFC for the syllable keys. The
  rejected alternative was `Intl.Segmenter` (an unneeded runtime concern).
- **Spoken parameter rename.** `note_spoken_*` changes `{letter}` → `{note}`, and the new
  `note_spoken_either` replaces `notes_selector_altered_spoken`. The rejected alternative was
  keeping the misleading `{sharp}`/`{flat}` names once flats can lead.
- **Bar toggle shape.** It is two `aria-pressed` buttons in a labeled group, rather than a single
  `role="switch"`. Both options must stay visible and named.
- **Panel button label.** The app-bar button that opens the panel keeps its "Language" text, and
  only the panel region and the close button gain "and notation". The rejected alternative was a
  longer bar button, which would crowd the 320 px app bar.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5 (runes), SvelteKit 2 with `adapter-static`

**Primary Dependencies**:
- `@inlang/paraglide-js` (existing; new keys only)
- `valibot` (existing; three optional fields)
- No new runtime dependency (R-15)

**Storage**: `localStorage` v1 preferences record via `src/lib/prefs`. It gains the additive
optional fields `notation`, `accidentals`, and `cagedNote` (data-model §4).

**Testing**:
- Vitest + @testing-library/svelte (jsdom) for units and components
- fast-check for the "no ASCII accidental" property test
- Playwright + @axe-core/playwright for e2e, layout, and screenshot fixtures

**Target Platform**: Static SPA on Cloudflare Pages, evergreen desktop and mobile browsers (last two majors), 320–2560 CSS px

**Project Type**: Single-project static web app (SvelteKit)

**Performance Goals**:
- A notation or accidental switch updates the fretboard within ≤ 100 ms (NFR-1.3), as a pure
  in-place re-render.
- Zero network requests on a switch.

**Constraints**:
- Initial JS ≤ 120 KB gzip. The slice adds an estimated +1.0–1.8 KB, measured at the first
  checkpoint (R-15).
- Theory code (`src/lib/theory`) is untouched.
- Triads and CAGED spelling and snapshots are unchanged.
- Prerendered HTML stays English letters, with no hydration warnings.
- Share links never carry notation or accidentals.

**Scale/Scope**:
- About 20 source files touched (formatter call sites need no change; 5 surfaces opt into the
  policy).
- About 15 new or changed catalog keys × 3 languages.
- 2 new components, 1 new store, 2 new pure modules.
- 7 new prefs fixtures.
- E2E: 18 language × notation × policy combinations × 3 tools for the "no #/b" scan.

No open unknowns remain. Every Phase 0 item is resolved in [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The initial check and the post-design re-check both **PASS**. There are no violations, so
Complexity Tracking is empty.

- [x] **I. Musical Correctness**:
  - No file in `src/lib/theory` changes, so the TM table and property suites gate it unchanged.
  - Notation changes display only (FR-019).
  - Triads and CAGED keep theory spelling. A test pins A major to A–C♯–E under flats (SC-003).
  - Respelling for the accidental policy only maps X♯ → Y♭ (same pitch class and octave),
    verified by unit test N-9.
- [x] **II. On-Device, Static, Private**:
  - Syllables ship in the bundled catalogs, and switching makes zero requests.
  - The choices live only in local preferences, are erasable (erase resets all three fields), and
    never enter share links.
- [x] **III. Pure Core, Thin Shell**:
  - `notation` stays Svelte- and DOM-free and gains a getter seam, not a store import.
  - `policy.ts` and `label-fit.ts` are pure.
  - Tools still hand a display model to the renderer, with only the `spellingPolicy` flag added.
  - Orientation and handedness are untouched.
  - The notation state lives in a store outside the components.
- [x] **IV. Test-First / Tested Behavior**:
  - The notation, policy, label-fit, prefs schema, and store modules are written test-first.
  - Every acceptance scenario US1–US5 maps to a test in [quickstart.md](./quickstart.md).
  - A screenshot fixture covers glyph alignment.
  - No timing-dependent tests.
- [x] **V. Accessible (WCAG 2.2 AA)**:
  - Native radio groups and an `aria-pressed` button group, keyboard-operable with 44 px targets.
  - Accidentals are spoken in full in every language, and "both" is read as "X or Y".
  - Abbreviation never reaches accessible text.
  - The CAGED note is a polite, non-modal `Notice`. Axe runs in the new specs.
- [x] **VI. Performance Budgets**:
  - Estimated +1.0–1.8 KB gzip, against a cap of 120 KB, measured at the first checkpoint with a
    trim-first contingency (R-15).
  - A switch is an in-place re-render, with a `perf.spec.ts` assertion of ≤ 100 ms.
- [x] **VII. Design System Fidelity**:
  - The toggle sits in the app bar and covers nothing, and the main control is not behind a menu.
  - Label sizes use the existing `--marker-label-size` and `--marker-label-min-size` tokens.
  - The CAGED note uses the existing `Notice` (≤ 2 lines, not error red, no modal).
  - Note-function shapes and colors are unchanged.
- [x] **VIII. International From the First Line**:
  - The slice delivers the notation half of this principle: every note name comes from
    `src/lib/notation`.
  - Glyphs are ♯ ♭ 𝄪 𝄫 only, verified by a property test and the e2e scan.
  - All new text exists in the three catalogs.
  - A fourth language needs only catalog keys plus the `LANGUAGES.notation` data field, the same
    allowance as 020 FR-013.
  - Verified at 200 % zoom.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - The three fields are parsed with Valibot picklists or booleans, each with its own fallback,
    and parsing stays total.
  - The format version stays 1 (additive), and the fixtures are add-only (7 new).
  - The share-link format is untouched, so link fixtures are unaffected.
- [x] **X. Simplicity**:
  - No new dependency.
  - `policy.ts` has three real users (notation, prefs, i18n data), and `label-fit` has one module
    with two call paths (markers, both-stacking).
  - `spellingPolicy` and `fixedSpelling` are single flags rather than new abstractions.
  - Fallback: corrupt values become defaults, and an oversize label is abbreviated, never blank.
- [x] **Stack and source layout**:
  - Work stays inside the mandated `src/lib/{notation,state,shell,fretboard,prefs,instrument,i18n}`,
    `messages/`, `tests/`, `e2e/`, and `docs/adr/`.
  - No routes are added and the stack is unchanged.
- [x] **Workflow gates**:
  - Conventional Commits, with the merge gate in CI.
  - ADR 0020 records the notation context, the per-surface policy, and the fit rule (R-16).
  - Local verification follows the tiers (targeted Vitest, `test:e2e:fast` on touched specs, and
    `pnpm verify` once).
  - Native review of the new glossary terms is a pre-launch gate.

## Project Structure

### Documentation (this feature)

```text
specs/021-note-notation-and-accidentals/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-16
├── data-model.md        # Phase 1: notation, policy, context, prefs fields, store, fit rule
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── notation-api.md  # Module contracts (notation, policy, store, prefs, fretboard, instrument, catalogs)
│   └── notation-ui.md   # Observable UI behavior (panel, toggle, switch, policy table, labels, CAGED note)
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks; not created here)
```

### Source Code (repository root)

```text
messages/{en,pt-BR,es}.json        # + note_name_solfege_*, note_spoken_either, notation_*, accidentals_*,
                                   #   caged_solfege_note; note_spoken_* {letter}→{note};
                                   #   tuning_af4/5/6/8/9/10/11/23 take {note}; panel/close labels
docs/
├── adr/0020-notation-context-and-accidental-policy.md   # NEW
└── i18n/glossary.md                                     # + notation terms
src/lib/
├── notation/
│   ├── policy.ts                  # NEW (pure types + allowed sets)
│   └── notation.ts                # + context getter, noteName, solfegeName, noteLabelParts,
│                                  #   singleSpelling, spellingPair, markerSpellings, stringSpelling,
│                                  #   spokenPair, labelPair
├── i18n/languages.ts              # + LANGUAGES[].notation, defaultNotation
├── prefs/schema.ts                # + notation, accidentals, cagedNote fields
├── prefs/session.ts               # PreferencesPatch accepts the new fields
├── instrument/instrument.ts       # + Instrument.fixedSpelling
├── instrument/tunings.ts          # sets fixedSpelling (preset true, custom false)
├── fretboard/
│   ├── types.ts                   # + DisplayModel.spellingPolicy
│   ├── label-fit.ts               # NEW (pure fit/abbreviation rule)
│   ├── Fretboard.svelte           # policy-aware labels, stacked "both", fit classes, nut labels
│   └── description.ts             # policy-aware spoken names
├── state/
│   ├── notation.svelte.ts         # NEW runes store; installs the notation source
│   ├── preferences.svelte.ts      # start/erase notation; cagedNoteShown + markCagedNoteShown
│   ├── notes-model.ts             # spellingPolicy, singleSpelling/spellingPair/spokenPair
│   ├── caged.svelte.ts            # store Tuning, derive tuning label (R-07)
│   └── instrument.svelte.ts       # pass Tuning to caged.applyInstrument
├── shell/
│   ├── NotationSelector.svelte    # NEW (two radio fieldsets)
│   ├── NotationToggle.svelte      # NEW (app-bar "C D E | Do Re Mi")
│   ├── LanguagePanel.svelte       # renders NotationSelector
│   ├── ToolLayout.svelte          # renders NotationToggle in header
│   ├── InstrumentPanel.svelte     # stringSpelling for custom rows/summary
│   └── tuning-names.ts            # {note} params via noteLabel
└── tools/
    ├── NoteSelector.svelte        # labelPair / spokenPair (preferred first)
    ├── notes/{NotesTool,PositionCard,StringFilter}.svelte   # policy helpers
    └── caged/CagedTool.svelte     # one-time solfège Notice
tests/unit/
├── notation/{notation,policy}.test.ts           # extended / NEW
├── fretboard/label-fit.test.ts                  # NEW
├── state/notation-store.test.ts                 # NEW
├── notation-selector.test.ts, notation-toggle.test.ts   # NEW
├── prefs/fixtures/{notation-solfege,notation-letters,accidentals-flats,accidentals-both,
│                   bad-notation,bad-accidentals,caged-note}.txt   # NEW (add-only)
└── (extended) prefs/schema, state/preferences-store, state/notes-model, fretboard/*,
    instrument/tunings, i18n/{languages,catalogs}, language-panel, tool-layout
e2e/
├── notation.spec.ts               # NEW: US1–US4, no-#/b scan, glyph screenshot fixture
├── notation-layout.spec.ts        # NEW: 320 px × 200 % in solfège/flats/both
├── caged.spec.ts                  # + US5 solfège note
└── perf.spec.ts                   # + notation switch ≤ 100 ms
```

**Structure Decision**: This is a single SvelteKit project, and all work goes into directories
that already exist:
- `src/lib/notation`, `src/lib/state`, `src/lib/shell`, `src/lib/fretboard`, `src/lib/prefs`,
  `src/lib/instrument`, `src/lib/i18n`, and `src/lib/tools`;
- `messages/`, `tests/unit/`, `e2e/`, `docs/adr/`, and `docs/i18n/`.

No new directory and no new route. The new pure modules sit beside the code they serve:
- `policy.ts` in `src/lib/notation`, which is boundary-linted DOM-free and framework-free;
- `label-fit.ts` in `src/lib/fretboard`, because marker sizing is renderer-owned under
  Constitution III.

## Phase 0 / Phase 1 outputs

- [research.md](./research.md):
  - reactive notation source (R-01), syllables (R-02), language default (R-03);
  - accidental policy surfaces (R-04), display-model flag (R-05), string spelling (R-06);
  - tuning names and the CAGED name capture (R-07), spoken names (R-08), fit rule (R-09);
  - controls (R-10), CAGED note (R-11), prefs fields (R-12), startup (R-13);
  - "#/b" scan and screenshots (R-14), bundle (R-15), ADR (R-16).
- [data-model.md](./data-model.md), [contracts/notation-api.md](./contracts/notation-api.md),
  [contracts/notation-ui.md](./contracts/notation-ui.md), [quickstart.md](./quickstart.md).

## Risks

| Risk | Mitigation |
| --- | --- |
| A note-bearing string is computed outside a reactive scope and does not switch (found: the CAGED `tuningName` capture) | Fix it in R-07. The e2e "toggle reaches every surface" scan runs per tool after a switch. A review grep checks for `noteLabel(`/`spokenNote(` in module top-level constants and in values stored on stores |
| The accidental policy leaks into Triads or CAGED | The policy is opt-in only (`spellingPolicy`, `fixedSpelling`). The Triads and CAGED snapshot fixtures and the SC-003 test must stay unchanged |
| Bundle crosses 120 KB (020 projected 115–117 KB) | Measure right after the catalogs land, before UI work. Trim new prose first. A constitution amendment is the last resort (R-15) |
| Stacked "both" labels or long solfège labels overflow at 200 % zoom | The deterministic fit rule plus the `notation-layout.spec.ts` checks at 320 px × 200 % in pt-BR and es |
| Hydration mismatch when the first client render is solfège | The same pre-hydration restore as language (ADR 0013, 0019), plus the e2e no-hydration-warning assertion |
| Existing e2e assertions on note text break | Defaults stay letters and sharps for en, and the e2e projects pin `locale: 'en-US'` (020 R-12), so existing specs see unchanged text |

## Complexity Tracking

No constitution violations, so nothing needs justification.
