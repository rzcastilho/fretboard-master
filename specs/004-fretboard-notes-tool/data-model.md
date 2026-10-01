# Data Model: Fretboard Notes Tool

**Feature**: `004-fretboard-notes-tool` | **Date**: 2026-10-01 | **Research**: [research.md](./research.md)

All entities are in-memory TypeScript values. Nothing is persisted (FR-019). Pitch types
(`Pitch`, `PitchClass`, `Spelling`) and `Instrument` / `Position` are the existing ones from
`src/lib/theory/pitch.ts` and `src/lib/instrument/instrument.ts`.

---

## 1. NotesViewState (`src/lib/state/notes-view.ts`)

The tool's complete view state. Immutable value; transitions return a new value.

| Field | Type | Default (FR-001) | Rules |
|---|---|---|---|
| `selection` | `readonly PitchClass[]` | `[]` | 0–12 distinct values 0–11, first-selected order preserved (FR-003) |
| `labelType` | `'name' \| 'octave' \| 'none'` | `'name'` | FR-005 |
| `background` | `'naturals' \| 'all' \| 'none'` | `'naturals'` | FR-006 |
| `hideNames` | `boolean` | `false` | FR-011; `labelType` is kept while on and restored when off |
| `activeStrings` | `readonly number[]` | all `1..stringCount` | sorted ascending, non-empty, each in `1..stringCount` (FR-007) |
| `region` | `Region` | `{ start: 0, end: fretCount }` | see §2 |
| `card` | `Position \| null` | `null` | the tapped position whose card is open (FR-010) |

**Derived predicates**

- `regionIsWholeNeck = region.start === 0 && region.end === fretCount` ("no region filter").
- `backgroundSet`: naturals → {0,2,4,5,7,9,11}; all → 0..11; none → ∅.
- `tonesOn = !hideNames && labelType !== 'none' && (selection.length === 1 || labelType === 'octave')` (FR-004).

### Transitions (pure; `instrument` passed where bounds matter)

| Function | Effect | No-op when |
|---|---|---|
| `toggleNote(s, pc)` | append `pc` if absent, else remove it | — |
| `addNote(s, pc)` (See every occurrence) | append if absent | already selected |
| `setLabelType(s, t)` / `setBackground(s, b)` / `setHideNames(s, on)` | set field | same value |
| `toggleString(s, n)` | remove/add `n`, keep sorted | removing the only active string (EC-4.2) |
| `setRegionStart(s, v, inst)` | `start = clamp(v, 0, fretCount)`; if `start > end` then `end = start` | same value |
| `setRegionEnd(s, v, inst)` | `end = clamp(v, 0, fretCount)`; if `end < start` then `start = end` | same value |
| `setRegionShortcut(s, k, inst)` | `k ∈ {'0-4','5-9','10-14','whole'}` → `{0,4}`, `{5,9}`, `{10, min(14, fretCount)}`, `{0, fretCount}` | same region |
| `widenRegion(s, inst)` | algorithm in research R-06 | nothing missing |
| `openCard(s, p)` | `card = p` (replaces) | same position (caller still replays) |
| `closeCard(s)` | `card = null` | already closed |
| `clear(s, inst)` | `selection = []`, all strings, whole neck, `card = null`; keeps `labelType`, `background`, `hideNames` (FR-013) | already matching |
| `reset(inst)` | `initialNotesView(inst)` (FR-014) | already initial |
| `revalidate(s, inst)` | drop strings `> stringCount` (all strings if none remain); clamp region to `0..fretCount`, then push rule; drop `card` if invalid; selection unchanged | already valid |

`equalsNotesView(a, b)` lets the store skip no-ops (and therefore skip `playback.stop`).

---

## 2. Region

| Field | Type | Rule |
|---|---|---|
| `start` | integer | `0 ≤ start ≤ end` |
| `end` | integer | `start ≤ end ≤ fretCount` |

`start === end` is allowed (one-fret region). Non-integers are rounded, then clamped.

---

## 3. Position facts (`src/lib/instrument/instrument.ts`, pure)

| Function | Returns | Rule |
|---|---|---|
| `positionsWithPitchClass(inst, pc)` | `Position[]` | every valid position whose `pitchClass(positionPitch)` equals `pc`, string ascending, fret ascending |
| `unisonsOf(inst, p)` | `Position[]` | every other valid position with `positionPitch` equal to `p`'s, string ascending then fret ascending; ignores filters and background (TM-1.4) |

---

## 4. Emphasis classification (`src/lib/state/notes-model.ts`)

For every position `p` of `allPositions(instrument)`, with `pc = pitchClass(pitch(p))`,
`inFilter = activeStrings.includes(p.string) && region.start ≤ p.fret ≤ region.end`,
`selected = selection.includes(pc)`, `bg = backgroundSet.has(pc)`. First matching row wins:

| # | Condition | Emphasis | Label shown | Tone |
|---|---|---|---|---|
| 1a | `card` open and (`p = card` or `p ∈ unisonsOf(card)`) | highlighted | yes | no (single highlight token) |
| 1b | `card` open and `!selected && !bg` | hidden | — | — |
| 1c | `card` open, otherwise | dimmed | only if not filter-dimmed (`inFilter`) | no |
| 2 | `!selected && !bg` | hidden | — | — |
| 3 | `!inFilter` | dimmed | **no** (filter-dimmed) | no |
| 4 | `selected` | highlighted | yes | `tonesOn ? toneOf(octave) : none` |
| 5 | `bg` and `selection.length === 0` | normal | yes | no |
| 5′ | `bg` and `selection.length > 0` | dimmed | **yes** (selection-dimmed) | no |

"Label shown" is further gated by the global label rule: nothing is labeled when `hideNames` or
`labelType === 'none'`. Every marker uses `function: 'neutral'` (clarification, constitution VII).

**Octave badge**: `octaveBadge = tonesOn && labelType === 'name' && emphasis === 'highlighted'`
(the small number beside the name; with `labelType === 'octave'` the label already contains it).

**Tone**: `toneOf(octave) = min(7, max(1, octave))` → `OctaveTone` 1–7.

---

## 5. NotesDisplay (output of `buildNotesModel`)

| Field | Type | Purpose |
|---|---|---|
| `model` | `DisplayModel` | passed to `<Fretboard>` (see contracts/fretboard-model.md) |
| `highlightedCount` | `number` | description and tests |
| `missing` | `readonly PitchClass[]` | selected notes with zero positions in filters, selection order (FR-015) |
| `emptyGuidance` | `boolean` | `background === 'none' && selection.length === 0` → "Pick a note or tap a fret" |
| `listenSteps` | `readonly (Position \| readonly Position[])[]` | research R-07 |
| `listen` | `{ enabled: true } \| { enabled: false; reason: 'none' \| 'too-many' \| 'no-positions' }` | FR-012 |
| `cardInfo` | `CardInfo \| null` | §6 |

`model.description` = summary + entries (FR-019a): summary names selected notes in full words
(conjunction list, selection order), the highlighted count, active strings ("strings 1 to 6" when
contiguous, otherwise a list), and the region ("frets 0 to 22"); with nothing selected it states
the background set. Entries: highlighted positions as "string N, fret F, G3" (open: "string N,
open, E2"), ordered by string descending then fret ascending (same order as `describeView`).
With `hideNames` on, entries of unselected positions omit names (only highlighted entries are
listed, and those are selected, so the visible rule is: no entry for unselected positions).

---

## 6. CardInfo

| Field | Type | Source |
|---|---|---|
| `position` | `Position` | `state.card` |
| `pitchClass` | `PitchClass` | pitch class of the tapped position (argument of See every occurrence) |
| `spelling` | `Spelling` | `defaultSpelling(pc)` (sharp) |
| `altSpelling` | `Spelling \| null` | flat spelling of the same pc when altered (C♯ → D♭), else `null` |
| `octave` | `number` | `octaveOf(pitch)` |
| `unisons` | `readonly Position[]` | `unisonsOf` |
| `selected` | `boolean` | whether `pc` is already selected (See every occurrence stays enabled; it is a no-op then) |

The flat alternative comes from a new `notation.flatSpelling(pc)` (Principle VIII: only
`notation` produces names).

---

## 7. Fretboard model additions (`src/lib/fretboard/types.ts`)

```ts
export type LabelMode = 'note' | 'octave' | 'none';
export type OctaveTone = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Marker {
  // existing: string, fret, function, emphasis, spelling?
  /** Overrides the default label rule (labeled iff highlighted or normal). */
  readonly label?: boolean;
  /** Same-octave tone token (Notes). Drawing only. */
  readonly tone?: OctaveTone;
  /** Draw the small octave number beside a 'note' label. */
  readonly octaveBadge?: boolean;
}

export interface DisplayModel {
  // existing: markers, labelMode, summary?
  /** Lit band over frets start..end; a change scrolls it into view. */
  readonly region?: { readonly start: number; readonly end: number };
  /** false → no hover hint (Hide names). Default true. */
  readonly hoverHint?: boolean;
  /** Replaces the computed text description verbatim. */
  readonly description?: string;
}
```

Fields are optional, so `ToolPlaceholder` (Triads) and the test fixtures keep working unchanged.

---

## 8. Store surface (`src/lib/state/notes.svelte.ts`)

```text
notes.state            → NotesViewState (read-only getter)
notes.instrument       → Instrument currently applied
notes.toggleNote(pc) / addNote(pc) / setLabelType(t) / setBackground(b) / setHideNames(on)
notes.toggleString(n) / setRegionStart(v) / setRegionEnd(v) / setRegionShortcut(k) / widenRegion()
notes.openCard(p) / closeCard() / clear() / reset()
notes.useInstrument(inst)   → revalidate; stops playback with reason 'instrument' if changed
resetNotesForTests()
```

Every mutating action computes the next state with the pure transition; if it differs, it calls
`playback.stop('view')` (except `openCard` / `closeCard`, research R-08) and assigns.

## 9. State transitions (card)

```text
closed --activate p--> open(p)          [playback.note(p)]
open(p) --activate q≠p--> open(q)       [playback.note(q)]
open(p) --activate p--> open(p)         [playback.note(p) replay]
open(p) --Close/Escape--> closed        [focus → cell p]
open(p) --Clear/Reset--> closed         [playback.stop('view')]
open(p) --selection/filter/label/background/hide change--> open(p)
```
