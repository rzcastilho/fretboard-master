# Implementation Plan: CAGED Across Tunings

**Branch**: `feature/015-caged-in-any-tuning` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-caged-in-any-tuning/spec.md`

## Summary

CAGED now behaves honestly in every tuning, replacing slice 014's interim message. The FR-2.12
classifier that already exists sorts tunings into three classes.

- **Compatible** tunings (Half step down, Whole step down, 7-string standard and half step
  down, Drop A) draw exactly the Standard shapes. Every note name, pitch and sound comes from
  the real tuning, and shape names describe the drawing.
- **Compatible with an altered string** (Drop D, Drop C, and their 7-string variants):
  - Shapes are placed and fitted from strings 5→1 only.
  - String 6 never shows the shape's original note. For G and E shapes it shows the key's
    chord tones whose real fret lies in the occurrence's chord-fret span; C, A and D shapes
    show nothing there.
  - String 6 carries a visible "altered" text mark, and tags omit string 6 from "roots on
    strings".
- **Non-compatible** tunings replace the board with the explanation "CAGED depends on the
  standard relationship between the strings, so its shapes don't exist in {tuning}." and two
  actions:
  - **View in standard tuning**: a per-view, never-stored temporary Standard or 7-string
    standard tuning, with a permanent "Temporary tuning: …" header badge.
  - **Go to Triads**.

Technical approach ([research.md](./research.md)):

- **Placement**: computed from string 5 (`shift = rootPc − (pc(s5) − 9)`, R-02). It is
  identical to slice 014 for compatible tunings and makes Drop D equal Standard. A new pure
  `alteredStringNotes` adds the region notes on string 6 (R-03), and `occurrenceRootStrings`
  fixes the tag text (R-04).
- **Store**: the CAGED store gains a `temporary` flag. Its effective instrument becomes
  `standardCounterpart(preferred)` (R-06). The flag ends on a real navigation
  (`+layout` `beforeNavigate`), on reload (module state), or on any instrument **Confirm**.
- **Shell**: `TuningBadge` renders the temporary variant (R-07). `links.svelte.ts` gains
  `openTriadsFromCaged` (R-09).
- **Renderer**: one optional `DisplayModel.stringMarks` field draws the "altered" text in the
  string-label column, which widens only when marks exist. Handedness and orientation come
  free (R-05).
- **Tests**: the TM-6/TM-7 table tests and properties are extended for the altered-string
  rule (Principle I gate, R-14). A new E2E spec covers US1–US3, the 14-preset sweep and axe.

Assumptions recorded (each from the spec's clarify sessions, or noted here where the plan adds
one):

- **7-string Drop D/Drop C variants** are `altered-string` by FR-001's pitch rule. The spec's
  edge case names only the 14 catalogue ids (R-01).
- **Reset tool keeps the temporary tuning**, because FR-010 lists the ending events
  exhaustively.
- **The non-compatible notice is a persistent fallback view**, not a dismissible notice
  (see Complexity Tracking).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node via mise (`mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS,
Valibot, all existing. **No new dependency.**

**Storage**: none changed. The `localStorage` `fretboard-master:prefs` v1 record is untouched,
and the temporary tuning lives only in the in-memory CAGED store (FR-009, SC-005). No URL
state.

**Testing**:

- **Vitest + fast-check**: theory tables and properties, `standardCounterpart`, model, store,
  instrument orchestration, links, renderer marks, components, badge.
- **Playwright + @axe-core/playwright**: new `e2e/caged-tunings.spec.ts`, edited
  `e2e/caged.spec.ts` interim cases, a perf case, and two new screenshot fixtures in
  `e2e/caged-tm9.spec.ts`.

**Target Platform**: evergreen browsers (last two majors), desktop and mobile, served
statically from Cloudflare Pages.

**Project Type**: static single-page web application (SvelteKit, prerendered, single bundle
per ADR 0002)

**Performance Goals**:

- instrument change on CAGED ≤ 300 ms (SC-006);
- key or quality change ≤ 100 ms;
- open CAGED ≤ 300 ms.

The added computation is ≤ 5 shapes × 4 octaves × ≤ 5 frets per change.

**Constraints**:

- initial JS ≤ 90 KB gzip (estimate +1.0–1.5 KB, R-13);
- offline;
- 320–2560 px with only the fretboard scrolling;
- 200 % text zoom;
- WCAG 2.2 AA;
- every string from the catalog;
- no storage or URL writes for the temporary tuning.

**Scale/Scope**:

- 3 tuning classes and 14 presets (plus the 7-string variants);
- 12 keys × 2 qualities;
- 2 new theory functions and 1 new instrument function;
- about 8 modules touched and 9 catalog keys (1 removed);
- 1 new E2E spec and 2 screenshots;
- 1 ADR.

No `NEEDS CLARIFICATION` remains: the spec's two clarify sessions settled every question, and
Phase 0 settled the design questions R-01 … R-15.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts):
**PASS**. One deviation is recorded and justified in Complexity Tracking (a non-dismissible
fallback notice).

**I. Musical Correctness (NON-NEGOTIABLE)**

- [x] Shapes match the theory reference: the TM-6.1/TM-7.1 tables are unchanged. The TM-8.1–8.3
  behaviours are covered by table tests T1–T13 (contracts/caged-api §1), including the SC-004
  worked examples.
- [x] Spelling: string-6 markers take `spellTriad` spellings like every other marker, and
  altered roots keep the TM-4.3 rule (data-model §8).
- [x] Shapes come from the configured tuning, string count and fret count. Placement uses real
  string-5 pitches, string-6 notes use the real string-6 pitch, and fit uses `fretCount`. The
  temporary standard keeps the string count and fret count (R-02, R-03, R-06).
- [x] Theory merge gate: CAGED's table and property suites (introduced in 014) are extended
  with altered-string cases T1–T13 and properties P1–P6 over random altered tunings. TM-6.1,
  TM-6.2, TM-7.1 and the TM-4.x/TM-5.5 suites run unchanged.
- [x] Each note sounds at its pitch: `caged.activate` plays on the effective instrument
  (the real tuning, or the temporary standard while it is active). Drop D string 6 fret 12 is
  D3 (FR-017, test M9).

**II. On-Device, Static, Private by Design**

- [x] All logic runs in the browser and there is no network. The temporary tuning is never
  written to storage or the URL, and no new persisted field exists. There are no accounts and
  no permissions.

**III. Pure Core, Thin Shell**

- [x] `theory/caged.ts` stays pure (imports `./pitch` and `./triad` only), and
  `standardCounterpart` stays in `src/lib/instrument`. The ESLint boundary rule is unchanged.
- [x] Data flow is one-way:
  - CAGED buttons → `caged` store (`temporary`, view state) → `buildCagedModel` → `Fretboard`;
  - the badge → `instrument.open()`.
  - Components compute no theory.
- [x] Handedness and orientation are applied only in the renderer: the "altered" mark is
  placed through `layoutFretboard`'s `labelCenter`, and the model is identical across the four
  layouts.
- [x] Events stay in musical terms: `onactivate({string, fret})` is unchanged.
- [x] View state and the temporary flag live in the `caged.svelte.ts` singleton, outside
  components.

**IV. Test-First for Logic, Tested Behavior for UI**

- [x] The theory, instrument helper, model, store and orchestration changes are test-first,
  per contracts/caged-api §1–§6.
- [x] Every acceptance scenario (US1-1…8, US2-1…3, US3-1…6) maps to an automated test
  (quickstart §4, contracts/caged-ui §7).
- [x] TM-9: the new Drop D and Open G notice screenshots extend the CAGED fixture set. The
  views that need layers or focus still belong to later slices.
- [x] Deterministic: no timers. Playback stops are asserted through the existing playback
  log.

**V. Accessible by Default (WCAG 2.2 AA)**

- [x] Keyboard: native buttons for both actions and the badge, a logical Tab order, and focus
  moves to the zone heading after **View in standard tuning** (caged-ui §2, §6).
- [x] Not colour alone: the "altered" mark, the temporary badge and the notice are all text.
  Marker shapes and labels are unchanged.
- [x] Text equivalent: the description states the tuning, the temporary tuning and the altered
  string, and the notice is `role="status"` (FR-013).
- [x] axe has zero violations in four new states, including left-handed/lowest-top and
  320 px (A1–A4). Targets are ≥ `--target-min`, and there is no new motion.
- [x] Sound is never the only carrier: real pitches are visible as note names and announced.

**VI. Performance Budgets Are Gates**

- [x] Instrument change ≤ 300 ms gets a new perf case. Key and quality changes are
  unaffected, because the work is O(shapes × octaves × span) inside `$derived`.
- [x] Bundle: +1.0–1.5 KB estimated with no dependency, measured by `pnpm verify`. A breach
  blocks the merge and needs an amendment, which is not pre-approved (Complexity Tracking).
- [x] Scrolling is unchanged: one extra SVG text and a wider label column only when marks
  exist.

**VII. Design System Fidelity**

- [x] The note-function code and colours are reused, the mark uses neutral text tokens, and
  there is no new colour. The column width comes from the new token `--fb-label-col-marked`,
  with no hard-coded values.
- [x] The fretboard is the protagonist: the mark sits in the existing label column and never
  covers frets. Main controls are not behind a menu.
- [x] Emphasis: all markers stay `normal`.
- [x] Notices: neutral colour, no modal, one sentence. The non-dismissible notice is a
  justified deviation (Complexity Tracking).
- [x] Works from 320 to 2560 px: the header badge and action buttons wrap, and only the board
  scrolls.

**VIII. International From the First Line**

- [x] Nine new catalog keys (caged-ui §5) and one removed. `no-raw-text` covers the new
  markup.
- [x] Note names come only from `src/lib/notation`. Tuning names come from the `tuning_*`
  catalog keys, and shape letters stay literal.
- [x] Accidentals render as ♯ ♭ (E♭, G♭ in US2). The notice and badge are single messages
  with a parameter, so word order can be translated, and they wrap at 200 % zoom.

**IX. Untrusted Input, Versioned Formats**

- [x] N/A for formats: this slice adds no stored or linked field. The prefs v1 schema and its
  fixtures are unchanged, no fixture is removed, and no share-link codec exists yet.
- [x] No input-derived HTML: the tuning name is a catalog string or "Custom".

**X. Simplicity and Incremental Delivery**

- [x] It follows the wave order: `specs/autonomous/breakdown/004-caged/002-caged-in-any-tuning.md`
  comes after 014 and ships independently.
- [x] No speculative abstraction:
  - `stringMarks` has one real use;
  - the `temporary` flag is CAGED-local, not a generic override system;
  - `standardCounterpart` serves this one need, where the alternative was duplicating
    `presetInstrument` and `withPresentation` in the store.
- [x] No new runtime dependency.
- [x] "Never blank": a non-compatible tuning shows an explanation plus two ways forward, and an
  empty string-6 region still shows the mark.

**Workflow gates**

- [x] ADR planned: `docs/adr/0018-caged-tuning-classes-and-temporary-tuning.md`, which
  amends ADR 0017's "only compatible draws" (R-15).
- [x] Conventional Commits and a PR to `main`. Local verification follows the CLAUDE.md tiers
  (quickstart §2). There is no full-matrix run locally.

## Project Structure

### Documentation (this feature)

```text
specs/015-caged-in-any-tuning/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-15
├── data-model.md        # Phase 1: classes, occurrence, store, display, renderer field
├── quickstart.md        # Phase 1: commands, manual scenarios Q1–Q16, traceability
├── contracts/
│   ├── caged-api.md     # internal signatures + required unit/property tests
│   └── caged-ui.md      # zone states, notice, badge, mark, catalog keys, E2E list
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

No `storage-format.md` contract is needed this time, because no persisted or linked format
changes (Principle IX N/A).

### Source Code (repository root)

```text
src/lib/
├── theory/caged.ts                 # string-5 placement, altered-string branch,
│                                   #   alteredStringNotes, occurrenceRootStrings, alteredString flag
├── instrument/tunings.ts           # standardCounterpart
├── state/
│   ├── caged-model.ts              # CagedContext, notice, temporaryName, stringMarks, description
│   ├── caged.svelte.ts             # temporary flag, effective instrument, viewInStandard,
│   │                               #   endTemporary, screenChanged, applyInstrument(next, name)
│   ├── instrument.svelte.ts        # confirm → caged.endTemporary(); pass tuningLabel
│   └── links.svelte.ts             # openTriadsFromCaged
├── fretboard/
│   ├── types.ts                    # DisplayModel.stringMarks
│   ├── geometry.ts                 # marked label-column width
│   ├── metrics.ts                  # --fb-label-col-marked metric
│   └── Fretboard.svelte            # draw string marks
├── tools/caged/CagedTool.svelte    # non-compatible notice + two actions (replaces interim text)
├── shell/TuningBadge.svelte        # temporary badge variant
└── styles/tokens.css               # --fb-label-col-marked

src/routes/+layout.svelte           # beforeNavigate → caged.screenChanged()
messages/en.json                    # +9 caged_* keys, −caged_tuning_unavailable
docs/adr/0018-caged-tuning-classes-and-temporary-tuning.md   # NEW

tests/unit/
├── theory/caged.test.ts, theory/caged.property.test.ts      # T1–T14, P1–P6
├── instrument/tunings.test.ts                                # standardCounterpart
├── state/caged-model.test.ts, caged-store.test.ts,
│   instrument-store.test.ts, links-store.test.ts             # M1–M9, store, orchestration
├── fretboard/fretboard.test.ts, fretboard/geometry.test.ts   # string marks
├── caged/caged-tool.test.ts                                  # notice + actions (interim case rewritten)
└── tuning-badge.test.ts                                      # temporary variant

e2e/
├── caged-tunings.spec.ts           # NEW: E1–E14, A1–A4
├── caged.spec.ts                   # interim-message expectations updated
├── caged-tm9.spec.ts               # + Drop D, Open G notice snapshots
└── perf.spec.ts                    # + CAGED instrument change ≤ 300 ms
```

**Structure Decision**: one SvelteKit project at the repository root, in the
constitution-mandated layout. All changes land in existing directories:

- `src/lib/theory`, `src/lib/instrument`, `src/lib/state`, `src/lib/fretboard`;
- `src/lib/tools/caged`, `src/lib/shell`, `src/lib/styles`, `src/routes`;
- `messages/`, `docs/adr/`, `tests/unit/`, `e2e/`.

The slice adds no new route, tool folder or module. The audio, notation, prefs and
instrument-config modules are not modified.

## Complexity Tracking

| Item | Decision | Rejected alternative / reason |
|---|---|---|
| **Deviation (Principle VII "notices dismissible")**: the non-compatible notice cannot be dismissed | It is the zone-C fallback view that replaces the fretboard (Principle X "never blank"), as slice 014's interim message was. It is one sentence plus two actions, in neutral colour, with no modal | Dismissible notice: dismissing would leave zone C empty, or would draw invented shapes (Principle I) |
| Placement from string 5 for every drawable class | One formula, equivalent to 014's for compatible tunings (R-02) | Per-class placement functions: duplicated candidate and fit loop |
| String-6 notes only for G and E shapes | Clarify default: C, A and D shapes mute string 6 in Standard, so adding notes would invent a voicing | Region notes for every shape: contradicts the clarify answer |
| 7-string Drop D/Drop C variants treated as altered-string | FR-001's pitch rule governs. The spec's edge case refers to the 14 catalogue ids only (R-01) | Forcing them to non-compatible: contradicts FR-001 and gives a worse experience |
| Reset tool keeps the temporary tuning | FR-010 lists the ending events exhaustively, and Reset is not among them | Ending on Reset: unspecified behaviour |
| Temporary tuning kept out of `CagedViewState` | Key, quality and Reset must not change it, and it is not part of a future share link | Putting it in the view state: Reset and `equalsCagedView` would need special cases |
| "Altered" mark as SVG text in a widened label column | Text next to the string label, mirrored for free (R-05) | HTML legend: not "next to its label". Colour only: violates Principle V |
| `buildCagedModel` gets a `CagedContext` (tuning name, temporary) | Keeps the model free of shell and instrument-store imports (R-12) | Importing `tuning-names` into state: wrong layering, risk of an import cycle |
| Existing interim-message tests | Expectations change (AF-4 now draws, and non-compatible shows the new notice); the tests are edited, not deleted | Deleting the tests: loses coverage |
| Bundle headroom | +1.0–1.5 KB estimated, with no dependency. **Risk**: if `check-bundle-size` fails, a constitution amendment PR is needed before merge, and it is not assumed | Lazy chunk: forbidden by ADR 0002 |
