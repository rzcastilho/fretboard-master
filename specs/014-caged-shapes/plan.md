# Implementation Plan: The Five CAGED Shapes Along the Neck

**Branch**: `feature/014-caged-shapes` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-caged-shapes/spec.md`

## Summary

This slice adds CAGED as the third tool (`/caged`, home card "How does the whole neck
connect?", third navigation entry). It opens on C major and draws the five chord shapes
C → A → G → E → D along the whole neck. Each shape has a non-interactive tag ("E shape · roots
on strings 6, 4, 1") and interval-labelled root, third and fifth markers. The user picks any
of 12 keys and major or minor. Altered roots follow the Triads spelling rule and offer a
**Switch to {root}** command. On short boards only shapes that fully fit are drawn, with a
"With n frets, k shapes fit" note. Seven-string instruments use strings 6–1. Handedness and
orientation come free from the renderer. Tunings outside the FR-2.12 "Compatible" class show
an interim message instead of made-up shapes.

Technical approach ([research.md](./research.md)):

- **Shape tables**: a new pure `src/lib/theory/caged.ts` holds the TM-6.1 and TM-7.1 tables
  as data.
- **Placement**: occurrences come from the **real** open pitches. The drawing is fixed, and
  the shift is `rootPc − (string 6 pitch class − E)`, tried at octave offsets −12…+24 and kept
  only when every chord fret is in `0…fretCount`, then sorted by start fret. That yields the
  TM-6.2 cycle, the EC-6.2 next-octave rule and the EC-6.3 fit count with no special cases
  (R-02).
- **Tuning class**: an interval-based FR-2.12 classifier (R-03).
- **State and model**: a pure view state (`caged-view.ts`) and a display-model builder
  (`caged-model.ts`) feed the existing `Fretboard`. The renderer's only change is an optional
  `tagsInteractive: false` (R-06).
- **Shell wiring**: the tool registry, screens, route, layout branch, instrument
  orchestration, reset and `lastTool` picklist follow Triads exactly (R-09).
- **Tests**: table tests (TM-6.1, TM-6.2, TM-7.1) and fast-check properties satisfy the
  Principle I gate for the new theory code. TM-9 view 15 becomes a screenshot fixture.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node via mise (`mise.toml`)

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS, Valibot.
All are existing; **no new dependency**.

**Storage**: `localStorage` key `fretboard-master:prefs`, v1 record. The only change is that
`lastTool` accepts `"caged"`
([contracts/storage-format.md](./contracts/storage-format.md)). The CAGED key, quality and
spelling are session-only (an in-memory store).

**Testing**:

- Vitest + fast-check: theory tables and properties, view transitions, model, store,
  components, prefs fixtures.
- Playwright + @axe-core/playwright: `e2e/caged.spec.ts` and `e2e/caged-tm9.spec.ts`.
- TM-9 view 15 screenshot (phone, phone-touch, desktop), plus the left-handed variant.

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile. Static hosting
on Cloudflare Pages.

**Project Type**: Static single-page web application (SvelteKit, prerendered, single bundle per
ADR 0002)

**Performance Goals**:

- key or quality change → board updated ≤ 100 ms (Constitution VI; SC-004 asks < 200 ms);
- open CAGED ≤ 300 ms;
- instrument change ≤ 300 ms;
- smooth scroll with 7 strings × 24 frets.

**Constraints**:

- initial JS ≤ 90 KB gzip (currently 86.1 KB; estimate +2–3 KB, R-12);
- fully offline;
- 320–2560 px, with only the fretboard scrolling horizontally;
- 200 % text zoom;
- WCAG 2.2 AA;
- every string from the message catalog;
- shape letters are literal.

**Scale/Scope**:

- 10 reference shapes;
- 12 keys × 2 qualities;
- ≤ 9 occurrences on a 24-fret board;
- ≤ 7 × 25 cells;
- ~4 new source modules + 2 components + 1 route;
- ~7 existing modules touched;
- ~21 catalog keys;
- 2 new E2E specs;
- 1 ADR.

No open clarification item remained after the spec's two clarification sessions. Phase 0
resolved the design questions R-01 … R-14.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts): **PASS**,
with no unjustified violation. Complexity Tracking lists assumptions, test expectations that
change, and one budget risk.

**I. Musical Correctness (NON-NEGOTIABLE)**

- [x] Shapes match the theory reference: TM-6.1 and TM-7.1 are stored verbatim as data, and a
  table test compares all ten shapes' frets, degrees and root strings (contracts/caged-api §1,
  SC-003).
- [x] Spelling: altered roots reuse `effectiveRootSpelling` / TM-4.3 defaults from
  `theory/triad.ts`, and markers carry `spellTriad` spellings. The spelling scenario is
  tested (data-model §4).
- [x] Shapes are calculated from the configured tuning, string count and fret count, never
  standard-only: the start fret comes from the real string-6 pitch, and the fit comes from
  `fretCount`. AF-2, AF-21 and AF-23 are tested, plus random compatible tunings (R-02).
- [x] Theory merge gate: this slice introduces CAGED theory, so it adds the TM-6 / TM-7 table
  tests (TM-6.1, TM-6.2, TM-7.1) and fast-check property tests (pitch classes, fret bounds,
  cycle order, octave repeat, fit count, classifier). TM-6.4/6.5 and TM-7.4/7.5 arrive with
  layers in 004-caged/004, as FR-012 scopes. Existing TM-4.x/TM-5.5 suites run unchanged.
- [x] Each note sounds at its pitch: tapping a marker uses the existing `playback.note` on the
  real instrument (store `activate`).

**II. On-Device, Static, Private by Design**

- [x] All computation runs in the browser with a prerendered static route. There is no
  network, no accounts and no permissions. The only persisted value is the existing erasable
  `lastTool` field, which now also accepts `"caged"`.

**III. Pure Core, Thin Shell**

- [x] `src/lib/theory/caged.ts` imports only `./pitch` and `./triad` and takes pitches, not
  `Instrument`. The ESLint boundary enforces this.
- [x] One-way flow: CagedControls → `caged` store (view state) → `buildCagedModel` →
  `Fretboard`. The tool components compute no theory and draw no fretboard.
- [x] Handedness and orientation are applied only in `layoutFretboard` and the tag strip. The
  model is identical across the four combinations (tested).
- [x] Events in musical terms: `onactivate({string, fret})` is unchanged.
- [x] View state lives outside components in the `caged.svelte.ts` module singleton, ready for
  links and carry-over (004-caged/006).

**IV. Test-First for Logic, Tested Behavior for UI**

- [x] Theory, view state and the prefs change are written test-first. contracts/caged-api
  §1–§4 list the tests.
- [x] Every acceptance scenario US1-1 … US6-4 maps to an automated test (quickstart §3,
  Q1–Q27).
- [x] TM-9 view 15 (and its left-handed variant, the CAGED part of view 22) becomes a
  Playwright screenshot fixture. Views 16–21 need layers, focus or connections and arrive with
  003–005 and 002.
- [x] The tests are deterministic. There is no timing-dependent audio in this slice; tap
  playback is asserted through the existing audio log hook.

**V. Accessible by Default (WCAG 2.2 AA)**

- [x] The controls are native radio groups and a button. Fretboard arrow-key navigation is
  unchanged, tags are not Tab stops (no dead focus), and the Tab order is logical
  (contracts/caged-ui §6).
- [x] No information is conveyed by colour alone: there are root, third and fifth marker
  shapes plus interval labels, and the tags are text.
- [x] There is a text equivalent: the description override lists each occurrence with its
  frets, root strings and notes. The fit note and tuning message are polite status text, and
  accidentals are read in full.
- [x] axe reports zero violations in the C major, fit-note, Drop D message, left-handed /
  lowest-on-top, 320 px and 2560 px cases. Targets are ≥ 44 px through the existing controls.
  There is no new motion.
- [x] Sound is never the only carrier, because everything is visible and described.

**VI. Performance Budgets Are Gates**

- [x] The computation is O(5 × 4 × 6) per change via `$derived`. The perf suite adds "open
  CAGED ≤ 300 ms" and "key change ≤ 100 ms".
- [x] The bundle check stays a hard gate: the estimate is +2–3 KB against 3.9 KB headroom. It
  is mitigated by reusing components and adding no dependency. A breach requires an
  amendment, which is not pre-approved (Complexity Tracking).
- [x] Scrolling with 7 × 24 and nine tags is covered by the existing perf scroll case,
  extended to CAGED.

**VII. Design System Fidelity**

- [x] The fixed note-function code is reused (root square, third circle, fifth diamond). There
  are no new colours. Tags and messages use existing tokens, and the message uses neutral
  text, not error red.
- [x] The fretboard is the protagonist. The tool opens in its simplest state with no layer,
  label or connection controls. Main controls are not behind a menu.
- [x] All emphasis is `normal`, one of the four levels. Shared positions get no extra
  emphasis.
- [x] Works from 320 to 2560 px, with only the board scrolling. There are no modals, rewards
  or overlays.

**VIII. International From the First Line**

- [x] Every CAGED string is a catalog key (contracts/caged-ui §5), and `no-raw-text` covers the
  new components.
- [x] Note names come only from `src/lib/notation` (key name, Switch button, description).
  Shape letters are literal message parameters, never note-formatted (FR-009).
- [x] Accidentals render as ♯ ♭. Layouts wrap at 200 % zoom. Tag text is a single message per
  quality, so word order is translatable.

**IX. Untrusted Input, Versioned Formats**

- [x] The only stored change is a widened Valibot picklist. Invalid values still fall back
  independently, `version` stays 1, and one fixture is added with none removed.
- [x] Share links: N/A. No link codec exists yet, and CAGED links are out of this slice's
  scope (004-caged/006).
- [x] No input-derived content is rendered as HTML.

**X. Simplicity and Incremental Delivery**

- [x] The slice follows the breakdown wave order (`specs/autonomous/breakdown/004-caged/001-caged-shapes.md`)
  and ships independently: the interim message keeps non-compatible tunings honest until 002.
- [x] No speculative abstraction is added:
  - `tagsInteractive` has a real use now;
  - the view state is CAGED-specific (no shared "key store");
  - the tuning-class enum is defined by FR-2.12 and DM, and is not configurability.
- [x] There is no new runtime dependency.
- [x] "Never blank": a non-compatible tuning shows the message with controls kept, and short
  boards state the fit count.

**Workflow gates**

- [x] ADR planned: `docs/adr/0017-caged-occurrences-from-real-tuning.md`, which amends 0009 for
  non-interactive tags (R-14).
- [x] Conventional Commits, PR to `main`, CI merge gate unchanged. Local verification follows
  the tiers in CLAUDE.md (quickstart §1–§2).

## Project Structure

### Documentation (this feature)

```text
specs/014-caged-shapes/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-14
├── data-model.md        # Phase 1: shapes, tuning class, occurrences, view state, display, prefs
├── quickstart.md        # Phase 1: validation commands and scenarios Q1–Q27
├── contracts/
│   ├── caged-api.md         # internal module signatures + required tests
│   ├── caged-ui.md          # entry points, layout, drawing, texts, keyboard/SR
│   └── storage-format.md    # lastTool picklist widening, fixtures
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/caged.ts                    # NEW: shape tables, cagedTuningClass, cagedOccurrences
├── state/
│   ├── caged-view.ts                  # NEW: pure view state + transitions
│   ├── caged-model.ts                 # NEW: buildCagedModel → CagedDisplay (markers, tags, notes)
│   ├── caged.svelte.ts                # NEW: session store
│   ├── links.svelte.ts                # resetTool('caged'); no carry to/from caged
│   └── instrument.svelte.ts           # confirm/restore apply instrument to caged
├── tools/caged/
│   ├── CagedTool.svelte               # NEW: zones B/C/D, message branch, fit note
│   └── CagedControls.svelte           # NEW: key selector, quality, Switch to {root}
├── fretboard/
│   ├── types.ts                       # DisplayModel.tagsInteractive?
│   └── Fretboard.svelte               # span tags when non-interactive
├── shell/
│   ├── tools.ts                       # 'caged' tool entry (third)
│   ├── screens.ts                     # caged screen + title
│   └── ToolLayout.svelte              # caged branch + failure reset
└── prefs/schema.ts                    # TOOL_IDS + 'caged'

src/routes/caged/+page.svelte          # NEW
messages/en.json                       # ~21 caged_* / tool_caged_* keys
docs/adr/0017-caged-occurrences-from-real-tuning.md   # NEW

tests/unit/
├── theory/caged.test.ts               # NEW: TM-6.1, TM-6.2, TM-7.1, EC-6.3, tunings, classes
├── theory/caged.property.test.ts      # NEW
├── state/caged-view.test.ts           # NEW
├── state/caged-model.test.ts          # NEW
├── state/caged-store.test.ts          # NEW
├── caged/caged-tool.test.ts           # NEW (components)
├── prefs/fixtures/last-tool-caged.txt # NEW fixture
└── tools, screens, routes, tool-layout, prefs/schema, state/{preferences,links,instrument}-store,
    fretboard/fretboard, home-screen, app-nav tests (updated)

e2e/
├── caged.spec.ts                      # NEW: US1–US6, axe, a11y
├── caged-tm9.spec.ts                  # NEW: TM-9 view 15 (+ left-handed) snapshots
└── home, navigation, resilience, preferences, perf specs (updated)
```

**Structure Decision**: a single SvelteKit project at the repository root, in the layout the
constitution mandates. New code goes into the existing `src/lib/theory`, `src/lib/state`,
`src/lib/tools` (new `caged/` subfolder alongside `notes/` and `triads/`), `src/routes`
(new `caged/`, as the constitution's route list foresees), `messages/`, `docs/adr/`,
`tests/unit/` and `e2e/`. Audio, notation, instrument and prefs storage modules are not
modified beyond the `TOOL_IDS` constant.

## Complexity Tracking

No constitution violation requires justification. The assumptions, changed expectations and
risks below are recorded for review:

| Item | Decision | Rejected alternative / reason |
|---|---|---|
| Placement from real tuning | Fixed drawing, shift from string 6's pitch class, octave candidates filtered by `0…fretCount` (R-02) | Absolute-pitch root search per shape: same result, more code. Standard-only table: forbidden by Principle I |
| Tuning class | Interval rule over strings 6–1 (R-03); only `compatible` draws in this slice | Preset-id lookup: misclassifies custom tunings (011) |
| "Compatible with an altered string" (AF-4/AF-5) shows the interim message, not FR-6.15 drawing | Per the spec clarification (FR-016); FR-6.15 is 004-caged/002 | Drawing strings 5–1 now: pulls 002 scope forward |
| Non-interactive tags | `DisplayModel.tagsInteractive = false` renders text tags in the existing strip (R-06) | Disabled buttons (misleading to AT); separate overlay (duplicates layout and mirroring; tool would draw the board) |
| Switch spelling command | A standalone "Switch to {root}" button for altered roots (R-10) | Porting Triads' composition panel: out of scope, adds bundle |
| Tests that pinned `caged` as nonexistent | Expectations change: `/caged` is a known path, and `lastTool: "caged"` is kept. `wrong-types.txt` is unchanged in content with an updated expectation, and a new fixture is added (contracts/storage-format) | Deleting or rewriting fixtures: Principle IX says fixtures are only added |
| Bundle headroom | Estimate +2–3 KB against 3.9 KB headroom. Mitigated by reuse and no dependencies (R-12) | Lazy route chunk: forbidden by ADR 0002. **Risk**: if the check fails, a constitution amendment is required before merge, and it is not assumed here |
| TM-9 views 16–21 | Not fixtures in this slice: they need layers, focus, connections or other tuning classes | Partial fixtures now: would be rewritten by 002–005 |
| Description text | A full `description` override grouped by occurrence (R-08) | The default per-string description loses the shape grouping that is the tool's purpose |
