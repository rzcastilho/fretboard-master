# Phase 0 Research: CAGED Across Tunings

Feature: `specs/015-caged-in-any-tuning/spec.md`. Each decision below states what was chosen,
why, and what was rejected. No `NEEDS CLARIFICATION` item remained after the spec's two
clarification sessions; the items here resolve design questions only.

Baseline read for this research (slice 014, merged at `7ac64d2`):

- `src/lib/theory/caged.ts` already has `cagedTuningClass` (interval rule over strings 6→1)
  returning `'compatible' | 'altered-string' | 'non-compatible'`, and `cagedOccurrences`
  returns `[]` for anything but `'compatible'`.
- `src/lib/state/caged-model.ts` returns `model: null` for every non-compatible class, and
  `CagedTool.svelte` then shows the interim `caged_tuning_unavailable` message.
- `TuningBadge.svelte` (header) shows the FR-2.10 badge from `instrument.active` and opens the
  panel through `instrument.open()`, whose `openPanel(panel, active)` already selects the
  preferred instrument.
- `+layout.svelte` `beforeNavigate` already notifies stores on every real screen change.

---

## R-01 Tuning classification (FR-001)

**Decision**: keep the existing `cagedTuningClass(sixOpen)` unchanged. It compares the five
adjacent intervals of the six highest strings with `[5, 5, 5, 4, 5]`; all equal →
`compatible`; only 6→5 differs → `altered-string`; else `non-compatible`.

**Rationale**: it depends only on open pitches, so custom tunings (slice 011) and transposed
presets classify correctly. Table check of all 14 presets: AF-1, AF-2, AF-3, AF-21, AF-22,
AF-23 → compatible; AF-4, AF-5 → altered-string; AF-6 … AF-11 → non-compatible. Existing
tests already cover this.

**Finding recorded**: the 7-string variants of Drop D and Drop C (AF-4/AF-5 at 7 strings,
which `presetStrings` builds as A1-D2-A2-D3-G3-B3-E4 and G1-C2-G2-C3-F3-A3-D4) are
`altered-string` under the pitch rule. The spec's edge case says "Under the FR-2.12 table no
7-string preset is of this class" — that is true of the 14 catalogue ids, and FR-001
("classified from its open-string pitches") governs the derived variants. They get the
altered-string behaviour on string 6, and string 7 stays marker-free as in slice 014. A unit
test pins this.

**Rejected**: classification by preset id — misclassifies custom tunings and the 7-string
derived presets.

## R-02 Placement in an altered-string tuning (FR-004, clarify session 2)

**Decision**: compute the shift from **string 5** for every drawable class:
`shift = mod12(rootPc − (pc(string5) − 9))` (A = 9 is string 5's standard pitch class).
Octave candidates −12…+24 as in slice 014. For `altered-string`, the table's string-6 cell is
dropped before the fit test, so `start`/`end` and the fit rule use strings 5→1 only.

**Rationale**: in a compatible tuning `pc(s6) − 4 ≡ pc(s5) − 9 (mod 12)`, so the shift is
identical to slice 014 for every compatible tuning (no behaviour change, existing table tests
keep passing). In Drop D the shift equals Standard's, so occurrence frets match Standard for
the same key (clarify test). Drop C matches Whole step down (US3-6).

**Rejected**: deriving from string 6 (wrong for altered strings); a separate placement
function per class (duplicates the candidate/fit loop).

## R-03 Notes on the altered string (FR-005, FR-006, FR-017)

**Decision**: new pure function in `theory/caged.ts`:

```ts
alteredStringNotes(open6: Pitch, rootPc: PitchClass, quality: CagedQuality,
                   lo: number, hi: number): readonly OccurrenceNote[]
```

It walks frets `lo…hi` (the occurrence's inclusive chord-fret span on strings 5→1) and keeps
each fret whose real pitch class is a chord tone: root → `'R'`, +4 → `'3'` (major) or +3 →
`'b3'` (minor), +7 → `'5'`. Only shapes whose table plays string 6 (G and E, both qualities)
call it; C, A, D shapes get nothing on string 6.

Worked check (Drop D, string 6 = D2, pc 2):

| Key / shape | span 5→1 | frets on string 6 → note | result |
|---|---|---|---|
| D major E shape | 10–12 | 10 C, 11 C♯, 12 D | D (R) at 12 only |
| D major G shape | 7–10 | 7 A, 8 A♯, 9 B, 10 C | A (5) at 7 only |

Both equal SC-004. An empty result is legal (FR-006); the "altered" mark is string-level and
does not depend on it.

**Rationale**: spans are ≤ 4 frets, so the loop is trivial; it is total and pure. Since a
custom offset difference between strings 6 and 5 is in `[−11, 11] \ {0}`, a string-6 note can
never equal the table's original note at the table fret (FR-004); it can be a *different*
chord tone at that fret, which is real and allowed.

**Rejected**: transposing the table note on string 6 by the tuning difference (moves the
note outside the region and invents a stretch); showing the table note "greyed" (violates
FR-004).

## R-04 Tag text in an altered-string tuning (FR-003)

**Decision**: tag and description root-string lists come from a new
`occurrenceRootStrings(occ)` that returns `rootStrings(shape)` minus string 6 when
`occ.alteredString` is true. Shape name text never changes.

E shape in Drop D → "E shape · roots on strings 4, 1"; G shape → "G shape · roots on strings
3, 1". Compatible tunings keep the Standard text.

## R-05 "Altered" mark rendering (FR-005, FR-014, Principle III/V)

**Decision**: extend `DisplayModel` with an optional
`stringMarks?: readonly { string: number; label: string }[]`. The renderer draws the label as
SVG text in the string-label column of that row, under the existing "6 D" label. When any mark
is present, the label column widens from `--fb-label-col` to a new token
`--fb-label-col-marked`. Mirroring uses the existing `labelCenter`, so handedness and
orientation come free. The mark is `aria-hidden` like the other labels; the description
carries it for assistive tech.

**Rationale**: text, not colour (Principle V); presentation stays in the renderer
(Principle III); one optional model field with a concrete use.

**Rejected**:

- An HTML legend outside the SVG: not "next to its label" (clarify default).
- Painting string 6 a different colour: colour alone, and colour reuse is forbidden.
- Putting "altered" inside the board at fret 0: collides with open-string markers (E shape in
  low keys).

## R-06 Temporary standard tuning (FR-009, FR-010)

**Decision**:

- The CAGED store gains `temporary = $state(false)`. The effective instrument is
  `$derived(temporary ? standardCounterpart(preferred) : preferred)`, where `preferred` is the
  existing `instrument` field fed by `applyInstrument`.
- New pure `standardCounterpart(inst)` in `src/lib/instrument/tunings.ts`: same string count,
  fret count, handedness and orientation; open strings of `standardTuningId(stringCount)`.
  It reuses `presetInstrument` and `withPresentation`.
- `caged.viewInStandard()` sets `temporary = true` (no-op unless the class is
  `non-compatible`); `caged.endTemporary()` clears it.
- **Ending**:
  - `+layout.svelte` `beforeNavigate` calls `caged.screenChanged()` on every real path change
    (the same hook as `instrument.screenChanged()`), so leaving CAGED drops it.
  - Reload drops it: module state only.
  - `instrument.confirm()` calls `caged.endTemporary()` first, before its "unchanged" early
    return, so confirming even the same instrument ends it (FR-010, US1-8).
  - `cancel()` does nothing, so dismissing the panel keeps it.
- Key, quality, spelling and **Reset tool** do not touch it (FR-010 lists the ending events
  exhaustively).
- Turning it on or off stops playback with reason `instrument`, like any instrument change.

**Rationale**: nothing is written to `preferences` or the URL (SC-005). The panel already
opens on `instrument.active`, so the preferred instrument is selected with no change.

**Rejected**:

- Writing a temporary config into `instrument.active`: it would leak into other tools and
  into `preferences.remember`.
- A URL flag: forbidden by FR-009.
- Ending on `Reset tool`: not in FR-010's list.

## R-07 Temporary badge (FR-009, FR-014)

**Decision**: `TuningBadge.svelte` reads `caged.temporaryName` (a localized tuning name or
`null`). When it is non-null the badge renders as a button labelled
`caged_temporary_badge` ("Temporary tuning: {name}"), with an accessible name from
`caged_temporary_badge_label` ("Temporary tuning: {name}. Open instrument panel"). This
replaces the normal FR-2.10 badge; the click path (`rememberOpener` + `instrument.open()`) is
unchanged.

It is visible at every width because the header already wraps (`flex-wrap`). There is no
time-out.

**Rejected**:

- A second badge beside the FR-2.10 one: the clarify answer says "replaced by".
- A badge inside the CAGED zone: the FR-2.10 badge lives in the header, so this keeps one
  place.

## R-08 Non-compatible state view (FR-007, FR-008, FR-016)

**Decision**: zone C shows a `role="status"` paragraph with
`caged_tuning_unsupported({ tuning })`, followed by two buttons in order:
**View in standard tuning** (`caged.viewInStandard()`) and **Go to Triads**
(`openTriadsFromCaged()` in `links.svelte.ts`). The tuning name comes from `tuningLabel()`
(preset name or "Custom"). Zone B is unchanged. The Reset button stays. The old
`caged_tuning_unavailable` key is removed.

**Rationale**:

- This is the "never blank" fallback view (Principle X), not a transient Principle VII
  notice. It replaces the fretboard for as long as the tuning is non-compatible, so it is not
  dismissible: dismissing it would leave an empty zone C. The text is one sentence, within the
  two-line limit at normal widths. Recorded in plan Complexity Tracking.
- Neutral text colour, not error red.

## R-09 Go to Triads (FR-012)

**Decision**: `openTriadsFromCaged(): Promise<void>` does `goto(resolve('/triads'))` with no
carry. `linkTools` already ignores `caged`. `beforeNavigate` drops the temporary tuning, so
Triads shows the preferred instrument. Triads works in every tuning (slice 009+).

## R-10 Text description (FR-013)

**Decision**: `buildCagedModel` prefixes the description with:

- `caged_description_tuning({ tuning })` — "Tuning: {tuning}." — always when shapes are
  drawn, using the temporary name when the temporary tuning is active
  (`caged_description_temporary`: "Temporary tuning: {tuning}.").
- When the tuning is altered-string, also `caged_description_altered({ string: 6 })`:
  "String 6 is altered: it shows only the chord notes inside each shape."
- Per-occurrence entries list string-6 notes like other notes.

In the non-compatible state there is no fretboard. The status notice names the tuning and says
the shapes don't exist; this is the text description of the absence of shapes.

## R-11 Instrument change while open (FR-011, SC-006)

**Decision**: no new mechanism is needed. `instrument.confirm` already calls
`caged.applyInstrument`, and `display` is `$derived`, so the class switches immediately and
the view state (key, quality) is untouched. The perf suite gains one case: switching to DADGAD
on CAGED stays ≤ 300 ms.

## R-12 Model and component boundaries (Principle III)

**Decision**: `buildCagedModel(view, instrument, context)`, where
`context = { tuningName: string; temporary: boolean }`. The store owns `tuningName` and
receives it through a second argument: `caged.applyInstrument(next, tuningName)`.

- `instrument.confirm()` and `instrument.restore()` pass `tuningLabel(config.tuning)`.
- The `useInstrument` test hook passes the fixture's name.
- While `temporary` is true, the model shows the standard name itself:
  `m.tuning_af21()` for 7 strings, `m.tuning_af1()` for 6, the same catalog keys
  `tuning-names.ts` uses. `caged-model.ts` already imports paraglide, so state never imports
  the shell.

This keeps `caged-model.ts` free of `instrument.svelte` (no import cycle).

**Rejected**:

- Recovering the name inside the model from `Instrument` pitches: `Instrument` carries pitches,
  not a `Tuning` id, so it would need `matchPreset` plus a shell import into state, which is
  extra coupling for nothing.
- A separate `setTuningName` setter: it could drift from the instrument it names.

## R-13 Bundle impact (Principle VI)

Estimate: +1.0–1.5 KB gzip, from:

- the theory function and a small store delta;
- about 8 catalog keys;
- one new component branch;
- the renderer mark;
- the badge variant.

There is no dependency. Slice 014 left the bundle near the 90 KB limit (86.1 KB before 014,
plus 014's own +2–3 KB). The exact headroom is measured by `pnpm verify` at slice end. If the
check fails, the constitution requires an amendment PR before merge; that is not assumed here
(plan Complexity Tracking).

**Measured (T052)**: 88.9 KB at `7ac64d2` (before this slice) → 90.2 KB (92,315 B; +1.3 KB,
inside the estimate). That is 155 B over the 90 KB cap. Trimming the slice's code saved ≈ 11 B
after gzip, so constitution 1.6.0 raised the Principle VI budget to 92 KB (approved by the owner).

## R-14 Tests and Principle I gate

This slice changes CAGED theory, which slice 014 introduced together with its table and
property suites. The gate is to keep those suites passing and extend them:

- **Table tests** (`tests/unit/theory/caged.test.ts`):
  - SC-004 worked examples (Drop D D major E and G shapes);
  - Drop D occurrence frets equal Standard's for all 12 keys × 2 qualities;
  - Drop C equals Whole step down;
  - Half step down E♭ major E shape at fret 0 and G♭ major at fret 3;
  - 7-string Drop D is altered-string;
  - C/A/D shapes have no string-6 note;
  - an empty-region case (FR-006).
- **Property tests** (`caged.property.test.ts`), over random altered-string tunings
  (random compatible base + string-6 delta in [−11, 11] \ {0}):
  1. strings 5→1 notes equal the compatible counterpart's;
  2. every string-6 note is a chord tone at its real pitch and inside `[start, end]`;
  3. no string-6 note for C, A, D shapes;
  4. no string-6 note equals the table degree at the table fret;
  5. fit uses strings 5→1 only.
- Existing TM-6.1, TM-6.2, TM-7.1 and fit-count suites run unchanged.

## R-15 ADR

`docs/adr/0018-caged-tuning-classes-and-temporary-tuning.md` records three decisions:

- string-5-based placement;
- the region rule for the altered string;
- the per-view temporary tuning that is never stored.

It amends ADR 0017's "only compatible draws" clause.
