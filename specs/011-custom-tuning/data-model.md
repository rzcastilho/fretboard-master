# Data Model: Custom Tuning (011)

Phase 1 output for [plan.md](./plan.md). Decisions referenced as R-nn are in
[research.md](./research.md). Existing types from slices 009/010 are only extended; nothing is
removed except `InstrumentConfig.tuningId`, which is replaced by `tuning` (§3).

String numbering follows the product: string 1 = thinnest/highest, string 6 =
thickest/lowest. **Offsets and preset `strings` are ordered strings 6 → 1 (low → high)**;
`Instrument.openStrings` stays string 1 first (unchanged 009 convention).

## 1. Offsets (`src/lib/instrument/custom-tuning.ts`, pure)

| Field | Type | Rule |
|---|---|---|
| `Offsets` | `readonly [number, number, number, number, number, number]` | Index 0 = string 6 … index 5 = string 1. Each element integer, `OFFSET_MIN ≤ x ≤ OFFSET_MAX`. Frozen. |
| `OFFSET_MIN` | `-7` | FR-002 lower limit (per string, relative to standard). |
| `OFFSET_MAX` | `4` | FR-002 upper limit. |
| `STANDARD_OFFSETS` | `Offsets` | `[0,0,0,0,0,0]`. |

Validation (`isOffsets(x: unknown): x is Offsets`): array, length 6, every element
`Number.isInteger` and in range. Used by the prefs schema and by tests; transitions never
produce invalid offsets (they clamp by refusing the step).

Per-string limits that follow (standard E2 A2 D3 G3 B3 E4):

| String | Standard | Lowest (−7) | Highest (+4) |
|---|---|---|---|
| 6 | E2 | A1 | G♯2 |
| 5 | A2 | D2 | C♯3 |
| 4 | D3 | G2 | F♯3 |
| 3 | G3 | C3 | B3 |
| 2 | B3 | E3 | D♯4 |
| 1 | E4 | A3 | G♯4 |

Derived pure functions:

- `presetOffsets(id: TuningId): Offsets` — semitone difference of each preset string from
  standard (memoized table). All eleven presets are in range (test asserts).
- `matchPreset(o: Offsets): TuningId | null` — tuple equality against `presetOffsets` in
  AF-1…AF-11 order (R-02).
- `offsetPitches(o: Offsets): readonly Pitch[]` — standard pitch + offset, strings 6 → 1.
- `invertedStrings(o: Offsets): boolean` — true iff some string n (1…5) is strictly lower in
  pitch than string n+1 (FR-011; equal pitches are not inverted, EC-2.1).
- `canStep(o: Offsets, string: 1..6, delta: 1 | -1): boolean` — result stays within limits.
- `stepOffsets(o, string, delta): Offsets` — returns the same object when `!canStep`.

## 2. Tuning (`src/lib/instrument/tunings.ts`, pure)

```text
Tuning =
  | { kind: 'preset'; id: TuningId }
  | { kind: 'custom'; offsets: Offsets }      // invariant: matchPreset(offsets) === null
```

- `tuningFromOffsets(o): Tuning` — **the only constructor of `custom`**: `matchPreset(o)`
  non-null → `{ kind: 'preset', id }`, else `{ kind: 'custom', offsets: o }` (canonical form,
  FR-007).
- `offsetsOfTuning(t): Offsets` — preset → `presetOffsets(id)`, custom → `offsets`.
- `isStandard(t): boolean` — `t.kind === 'preset' && t.id === 'AF-1'` (badge rule, FR-008).
- `equalsTuning(a, b): boolean` — same kind and same id / offsets tuple.
- `tuningStrings(t): readonly SpelledPitch[]` (low → high) — preset → the preset's own
  spelling; custom → `offsetPitches(o).map(spellSharp)` (R-03, FR-009).
- `tuningInstrument(t, fretCount): Instrument` — preset → existing `presetInstrument`;
  custom → frozen 6-string instrument with `openStrings = reverse(tuningStrings(t))`,
  memoized by `offsets.join(',') + '|' + frets` (R-11). Handedness/orientation unchanged.

Spelling helpers added to `src/lib/theory/pitch.ts` (R-03):
`sharpSpelling(pc): Spelling` (C C♯ D D♯ E F F♯ G G♯ A A♯ B) and
`spellSharp(p: Pitch): SpelledPitch` (`octave = octaveOf(p)`).
`notation.defaultSpelling` delegates to `sharpSpelling` (behaviour unchanged).

## 3. InstrumentConfig and PanelState (`src/lib/state/instrument-config.ts`, pure)

```text
InstrumentConfig {
  tuning: Tuning          // replaces tuningId (canonical, never a custom that matches a preset)
  fretCount: number       // unchanged, 12..24, independent of tuning (FR-022)
}

PanelState =
  | { open: false }
  | { open: true; pending: InstrumentConfig; customOpen: boolean }
```

`DEFAULT_CONFIG = { tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }`.
`equalsConfig` uses `equalsTuning`. `instrumentOf(c) = tuningInstrument(c.tuning, c.fretCount)`.

### Transitions (no-op returns the same object)

| Transition | Precondition | Effect |
|---|---|---|
| `openPanel(p, active)` | closed | `pending = active`, `customOpen = active.tuning.kind === 'custom'` |
| `selectTuning(p, id)` | open, valid id | `pending.tuning = preset id`, `customOpen = false` (FR-001) |
| `chooseCustom(p)` | open | `customOpen = true`; pending tuning unchanged (starts from current pending pitches) |
| `stepString(p, string, delta)` | open, `customOpen`, `canStep` | `pending.tuning = tuningFromOffsets(stepOffsets(offsetsOfTuning(pending.tuning), string, delta))` |
| `setFrets` / `stepFrets` | open | unchanged; tuning and `customOpen` kept |
| `restoreDefault(p)` | open | `pending = DEFAULT_CONFIG`, `customOpen = false` (FR-022) |
| `cancelPanel(p)` | open | `CLOSED` — adjustments discarded (FR-006) |
| `confirmPanel(p, active)` | open | `{ panel: CLOSED, next: pending, changed: !equalsConfig(pending, active) }` |

State diagram (panel session):

```text
closed ──open──▶ open{customOpen = active is custom}
open{false} ──chooseCustom──▶ open{true}
open{true}  ──stepString*──▶ open{true}          (name line may read a preset or "Custom")
open{*}     ──selectTuning──▶ open{false}        (pending = preset pitches)
open{*}     ──restoreDefault──▶ open{false}      (Standard)
open{*}     ──cancel / Escape / Back / backdrop──▶ closed (discard)
open{*}     ──confirm──▶ closed (apply if changed; write prefs)
```

### Derived panel view (computed in the store/component, not stored)

| Derived value | Rule |
|---|---|
| Selected radio | `customOpen ? 'custom' : pending.tuning.id` (`pending.tuning` is always a preset when `!customOpen`, because `openPanel` sets `customOpen` for a custom active tuning and only `stepString` — which needs `customOpen` — can create a custom pending tuning) |
| String rows (when `customOpen`) | for string 6…1: `tuningStrings(pending.tuning)[i]`, `canStep(-1)`, `canStep(+1)` |
| Tuning-name line (when `customOpen`) | preset → `tuningName(id)`; custom → `m.tuning_custom()` |
| Order note visible | `customOpen && invertedStrings(offsetsOfTuning(pending.tuning))` |
| Preview instrument | `instrumentOf(pending)` (FR-021) |

## 4. App-wide instrument store (`src/lib/state/instrument.svelte.ts`)

New methods: `chooseCustom()`, `stepString(string, delta): boolean` (returns whether the
pitch changed so the component knows to play and to check focus), and
`playString(string)` → `playback.note({ string, fret: 0 }, preview)` (no-op when closed).
`confirm` writes preferences as
`{ tuningId: tuning.kind === 'preset' ? tuning.id : 'AF-1', customTuning: tuning.kind === 'custom' ? tuning.offsets : null, fretCount }`.
`restore(config)` signature unchanged (now carries `tuning`).

## 5. Preferences (`src/lib/prefs/schema.ts`)

`Preferences` gains `customTuning: Offsets | null` (default `null`). Record field and
rules in [contracts/storage-format.md](./contracts/storage-format.md).

`tuningOfPreferences(p: Preferences): Tuning` (pure, in `src/lib/prefs/schema.ts`):
`p.customTuning !== null ? tuningFromOffsets(p.customTuning) : { kind: 'preset', id: p.tuningId }`.
`preferences.start()` / `erase()` call `instrument.restore({ tuning: tuningOfPreferences(p), fretCount })`.

## 6. Entity ↔ requirement map

| Entity | Requirements |
|---|---|
| Offsets, limits, `canStep` | FR-002, FR-005, SC-002, SC-003 |
| `tuningFromOffsets`, `matchPreset` | FR-007, FR-008, SC-001, SC-004 |
| `tuningStrings` / `spellSharp` | FR-003, FR-009, FR-018 |
| `invertedStrings` | FR-010, FR-011 |
| `PanelState.customOpen`, transitions | FR-001, FR-006, FR-021, FR-022 |
| `tuningInstrument` | FR-012, FR-013 (via existing triad shapes), FR-020 (6 strings only) |
| `Preferences.customTuning` | FR-015, FR-016, FR-017 |
