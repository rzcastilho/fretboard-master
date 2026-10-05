# Contract: CAGED Listen and Links — Module API

**Feature**: 019-caged-listen-and-links. Types in [data-model.md](../data-model.md). Every
function is total (never throws); a no-op returns the same object.

## 1. Audio (`src/lib/audio/types.ts`, `schedule.ts`, `engine.ts`)

```ts
export interface TimedStep { positions: readonly Position[]; onsetMs: number; durationMs: number }
export const MAX_TIMELINE_MS = 60_000;
// PlaybackRequest gains { kind: 'timeline'; events: readonly TimedStep[] }
export function planRequest(request: PlaybackRequest, instrument: Instrument): Plan; // handles 'timeline'
```

- `planRequest({kind:'timeline', events})` → one `PlannedStep` per surviving event, same onset and
  duration (clamped), marks per position. Kinds `note`, `chord`, `sequence` are unchanged
  (existing tests untouched).
- Engine: a `timeline` request sets `sequence = true` (calls `onSequenceChange(true/false)`),
  interrupts the previous request, stops on `stop(reason)`, ends naturally after the last mark.
  Log entries carry `kind: 'timeline'`.

## 2. Playback store (`src/lib/state/playback.svelte.ts`)

```ts
playback.timeline(events: readonly TimedStep[], instrument: Instrument): readonly TimeMark[];
```

Gesture-only, like `sequence`; marks unlocked. No other change.

## 3. Listen constants (`src/lib/state/listen.ts`)

```ts
export const LISTEN_BPM = 120;            // existing
export type Tempo = 'slow' | 'medium' | 'fast';
export const TEMPOS: readonly Tempo[];
export const DEFAULT_TEMPO: Tempo;        // 'medium'
export const TEMPO_BPM: Readonly<Record<Tempo, number>>; // 80 / 120 / 180
export const STRUM_GAP_MS = 250, BLOCK_DELAY_MS = 500, SHAPE_GAP_MS = 1500, RING_MS = 1500;
export function isTempo(x: unknown): x is Tempo;
```

## 4. Planner (`src/lib/state/caged-listen.ts`, new, pure)

```ts
export const LISTEN_ORDER: readonly ListenLayer[];
export function listenSource(layers: LayersOn, focused: ShapeOccurrence | null,
                             triad: ShapeTriad | null): ListenSource;
export function listenRegion(positions: readonly ResolvedPosition[], layer: MelodicLayer,
                             q: CagedQuality): readonly RegionNote[];   // highlighted ∩ layer degrees
export function dedupeUnisons(region: readonly RegionNote[]): readonly RegionNote[];
export function melodicSteps(region: readonly RegionNote[], layer: MelodicLayer): readonly Position[];
export function chordPositions(occ: ShapeOccurrence, openPitches: readonly Pitch[]): readonly RegionNote[];
export function strumEvents(chord: readonly RegionNote[], t0: number):
  { readonly events: readonly TimedStep[]; readonly blockOnsetMs: number };
export function buildCagedListen(input: CagedListenInput): CagedListenPlan;
```

Guarantees: invariants P-1 … P-6 (data-model §6). `buildCagedListen` returns `{kind:'none'}` when
`occurrences` is empty. `TimedStep` is re-declared structurally in this module's types (state may
not import `audio/` outside `playback.svelte.ts`); `playback.timeline` accepts it structurally.

## 5. CAGED model (`src/lib/state/caged-model.ts`)

`CagedDisplay.listen: { enabled: boolean; reason: string | null; source: ListenSource | null }`
— `enabled ⇔ occurrences.length > 0`; `reason` = `m.caged_listen_reason_no_shapes()` (no drawable
tuning) or `m.caged_listen_reason_no_fit()` (no shape fits); `source` = `listenSource(...)`.

## 6. CAGED store (`src/lib/state/caged.svelte.ts`)

```ts
caged.tempo: Tempo;
caged.setTempo(t: Tempo): void;       // stops a playing Listen sequence; remembers
caged.restoreTempo(t: Tempo): void;   // no stop, no write
caged.listen(): void;                 // gesture handler
caged.listening: ListenSource | null;
caged.carry(k: CagedCarry): void;     // apply + withResolvedFocus; stops playback
caged.showTriadLayer(): void;
```

Stop matrix (R-09) is part of this contract: focus, layer, Triad set and tempo changes stop a
playing *sequence* only; key/quality/spelling/reset/carry stop any playback; label type and
connections never stop.

## 7. Preferences (`src/lib/prefs/schema.ts`, `state/preferences.svelte.ts`)

- `Preferences.tempo: Tempo`; `DEFAULT_PREFERENCES.tempo = 'medium'`.
- `parsePreferences`: `tempo` picklist with fallback; `serializePreferences`: `tempo` only when not
  `'medium'`. `PREFS_VERSION === 1`.
- `preferences.start()` / `erase()` call `caged.restoreTempo(p.tempo)`.

## 8. Links (`src/lib/state/links.ts`, `links.svelte.ts`)

```ts
// links.ts (pure)
export interface CagedCarry { rootPc: PitchClass; quality: CagedQuality; spelling: SpellingOverride }
export function carryFromCaged(c: CagedViewState): CarryContext;          // kind 'notes'
export function carryTriadsToCaged(t: TriadsViewState): CagedCarry;
export function carryIntoCaged(c: CagedViewState, k: CagedCarry): CagedViewState;
export function cagedCanShow(q: Quality): q is CagedQuality;              // major | minor

// links.svelte.ts
export function linkTools(from: ScreenId, to: LinkedTool): void;          // + 4 CAGED pairs
export async function openCagedFromNote(pc: PitchClass): Promise<void>;   // one goto
export async function openCagedFromTriads(): Promise<void>;               // no-op for dim/aug
```

`linkTools` pairs: notes→caged (one note only), caged→notes, triads→caged, caged→triads;
notes↔triads unchanged.
