# Research: Triads Full Neck and All Notes Views

**Feature**: `006-full-neck-and-all-notes` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

Technical Context had no open `NEEDS CLARIFICATION` items: the stack is fixed by the
constitution and feature 005 already ships the Triads tool, its store, its display model, the
shared fretboard, and playback. The research below settles the design questions this slice
raises against that existing code. Each item: **Decision / Rationale / Alternatives**.

---

## R-01 — Where the inversion chain is computed

**Decision**: Add one pure function to `src/lib/theory/triad-shape.ts`:
`inversionChain(open, triad, fretCount): ChainResult`. It calls the existing `triadShape` for
each of `INVERSIONS`, expands each shape with the existing `occurrences(frets, fretCount)`,
tags each entry with `{ inversion, octave: k, frets, functions }`, and sorts by `frets[0]`
(lowest-string fret, C2). Result kinds: `{ kind: 'chain', shapes }` (≥ 1 shape),
`{ kind: 'beyond' }` (closes, nothing fits), `{ kind: 'does-not-close' }`.

**Rationale**: FR-003 demands the same calculation as Isolated; reusing `triadShape` +
`occurrences` guarantees it. The chain is theory (TM-5.3 step 5, TM-5.6 point 3), so it belongs
in `theory/` under the Principle I gates (table + property tests). Sorting by `frets[0]` is a
total order: the three inversions have distinct bass pitch classes, so two chain entries never
share a lowest-string fret.

**Alternatives**: computing the chain in `triads-model.ts` (rejected: theory outside
`theory/`, escapes the 95 % coverage and property-test gate); a separate `triad-chain.ts`
module (rejected: one function, same concepts as `triad-shape.ts`; Principle X).

**Spot check** (by hand from TM-5.3, standard tuning, 22 frets): A major 3-2-1 → root 2-2-0
(+12 → 14-14-12), 1st 6-5-5 (+12 → 18-17-17), 2nd 9-10-9 (+12 → 21-22-21); six shapes, matches
C1. C augmented 3-2-1 → 2nd 1-1-0, root 5-5-4, 1st 9-9-8, then +12 each; matches C17.

## R-02 — "Does not close" vs "beyond" in Full neck

**Decision**: `triadShape` returns `does-not-close` for all three inversions or none (it only
depends on the open pitches being strictly rising), so the chain is `does-not-close` iff the
root-position call is. `beyond` iff it closes and the merged list is empty. Guidance mapping
reuses the Isolated `ShapeView` kinds (C7).

**Rationale**: Keeps one guidance component and one message set. **Alternatives**: a
Full-neck-specific "no inversion fits" message (rejected: C7 says same guidance).

## R-03 — View state shape and transitions

**Decision**: Add `view: TriadsView` (`'isolated' | 'full-neck' | 'all-notes'`) to
`TriadsViewState`, initial `'isolated'`, included in `equalsTriadsView`. New total transitions
in `triads-view.ts`:

- `setView(s, v)` — no-op on same/invalid value; keeps every other field (C8, edge "view change
  while an inversion is selected").
- `seeAllNotes(s)` = `setView(s, 'all-notes')` (named for the action; C8).
- `selectShape(s, inv, octave, i)` — valid only in `full-neck`; sets `inversion` and
  `occurrence` (C3); no-op if both already equal, or if `octave` is out of range for that
  inversion on `i`.
- `resetTriads(i)` — returns `initialTriadsView(i)` (FR-019, FR-1.11).
- Guards: `setInversion` and `setStringSet` are no-ops in `all-notes` (FR-010, controls are
  disabled; the guard makes the rule hold for any future caller such as a share link);
  `octaveUp`/`octaveDown` are no-ops outside `isolated` (C4).

**Rationale**: Principle III (view state outside components, drivable by later share-link /
context features). Total, `Object.is`-stable no-ops keep the store's "stop playback only on a
real change" rule (005 FR-028) working unchanged, which delivers C13 for free: view, occurrence,
inversion, set, label, root, spelling and quality changes all go through `apply()`.

**Alternatives**: view in component-local `$state` (rejected: Principle III, FR-019); a
separate view store (rejected: two stores to keep in sync, YAGNI).

## R-04 — Persistence and Reset tool

**Decision**: No local-storage write (FR-019, C14). The Triads tool has no **Reset tool**
command yet (005 did not ship it), but FR-019 requires Reset to return the view to
`isolated`, and FR-1.11 requires every tool to have it. Add `triads.reset()` and a
**Reset tool** button in `TriadsSecondary` mirroring `NotesActions` (message key
`triads_reset`). Reset does not change instrument, language, or notation (FR-1.11).

**Rationale**: Smallest change that makes FR-019 testable through the UI; mirrors the
existing Notes pattern rather than inventing one. **Alternatives**: store-only reset with no
button (rejected: FR-019 then has no user path; acceptance tests would have to poke the store);
deferring Reset to a later slice (rejected: FR-019 is in this spec).

## R-05 — Tags: who draws them and how they stay aligned

**Decision**: Extend the shared fretboard, not the tool. `DisplayModel` gains an optional
`tags?: readonly FretboardTag[]` (`{ id, start, end, label, name, pressed, detail? }`, frets in
musical terms). `Fretboard.svelte` renders them as HTML `<button aria-pressed>` elements in a
tag strip **inside the horizontal scroller, above the SVG**, so they scroll with the board and
need no scroll listeners. It reports activation as `ontag(id)`. The tool maps `id` back to
`(inversion, octave)` via the display model.

Placement is a pure function `layoutTags(items, boardWidth)` in a new
`src/lib/fretboard/tags.ts`: each item has a centre (midpoint of
`columns[start].start … columns[end].end` from `layoutFretboard`) and a measured width
(`max(--target-min, measured)`); items are placed in chain order; each goes on the first row
where it does not overlap any already-placed tag on that row (gap = `--space-1`), else on a new
row; x is clamped into `[0, boardWidth − width]`. Widths are measured with a `ResizeObserver`
on the tag buttons (so 200 % text zoom and longer pt/es strings are handled); before the first
measurement the minimum width is used.

**Rationale**: Principle III ("tools MUST NOT draw the fretboard directly", "events in musical
terms"); the design spec puts tags in zone C as part of the fretboard ("The fretboard, with
tags and minimap"; "aligned with the region"). CAGED shape tags (wave 004) are the second real
use, so the generic `tags` field is not speculative. DOM order = chain order gives the C5 focus
order; native buttons give Enter/Space activation and visible focus with the global focus ring.

**Alternatives**: absolutely positioned tags in `TriadsTool` synced to `scrollLeft` (rejected:
tool draws fretboard geometry, scroll jitter); SVG `<text>` tags inside the grid (rejected: the
SVG is an ARIA grid of cells — buttons inside it break the grid pattern, ADR 0005).

## R-06 — Auto-scroll on entering Full neck (C15)

**Decision**: `DisplayModel` gains optional
`autoScroll?: { key: string; groups: readonly (readonly Position[])[] }`. When present, the
fretboard ignores its default "highlighted set changed" trigger and instead re-evaluates only
when `key` changes: if any group is fully visible → no scroll; otherwise scroll the first
(lowest) group into view with the existing `spanTarget` minimal move (instant under reduced
motion — the existing `scrollDuration()` already returns 0). Pure helper
`groupScrollTarget(layout, groups, viewport)` in `interaction.ts`.

The Triads model sets it in Full neck with
`key = full-neck|<stringSet>|<rootPc>|<quality>|<fretCount>` and
`groups` = highlighted chain shapes in chain order; in All notes `{ key: 'all-notes', groups: [] }`
(never scrolls). Isolated leaves it absent (005 behaviour unchanged).

**Rationale**: With the default trigger, tapping a "2nd" tag would change the highlighted set
to {9-10-9, 21-22-21}, whose span does not fit, and jump the board to fret 9 — violating
"tag activation never scrolls". Excluding `inversion` and `occurrence` from the key makes tag
taps and inversion-control changes in Full neck scroll-neutral while entering the view, or
changing root/quality/set there, applies the C15 rule.

**Alternatives**: a `noScroll` flag set by the store on tag activation (rejected: model would
depend on how the change was made, not on state; breaks purity of `buildTriadsModel`);
scrolling to the selected occurrence (rejected: C15 says tag activation never scrolls).

## R-07 — Emphasis and overlapping positions

**Decision**: Full neck markers: every chain shape's three positions, `highlighted` when the
shape's inversion equals `s.inversion`, else `normal`; no marker elsewhere (= hidden). Markers
are emitted highlighted-first so that if two chain shapes ever share a (string, fret) the
fretboard's "first marker wins" rule keeps the stronger emphasis. A shared position has the same
pitch hence the same function and spelling, so nothing else can conflict.

All notes markers: for each string 1…n and fret 0…fretCount whose pitch class equals root,
third or fifth → `normal` marker with function, `spelling` (triad spelling, so F𝄪 not G) and
`interval` label (C9).

**Rationale**: Principle VII emphasis levels; FR-005 (opacity + size come from the existing
marker CSS). **Alternatives**: `dimmed` for non-selected shapes (rejected: FR-5.9 says normal).

## R-08 — Full neck and All notes Listen

**Decision**: Full neck: for each chain shape in chain order, steps `low, mid, high,
[low, mid, high]` → one `playback.sequence(steps, LISTEN_BPM)` (C11; 24 steps for A major
3-2-1). All notes (C12): compute in `triads-model.ts` with instrument helpers —
`rootPitch = min pitch over positionsWithPitchClass(root)`; third = smallest instrument pitch
> rootPitch with the third's pitch class; fifth likewise above the third; each played at
`lowestPositionOfPitch(instrument, pitch)` = lowest fret, ties → higher string number
(thicker). New helper `lowestPositionOfPitch` in `src/lib/instrument/instrument.ts`. If a note
is unreachable (very short fret count) the steps stop at the last reachable note; with no
reachable root, Listen is disabled (`listen.enabled = false`), never an error.

**Rationale**: existing playback engine already pulses even when muted (005 US7); one sequence
keeps "new sequence interrupts" semantics. Position choice is a playing-position rule
(instrument), not theory. Reference check: standard tuning A major → A2 = string 5 fret 0
(string 6 fret 5 loses on fret), C♯3 = string 5 fret 4, E3 = string 4 fret 2 (C12).

**Alternatives**: playing the three notes as a chord too (rejected: C12 "no chord step").

## R-09 — Disabled main controls in All notes

**Decision**: `ChoiceGroup` gains `disabled?: boolean`. When true: `aria-disabled="true"` on the
radiogroup and every radio; clicks and arrow keys do nothing; the checked radio keeps
`tabindex=0` (focusable, discoverable by keyboard and screen readers, consistent with 005's
`aria-disabled` octave buttons); styles use `--color-text-muted`-style disabled tokens (add a
`--color-disabled` / `--opacity-disabled` token if missing); a visible one-line hint below the
two groups ("Not used in All notes", `triads_hint_all_notes`) is referenced with
`aria-describedby`. The current values stay rendered as checked (FR-010 "keep their previous
values").

**Rationale**: FR-010 "visibly greyed, not operable, communicated as disabled"; Principle V (no
information by colour alone: the hint text carries it too). **Alternatives**: native `disabled`
(rejected: removes the control from tab order and some screen readers skip it entirely, so the
reason is never heard); hiding the controls (rejected: spec says disabled, and layout would jump).

## R-10 — Composition panel per view (C10)

**Decision**: `Composition.name.inversion` becomes `Inversion | null` and `lowToHigh` becomes
nullable; `buildTriadsModel` sets both to `null` in All notes. `CompositionPanel` renders
`triads_name_no_inversion` ("{root} {quality}") and hides the low-to-high line when null. Full
neck and Isolated unchanged.

**Alternatives**: a separate `view` prop on the panel (rejected: panel would re-derive state).

## R-11 — Text descriptions (C18)

**Decision**: Use `DisplayModel.description` (replaces the computed per-cell description) in
both new views, built in `triads-model.ts` from catalog messages:
`triads_desc_full_neck` ("{name} on strings {strings}: {shapes}. Selected: {inversion}."),
`triads_desc_chain_entry` ("{inversion}, frets {frets}"), `triads_desc_chain_wide`
(", wide stretch"), `triads_desc_all_notes` ("{name}: {functions}."),
`triads_desc_note_entry` ("{note}: {strings}"), `triads_desc_string_frets`
("string {string} frets {frets}"). Note names via `spokenNote` (accidentals read in full).
The existing live region in `Fretboard.svelte` announces politely on change, not on scroll.

**Rationale**: the per-cell list for ~40 All-notes markers is unreadable; C18 fixes a grouped
format. **Alternatives**: `summary` + default list (rejected: does not match C18).

## R-12 — Messages (Principle VIII)

**Decision**: new keys in `messages/en.json` (pt/es catalogs do not exist yet; adding a
language stays catalog-only): `triads_group_view`, `triads_view_isolated`,
`triads_view_full_neck`, `triads_view_all_notes`, `triads_tag_root` ("Root position"),
`triads_tag_first` ("1st"), `triads_tag_second` ("2nd"), `triads_tag_name`
("{inversion}, frets {frets}"), `triads_see_all_notes`, `triads_hint_all_notes`,
`triads_hint_octave_isolated` ("Only in Isolated"), `triads_name_no_inversion`, `triads_reset`, `fretboard_tags_label` ("Shapes"),
plus the R-11 description keys. `tests/unit/no-raw-text.test.ts` keeps guarding raw text.

## R-13 — Test-only fixtures

**Decision**: add `AF-8` (Open G: D2 G2 D3 G3 B3 D4, 22 frets) to `src/lib/instrument/fixtures.ts`
and the `__fmInstrument` union for TM-9 view 14, and `SHORT-7` (standard tuning, 7 frets) for
"only one or two inversions fit" (US5-3: A major 3-2-1 → root 2-2-0, 1st 6-5-5 fit; 2nd 9-10-9
does not). Existing `AF-1-12` and `NC-UNISON` cover beyond-fret and does-not-close.

## R-14 — Performance (FR-021, Principle VI)

**Decision**: no new runtime dependency. Chain = 3 × `triadShape` + ≤ 6 occurrences; All notes
= ≤ 7 × 25 positions; both trivially within the 100 ms control budget. Add `e2e/perf.spec.ts`
cases for view switch and tag tap (reuse its existing control-change measurement). Only changed
markers animate: markers are keyed by position (`d.key`), so switching Isolated → Full neck
adds markers without re-creating the shared ones. Bundle impact: a few hundred bytes of code +
messages, well under the 80 KB initial JS budget.
