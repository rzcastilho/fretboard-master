# Research: The Five CAGED Shapes Along the Neck

**Feature**: `014-caged-shapes` | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-04

The spec's two clarification sessions left no open clarification item. Phase 0 therefore
resolves the design questions that the spec leaves to the plan. Each entry gives the decision,
the reasoning, and the alternatives considered. Sources: the spec, the constitution (1.5.0),
`11-music-theory-reference.md` (TM-6, TM-7, TM-8), `03-functional-requirements.md` (FR-2.12,
FR-6.x), and the existing code in `src/lib/**`.

---

## R-01 — Where the shape tables live and what they hold

**Decision**: a new pure module `src/lib/theory/caged.ts` holds the ten reference shapes as
data. Each shape is `{ id: 'C'|'A'|'G'|'E'|'D', quality, strings }`. `strings` is indexed from
string 6 to string 1 (the TM table order). Each entry is either `null` (muted) or
`{ fret, degree }`, where `fret` is the C-key reference fret and `degree` is `'R' | '3' | 'b3' | '5'`.
Root strings are **derived** from the degrees, not stored, so the tag text and the table can
never disagree.

**Rationale**: Principle I makes TM-6.1 and TM-7.1 the source of truth. Copying them verbatim
as data makes the FR-012 table test a direct comparison. The theory boundary (ESLint
`no-restricted-imports` on `src/lib/theory/**`) allows only `./pitch` and `./triad`, and the
module needs nothing else. Reusing the `IntervalId` from `./triad` (`'R' | '3' | 'b3' | '5'`)
means markers carry the same interval ids Triads already renders.

**Alternatives considered**:
- *Deriving the shapes algorithmically from open chords*: this is fragile for Cm and Gm, which
  have substituted or muted strings (TM-7.1 notes) and so no generic rule. Rejected.
- *Storing absolute frets per key*: 24 tables instead of 2, and it hides the "shift by
  semitones" rule from TM-6.1. Rejected.

## R-02 — Computing occurrences from the real tuning

**Decision**: `cagedOccurrences(sixOpen, rootPc, quality, fretCount)` takes the open pitches
of the six highest strings (string 6 → 1, as MIDI numbers) and computes:

1. `t = pitchClass(sixOpen[0]) − 4` (E = 4). This is the transposition of the instrument's
   string 6 from standard E.
2. `s = mod(rootPc − t, 12)`. This is the shift in frets from the C-key, standard-tuning
   reference.
3. For each of the five shapes and each octave offset `o ∈ {−12, 0, 12, 24}`, the candidate
   frets are `ref + s + o` on non-muted strings. The candidate is kept iff every chord fret is
   in `0…fretCount` (FR-006).
4. Results are sorted by lowest chord fret, ties broken by cycle order (they cannot tie in
   practice).

**Rationale**: TM-8.1 says that in a compatible tuning the drawing is fixed and only the
position moves. The position is fully determined by string 6's pitch class, because the
compatibility check (R-03) guarantees the other five strings follow. Sorting by start fret
reproduces the cycle C → A → G → E → D automatically, because the reference spans
(0–3, 3–5, 5–8, 8–10, 10–13) tile the octave in that order. The "below the nut → next octave"
rule (EC-6.2) needs no special case: the candidate at `o = −12` is rejected and the one at
`o = 0` is kept. Hand-checked against TM-6.2:

| Key | s | Result (first cycle) | TM-6.2 |
|---|---|---|---|
| C | 0 | C 0, A 3, G 5, E 8, D 10 | ✓ |
| D♭ | 1 | C 1, A 4, G 6, E 9, D 11 | ✓ |
| G | 7 | G 0 (12−12), E 3, D 5, C 7, A 10 | ✓ |
| F♯ | 6 | E 2, D 4, C 6, A 9, G 11 | ✓ |
| C, AF-2 (t = −1) | 1 | C 1, A 4, G 6, E 9, D 11 | spec FR-004 ✓ |

The full 12-key × 2-quality table on 24 frets is FR-012's table test (contracts/caged-api §1).

**Alternatives considered**:
- *Using `triadShape` per string set to find positions*: this finds triads, not chord shapes,
  and cannot express muted strings. Rejected.
- *Absolute-pitch search for each shape's root on its root string*: equivalent in result but
  more code, and the result then depends on which root string is chosen. Rejected (YAGNI).

## R-03 — Tuning class (FR-2.12) in this slice

**Decision**: `cagedTuningClass(sixOpen)` in `src/lib/theory/caged.ts` returns
`'compatible' | 'altered-string' | 'non-compatible'` from the five intervals between
consecutive strings among the six highest (string 6 → 1):

- `[5,5,5,4,5]` → compatible;
- the last four intervals equal `[5,5,4,5]` but the first interval (string 6 → 5) is not 5,
  i.e. strings 5 → 1 are standard and string 6 is changed → altered-string (AF-4, AF-5:
  `[7,5,5,4,5]`);
- anything else → non-compatible.

The function takes pitches, not an `Instrument`, so the theory boundary holds. For seven
strings, `src/lib/state/caged-model.ts` passes strings 6 … 1 and ignores string 7. AF-21,
AF-22 and AF-23 are therefore compatible (spec clarification), and so is a custom tuning
whose six higher strings keep the standard intervals. In this slice, only `'compatible'` draws
shapes. Both other classes show the interim message (FR-016). The class is still computed in
full so that 004-caged/002 can add FR-6.15 without changing it.

**Rationale**: FR-2.12 defines the classes by intervals, not by preset ids. An interval rule
covers custom tunings (011) and seven strings (012) with one function and one property test.
Expected classes per preset (table test): AF-1, AF-2, AF-3, AF-21, AF-22, AF-23 → compatible;
AF-4, AF-5 → altered-string; AF-6 … AF-11 → non-compatible.

**Alternatives considered**:
- *A preset-id lookup table*: this misclassifies custom tunings, so it breaks Principle I for
  011 users. Rejected.
- *Returning a boolean "compatible"*: 002 would then need a second function. The three-way
  enum costs nothing now and is named in DM (CAGED compatibility class). Kept as an enum.
  Splitting the altered-string case off is not speculative, because data-model DM lists the
  enum as a derived attribute.

## R-04 — View state and the spelling rule

**Decision**: a pure `src/lib/state/caged-view.ts` holds
`CagedViewState { rootPc, spellingOverride: 'none' | 'sharp' | 'flat', quality: 'major' | 'minor' }`
and the transitions `selectRoot`, `setQuality`, `switchSpelling`, `resetCaged`, and
`equalsCagedView`. Spelling resolves through the existing
`effectiveRootSpelling(pc, quality, override)` / `defaultRootSpelling` / `otherRootSpelling`
from `src/lib/theory/triad.ts`. `selectRoot` resets the override to `'none'`, and
`setQuality` keeps it. That matches the spec test D♭ maj → C♯ min → (switch) D♭ min →
D♭ maj.

**Rationale**: this has the same shape as `triads-view.ts` (ADR 0008: view state outside
components, pure transitions, no-op returns the same object). The rule is already
implemented and tested for Triads (TM-4.3 tie-breaks included), so CAGED reuses it rather than
re-deriving it.

**Alternatives considered**:
- *Sharing `TriadsViewState`*: CAGED has no inversion, string set or view mode. Sharing would
  couple the two tools' resets and session state, and FR-017 says that one tool's key must not
  affect the other. Rejected.
- *A generic "key" store for both tools*: a new abstraction that the spec does not ask for in
  this slice (context carry-over is 004-caged/006). Rejected under Principle X.

## R-05 — Display model and markers

**Decision**: `buildCagedModel(view, instrument)` in `src/lib/state/caged-model.ts` returns
`CagedDisplay`:

- `tuningClass`;
- `occurrences` (for the description and tests);
- `fitCount` (k) and `showFitNote` (`k < 5`);
- `model: DisplayModel`.

When `tuningClass !== 'compatible'`, it returns `model: null` and the tool renders the
message in place of the board. Otherwise:

- **Markers**: one per chord position. `function` comes from the degree (R → `root`,
  3 / ♭3 → `third`, 5 → `fifth`) and `emphasis` is `'normal'`. `interval` is the degree id,
  `spelling` comes from `spellTriad(effectiveRoot, quality)`, and the `id` is
  `${string}:${fret}`. Positions shared by two occurrences (TM-6.3) are deduplicated (first
  wins, which `DisplayModel` already requires). Muted strings yield no marker.
- **Label mode**: `labelMode: 'interval'`.
- **Tags**: one `FretboardTag` per occurrence, with `id = ${shape}@${startFret}`,
  `start`/`end` = the lowest and highest chord fret, `label` = the tag text, `name` = the same
  text, and `pressed: false`.
- **Description**: a full replacement string (R-08).
- **Scrolling**: no `autoScroll`. The full neck is shown from the nut, as Triads Full neck does
  when nothing is selected.

Shape letters are inserted as literal parameters into catalog messages (`{shape}` → `"E"`),
never passed through `src/lib/notation` (FR-009, FR-015). The minor "m" suffix is part of the
message (`caged_tag_minor: "{shape}m shape · roots on strings {strings}"`), so a future
language can change word order.

**Rationale**: the one-way flow is control → view state → display model → renderer
(Principle III). The tool computes nothing, and the renderer draws markers and tags it
already knows. Mapping degrees onto the existing note functions keeps the fixed product-wide
marker code (Principle VII).

## R-06 — Non-interactive tags in the existing tag strip

**Decision**: add one optional field `DisplayModel.tagsInteractive?: boolean`, default
`true`. When it is `false`, `Fretboard.svelte`'s `tagStrip` renders each tag as a `<span
class="tag">`, not a `<button>`. It uses the same measured width, `layoutTags` placement,
tokens and edge rules (handedness and orientation, ADR 0016), and it has no `aria-pressed`
and no click handler. The strip keeps `role="group"` and its "Shapes" label. CAGED sets it to
`false`. Triads is untouched.

**Rationale**: the spec puts tag focus in 004-caged/003, so a focusable button that does
nothing would be an accessibility defect (a Tab stop with no action). `layoutTags` already
guarantees "never overlap" by stacking rows (FR-007). This reuses the whole layout, so the
mirroring and orientation from 013 come for free (FR-013).

**Alternatives considered**:
- *A CAGED-only tag overlay outside `Fretboard`*: this duplicates the layout and the 013
  mirroring, and it breaks "tools don't draw the fretboard" (Principle III). Rejected.
- *Disabled buttons*: these are announced as unavailable controls, which is misleading.
  Rejected.

## R-07 — The interim message for non-compatible tunings

**Decision**: when `tuningClass !== 'compatible'`, `CagedTool.svelte` renders, in the
fretboard zone (zone C), a `<p role="status">` with
`m.caged_tuning_unavailable()`. It has no buttons. The key and quality controls (zone B) stay
rendered with their values. The model recomputes from the instrument store, so switching back
to Standard redraws the board at once. The message uses neutral text tokens, never error red
(Principle VII), and is not dismissible, because it *is* the view, not a notice layered on
one.

**Rationale**: this follows FR-016 and Principle X's "never blank". Its future replacement
(002) adds the two action buttons in the same slot.

## R-08 — Text description and announcements (FR-014)

**Decision**: `CagedDisplay.model.description` is built in `caged-model.ts` from catalog
messages:

- the summary sentence is "{key}: {count} shapes along the neck." Each occurrence then
  follows in order as "{S} shape, frets {lo} to {hi}, roots on strings {list}: string {s}
  fret {f} {interval}; …";
- open strings use "string {s} open {interval}";
- intervals are spoken as "root", "major third", "minor third", "fifth", and the existing
  `spokenNote` covers keys ("D flat").

The exact strings are in contracts/caged-ui §4.

The fit note and the tuning message are `role="status"` (polite). The key selector and the
quality group are the existing labelled radio groups (`NoteSelector`, `ChoiceGroup`).

**Rationale**: the fretboard's computed description lists positions string by string, which
loses the shape grouping that is this tool's whole point. A `description` override is the
existing mechanism (`DisplayModel.description`) and needs no renderer change.

## R-09 — Shell integration: tool id, route, home card, last tool, reset

**Decision**:

- `ToolId` gains `'caged'`, and `TOOLS` gains a third entry (`/caged`, `tool_caged_name`
  "CAGED", `tool_caged_question` "How does the whole neck connect?"). The order is Notes,
  Triads, CAGED. `SCREENS` gains `caged`.
- `src/routes/caged/+page.svelte` renders `<ToolLayout tool="caged" />`.
- `ToolLayout` gets a `{:else if tool === 'caged'}<CagedTool />` branch, and the failure-view
  reset includes `caged`.
- `prefs/schema.ts` `TOOL_IDS` gains `'caged'`. `lastTool: "caged"` was previously parsed to
  `null` and now parses to `'caged'`. The format stays `version: 1`, because the change only
  widens an allowed set, and an older app reading a newer record falls back to `null`, which
  it already does.
- `links.svelte.ts`: `resetTool` accepts `'caged'`. `linkTools` is a no-op whenever `caged`
  is on either side (FR-017: no carry in this slice; FR-1.6 is 006). `LinkedTool` widens to
  `ToolId`.
- `instrument.svelte.ts` `confirm`/`restore` also call `caged.applyInstrument(inst)`. CAGED
  never adjusts its view (all 24 keys are always valid), so it never raises the adjustment
  notice.
- **Reset tool**: a button in CAGED's secondary zone (`caged_reset` "Reset tool") calls
  `caged.reset()`, which returns C major with no override. The instrument is not changed.
- **History**: key and quality changes only touch the store, never `goto`, so they add no
  history entry (FR-1.8). This is the same as the existing tools.

**Rationale**: every touch point mirrors the existing Triads wiring, and ADR 0002's single
bundle means the new route needs no lazy chunk. Existing tests that pinned `/caged` as an
*unknown* path (`tests/unit/screens.test.ts`, `e2e/resilience.spec.ts`) or `'caged'` as an
invalid `lastTool` (`tests/unit/prefs/schema.test.ts`, `tests/unit/state/preferences-store.test.ts`,
`e2e/preferences.spec.ts`, fixture `wrong-types.txt`) were placeholders for a tool that did not
exist yet. Their expectations change, and no fixture file is deleted (see Complexity Tracking).

## R-10 — Spelling switch command placement

**Decision**: CAGED's controls show a **Switch to {root}** button under the key selector, only
when `isAlteredRoot(rootPc)`. It uses `otherRootSpelling` to name the target (for example
"Switch to C♯"). The key heading ("D♭ major") and the description use the effective spelling.
The button text is a new key, `caged_switch_spelling`, formatted with `noteLabel` (so the
accidental glyphs come from `src/lib/notation`, Principle VIII).

**Rationale**: the spec asks for the "same as Triads" command. Triads shows it as
"Switch to {root}" inside its composition panel, which CAGED does not have. A standalone
button with identical wording and behaviour is the minimal equivalent.

## R-11 — Seven strings and handedness/orientation

**Decision**: there is no CAGED-specific code. `caged-model.ts` maps shape string index `i`
(0 = string 6) to fretboard string `6 − i`, so string 7 never receives a marker (FR-010).
Handedness and orientation are applied by `layoutFretboard` and the tag strip (ADR 0016) to
whatever model they receive (FR-013). Tests assert the same marker set in all four
combinations and with seven strings.

## R-12 — Performance and bundle budget

**Decision**: the computation is O(5 shapes × 4 octaves × 6 strings), done once per view or
instrument change through `$derived`, which is far under the 100 ms budget (SC-004 asks for
< 200 ms). `e2e/perf.spec.ts` gains "CAGED key change ≤ 100 ms" and "open CAGED ≤ 300 ms"
cases.

The last measured bundle is **86.1 KB** gzip (slice 013) against a 90 KB cap. The estimate
for this slice is +2.0–3.0 KB (theory tables ~0.4 KB, view/model ~0.8 KB, store ~0.3 KB, two
Svelte components ~0.8 KB, ~20 messages ~0.4 KB), which leaves ~1 KB of headroom. To keep it:

- reuse `NoteSelector`, `ChoiceGroup` and `Notice` styling;
- add no new dependency;
- keep the tables compact (one `number | null` array plus a parallel degree string per
  shape).

If `check-bundle-size.mjs` fails, the constitution requires an amendment to raise the budget.
That is recorded as a risk and is not pre-approved here.

**Alternatives considered**: *lazy-loading CAGED* is forbidden by ADR 0002 (single bundle for
version continuity). Rejected.

## R-13 — Test strategy (Principle IV)

**Decision**:

- **Theory (test-first)**: `tests/unit/theory/caged.test.ts`:
  - the TM-6.1 and TM-7.1 tables (frets, degrees and root strings of all ten shapes in C);
  - the TM-6.2 table for 12 keys × {major, minor} on 24 frets (sequence and start frets);
  - the EC-6.3 count cases (C/12 → 4, G/12 → 5, D♭/13 → 4, C/24 → nine occurrences);
  - AF-2, AF-21 and AF-23 starts;
  - the tuning class for each preset.
- **Properties**: `tests/unit/theory/caged.property.test.ts`, with fast-check over random
  compatible tunings (random string-6 pitch, with the standard intervals above it), keys,
  qualities and fret counts 12–24:
  - every drawn chord note has the shape's pitch class for its degree;
  - every fret is within `0…fretCount`;
  - occurrences come in cyclic order;
  - an occurrence 12 frets higher has the same shape;
  - k ∈ {4, 5};
  - random non-standard interval sets never classify as compatible.

  These extend the NFR-9.3-style property suite to CAGED, which the constitution's Principle I
  scope note requires from this slice.
- **State and model**: `tests/unit/state/caged-view.test.ts`, `caged-model.test.ts` and
  `caged-store.test.ts` cover transitions, the spelling scenario, markers and tags, the fit
  note, the interim class and 7 strings.
- **Components**: `tests/unit/caged/caged-tool.test.ts` checks that there are no
  layer/label/connection controls, the message branch, and the switch button.
- **E2E**: `e2e/caged.spec.ts` covers US1–US6 and axe, and `e2e/caged-tm9.spec.ts` covers
  the TM-9 view 15 screenshot plus view 15 left-handed (the CAGED part of view 22). Existing
  specs are updated as listed in R-09.

Local runs follow CLAUDE.md tiers: `pnpm vitest run <paths>`, `pnpm test:e2e:fast e2e/caged*.spec.ts`,
and `pnpm verify` once at the end.

## R-14 — ADR

**Decision**: write `docs/adr/0017-caged-occurrences-from-real-tuning.md`. It records:

- the drawing-is-fixed, start-fret-from-string-6 computation (R-02);
- the interval-based tuning class (R-03);
- the non-interactive tag variant (R-06).

It amends ADR 0009 (tags) for the `tagsInteractive` flag.

**Rationale**: the computation rule constrains slices 002–006, which makes it architecturally
significant.
