# Implementation Plan: Seven-String Guitars

**Branch**: `feature/012-seven-strings` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-seven-strings/spec.md`

## Summary

Add a **6 / 7 strings** choice to the instrument panel (slices 009–011). The string count
becomes a field of `InstrumentConfig`; tuning stays the 011 tagged union `preset | custom
(offsets)` in **canonical form, now per count**: 7 strings list AF-21, AF-22, AF-23, AF-3 …
AF-11 (AF-1/AF-2 are represented by AF-21/AF-22), custom offsets have one entry per string
over B1 E2 A2 D3 G3 B3 E4. Changing 6 → 7 prepends a copy of string 6's offset (string 7 a
perfect fourth below), 7 → 6 drops it, and re-canonicalization gives every name in the
clarifications (Standard → 7-string standard, Drop D → Drop D, Drop A → Standard). String 7 of
a 6-string preset is spelled by a new pure `fourthBelow` theory helper. Every consumer already
iterates `Instrument.stringCount`, so the fretboard, Notes, Triads (set 7-6-5 via
`stringSets`) and sound work from the real tuning; the plan adds the `--fb-string-width-7`
token, the Notes string-filter rule on count change (add 7 iff all on; drop 7 silently; notice
only when the filter would be empty), the optional `strings` field in the v1 preferences record,
and tests pinning TM-5.5 7-6-5 and every acceptance value. Technical approach and alternatives:
[research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node via mise (`mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS, Valibot
(all existing; **no new dependency**)

**Storage**: `localStorage` key `fretboard-master:prefs`, v1 record + optional `strings`
([contracts/storage-format.md](./contracts/storage-format.md))

**Testing**: Vitest + fast-check (units, properties, components); Playwright +
@axe-core/playwright (phone 360 px, desktop); TM-9 screenshot fixtures views 4 and 13

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile; static hosting
on Cloudflare Pages

**Project Type**: Static single-page web application (SvelteKit, prerendered)

**Performance Goals**: control change → fretboard ≤ 100 ms; instrument change ≤ 300 ms; tap to
sound ≤ 100 ms; smooth scroll/drag with 7 strings × 24 frets (Constitution VI, NFR-1.6)

**Constraints**: initial JS ≤ 85 KB gzip (slice estimate < 1 KB: 3 presets, 1 helper, ~6
messages — R-13); fully offline; 320–2560 px; 200 % text zoom; WCAG 2.2 AA; 6-string behavior
byte-for-byte unchanged (FR-019, SC-006)

**Scale/Scope**: 2 string counts, 14 preset ids (12 shown on 7 strings), 7 × 25 = 175 board
cells max; ~8 modules touched, 1 panel component extended, ~6 catalog messages, 13 fixture
records, 1 ADR

No open clarification item remained after the spec's Clarifications session; Phase 0 resolved
design questions R-01 … R-15.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts): **PASS**,
no violations (Complexity Tracking lists assumptions only).

**I. Musical Correctness**

- [x] Notes/pitches match the theory reference — AF-21/22/23 stored with TM-2 spelling; derived
  rows table-tested (data-model §1); string 7 = string 6 − 5 semitones by construction (R-04).
- [x] Spelling rules — `fourthBelow` applies the TM-4 letter rule with exact accidental (R-05);
  custom tunings keep the 011 sharps rule.
- [x] Shapes from configured tuning — Triads computes 7-6-5 from `setOpenPitches` of the real
  instrument; no diagram data (R-10).
- [x] Theory merge gate — TM-5.5 7-6-5 table test (12 shapes) added; NFR-9.3 property test
  extended to 7-string tunings; `fourthBelow` table + property test (contracts/tuning-api §7).
- [x] Each note sounds at its pitch — `positionPitch` → `frequencyOf`, tested B1 = 35, A1 = 33
  (R-12).

**II. On-Device, Static, Private**

- [x] All logic in the browser; no network, no accounts, no permissions; the only persisted data
  is the existing erasable preferences record with one more field.

**III. Pure Core, Thin Shell**

- [x] `fourthBelow` lives in `src/lib/theory` (pure, no UI imports); tunings/offsets stay in
  `src/lib/instrument`; transitions pure in `src/lib/state/instrument-config.ts`.
- [x] One-way flow unchanged: panel action → `InstrumentConfig` → `Instrument` → display model
  → renderer; handedness/orientation still read only by `screenOrder` (R-14).
- [x] Tools neither calculate theory nor draw; view state stays in the stores.

**IV. Test-First**

- [x] Every acceptance scenario mapped to a test (quickstart §3 table, Q1–Q18); unit tests
  written before code for theory, instrument, prefs (contracts/tuning-api §7).
- [x] TM-9 views 4 (Notes, 7 strings) and 13 (Triads E minor 7-6-5) become Playwright
  screenshot fixtures.
- [x] Deterministic: audio checked through the existing playback test hook, no real time.

**V. Accessible by Default**

- [x] String-count radios are native, keyboard-operable, ≥ 44 × 44 px; string 7 reachable by
  arrow keys; text description includes string 7 with accidentals in full (FR-018).
- [x] String 7 distinguished by thickness and label, not color; notice announced politely;
  axe zero violations on all 7-string views (SC-008).

**VI. Performance Budgets**

- [x] Perf suite gains 7 × 24 cases (instrument change ≤ 300 ms, control change ≤ 100 ms,
  scroll smoothness); bundle check stays a gate, estimated impact < 1 KB (R-13).

**VII. Design System Fidelity**

- [x] New visual value only as token `--fb-string-width-7`; row height token unchanged so
  markers never touch (R-08); notice reuses the existing non-blocking, dismissible component.
- [x] Main controls stay out of menus; fretboard never covered; works 320–2560 px.

**VIII. International**

- [x] New strings (`tuning_af21`–`tuning_af23`, `instrument_strings_legend`,
  `instrument_strings_option`, `{count}` in summaries) live in `messages/en.json`; note names
  only through `src/lib/notation`; ♯ ♭ glyphs only.

**IX. Untrusted Input, Versioned Formats**

- [x] `strings` parsed by Valibot with per-field fallback (rule 10–13), never throws; `version`
  stays 1 under the documented extension rule; 13 fixtures added, none removed.
- [x] No input rendered as HTML. Share links: N/A — no link codec exists yet and string count in
  links belongs to the sharing wave (spec Assumptions).

**X. Simplicity and Incremental Delivery**

- [x] Vertical slice in wave order (breakdown 003-your-instrument/004); no new abstraction —
  the count is a field, offsets a variable-length array (R-01, R-03); no new dependency.
- [x] "Never blank; adjust and tell": 7-6-5 → 6-5-4 and empty Notes filter → all strings, both
  with the one-line notice (R-09, R-10).

**Workflow gates**

- [x] ADR planned: `docs/adr/0015-string-count-and-seven-string-canonical-form.md` (amends ADR
  0012 store contract, 0013 record, 0014 canonical form) — R-15.
- [x] Conventional Commits, PR to `main`, CI merge gate unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/012-seven-strings/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-15
├── data-model.md        # Phase 1: string count, presets per count, offsets, transitions
├── quickstart.md        # Phase 1: validation commands and scenarios Q1–Q18
├── contracts/
│   ├── instrument-panel-ui.md   # panel string-count group, 7-string list, tool surfaces
│   ├── tuning-api.md            # internal module signatures + required tests
│   └── storage-format.md        # `strings` field, reader/writer rules, fixtures
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/pitch.ts                    # + fourthBelow
├── instrument/
│   ├── tunings.ts                     # StringCount, AF-21/22/23, presetsFor, presetStrings,
│   │                                  #   normalizePresetId, count-aware tuning functions
│   ├── custom-tuning.ts               # variable-length Offsets, referencePitches,
│   │                                  #   addSeventh/dropSeventh, StringNumber 1…7
│   ├── instrument.ts                  # unchanged (already count-generic)
│   └── string-sets.ts                 # unchanged (7-6-5 from stringSets)
├── state/
│   ├── instrument-config.ts           # stringCount in config, setStringCount
│   ├── instrument.svelte.ts           # setStringCount, stringCount, presets, rows 7…1, remember
│   ├── notes-view.ts                  # adaptNotesView string-filter rule
│   ├── preferences.svelte.ts          # restore with stringCount
│   └── triads-view.ts                 # unchanged (tests only)
├── prefs/schema.ts                    # `strings` field, count-aware tuning/customTuning
├── fretboard/Fretboard.svelte         # .string-7 stroke
├── shell/
│   ├── InstrumentPanel.svelte         # Strings radio group, list from presetsFor(count)
│   ├── InstrumentSummary.svelte       # {count} in summary
│   └── tuning-names.ts                # AF-21/22/23 names
└── styles/tokens.css                  # --fb-string-width-7

messages/en.json                       # new keys, {count} parameter
docs/adr/0015-string-count-and-seven-string-canonical-form.md

tests/unit/
├── theory/{pitch,triad-shape}.test.ts (+ property)
├── instrument/{tunings,custom-tuning}.test.ts (+ property)
├── state/{instrument-config,instrument-store,notes-adapt,triads-view}.test.ts
├── prefs/schema.test.ts + prefs/fixtures/*.txt (13 new)
├── fretboard/fretboard.test.ts
└── instrument-panel.test.ts, tuning-badge.test.ts

e2e/
├── seven-strings.spec.ts              # NEW: US1/US4 flows
├── instrument-panel.spec.ts, preferences.spec.ts
├── notes.spec.ts, notes-tm9.spec.ts (+ view 4 snapshot)
├── triads.spec.ts, triads-tm9.spec.ts (+ view 13 snapshot)
├── fretboard.spec.ts                  # keyboard reach, marker spacing
└── perf.spec.ts                       # 7 × 24 cases
```

**Structure Decision**: Single SvelteKit project at the repository root, using the
constitution's source layout. All changes land in existing directories — `src/lib/theory`,
`src/lib/instrument`, `src/lib/state`, `src/lib/prefs`, `src/lib/fretboard`, `src/lib/shell`,
`src/lib/styles`, `messages/`, `tests/unit/`, `e2e/`, `docs/adr/` — plus one new e2e spec file
and one ADR. No new directory or module boundary.

## Complexity Tracking

No constitution violations. Assumptions taken in headless mode (each reversible), with the
rejected alternative:

| Assumption / decision | Why | Rejected alternative |
|---|---|---|
| String count is an `InstrumentConfig` field; presets resolved per count | AF-3 … AF-11 exist for both counts, so an id cannot imply the count (R-01) | Per-count preset ids (AF-4/7 …) — doubles ids, catalog and storage picklist |
| `Offsets` becomes variable length (6 or 7) instead of a 6-tuple | One code path for custom tuning, matching, storage; adding string 7 = prepend string 6's offset (R-03) | Separate `seventh` field — special case everywhere a tuning is iterated |
| Writer omits `strings` when 6 | Keeps every 6-string record byte-identical to 011 (SC-006) | Always writing `strings` — changes existing outputs/fixtures expectations |
| Handedness/orientation for string 7 verified at `screenOrder` level only | Product ships right-handed/highest-top only; renderer is the single reader (R-14) | Building handedness controls now — out of slice scope |
| `fourthBelow` returns `null` for B𝄪 instead of a triple-sharp spelling | Accidental type is −2 … +2; never reached by presets (data-model §2) | Widening the accidental type — speculative |
