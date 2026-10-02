# Data Model: Interactive Fretboard

**Feature**: `002-interactive-fretboard` | **Date**: 2026-09-30 | **Plan**: [plan.md](./plan.md)

All entities are in-memory TypeScript values. Nothing is persisted, sent, or read from the URL in
this slice. Source references: DM-3 (pitch), DM-5 (instrument), DM-6 (position) in
`specs/autonomous/fretboard-master/04-data-model.md`; TM-1/TM-3 in `11-music-theory-reference.md`.

---

## 1. Theory types — `src/lib/theory/pitch.ts` (pure)

| Type | Shape | Rules |
|---|---|---|
| `Letter` | `'C' \| 'D' \| 'E' \| 'F' \| 'G' \| 'A' \| 'B'` | Natural-note letters in order C…B. |
| `Accidental` | `-2 \| -1 \| 0 \| 1 \| 2` | −2 = 𝄫, −1 = ♭, 0 = natural, 1 = ♯, 2 = 𝄪. |
| `Spelling` | `{ letter: Letter; accidental: Accidental }` | A spelled pitch class. |
| `SpelledPitch` | `Spelling & { octave: number }` | Octave numbered by the *letter* (B♯3 sounds as C4). |
| `Pitch` | `number` (integer) | Semitones, C4 = 60, C−1 = 0. |
| `PitchClass` | `number` (integer 0–11) | C = 0 … B = 11. |

Functions (all total, no throws, explicit return types):

- `pitchClass(p: Pitch): PitchClass` — `((p % 12) + 12) % 12`.
- `octaveOf(p: Pitch): number` — `Math.floor(p / 12) - 1` (octave changes at C, TM-1.3).
- `transpose(p: Pitch, semitones: number): Pitch`.
- `pitchClassOfSpelling(s: Spelling): PitchClass` — natural letter class + accidental, mod 12.
- `pitchOfSpelling(s: SpelledPitch): Pitch` — `(octave + 1) * 12 + naturalClass(letter) + accidental`
  (not reduced mod 12, so B♯3 → 60 and C♭4 → 59).

Validation: callers pass integers; `Spelling`/`Accidental` are closed unions so invalid values
cannot be constructed in typed code.

## 2. Instrument — `src/lib/instrument/instrument.ts` (DM-5)

```text
Instrument {
  stringCount: number          // 6 in this slice (6 or 7 later)
  fretCount: number            // 22 in this slice (12–24 later)
  openStrings: readonly SpelledPitch[]   // index 0 = string 1 (highest); length === stringCount
  handedness: 'right' | 'left'           // presentation only; 'right' in this slice
  orientation: 'highest-top' | 'lowest-top'  // presentation only; 'highest-top' in this slice
}
```

- `STANDARD_GUITAR`: `stringCount 6`, `fretCount 22`, `openStrings` = E4, B3, G3, D3, A2, E2
  (strings 1→6), `handedness 'right'`, `orientation 'highest-top'`. Frozen.
- Invariants (unit-tested on the constant; enforced by construction in later waves):
  `openStrings.length === stringCount`; strings 1→N have non-increasing pitch is **not** required
  (re-entrant tunings exist), so no ordering invariant is asserted.
- Handedness and orientation are read **only** by `src/lib/fretboard` (constitution III).

## 3. Position and pitch (DM-6)

```text
Position { string: number; fret: number }   // string 1..stringCount (1 = highest), fret 0..fretCount
```

- `isValidPosition(instrument, p): boolean` — integers within the ranges above.
- `positionPitch(instrument, p): Pitch` — `pitchOfSpelling(openStrings[p.string − 1]) + p.fret`
  (FR-006; TM-1.2). Precondition: valid position (the fretboard only generates valid ones).
- `positionKey(p): string` — `"${string}:${fret}"`, used for maps and keyed `{#each}`.
- Count for this slice: 6 × 23 = **138** positions (SC-006).

## 4. Display model (input to the fretboard; produced by tools from 004 on)

```text
NoteFunction = 'root' | 'third' | 'fifth' | 'degree' | 'neutral'
Emphasis     = 'highlighted' | 'normal' | 'dimmed' | 'hidden'
LabelMode    = 'note' | 'none'

Marker {
  string: number
  fret: number
  function: NoteFunction
  emphasis: Emphasis
  spelling?: Spelling          // explicit spelling (e.g. E♯, B𝄫); absent → notation default (sharps)
}

DisplayModel {
  markers: readonly Marker[]   // at most one per position
  labelMode: LabelMode
  summary?: string             // optional leading sentence of the text description, already localized by the tool
}
```

Rules (FR-007–FR-009, FR-020):

- **Uniqueness**: at most one marker per `positionKey`. The renderer indexes markers in a
  `Map`; if a tool sends duplicates, the **first** wins and the rest are ignored (never throws;
  unit-tested). Overlap resolution (EC-3.1) is the tool's job.
- **Range**: markers at invalid positions for the instrument are ignored (never throws).
- **Unmarked position** ≡ `emphasis: 'hidden'`: not drawn, still a focusable, tappable, hoverable
  gridcell.
- **Label visibility**: label shown iff `labelMode === 'note'` and emphasis ∈ {highlighted,
  normal}. Label text = `noteLabel(spelling ?? defaultSpelling(pitchClass(positionPitch)))`.
- **Default model** (no `model` prop): `{ markers: [], labelMode: 'none' }`.
- **Highlighted set** = positions whose marker emphasis is `highlighted`; its sorted key list is
  the auto-scroll trigger (R-09).

Visual mapping (all sizes/opacities are tokens, R-06):

| Function | Element | Size token | Fill |
|---|---|---|---|
| root | rounded square | `--marker-root` (largest) | `--color-root` |
| third | circle | `--marker-medium` | `--color-third` |
| fifth | diamond | `--marker-medium` | `--color-fifth` |
| neutral | circle + solid outline ring (`--marker-neutral-stroke-width`; third has none) | `--marker-medium` | `--color-neutral-note` (light), stroke `--color-neutral-note-stroke` |
| degree | outlined circle | `--marker-small` (smallest) | none, stroke `--color-degree-stroke` |

| Emphasis | Class | Effect |
|---|---|---|
| highlighted | `.highlighted` | full opacity, `scale(--emph-highlight-scale)`, elevation stroke, label |
| normal | `.normal` | full opacity, base size, label |
| dimmed | `.dimmed` | `opacity --emph-dim-opacity`, `scale(--emph-dim-scale)`, no label |
| hidden | — | not rendered |

## 5. Fretboard layout (pure, `src/lib/fretboard/geometry.ts`)

```text
FretboardMetrics {         // px, resolved from rem tokens at runtime (R-05)
  row: number; labelCol: number; openCol: number;
  fretFirst: number; fretLast: number; numbersRow: number; nutWidth: number
}

FretboardLayout {
  width: number; height: number           // SVG size in px
  scale: number                           // ≥ 1; > 1 when filling a wider container
  columns: readonly Column[]              // index = fret (0 = open column)
  rows: readonly Row[]                    // index = string − 1, top to bottom on screen
  nutX: number
  boardTop: number; boardBottom: number   // fretted area, excludes the numbers row
  scrolls: boolean                        // natural width > container width
}
Column { fret: number; start: number; end: number; center: number }
Row    { string: number; top: number; bottom: number; center: number }
```

- `layoutFretboard(instrument, metrics, containerWidth, variant): FretboardLayout`.
  - Interactive: columns = open + frets 1…fretCount; fret *n* width
    `fretFirst − (fretFirst − fretLast)·(n − 1)/21`, floored at `fretLast`.
  - Thumbnail: frets 0–12 with thumbnail metrics, no label column, no numbers row.
  - Fill: `scale = max(1, containerWidth / naturalWidth)` applied to column widths only.
- Invariants (unit-tested): every column width ≥ `metrics.openCol` (44 px at 100 %); every row
  height ≥ 44 px; columns contiguous and strictly increasing; fret 1 widest, last fret narrowest.
- Inlays: `INLAY_FRETS = [3,5,7,9,15,17,19,21]`, `DOUBLE_INLAY_FRETS = [12,24]`, filtered by
  `fret ≤ fretCount` (FR-003). Fret-number emphasis set = the same frets ≤ 22 (FR-004).
- Orientation/handedness: `rows` order and column direction come from one mapping function
  (`screenOrder(instrument)`); in this slice it is identity (string 1 on top, nut on the left).

## 6. Interaction state (component-local, per fretboard instance)

```text
GestureState =
  | { kind: 'idle' }
  | { kind: 'pending'; pointerId: number; pointerType: string; originX: number; originY: number }
  | { kind: 'scrolling'; pointerId: number; pointerType: string; lastX: number }
  | { kind: 'cancelled' }                      // until all pointers are up

FocusState { stop: Position; inside: boolean }  // stop initial {string:1, fret:0}
HoverState  = Position | null                   // mouse only
```

Transitions (`reduceGesture(state, event): { state, effect }`, pure):

| From | Event | To | Effect |
|---|---|---|---|
| idle | down (button 0, isPrimary) | pending | — |
| idle | down (other button) | idle | — |
| pending | move, travel < 10 px | pending | — |
| pending | move, travel ≥ 10 px | scrolling | hide hover |
| pending | up (same pointer) | idle | **activate(nearestPosition)** |
| pending | down (another pointer) | cancelled | — |
| pending / scrolling | cancel | idle | — |
| scrolling | move (mouse) | scrolling | `scrollLeft −= dx` |
| scrolling | up | idle | none (no activation) |
| cancelled | up of last pointer | idle | — |

Keyboard (`moveFocus(stop, key, instrument): Position | 'activate' | null`):
ArrowRight fret+1, ArrowLeft fret−1, ArrowUp string−1, ArrowDown string+1 (clamped; unchanged at
edges), Enter/Space → `'activate'`, other keys → `null` (not handled).

Focus lifecycle: `stop` changes on arrow move or activation; `inside` toggles on
`focusin`/`focusout` of the grid; the focus ring renders iff `inside`. Re-entry by Tab lands on
`stop` because it holds the only `tabindex="0"`.

## 7. Position event (output to tools)

```text
onactivate?: (position: Position) => void
```

- Emitted on tap release (pending → up) and on Enter/Space; repeats emit again.
- Payload contains only `{ string, fret }` — no coordinates, pitch, or DOM references (FR-010,
  FR-022, ARCH-5).
- Emitted after DOM focus moved to the cell.

## 8. Text description (`src/lib/fretboard/description.ts`)

```text
describeView(instrument, model): string
positionName(instrument, position, marker?): string
```

- `describeView`: `[summary] + (entries.length ? entries.join('; ') : m.fretboard_description_empty())`
  where entries = highlighted + normal markers, sorted by string descending (6→1) then fret
  ascending, each `m.fretboard_description_entry({ string, fret, note, function })`; fret 0 uses
  `m.fretboard_fret_open()`.
- `positionName`: `m.fretboard_position_name({ note, string, fret })` plus
  `m.fretboard_position_function({ function })` when a marker exists (any emphasis except
  hidden — a hidden marker is not announced as a function, matching "not drawn").
- `note` = `spokenNote(spelling ?? defaultSpelling(...))`.
- Live-region state: `announced: string | null`; set only after the first render and only when
  `describeView` output differs from the last value.

## 9. Test-build fixture hook (not shipped)

```text
globalThis.__fmFretboardFixture?: FixtureName     // read in test/dev builds only
globalThis.__fmFretboardEvents?: Position[]       // appended on activation in test/dev builds
FixtureName = 'all-markers' | 'labels-spelled' | 'highlight-far' | 'highlight-split' | 'empty'
```

Unknown names → plain board. Guarded by `__FM_FAULT_INJECTION__`; removed from production builds
and asserted absent by `scripts/check-no-fault-hook.mjs`.
