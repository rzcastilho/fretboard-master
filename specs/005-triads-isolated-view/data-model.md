# Data Model: Triads Isolated View

**Feature**: `005-triads-isolated-view` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

All types are immutable (`readonly`). Layering follows Principle III:
`theory` (pure) ← `instrument` ← `state` (view state + display model + store) ← `tools` (UI)
→ `fretboard` (renderer). Existing types reused: `Letter`, `Accidental`, `Spelling`, `Pitch`,
`PitchClass` (`theory/pitch.ts`), `Instrument`, `Position` (`instrument/instrument.ts`),
`Marker`, `DisplayModel` (`fretboard/types.ts`).

---

## §1 Theory: triad spelling (`src/lib/theory/triad.ts`)

| Type | Definition | Rules |
|---|---|---|
| `Quality` | `'major' \| 'minor' \| 'diminished' \| 'augmented'` | FR-003 |
| `TriadFunction` | `'root' \| 'third' \| 'fifth'` | |
| `IntervalId` | `'R' \| '3' \| 'b3' \| '5' \| 'b5' \| '#5'` | symbolic; glyphs via notation |
| `StackingId` | `'M3+m3' \| 'm3+M3' \| 'm3+m3' \| 'M3+M3'` | major, minor, dim, aug |
| `TriadSpelling` | `{ root: Spelling; third: Spelling; fifth: Spelling; pitchClasses: readonly [PitchClass, PitchClass, PitchClass] }` | R–3–5 order |
| `RootSpellingChoice` | `'sharp' \| 'flat'` | |

Constants:

```text
QUALITY_INTERVALS: major {third 4, fifth 7} | minor {3, 7} | diminished {3, 6} | augmented {4, 8}
QUALITY_LABELS:    major [R,3,5] | minor [R,b3,5] | diminished [R,b3,b5] | augmented [R,3,#5]
QUALITY_STACKING:  major M3+m3 | minor m3+M3 | diminished m3+m3 | augmented M3+M3
TIE_BREAK:         {pc 3 (D♯/E♭), minor} → flat ; {pc 6 (F♯/G♭), major} → sharp   (TM-4.3 *)
```

Functions (all total, pure):

| Function | Contract |
|---|---|
| `rootSpellings(pc)` | natural → `[natural]`; altered → `[sharp, flat]` (C♯/D♭ …) |
| `isAlteredRoot(pc)` | `rootSpellings(pc).length === 2` |
| `spellTriad(root, quality)` | TM-4.1 alternate letters + exact accidentals; equals TM-4.2 for all 68 rows |
| `accidentalCount(t)` | Σ \|accidental\| over the three notes (double = 2) |
| `defaultRootSpelling(pc, quality)` | fewer accidentals wins; ties via `TIE_BREAK`; equals TM-4.3 |
| `effectiveRootSpelling(pc, override, quality)` | override (`'sharp'\|'flat'`) on altered roots, else default |
| `otherRootSpelling(pc, current)` | the other altered spelling, `null` for naturals |
| `doubleAccidentalNotes(t)` | the notes with \|accidental\| = 2, in R–3–5 order (C3) |

## §2 Theory: triad shape (`src/lib/theory/triad-shape.ts`)

| Type | Definition |
|---|---|
| `Inversion` | `'root' \| 'first' \| 'second'` |
| `Frets3` | `readonly [number, number, number]` — low → high string |
| `ShapeResult` | `{ kind: 'shape'; frets: Frets3; functions: readonly [TriadFunction ×3] } \| { kind: 'does-not-close' }` |

Constants: `INVERSION_ORDER` — root `[root, third, fifth]`, first `[third, fifth, root]`,
second `[fifth, root, third]` (TM-5.2); `WIDE_STRETCH_SPAN = 5`; `OCTAVE_FRETS = 12`.

| Function | Contract |
|---|---|
| `triadShape(open: readonly [Pitch,Pitch,Pitch], t: TriadSpelling, inv)` | R-05: `does-not-close` unless `open[0] < open[1] < open[2]`; else lowest occurrence with all frets ≥ 0 (TM-5.3 steps 1–4). Never consults a fret count. |
| `occurrences(frets, fretCount)` | `[frets + 12k]`, k = 0,1,… while `max ≤ fretCount`; `[]` when the lowest exceeds it |
| `span(frets)` | `max − min` over frets > 0; `0` with < 2 fretted notes (TM-5.4, EC-5.7) |
| `isWideStretch(frets)` | `span(frets) ≥ WIDE_STRETCH_SPAN` |

**Invariants (property-tested, NFR-9.3)** for every `shape` result over random strictly
rising open pitches: three adjacent strings by construction; sounding pitches
`open[i] + frets[i]` strictly rise; top − bottom < 12; pitch classes = the triad's; bass pitch
class = `INVERSION_ORDER[inv][0]`'s; all frets ≥ 0 and `frets[0] ≤ 11` or a negative-fret
raise happened (lowest occurrence: subtracting 12 makes some fret negative).

## §3 Instrument: string sets (`src/lib/instrument/string-sets.ts`)

| Item | Definition |
|---|---|
| `StringSetId` | `number` = lowest (bass) string of the set; valid iff integer, `3 ≤ id ≤ stringCount` |
| `stringSets(i)` | `[stringCount, …, 3]` (bass → treble). MVP: `[6, 5, 4, 3]` |
| `setStrings(id)` | `[id, id − 1, id − 2]` (low → high) |
| `setOpenPitches(i, id)` | open pitches of `setStrings(id)` |
| `setLabel(id)` | `"6-5-4"` etc. (digits and hyphens only; not a translatable string) |
| `shapePositions(id, frets)` | `Position[]` low → high: `{ string: id − k, fret: frets[k] }` |

## §4 View state (`src/lib/state/triads-view.ts`)

```text
TriadsViewState {
  rootPc: PitchClass              // 0..11
  spellingOverride: 'none' | 'sharp' | 'flat'
  quality: Quality
  inversion: Inversion
  stringSet: StringSetId
  labelType: 'interval' | 'name'
  occurrence: number              // 0 = lowest
}
```

**Initial** (FR-001): `{ rootPc: 0, spellingOverride: 'none', quality: 'major', inversion:
'root', stringSet: 3, labelType: 'interval', occurrence: 0 }`. For instruments with
fewer than 3 strings (not shippable) the set clamps to `stringCount`; not reachable.

**Transitions** (all total; unchanged → same object, `Object.is`; invalid input → same
object):

| Transition | Effect | Keeps | Resets |
|---|---|---|---|
| `selectRoot(s, pc)` | sets `rootPc` | quality, inversion, set, label | override → none, occurrence → 0 (no-op if same pc) |
| `switchSpelling(s)` | override → other of effective spelling | everything else incl. occurrence | — (no-op on naturals) |
| `setQuality(s, q)` | | override, label | occurrence → 0 |
| `setInversion(s, inv)` | | override, label | occurrence → 0 |
| `setStringSet(s, id, i)` | validates `3 ≤ id ≤ i.stringCount` | override, label | occurrence → 0 |
| `setLabelType(s, t)` | | everything incl. occurrence | — |
| `octaveUp(s, i)` / `octaveDown(s, i)` | ±1 within `0…count − 1` of the current occurrence list | everything else | no-op at ends / when count = 0 |
| `revalidate(s, i)` | clamp set and occurrence for a new instrument | | |
| `equalsTriadsView(a, b)` | field-wise equality | | |

State-change side effect (store, not pure function): any transition that changes the state
calls `playback.stop('view')` (FR-028).

## §5 Display model (`src/lib/state/triads-model.ts`)

```text
TriadsDisplay {
  model: DisplayModel                 // markers for the shown occurrence, labelMode, description
  spelling: TriadSpelling             // always present (C13)
  rootSpelling: Spelling              // effective
  shape: ShapeView
  composition: Composition
  listen: { enabled: boolean }        // false unless shape.kind === 'shown'
  listenSteps: ListenStep[]           // [low, mid, high, [low, mid, high]] or []
  octave: { up: boolean; down: boolean; index: number; count: number }
  anotherSet: StringSetId | null      // only for does-not-close (R-09)
}

ShapeView =
  | { kind: 'shown'; positions: Position×3 (low→high); functions; frets; span; wideStretch: boolean }
  | { kind: 'beyond'; fretCount: number }          // FR-019, C6
  | { kind: 'does-not-close' }                     // FR-020

Composition {
  name: { root: Spelling; quality: Quality; inversion: Inversion }   // "A major — 1st inversion"
  notes: [{ function, spelling }] ×3  (R–3–5 order)
  intervals: IntervalId ×3
  stacking: StackingId
  lowToHigh: [{ function, spelling }] ×3   (INVERSION_ORDER)
  soundsAs: [{ written: Spelling; sounds: Spelling }]   // only |accidental| = 2 notes, R–3–5 order (C3)
  suggestion: Spelling | null     // C4: altered root ∧ current has a double ∧ other spelling has none
  canSwitchSpelling: boolean      // isAlteredRoot(rootPc)
  switchTo: Spelling | null       // "Switch to D♭"
  symmetric: boolean              // quality = augmented (FR-023)
  characteristic: 'b5' | null     // quality = diminished (FR-024)
}
```

**Marker rules** (shown only): exactly three markers, one per shape position, `emphasis:
'highlighted'`, `function` = root/third/fifth, `spelling` = the triad spelling of that note
(C5), `interval` = its `IntervalId`. Every other position is absent (= hidden, FR-016).
`labelMode` = `'interval'` or `'note'` from `labelType`. For `beyond` / `does-not-close`:
`markers: []`.

**Description** (polite live text, FR-029): `summary` sentence = triad name + inversion + set
+ (wide stretch) or the guidance text; positions are listed by the renderer's existing
`describeView` (spoken spelling + function, string 6→1). Accidentals spoken in full via
`spokenNote` ("F double sharp").

**`sounds` spelling**: `defaultSpelling(pitchClassOfSpelling(written))` from notation (C3).

## §6 Store (`src/lib/state/triads.svelte.ts`)

Module singleton holding `view` (`$state`) and `instrument` (`$state.raw`, default
`STANDARD_GUITAR`), `display = $derived(buildTriadsModel(view, instrument))`. Public API in
[contracts/triads-state-api.md](./contracts/triads-state-api.md).

## §7 Renderer extension (`src/lib/fretboard/types.ts`)

| Change | Backwards compatible |
|---|---|
| `LabelMode` adds `'interval'` | yes (new member) |
| `Marker.interval?: IntervalId` | yes (optional) |

Label rule in interval mode: `intervalLabel(mk.interval)` if present, else no label.
Details: [contracts/fretboard-model.md](./contracts/fretboard-model.md).

## §8 Entity mapping to spec Key Entities

| Spec entity | Model |
|---|---|
| Triad selection | `TriadsViewState` (§4) |
| Triad spelling | `TriadSpelling` (§1) |
| Triad shape | `ShapeResult` (§2) + `ShapeView` (§5) |
| Occurrence set | `occurrences()` (§2) + `TriadsDisplay.octave` (§5) |
| Composition | `Composition` (§5) |
