# Data Model: Shape Focus and Connections

**Feature**: `016-shape-focus-and-connections` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Every entity below is in-memory and immutable. The one exception is §6, a field in the existing
v1 preferences record. The flow is fixed by Principle III:

control action → view state (§2) → display model (§4) → fretboard render (§5).

## 1. Connection (theory, `src/lib/theory/caged.ts`)

```ts
export interface CagedConnection {
  readonly string: number;          // 1…6 (never 7; never an altered string 6)
  readonly fret: number;            // 0…fretCount
  readonly degree: CagedDegree;     // 'R' | '3' | 'b3' | '5'
  /** Occurrence indices (into the sorted list) of each adjacent pair sharing this position. */
  readonly pairs: readonly (readonly [lower: number, upper: number])[];
}
```

- **Source**: `cagedConnections(occs: readonly ShapeOccurrence[]): readonly CagedConnection[]`.
  For each `i` in `0…occs.length − 2`, it intersects the `notes` of `occs[i]` and `occs[i+1]`
  by `(string, fret)`. Synthesized notes (`occ.alteredString && note.string === 6`) are
  excluded first.
- **Helper**: `sharedPositions(a, b): readonly OccurrenceNote[]` is the same intersection for
  one pair. The step transition (§3) uses it.
- **Invariants**:
  - The degree agrees in both occurrences, because a position has one pitch.
  - Output is sorted by fret, then string descending, so it is deterministic.
  - `pairs.length` is 1 or 2.
  - Pure and total: `[]` for fewer than 2 occurrences.
- **Validation**: TM-6.3 and TM-7.2 exact sets (FR-009, SC-002).

## 2. CAGED view state (`src/lib/state/caged-view.ts`, extended)

```ts
export interface CagedFocus {
  readonly letter: CagedShapeId;     // 'C' | 'A' | 'G' | 'E' | 'D'
  readonly ordinal: number;          // 0 = that letter's drawn occurrence nearest the nut
}

export interface CagedViewState {
  readonly rootPc: PitchClass;
  readonly spellingOverride: SpellingOverride;
  readonly quality: CagedQuality;
  readonly focus: CagedFocus | null;  // NEW — null = "See all"
  readonly connections: boolean;      // NEW — Show connections, default false
}
```

| Transition | Effect |
|---|---|
| `initialCagedView()` / `resetCaged()` | `focus: null`, `connections: false` (FR-011), C major |
| `setConnections(s, on)` | Sets the flag. Same value: no-op (same object) |
| `setFocus(s, f)` | Sets the focus. Equal focus: no-op |
| `selectRoot`, `setQuality` | Unchanged behavior. The store re-resolves `focus` afterwards (§3) |
| `switchSpelling` | Focus untouched |
| `equalsCagedView` | Also compares `focus` (letter and ordinal) and `connections` |

- **Lifetime**: module store. It survives tool navigation and resets on reload. It is never
  persisted and never put in a URL in this slice.

## 3. Focus resolution (`src/lib/state/caged-focus.ts`, new, pure)

All functions are total and take `occs`, the drawn occurrences sorted by start.

| Function | Rule |
|---|---|
| `occurrenceIndex(f, occs): number \| null` | Index of the `f.ordinal`-th occurrence with `shape.id === f.letter`, or `null` |
| `focusOfIndex(i, occs): CagedFocus \| null` | Inverse of `occurrenceIndex`, or `null` when out of range |
| `focusFromLetter(f, letter \| 'all', occs)` | `'all'` gives `null`. A letter already focused gives `f` unchanged. Otherwise ordinal 0 of the letter, or `f` when the letter is not drawn (disabled in the UI) |
| `toggleTagFocus(f, i, occs)` | `null` when `i` is the focused index, else `focusOfIndex(i)` |
| `stepFocus(f, dir: 1 \| -1, occs)` | `focusOfIndex(idx + dir)`. Returns `f` unchanged at either end or when `f` is `null`. No wrap |
| `stepAvailability(f, occs)` | `{ previous: idx > 0, next: idx < occs.length − 1 }`. Both are `false` when `f` is `null` |
| `drawnLetters(occs): ReadonlySet<CagedShapeId>` | Enables selector options |
| `reresolveFocus(prev: ShapeOccurrence \| null, prevFocus, nextOccs)` | See the rule below |
| `STEP_WINDOW_MS = 500` | Equals the `--duration-medium` token (asserted by a test) |

**Re-resolve rule** (key, quality or instrument change; R-02):

1. If `prevFocus` is `null`, the result is `null`.
2. If `nextOccs` is empty, the result is `null`.
3. If `occurrenceIndex(prevFocus, nextOccs) !== null`, keep `prevFocus`.
4. Otherwise, take the `prevFocus.letter` occurrence in `nextOccs` whose `start` is nearest
   `prev.start`.
5. Otherwise, take the occurrence nearest `prev.start`, with the lower start winning a tie.

The store reports **changed** when the old and new occurrences differ in letter or start. For
an instrument change only, that triggers the `instrument_adjusted` notice.

**Step transition** (store-only, never part of the view state):

```ts
interface StepTransition {
  readonly positions: readonly string[];   // "s:f" keys shared by departing and arriving occurrence
}
```

- Set on each `step(dir)` that moves focus.
- A pending timer is cleared first, then `setTimeout(clear, STEP_WINDOW_MS)` starts.
- Also cleared immediately by any non-step focus change, reset, key, quality or instrument
  change, or when the store is torn down.

## 4. CAGED display (`src/lib/state/caged-model.ts`, extended)

`buildCagedModel(view, instrument, context, transition)` adds the following to `CagedDisplay`:

| Field | Value |
|---|---|
| `focusIndex: number \| null` | `occurrenceIndex(view.focus, occurrences)` |
| `focused: ShapeOccurrence \| null` | The occurrence at `focusIndex` |
| `steps: { previous: boolean; next: boolean }` | `stepAvailability` |
| `drawnLetters: ReadonlySet<CagedShapeId>` | For selector `disabled` |
| `connections: readonly CagedConnection[]` | `cagedConnections(occurrences)` (always computed; cheap) |

The `model: DisplayModel` changes as follows:

- **`markers[k].emphasis`**:
  - `normal` when `focusIndex` is `null` and the position is not in the transition.
  - `highlighted` when the position is a note of the focused occurrence or in
    `transition.positions`.
  - `dimmed` otherwise.
- **`markers[k].ring`**: `true` when (`view.connections` and the position is in
  `connections`) or the position is in `transition.positions`.
- **`region`**: `{ start: focused.start, end: focused.end, align: 'center' }`, absent when
  there is no focus.
- **`tags[i].pressed`**: `i === focusIndex`. `tagsInteractive` is `true`. The tag `id` stays
  `"<letter>@<start>"`.
- **`description`**:
  - A leading `caged_focus_status` or `caged_focus_none` sentence.
  - Then the existing sentences.
  - Then one `caged_description_connection` per ringed connection, naming the two shapes of
    each pair (`occs[lower].shape.id`, `occs[upper].shape.id`).
- **Non-compatible**: `focusIndex: null`, `steps` both `false`, `drawnLetters` empty and
  `connections: []`. `model` stays `null` as today.

**New exported helper**: `cagedOccurrencesFor(view, instrument)`. The store uses it to
re-resolve before it commits a transition.

## 5. Renderer additions (`src/lib/fretboard/types.ts`, `Fretboard.svelte`, `interaction.ts`)

| Addition | Meaning |
|---|---|
| `Marker.ring?: boolean` | Draws `<circle class="connection-ring">` around the glyph, inside the marker group, so emphasis opacity and scale apply. `aria-hidden` like every marker. Never announced, because the description carries the meaning |
| `DisplayModel.region.align?: 'center'` | The band-change effect uses `centerScrollTarget` and the `--duration-medium` duration |
| `centerScrollTarget(layout, start, end, viewport): number \| null` | `clamp((colStart + colEnd)/2 − width/2, 0, layout.width − width)`. Returns `null` when the board fits or the target is within 0.5 px. Mirroring comes from `layout.columns` |
| Tokens | `--duration-medium: 500ms` (`0s` under reduced motion). `--connection-ring` (text color in every theme and in forced colors). `--connection-ring-width`. `--connection-ring-gap` |

## 6. Preferences record (`src/lib/prefs/schema.ts`, extended)

| Field | Stored key | Type | Default | Rule |
|---|---|---|---|---|
| `rotateHintShown` | `rotateHint` | boolean | `false` | `v.fallback(v.boolean(), false)` on read. Written only when `true`. `version` stays `1` |

- **Session store** (`preferences.svelte.ts`) exposes:
  - `rotateHintShown: boolean` (stored value, or this-load flag).
  - `markRotateHintShown(): void`. It is idempotent and fire-and-forget on storage failure.
- **`erase()`** clears it.

**Rotate rule** (`src/lib/state/rotate-hint.ts`, pure):

```ts
export const PHONE_MAX_WIDTH = 599;
export function isPhonePortrait(width: number, height: number): boolean; // width ≤ 599 && height > width
export function shouldShowRotateHint(i: { width: number; height: number; recorded: boolean }): boolean;
```

`recorded` = `preferences.rotateHintShown`. That flag is already `true` after a display in
this load, even when storage is unavailable.

## 7. Relationships

```text
Instrument + CagedViewState ──cagedOccurrencesFor──▶ ShapeOccurrence[] (sorted)
                                   │                         │
                                   ├─ caged-focus ──▶ focusIndex, steps, drawnLetters
                                   └─ cagedConnections ──▶ CagedConnection[]
StepTransition (store) ────────────────────────────────▶ positions
             all of the above ──buildCagedModel──▶ DisplayModel (emphasis, ring, region, tags, description)
Preferences.rotateHintShown + viewport ──shouldShowRotateHint──▶ CagedTool notice
```
