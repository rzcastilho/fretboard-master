# Data Model: Share the Current View (022)

Phase 1 output for [plan.md](./plan.md). Types are TypeScript sketches of the shapes the
implementation introduces; existing types are referenced, not redefined. Wire grammar is in
[contracts/link-format.md](./contracts/link-format.md).

## 1. ShareSnapshot (new, `src/lib/link/types.ts`)

The exact input of the encoder and output of the decoder. Contains no presentation or personal
data by construction (FR-010).

```ts
type LinkInstrument = {
  readonly stringCount: StringCount;      // 6 | 7
  readonly tuning: Tuning;                // canonical: preset id, or custom offsets matching no preset
  readonly fretCount: number;             // MIN_FRETS..MAX_FRETS (12..24)
};

type ShareSnapshot =
  | { readonly tool: 'notes';  readonly view: NotesViewState;  readonly instrument: LinkInstrument }
  | { readonly tool: 'triads'; readonly view: TriadsViewState; readonly instrument: LinkInstrument }
  | { readonly tool: 'caged';  readonly view: CagedViewState;  readonly instrument: LinkInstrument;
      readonly temporary: boolean };
```

- `LinkInstrument` is `InstrumentConfig` minus `handedness`/`orientation`
  (`src/lib/state/instrument-config.ts`). Built with `musicalOf(config)`; the encoder never sees
  presentation fields.
- `view` types are the existing `NotesViewState`, `TriadsViewState`, `CagedViewState`
  (`labelType` is inside each view).
- CAGED `instrument` is the **preferred** instrument; `temporary` says the standard counterpart is
  shown (slice 015 derivation unchanged).

### Validation rules (applied by `decodeLink`, each field falls back on its own)

| Field | Allowed | Fallback |
|---|---|---|
| `stringCount` | 6, 7 | 6 |
| `tuning` preset | `isTuningIdFor(id, stringCount)` | `standardTuningId(stringCount)` |
| `tuning` custom | `stringCount` MIDI ints; offsets vs `referencePitches` within `OFFSET_MIN..OFFSET_MAX`; then `tuningFromOffsets` | standard preset |
| `fretCount` | integer 12..24 | 22 |
| Notes `selection` | 0–12 distinct ints 0..11, order kept | `[]` |
| Notes `activeStrings` | non-empty, distinct, 1..stringCount, emitted ascending | all strings |
| Notes `region` | ints, 0 ≤ start ≤ end ≤ fretCount | `0..fretCount` |
| Notes `background` | `naturals` `all` `none` | `naturals` |
| Notes `hideNames` | `0` `1` | false |
| Notes `card` | `-` or valid `Position` on instrument | null |
| Notes `labelType` | `name` `octave` `none` | `name` |
| Triads `rootPc` | 0..11 | 0 |
| `spellingOverride` (Triads, CAGED) | `none` `sharp` `flat`; non-`none` only on altered roots | `none` |
| Triads `quality` | `QUALITIES` | `major` |
| Triads `inversion` | `INVERSIONS` | `root` |
| Triads `stringSet` | 3..stringCount | `min(3, stringCount)` |
| Triads `view` | `TRIADS_VIEWS` | `isolated` |
| Triads `occurrence` | int ≥ 0, then clamped by `revalidate` | 0 |
| Triads `compare.on` | `0` `1` | false |
| Triads `compare.quality` | `-` or quality ≠ `quality`; `on ⇒ non-null` | `{ on: false, quality: null }` |
| Triads `labelType` | `interval` `name` | `interval` |
| CAGED `rootPc` | 0..11 | 0 |
| CAGED `quality` | `major` `minor` | `major` |
| CAGED `focus` | `-` or letter ∈ `CAGED_CYCLE`, ordinal int ≥ 0 | null |
| CAGED `layers` | exactly 5 binary digits, at least one `1` (drawability vs focus is the store's `ensureDrawable`, applied by 006/002) | `CHORD_ONLY` |
| CAGED `connections` | `0` `1` | false |
| CAGED `triadSet` | `-` or 3..stringCount; non-null only when `layers.triad` | null |
| CAGED `labelType` | `interval` `name` | `interval` |
| CAGED `temporary` | `0` `1` | false |

Cross-field clamps reuse existing pure helpers: notes `revalidate`, triads `revalidate`. Focus
ordinal existence on the instrument is **not** checked by the codec (requires model build); the
CAGED store already drops unsupported focus on apply — that is 006/002's concern.

## 2. DecodeResult (new, `src/lib/link/types.ts`)

```ts
type DecodeResult =
  | { readonly kind: 'ok'; readonly snapshot: ShareSnapshot; readonly fellBack: readonly string[] }
  | { readonly kind: 'not-a-tool' }              // path is not /notes, /triads, /caged
  | { readonly kind: 'invalid' }                 // `v` missing or not a positive integer
  | { readonly kind: 'unsupported-version'; readonly version: number }; // v > 1
```

`fellBack` lists param keys (`sel`, `tu`, …) that were missing or invalid. Empty for every
fixture.

## 3. SharePlatform (new, `src/lib/state/share.svelte.ts`)

Injectable adapter over the browser (default reads globals lazily at call time).

```ts
interface SharePlatform {
  readonly canShare: () => boolean;                       // typeof navigator.share === 'function'
  readonly coarsePointer: () => boolean;                  // matchMedia('(pointer: coarse)').matches
  readonly share: (data: { url: string; title: string }) => Promise<void>;
  readonly writeText: ((text: string) => Promise<void>) | null; // navigator.clipboard?.writeText
}
```

## 4. ShareUiState (new, store-held)

```ts
interface ShareUiState {
  readonly busy: boolean;                     // a share/copy attempt is pending
  readonly notice: { readonly id: number } | null;   // "Link copied"; id bumps on each copy
  readonly fallback: { readonly href: string } | null; // manual-copy panel
}
```

State transitions (`share()`):

```text
idle ──share()──▶ busy
busy ──sheet ok──────────────▶ idle
busy ──sheet AbortError──────▶ idle                      (nothing shown)
busy ──sheet other error──┐
busy ──fine pointer/no API┴▶ copy
copy ──writeText ok──────────▶ idle + notice{id+1}       (replaces previous; auto-clear 4 s)
copy ──no writeText/reject───▶ idle + fallback{href}     (notice cleared; never "copied")
fallback ──Dismiss/Escape/view change/tool change──▶ idle (focus → Share button)
notice ──Dismiss / 4 s──▶ null
```

Invariants: `notice !== null ⇒ fallback === null` and vice versa; `busy ⇒` further `share()`
calls are ignored.

## 5. AddressSync (new, `src/lib/state/address.ts`)

```ts
interface AddressSync {
  schedule(href: string): void;   // trailing debounce, 150 ms
  flush(): void;                  // write pending now (first write on open)
  cancel(): void;                 // drop pending (screen change)
}
```

Created with `{ write(href), delayMs, setTimer, clearTimer }`; `write` never throws (wrapped).
Lifecycle per tool screen: `openToolAddress(tool)` (onMount: immediate replace with canonical
link) → `$effect` schedules on every state change → `popstate` re-schedules → `beforeNavigate`
with pathname change cancels.

## 6. Share title (derived, `src/lib/shell/share-title.ts`)

`shareTitle(snapshot): string` — derived from the same snapshot as the link (FR-015). Rules in
[contracts/share-ui.md](./contracts/share-ui.md) §3. Never empty; never contains `undefined`, an
empty segment or a dangling separator.

## 7. Relationships

```text
instrument.active ─musicalOf─▶ LinkInstrument ─┐
notes/triads/caged store state ────────────────┼─▶ ShareSnapshot ─encodeLink(origin)─▶ href
caged.temporary ───────────────────────────────┘          │                         │
                                                          └─shareTitle──▶ title    ├─▶ AddressSync.write
                                                                                    └─▶ share() / fallback
href ─decodeLink─▶ DecodeResult  (tests now; 006/002 applies it)
```
