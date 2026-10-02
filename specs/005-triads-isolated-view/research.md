# Research: Triads Isolated View

**Feature**: `005-triads-isolated-view` | **Date**: 2026-10-01 | **Plan**: [plan.md](./plan.md)

The Technical Context had no open `NEEDS CLARIFICATION` items: the stack is fixed by the
constitution and slices 001–004 already ship the fretboard, playback, notation, message
catalog, and the view-state / display-model pattern (ADR 0008). The questions below are the
design decisions this slice has to make. Each one is resolved with a decision, the rationale,
and the alternatives that were rejected.

---

## R-01 — Where the triad theory lives and what it takes as input

**Decision**: Two new pure modules in `src/lib/theory`:

- `triad.ts`: qualities, interval tables, `spellTriad(root: Spelling, quality)`,
  `rootSpellings(pc)`, `defaultRootSpelling(pc, quality)`, `effectiveRootSpelling(...)`,
  `accidentalCount`, `hasDoubleAccidental`, interval labels as symbolic ids.
- `triad-shape.ts`: `INVERSION_ORDER`, `triadShape(openPitches, triadPitchClasses, inversion)`
  implementing TM-5.3 over **three open-string pitches (low → high)** and returning a typed
  result, `occurrences(shape, fretCount)`, and `span(frets)`.

The theory functions take plain pitches (`Pitch[]`), never an `Instrument`. The mapping from
"string set 5-4-3 on this instrument" to three open pitches happens in
`src/lib/instrument/string-sets.ts` (new), which already owns `Instrument` and imports theory.

**Rationale**: Principle III requires `src/lib/theory` to be pure and free of app concepts;
the existing ESLint boundary (`eslint.config.js`, R-15 block) forbids theory importing
anything outside theory. `instrument.ts` already depends on `theory/pitch.ts`, so having theory
depend back on `instrument` would create a cycle. Taking open pitches also makes the NFR-9.3
property tests trivial: generate three integers, not a whole instrument.

**Alternatives considered**:

- Put the shape algorithm in `src/lib/instrument` — rejected: shapes are theory (Principle I
  table/property tests gate "theory code"), and coverage ≥ 95% is enforced on `src/lib/theory`
  only; hiding the algorithm in instrument would dodge that gate.
- One combined `triads.ts` — rejected: spelling and shape are independently table-tested
  (TM-4 vs TM-5) and have different inputs; two small single-purpose modules match the
  code-quality rule.

---

## R-02 — Spelling algorithm (TM-4.1) and the 17 root spellings

**Decision**: Letters are fixed first (root letter, +2 letters, +4 letters in C D E F G A B
order); then each accidental is `normalize(targetPc − naturalPc(letter))` into `−6…5`, where
`targetPc = rootPc + {3|4}` for the third and `rootPc + {6|7|8}` for the fifth (table
`QUALITY_INTERVALS`). The result type is `Accidental` (−2…2). A value outside −2…2 cannot
arise for roots with at most one accidental; the table test over all 17 root spellings × 4
qualities (68 rows, TM-4.2) proves it, and the function's return type stays total
(`TriadSpelling`), not `Result`, because the root domain is closed (`RootSpelling` = natural or
single accidental).

Root spellings per pitch class come from `notation`-independent data in theory
(`rootSpellings(pc)`: one spelling for naturals, `[sharp, flat]` for the five altered keys);
the notation module keeps producing glyphs and spoken names only.

**Rationale**: This is TM-4.1 verbatim and is how a musician spells; it yields C–E–G♯ (never
A♭) by construction, which is the constitution's named example.

**Alternatives considered**: Lookup table copied from TM-4.2 — rejected: Principle I forbids
hand-drawn data for shapes, and a copied table would make the table test tautological. Using
`notation.defaultSpelling`/`flatSpelling` for roots — rejected: theory must not import
notation (boundary), and those helpers are presentation defaults.

---

## R-03 — Default spelling of altered roots (TM-4.3) and the two ties

**Decision**: `defaultRootSpelling(pc, quality)` spells the triad with both root spellings,
counts accidentals (double counts as two, `accidentalCount`), and picks the smaller. Ties are
resolved by a two-entry constant `TIE_BREAK` — D♯/E♭ minor → flat (E♭), F♯/G♭ major → sharp
(F♯) — with a comment citing TM-4.3's asterisk. Computing all 20 altered cases confirms these
are the only two ties.

**Rationale**: Derives 18 of 20 entries from the rule and encodes only the editorial choices
the reference itself marks as conventions. The table test compares all 20 cells to TM-4.3.

**Alternatives considered**: Full 5 × 4 lookup table — rejected for the same tautology reason
as R-02; "prefer flats on tie" — rejected: gives G♭ major, contradicting TM-4.3.

---

## R-04 — Root state model and spelling override (C1)

**Decision**: View state stores `rootPc: 0…11` and `spellingOverride: 'none' | 'sharp' |
'flat'`. Effective spelling = override (if the root is altered and override ≠ none), else
`defaultRootSpelling(rootPc, quality)`. `selectRoot(pc)` with a different pc resets the
override to `none`; re-selecting the same pc is a same-object no-op. `switchSpelling()` sets
the override to the *other* spelling of the current effective one; it is a no-op on naturals.
Quality, inversion, string set, label and octave transitions keep the override.

**Rationale**: Exactly C1/FR-009; storing an override (not a spelling) means a quality change
without a user choice re-derives the default (US3-3: C♯ minor but D♭ major).

**Alternatives considered**: Storing a `Spelling` for the root — rejected: then a quality
change could not tell "user chose" from "default", breaking US3-3.

---

## R-05 — Shape algorithm (TM-5.3), "does not close", and beyond-fret

**Decision**: `triadShape(open: readonly [Pitch, Pitch, Pitch], pcs, inversion)` returns

```ts
type ShapeResult =
  | { kind: 'shape'; frets: readonly [number, number, number] }   // lowest occurrence
  | { kind: 'does-not-close' };
```

1. If the open pitches are not strictly rising (`open[0] < open[1] < open[2]`), return
   `does-not-close`. This is the definition used by the spec's C7 test injection ("a tuning
   with unison or descending adjacent strings").
2. Bass pitch class = `INVERSION_ORDER[inversion][0]`; bass fret `b ∈ 0…11` with
   `pitchClass(open[0] + b) === bassPc`.
3. Middle/high pitch = next triad note strictly above the previous pitch (smallest
   `p > prev` with the required pitch class); fret = pitch − open string.
4. While any fret < 0, add 12 to all three (equivalent to raising the bass an octave and
   recomputing, because steps 2–3 are translation-invariant). Terminates because adding 12
   increases every fret.

Beyond-fret is a separate, instrument-dependent query in the model: `max(frets) > fretCount`
⇒ guidance "This shape lies beyond fret {fretCount}" (C6, C8). `occurrences(frets, fretCount)`
returns `[frets + 12k for k ≥ 0 while max ≤ fretCount]`, empty when beyond.

**Rationale**: Literal TM-5.3. Splitting "closes" (pure, tuning only) from "fits" (fret
count) keeps theory independent of instruments and gives the model two distinct guidance
states. Strictly rising open strings is the smallest rule that makes the procedure's result
satisfy TM-5.1 "lie on three adjacent strings in ascending order" in the way a guitarist
reads a string set; re-entrant/descending sets are what EC-5.1 is about.

**Alternatives considered**:

- Treating "does not close" as "the loop never finds non-negative frets" — rejected: the loop
  always terminates, so that state would be unreachable and EC-5.1 untestable.
- Searching other octaves below for beyond-fret — rejected by C8: TM-5.3 already returns the
  lowest occurrence with no negative fret.

**Verified against reference**: C major root 6-5-4 standard → 8-7-5; C diminished root 5-4-3
→ 3-1-(−1) → +12 → 15-13-11 (TM-5.5); Drop D 6-5-4 C major → 10-7-5 (TM-5.7).

---

## R-06 — Span and wide stretch (TM-5.4)

**Decision**: `span(frets) = max(fretted) − min(fretted)` over frets > 0; 0 when fewer than
two fretted notes. `wideStretch = span ≥ 5`. Exported constant `WIDE_STRETCH_SPAN = 5`.

**Rationale**: TM-5.4/FR-025; US5-3 (0-1-0 → span 0).

**Alternatives**: Counting open strings as fret 0 — rejected by EC-5.7.

---

## R-07 — String sets on the instrument

**Decision**: `StringSet` is identified by its lowest (bass) string number:
`type StringSetId = number` with the MVP choices `[6, 5, 4, 3]` → labels "6-5-4", "5-4-3",
"4-3-2", "3-2-1". `stringSets(instrument)` returns `stringCount … 3` (so 7-string support later
adds 7-6-5 with no logic change). `setOpenPitches(instrument, low)` returns
`[pitch(low), pitch(low − 1), pitch(low − 2)]` (low → high). The shape's positions are
`{ string: low − i, fret: frets[i] }`.

**Rationale**: Sets are always three adjacent strings (FR-011); one number is the minimal
identity and validates trivially (`3 ≤ low ≤ stringCount`).

**Alternatives**: A tuple of three string numbers — rejected: admits non-adjacent invalid
states that must then be validated.

---

## R-08 — Occurrence index and octave commands (C9)

**Decision**: View state stores `occurrence: number` (0 = lowest). The display model clamps it
to `occurrences.length − 1` when computing what is shown (defensive; transitions already keep
it valid). `octaveUp()`/`octaveDown()` are no-ops at the ends; the UI renders them with
`aria-disabled="true"` (focusable, not hidden, no error style). Root/quality/inversion/set
transitions reset `occurrence` to 0; spelling and label keep it. Octave transitions need the
occurrence count, so they take the instrument (`octaveUp(s, instrument)`), mirroring
`toggleString(s, n, i)` in Notes.

**Rationale**: FR-017/FR-018; `aria-disabled` keeps the control discoverable to screen-reader
and keyboard users (Principle V) where `disabled` would drop it from the tab order.

**Alternatives**: Storing a base fret — rejected: invalid after any root/set change and
duplicates derivable data.

---

## R-09 — "Another set" (C11)

**Decision**: Pure `nearestClosingSet(state, instrument)` in the model: from the current set
index in bass→treble order, try `+1, −1, +2, −2, …` (treble first) and return the first set
whose `triadShape` closes; `null` → the action is omitted. Selecting it goes through the
normal `setStringSet` transition (resets occurrence, stops playback, announces).

**Rationale**: C11 verbatim, deterministic, and reuses the same transition path.

**Alternatives**: Opening a picker — rejected: the four set buttons are already visible;
the action exists to "adopt the nearest equivalent and tell" (Principle X).

---

## R-10 — Interval labels on the fretboard

**Decision**: Extend the shared renderer backwards-compatibly: `LabelMode` gains
`'interval'`, and `Marker` gains optional `interval?: IntervalId` (`'R' | '3' | 'b3' | '5' |
'b5' | '#5'`). In interval mode the label is `intervalLabel(id)` from `src/lib/notation`
(glyphs ♭/♯, "R" from the message catalog so locales can localize the root symbol); markers
without `interval` fall back to no label. In note mode, triad markers carry `spelling`, which
the renderer already honors (C5: F𝄪, not G). Cell accessible names and the description keep
spoken note + function (already in `description.ts`), so interval mode costs nothing for
screen-reader users.

**Rationale**: Renderer stays the only drawer (Principle III); interval symbols are notation,
so they live next to `noteLabel` (Principle VIII). Optional fields keep Notes untouched.

**Alternatives**: Putting a free-text `text` on markers — rejected: lets tools inject
arbitrary strings and bypass notation; a per-tool fork of the renderer — forbidden.

---

## R-11 — Composition panel content and where it is computed

**Decision**: `buildTriadsModel(state, instrument)` (pure, paraglide for text, like
`buildNotesModel`) returns a `TriadsDisplay` with a structured `composition` object (ids and
`Spelling`s, not strings): name parts, notes in R–3–5 order with function, interval ids,
stacking id (`'M3+m3' | 'm3+M3' | 'm3+m3' | 'M3+M3'`), low-to-high entries, `soundsAs[]`,
`suggestion` (spelling or null), `canSwitchSpelling`, `symmetric`, `characteristic` ('b5' or
null). The panel component formats with `noteLabel`/`intervalLabel`/messages only.

**Rationale**: Keeps the component free of theory (ESLint forbids `$lib/theory/*` imports in
tools) and makes every C3/C4/C13 rule unit-testable without rendering.

**Alternatives**: Formatting strings in the model — rejected: the panel needs per-note markup
(marker glyphs next to names, accessible spoken names), so structured data is easier to render
accessibly.

---

## R-12 — Listen (C10) and playback stop (FR-028)

**Decision**: `listenSteps = [low, middle, high, [low, middle, high]]` positions of the shown
occurrence; `triads.listen()` calls `playback.sequence(steps, LISTEN_BPM, instrument)` (constant
re-exported from `notes-model`, moved to a shared `src/lib/state/listen.ts` because it now has
two real uses). A new `sequence` already interrupts the previous one (003 contract), which
gives "restart from the beginning". Every state-changing triads transition goes through
`apply()` which calls `playback.stop('view')` when the view changed (same pattern as Notes).
Listen is disabled (`aria-disabled`) when no shape is shown. Pulses come from
`playback.pulses`, drawn even when muted (003).

**Rationale**: Zero new audio code; reuses the deterministic, clock-injectable engine
(Principle IV).

**Alternatives**: A `chord` request after a `sequence` — rejected: two requests would let the
second interrupt the first.

---

## R-13 — Guidance (empty state) presentation (C14)

**Decision**: The fretboard gets `markers: []` and a model `description` containing the
guidance; `TriadsTool` overlays a `TriadsGuidance` element *inside the fretboard zone*
(zone C) — not the `Notice` component, because Notice is dismissible and C14 says guidance is
not. Neutral text tokens, no error red, ≤ 2 lines, and the **Another set** button when
available. Composition panel stays populated.

**Rationale**: "Never blank" (Principle X) with the design rule "controls never cover the
fretboard" respected: the guidance sits in the empty board area, not over controls.

**Alternatives**: Reusing `Notice` with `dismissible={false}` — rejected: Notice semantics and
placement (top of tool, transient) differ; adding a non-dismissible mode would be speculative
configurability for one use.

---

## R-14 — State lifetime (FR-032)

**Decision**: Module-singleton runes store `src/lib/state/triads.svelte.ts` (same as
`notes.svelte.ts`, ADR 0008): survives in-app navigation, resets on reload, not persisted
(persistence and share links are later waves).

**Alternatives**: Component-local state — forbidden by Principle III.

---

## R-15 — Test-only instruments for unreachable cases and TM-9

**Decision**: Extend the existing `__fmInstrument` allow-list (ADR 0004 pattern,
`src/lib/instrument/fixtures.ts`) with:

| Name | Strings 1 → 6 | Frets | Purpose |
|---|---|---|---|
| `AF-4` | E4 B3 G3 D3 A2 D2 | 22 | Drop D: wide stretch (TM-5.7), TM-9 view 12 |
| `AF-1-12` | standard | 12 | beyond-fret guidance (C6, US8-1) |
| `NC-UNISON` | E4 B3 B3 D3 A2 E2 (strings 2 & 3 in unison) | 22 | does-not-close on 4-3-2 and 3-2-1, Another set → 5-4-3 (C11) |

`TriadsTool` reads `__fmInstrument` once on mount inside `if (__FM_FAULT_INJECTION__)` and
applies it via `triads.useInstrument(...)`, exactly like Notes. Unit tests pass instruments
directly to pure functions and never need the hook.

**Rationale**: C7 requires injection; reusing the guarded hook keeps production free of test
fixtures (checked by `scripts/check-no-fault-hook.mjs`).

**Alternatives**: URL query parameters — rejected: would become untrusted public input
(Principle IX) for a test-only need.

---

## R-16 — TM-9 views covered by this slice

**Decision**: Add `e2e/triads-tm9.spec.ts` screenshot fixtures for the TM-9 Triads views that
the Isolated view can show: **7** (E♭ minor, 1st inversion, 4-3-2), **8** (B diminished, root
position, 5-4-3), **11** (D♯ major, spelling switched to D♯; set 3-2-1), and **12** (C major
root position 6-5-4 on `AF-4`, wide-stretch mark). Views 6, 9 (full neck), 10 (comparison),
13 (7-string set), and 14 (All notes) need views/controls out of scope here and are added by
the slices that introduce them (recorded in plan Complexity Tracking).

---

## R-17 — Root selector and choice groups: reuse vs. new components

**Decision**: Reuse `src/lib/tools/NoteSelector.svelte` for the root, adding one optional
`label` prop (group accessible name) — its toggle-button semantics (`aria-pressed`) already
fit a single choice where re-pressing is a no-op. Extract the radiogroup markup and roving
arrow-key handling now inlined in `NotesActions.svelte` into
`src/lib/tools/ChoiceGroup.svelte`; it gets its second real use here (quality, inversion,
string set, label type), satisfying Principle X's two-uses rule.

**Alternatives**: New bespoke controls per group — rejected: duplicates keyboard handling
(Principle V risk); a generic form library — rejected: new runtime dependency.

---

## R-18 — Performance

**Decision**: No special work. A control change computes one spelling (3 notes), one shape
(≤ 12 iterations), and ≤ 2 occurrences; the display model builds ≤ 3 markers (vs. ~138 for
Notes). New code is a few KB gzip; the 80 KB initial-JS budget is unaffected because `/triads`
is route-split. The existing `e2e/perf.spec.ts` pattern gains a triads control-change ≤ 100 ms
check.

---

## Appendix — algorithm spot check (2026-10-01)

A throwaway script implementing R-05 exactly (bass fret 0–11, next triad note strictly above,
+12 while any fret < 0) reproduced **all 48 TM-5.5 cells**, Drop D 6-5-4 C major = **10-7-5**
(TM-5.7), and over 12 roots × 4 qualities × 3 inversions × 4 sets in shipped standard tuning:
highest lowest-occurrence fret **15**, largest span **4**, **40** shapes beyond fret 12 — the
figures stated in spec C7. The production implementation is written test-first per
Principle IV; this check only de-risks the design.
