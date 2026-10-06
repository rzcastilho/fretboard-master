# Research: Letters or Solfège, Sharps or Flats

**Feature**: `021-note-notation-and-accidentals` | **Date**: 2026-10-05 | **Plan**: [plan.md](./plan.md)

Phase 0 resolves every open technical question before design. The spec's Clarifications
section already fixes the product behavior (defaults, fit rule, storage shape, surfaces). The
items below decide *how* the codebase delivers it. No `NEEDS CLARIFICATION` remains.

Codebase facts this research rests on (read on 2026-10-05):

- `src/lib/notation/notation.ts` (86 lines) is already the only note formatter. It exports
  `defaultSpelling`, `flatSpelling`, `noteLabel`, `spokenNote`, `spokenNoteList`, `pitchLabel`,
  `noteList`, and `intervalLabel`, and it imports Paraglide `m` and `getLocale`.
- Those functions are called from about 20 files: `Fretboard.svelte`, `fretboard/description.ts`,
  `NoteSelector.svelte`, `notes/{NotesTool,StringFilter,PositionCard}.svelte`,
  `triads/{TriadsTool,CompositionPanel}.svelte`, `caged/CagedControls.svelte`,
  `shell/InstrumentPanel.svelte`, and `state/{notes,triads,caged}-model.ts`. All of them run
  inside `$derived` or template expressions, which is the property slice 020 relied on for
  language switching (ADR 0019).
- Spoken names use the catalog keys `note_spoken_{natural,sharp,flat,double_sharp,double_flat}`
  with a `{letter}` parameter, in all three catalogs.
- Preset tuning names live in `messages/*.json` as `tuning_af1 … tuning_af23`, with literal
  letters ("Drop D", "Aberta em G"), and are resolved by `src/lib/shell/tuning-names.ts`.
- `caged.applyInstrument(inst, tuningLabel(tuning))` stores the tuning *name string* in the CAGED
  store (`tuningName`). That string is frozen at apply time.
- `Instrument.openStrings` holds `SpelledPitch` values. Presets carry their own spelling (TM-2),
  and custom tunings are spelled with sharps (`tuningStrings`, 011 R-03).
- The marker label tokens exist already: `--marker-label-size: 0.875rem`,
  `--marker-label-min-size: 0.75rem`, `--marker-root`, `--marker-medium`, `--marker-small`.
- The prefs record is v1, with additive optional fields `rotateHint` (016), `tempo` (019), and
  `language` (020). The fixtures in `tests/unit/prefs/fixtures/` are add-only.

---

## R-01 — How notation and accidental choices reach every note name reactively

**Decision**: `src/lib/notation/notation.ts` reads the active notation context through one
replaceable getter, `overwriteNotationSource(get: () => NotationContext)`. The context is
`{ notation: 'letters' | 'solfege'; accidentals: 'sharps' | 'flats' | 'both' }`. The default
getter returns `{ letters, sharps }`, so Vitest and prerender behave exactly as today. A new
runes store, `src/lib/state/notation.svelte.ts`, installs a getter that reads its `$state` on
`start()`. Every `noteLabel` and `spokenNote` call inside a `$derived` therefore tracks the
notation state, so a switch re-renders in place.

**Rationale**:
- This is the same mechanism that made language switching work (020 R-01,
  `overwriteGetLocale`). It is proven in this codebase, with no remounts and no prop threading.
- It keeps `src/lib/notation` free of Svelte imports, as its ESLint boundary already requires.
- FR-018 ("one notation source") is satisfied by construction. Call sites keep calling the same
  functions, and only the functions' output changes.

**Alternatives considered**:
- *Pass the notation as a parameter to every formatter.* Rejected: it touches about 60 call
  sites and the display-model signatures, and a forgotten parameter silently keeps letters.
- *Re-key (`{#key}`) the tool on a switch.* Rejected: it remounts the tool, which loses focus
  and transient state (FR-006 "without altering tool state"), and it breaks motion.
- *Import a Svelte store inside notation.* Rejected: it violates the notation lint boundary.

## R-02 — Where the solfège syllables come from

**Decision**: Seven new catalog keys, `note_name_solfege_{c,d,e,f,g,a,b}`, in each catalog:
- en: Do Re Mi Fa Sol La Si
- es: Do Re Mi Fa Sol La Si
- pt-BR: Dó Ré Mi Fá Sol Lá Si

Letters stay literal (`'C'…'B'`) in code. A new function, `noteName(letter)`, returns the letter
or `m.note_name_solfege_<x>()`. `noteLabel`, `pitchLabel`, and `spokenNote` all go through
`noteName`.

**Rationale**:
- Constitution VIII says a new language needs only catalog files, and syllables are
  language-specific (pt accents).
- The existing completeness and placeholder-parity tests (020 R-08) cover the new keys
  automatically.
- English solfège equals Spanish solfège, and the identical-text allowlist
  (`tests/unit/i18n/identical-allowlist.ts`) gains these keys.

**Alternatives considered**:
- *A hard-coded per-locale table in notation.* Rejected: a fourth language would then need a
  code change.
- *Paraglide variants.* Rejected: no benefit over plain keys, and plain keys are the house style
  (020 R-07).

## R-03 — Default notation per language (FR-004)

**Decision**: Each `LANGUAGES` entry in `src/lib/i18n/languages.ts` gains a data field,
`notation: Notation`, with values `en: 'letters'`, `pt-BR: 'letters'`, and `es: 'solfege'`. The
notation store computes the effective notation as
`$derived(chosen ?? defaultNotation(language.current))`.

`language.current` is already the effective language (stored, else device, else English), so the
store re-derives on every language change until the user makes an explicit pick. The types
`Notation` and `AccidentalPolicy` and their allowed-value arrays live in a new pure module,
`src/lib/notation/policy.ts`. That module has no Paraglide import, so `i18n` and `prefs` can
import its types without pulling in the catalogs.

**Rationale**: Adding a language stays a catalog plus data registration, the same allowance 020
FR-013 accepted. The derive-until-chosen rule mirrors the 020 language pattern ("stored only when
explicit").

**Alternatives considered**:
- *Store the derived default at first launch.* Rejected: a later language change would not move
  the notation, which contradicts FR-004.
- *Put the default in the catalog as a message.* Rejected: it is behavior, not text.

## R-04 — Accidental policy: which surfaces read it, and how

**Decision**: Three spelling helpers in notation read `accidentals` from the context:

| Function | sharps | flats | both |
|---|---|---|---|
| `singleSpelling(pc)` (one-name slot) | sharp | flat | sharp |
| `spellingPair(pc)` (preferred first; `[s]` for naturals) | `[♯, ♭]` | `[♭, ♯]` | `[♯, ♭]` |
| `markerSpellings(pc)` (what a Notes marker may draw) | `[♯]` | `[♭]` | `[♯, ♭]` |

The surfaces that use them:
- **Notes model** (`src/lib/state/notes-model.ts`): card info (`spellingPair`), detected-triad
  root, missing-notes notice, listen and description text (`singleSpelling`), and descriptions
  under "both" (the spoken pair).
- **NoteSelector**: `spellingPair`, with the label joined by " / " and the spoken name from
  `note_spoken_either`.
- **Fretboard**, through a display-model flag (R-05).
- **Open-string names** (R-06).

Triads and CAGED never call these helpers. Their markers carry theory spellings, and their
unspelled background markers keep `defaultSpelling` (sharps), as FR-009 requires.

**Rationale**: The preference applies only to "single notes" (FR-007), so it must stay an
explicit opt-in per surface, not a global change to `defaultSpelling`. A global change would leak
flats into Triads and CAGED background notes and break FR-009 and SC-003.

**Alternatives considered**:
- *Make `defaultSpelling` honor the preference.* Rejected for the leak described above.
- *Pass the policy as a parameter.* Rejected for the same reason as in R-01. The helpers read the
  context, but the decision to *use* them is per surface.

## R-05 — Telling the Fretboard which markers follow the preference

**Decision**: `DisplayModel` (in `src/lib/fretboard/types.ts`) gains an optional field,
`spellingPolicy?: 'preference'`. When it is absent, behavior is today's: an explicit
`mk.spelling` wins, otherwise `defaultSpelling`. Only the Notes model sets it. When it is set, an
unspelled marker's label, hover hint, and description use `markerSpellings`, `singleSpelling`,
and the spoken pair respectively.

**Rationale**:
- Constitution III: tools hand the renderer a display model, and the renderer formats labels
  through notation.
- A single optional field leaves the Triads and CAGED models untouched, and their snapshot
  fixtures stay byte-identical.

**Alternatives considered**:
- *The Notes model puts `spelling` and `altSpelling` on every marker.* Rejected: it fattens up to
  168 markers per model and duplicates the policy.
- *Detect the tool inside the Fretboard.* Rejected: it couples the renderer to tool identity.

## R-06 — Open-string names: presets keep their spelling, custom tunings follow the preference

**Decision**: `Instrument` gains `readonly fixedSpelling: boolean`. `tuningInstrument` sets it to
`true` for presets, which includes a custom tuning that canonicalizes to a preset, because
`tuningFromOffsets` already returns `kind: 'preset'` for those. It is `false` for unmatched custom
tunings. Notation exports `stringSpelling(open: Spelling, fixed: boolean)`, which returns `fixed ?
open : singleSpelling(pitchClassOfSpelling(open))`.

Users: Fretboard nut labels (`openLabel`), `StringFilter`, the `InstrumentPanel` custom editor
rows and summary, and string names in descriptions. The preset list rows in `InstrumentPanel`
are always presets, so they stay unchanged.

The octave is unchanged by construction. Respelling only ever maps X♯ to the next letter's ♭
(C♯→D♭ … A♯→B♭), never to C♭ or B♯, so the octave never crosses.

**Rationale**: FR-010 and EC-8.5 are satisfied with one boolean that already follows from how
tunings are built. The flag is plain data, not presentation logic, so Constitution III holds:
the instrument module stays DOM-free and notation does the formatting.

**Alternatives considered**:
- *Re-spell custom tunings in `tuningStrings` based on the preference.* Rejected: it makes
  `src/lib/instrument` depend on a user preference, and it invalidates the memoized instruments.
- *Look up the tuning kind in the instrument store from the Fretboard.* Rejected: the Fretboard
  must take everything from its props.

## R-07 — Note references inside preset tuning names

**Decision**: These tuning names become parameterized:
- `tuning_af4` ("Drop {note}"), `af5`, `af6` ("Double Drop {note}"), and `af23`
- `af8`–`af11` ("Open {note}", "Aberta em {note}", "Abierta en {note}")

`tuning-names.ts` passes `noteLabel({ letter, accidental: 0 })`, so the names follow notation:
"Drop Re", "Aberta em Sol". `tuning_af7` ("DADGAD") stays a literal proper name.

In addition, `caged.applyInstrument(next, name)` stops storing a name string. It stores the
`Tuning` and derives the label (`tuningLabel(tuning)`) inside its display `$derived`, so the
unsupported-tuning notice also switches language and notation in place.

**Rationale**: FR-006 lists "preset tuning names". The CAGED capture is the one place found where
a note-bearing string is computed outside a reactive scope. This is the exact risk 020 recorded
("string computed outside a reactive scope does not switch").

**Alternatives considered**:
- *Leave the tuning names literal.* Rejected by the spec's Clarifications.
- *A notation-specific copy of each tuning name in the catalog.* Rejected: it doubles 9 keys × 3
  catalogs and can disagree with the note source (FR-018).

## R-08 — Spoken names (FR-013)

**Decision**: `spokenNote(s)` passes `noteName(s.letter)` into the existing `note_spoken_*`
messages. The parameter is renamed `{letter}` → `{note}` in all three catalogs, because it now
carries syllables too. The placeholder-parity test enforces the rename.

A new key, `note_spoken_either: "{first} or {second}"` ("ou" in pt-BR, "o" in es), replaces
`notes_selector_altered_spoken`, whose `{sharp}`/`{flat}` parameter names would lie once flats
lead. A new helper, `spokenPair(pc)`, returns the single spoken name for naturals and the joined
pair, preferred first, for altered notes.

The results:
- en letters: "F sharp"; en solfège: "Fa sharp"
- pt-BR: "Fá sustenido"; es: "Fa sostenido"
- doubles from the catalog

**Rationale**: It reuses the catalog structure that already reads accidentals in full, so no
"hash" or "b" can appear. One key for the "or" join serves the selector, the card, and the
descriptions.

**Alternatives considered**:
- *`Intl.ListFormat` disjunction for two items.* Acceptable, and `noteList` uses it for visible
  lists. A catalog key is chosen for spoken text so translators control the wording, consistent
  with the existing `notes_selector_altered_spoken`.

## R-09 — Marker label fit rule (FR-012, FR-008)

**Decision**: A pure module, `src/lib/fretboard/label-fit.ts`, exports:

```text
fitMarkerLabel(lines: readonly string[], markerSize: 'small' | 'medium' | 'root')
  → { lines: readonly string[]; size: 'normal' | 'min' }
```

Graphemes are counted with `Array.from(text).length`, which treats code points as graphemes. The
catalog syllables are NFC-precomposed (Dó, Ré, Fá, Lá), and 𝄪/𝄫 are single astral code points
that `Array.from` keeps whole. The rule is:
- one line: ≤ 3 graphemes → `normal`; 4 → `min`; ≥ 5 → abbreviate, then re-test at `min`.
- abbreviation: (1) shorten a note-name part longer than 2 graphemes to 2 graphemes (this only
  ever affects "Sol" → "So"); (2) drop a trailing octave digit.
- two lines (only under "both"): allowed only when `markerSize` is `medium` or `root` and each
  line is ≤ 3 graphemes; then `min`. Otherwise fall back to the first (sharp) line through the
  one-line rule.

Label parts come from a new notation helper, `noteLabelParts(s, octave?)`, which returns
`{ name, accidental, octave }`. Abbreviation can then act on the name part without parsing text.
The Fretboard renders the result as one `<text>`, or two `<tspan>`s, with a class that selects
`--marker-label-size` or `--marker-label-min-size`. The visible label is `aria-hidden` as today.
Accessible names come from the description and cell names, which always use the full spoken text.

**Rationale**:
- The spec mandates "pure, deterministic, no DOM measurement", which also keeps SSR and jsdom
  equal.
- Generic truncation to 2 graphemes keeps the rule language-neutral (no per-language
  abbreviation keys), and it yields exactly the specified "Sol" → "So".
- The rule lives with the renderer, because marker size is a presentation concept that
  Constitution III keeps out of notation.

**Alternatives considered**:
- *`Intl.Segmenter`.* Rejected: unnecessary for the closed alphabet here, and it adds a
  polyfill concern on older evergreen browsers.
- *Measuring with `getComputedTextLength`.* Rejected: not deterministic, absent in jsdom, and
  forbidden by the clarification.

## R-10 — Controls: the panel groups and the bar toggle (FR-005)

**Decision**:
- `LanguagePanel.svelte` renders, under `LanguageSelector`, a new `NotationSelector.svelte` with
  two native radio fieldsets:
  - "Note names": Letters / Solfège
  - "Accidentals": Sharps / Flats / Both

  The panel's `aria-label` text becomes "Language and notation", and the close button becomes
  "Close language and notation settings" (in all three catalogs).
- A new component, `NotationToggle.svelte` (in `src/lib/shell/`), goes in the `ToolLayout.svelte`
  header. It is placed before `LanguagePanel`, and ToolLayout is used only by Notes, Triads, and
  CAGED, so About and Home do not get it. It is a `role="group"` with `aria-label` "Note names"
  and two `<button aria-pressed>` options.
- The option texts are built through notation, so they cannot disagree with the rest of the
  page:
  - `noteName` of C, D, E in letters gives "C D E".
  - The same in solfège gives "Do Re Mi" (pt "Dó Ré Mi").
- Both controls call `notation.choose(n)` and read `notation.effective`, so they share one state.
  Targets use `--target-min` (44 px).

**Rationale**:
- Native radios bring keyboard behavior and grouping for free (V), the same pattern as
  `LanguageSelector` (020 R-10).
- A two-button `aria-pressed` group is the WAI-recommended pattern for a binary toggle whose
  options are both visible. It is operable with Tab and Enter/Space.
- Placing the toggle in the bar keeps the main control out of a menu (VII).

**Alternatives considered**:
- *A single switch (`role="switch"`).* Rejected: a switch reads as on/off, while here both
  options must be visible and named.
- *A `<select>`.* Rejected: it hides the options behind an interaction.

## R-11 — The one-time CAGED solfège note (FR-015)

**Decision**: The prefs field is `cagedNote: true`, stored only when true. The preferences store
exposes `cagedNoteShown` and `markCagedNoteShown()`, mirroring `rotateHintShown` and
`markRotateHintShown()` (016).

`CagedTool.svelte` adds an `$effect`: when `notation.effective === 'solfege'` and the note was
never shown, it sets `noteOpen = true` and calls `markCagedNoteShown()` in the same tick. That
covers both opening CAGED and switching while it is open. The note renders with the existing
`Notice` component (non-blocking, dismissible, ≤ 2 lines) and is independent of the rotate hint.

The text is `caged_solfege_note` with parameters `{c} {a} {g} {e} {d}`, filled with
`solfegeName(letter)`, so syllables match the language.

**Rationale**: This copies the proven rotate-hint lifecycle, including "recorded the moment it
appears" and the in-load flag when storage is unavailable.

**Alternatives considered**:
- *Record on dismiss.* Rejected: a reload before dismissal would show the note again, which
  contradicts the spec.

## R-12 — Preferences record fields (FR-016)

**Decision**: Three additive optional fields in the v1 record, placed in serializer order after
`language`:

| Field | Values | Written when | Invalid or absent → |
|---|---|---|---|
| `notation` | `'letters'` \| `'solfege'` | explicit choice (non-null) | `null` (follow language) |
| `accidentals` | `'flats'` \| `'both'` (reader also accepts `'sharps'`) | not `'sharps'` | `'sharps'` |
| `cagedNote` | `true` | true | `false` |

Each field has its own `v.fallback`, so other fields are kept. `PREFS_VERSION` stays 1. Records
from slices ≤ 020 serialize byte-identically, because none of the fields are written at their
defaults. New add-only fixtures:
- `notation-solfege.txt`, `notation-letters.txt`
- `accidentals-flats.txt`, `accidentals-both.txt`
- `bad-notation.txt`, `bad-accidentals.txt`
- `caged-note.txt`

`erase()` restores notation to `null` (follow language), accidentals to `'sharps'`, and
`cagedNoteShown` to `false`.

**Rationale**: Constitution IX, plus the established precedent (`rotateHint`, `tempo`,
`language`).

**Alternatives considered**:
- *Bump the record to v2.* Rejected: these are purely additive, and older readers ignore unknown
  keys.

## R-13 — Startup and hydration

**Decision**: `preferences.start()` calls `notation.start({ chosen, accidentals })` right after
`language.start(...)`, before hydration, which is the same point as the instrument and language
restores (ADR 0013, ADR 0019). The prerendered HTML stays English letters. A first client render
in solfège is then a client-side state difference applied before hydration, as language already
is. The e2e suite asserts no hydration warnings.

**Rationale**: It reuses the established startup ordering. No new hook is needed.

## R-14 — Verifying "no # or b" and glyph alignment (FR-011, SC-004)

**Decision**:
- `e2e/notation.spec.ts` iterates language × notation × accidentals (3 × 2 × 3 = 18 combinations,
  set through `localStorage` before load) over the three tools. It collects `innerText` plus
  `aria-label` texts and asserts no `#` and no match of
  `\b([A-G]|Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si)b\b`.
- A Playwright screenshot fixture, "accidental glyphs", renders F♯, Sol♯, F𝄪, and B𝄫 on root and
  medium markers through `MarkerSample.svelte`. It is generated for phone, phone-touch, and
  desktop with `-g` only.
- 200 % text zoom is checked in `e2e/notation-layout.spec.ts` with the existing
  `setTextScale` and `expectNoTruncationOrOverlap` helpers, in pt-BR and es solfège with flats and
  both.

**Rationale**: It follows the spec's own test clarification and the 020 layout-spec pattern.
Locally only the desktop project runs (Constitution verification tiers).

## R-15 — Bundle impact

**Decision**: Estimated +1.0–1.8 KB gzip. That covers:
- about 15 new or changed keys × 3 catalogs (syllables, panel labels, toggle, CAGED note, spoken
  "either");
- `policy.ts`, `label-fit.ts`, the notation store, and two small components.

There is no new dependency. The existing accidentals font subset (ADR 0006) already covers ♯ ♭ 𝄪
𝄫, and accented syllables use the system UI font.

020 projected 115–117 KB against the 120 KB cap. The first implementation checkpoint therefore
measures with `node scripts/check-bundle-size.mjs build` after the catalogs land. If the build is
over the cap, shorten new prose first, and amend the constitution only as a last resort (the same
contingency as 020 R-06).

## R-16 — ADR

**Decision**: Write ADR `docs/adr/0020-notation-context-and-accidental-policy.md`, recording:
- the replaceable notation source (R-01);
- the per-surface accidental opt-in through `spellingPolicy` and `fixedSpelling` (R-04–R-06);
- the grapheme fit rule (R-09).

**Rationale**: These are architecturally significant cross-cutting decisions (Constitution
workflow, "Decisions").
