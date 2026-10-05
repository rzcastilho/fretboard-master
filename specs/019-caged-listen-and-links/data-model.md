# Data Model: CAGED Listen and Links to Other Tools

**Feature**: 019-caged-listen-and-links | **Date**: 2026-10-05 | Decisions: [research.md](./research.md)

All entities are in-memory except **Tempo preference** (§5), which is one optional field of the
existing versioned preferences record. Nothing is added to share links.

---

## 1. Timed step and `timeline` request (`src/lib/audio/types.ts`) — R-01

```ts
export interface TimedStep {
  readonly positions: readonly Position[]; // one = single note, several = block
  readonly onsetMs: number;                // from request start; clamped 0…MAX_TIMELINE_MS
  readonly durationMs: number;             // ring length; clamped 1…MAX_TIMELINE_MS
}

export type PlaybackRequest =
  | { kind: 'note'; position }
  | { kind: 'chord'; positions }
  | { kind: 'sequence'; steps; bpm }
  | { kind: 'timeline'; events: readonly TimedStep[] };   // NEW
```

Validation (in `planRequest`, never throws): an event with a non-finite onset or duration is
dropped; invalid or duplicate positions inside one event are dropped (`validUnique`); an event
left empty is dropped. `MAX_TIMELINE_MS = 60_000`.

`Plan.kind` and `AudioLogEntry.step.kind` gain `'timeline'`. Engine: `ActiveRequest.sequence` is
true for `sequence` **and** `timeline` (drives `playback.sequencePlaying` and the Stop button).

## 2. Listen constants and tempo (`src/lib/state/listen.ts`) — R-06, R-08

| Name | Value | Note |
|---|---|---|
| `LISTEN_BPM` | 120 | existing; Notes, Triads, CAGED Triad playback |
| `Tempo` | `'slow' \| 'medium' \| 'fast'` | new type |
| `TEMPOS` | `['slow','medium','fast']` | picklist order = UI order |
| `DEFAULT_TEMPO` | `'medium'` | |
| `TEMPO_BPM` | `{ slow: 80, medium: 120, fast: 180 }` | `TEMPO_BPM.medium === LISTEN_BPM` (test) |
| `STRUM_GAP_MS` | 250 | strum onset spacing |
| `BLOCK_DELAY_MS` | 500 | last strum onset → block |
| `SHAPE_GAP_MS` | 1500 | block onset → next shape's strum (no focus) |
| `RING_MS` | 1500 | strum/block ring; equals `audio/schedule` `NOTE_MS` (test) |

## 3. Listen source, region and plan (`src/lib/state/caged-listen.ts`, new, pure) — R-02…R-07

```ts
export type ListenLayer = 'scale' | 'pentatonic' | 'arpeggio' | 'triad' | 'chord';
export type ListenSource =
  | { readonly kind: 'shape'; readonly layer: ListenLayer; readonly letter: CagedShapeId }
  | { readonly kind: 'all-chords' };

/** Widest first — NOT LAYER_PRIORITY (drawing order). */
export const LISTEN_ORDER: readonly ListenLayer[] = ['scale','pentatonic','arpeggio','triad','chord'];

export interface RegionNote { readonly string: number; readonly fret: number;
                              readonly degree: ScaleDegree; readonly pitch: Pitch; }

export interface CagedListenInput {
  readonly view: CagedViewState;            // layers, quality, focus
  readonly occurrences: readonly ShapeOccurrence[];
  readonly focusIndex: number | null;
  readonly positions: readonly ResolvedPosition[];   // display.positions (low → high)
  readonly triad: ShapeTriad | null;        // selected set's triad for the focus, else null
  readonly openPitches: readonly Pitch[];   // effective instrument, string 1 first
  readonly tempo: Tempo;
}

export type CagedListenPlan =
  | { readonly kind: 'sequence'; readonly steps: readonly ListenStep[]; readonly bpm: number;
      readonly source: ListenSource }
  | { readonly kind: 'timeline'; readonly events: readonly TimedStep[]; readonly source: ListenSource }
  | { readonly kind: 'none' };              // no occurrence drawn
```

Rules:

| Source | Plan | Steps / events |
|---|---|---|
| no focus (`all-chords`) | `timeline` | per occurrence in `occurrences` order (sorted by start = nut → body): strum + block (§4); next shape at previous block onset + 1500 |
| `chord` | `timeline` | strum + block of the focused occurrence's chord positions (§4) |
| `triad` | `sequence`, `LISTEN_BPM` | `[low, mid, high, [low, mid, high]]` of `triad` (strings `set`, `set−1`, `set−2`) |
| `arpeggio` | `sequence`, `TEMPO_BPM[tempo]` | distinct pitches `d[0…n−1]` then `d[n−2…0]` |
| `pentatonic` / `scale` | `sequence`, `TEMPO_BPM[tempo]` | from lowest root index `r`: `d[r…n−1]` then `d[n−2…r]` |

Region (`listenRegion`) = `positions.filter(p => p.emphasis === 'highlighted' && inLayer(p.degree,
layer, quality))`, then `dedupeUnisons` keeps the first (thicker-string) position of each pitch.

## 4. Chord strum positions — R-06

`chordPositions(occ, openPitches)` = `occ.notes` where `string ≤ 6` and not
(`occ.alteredString && string === 6`), mapped to `{ string, fret, pitch: openPitches[string−1] +
fret }`, sorted by pitch ascending (ties → higher string number). For `k` positions starting at
`t0`:

```
strum i (0…k−1): { positions: [c[i]], onsetMs: t0 + 250·i, durationMs: 1500 }
block:           { positions: c,      onsetMs: t0 + 250·(k−1) + 500, durationMs: 1500 }
```

## 5. Tempo preference (`src/lib/prefs/schema.ts`) — R-08

| Field | Type | Stored key | Default | Parse | Serialize |
|---|---|---|---|---|---|
| `tempo` | `Tempo` | `tempo` | `'medium'` | `v.fallback(v.picklist(TEMPOS), 'medium')` | only when `!== 'medium'`, after `rotateHint` |

`PREFS_VERSION` stays `1`. A record without `tempo`, or with an invalid value, parses to
`'medium'`; every other field is unaffected. `erase()` removes it with the rest of the record and
restores `'medium'`. New fixtures (added, never replacing): `tempo-fast.txt`
(`{"version":1,…,"tempo":"fast"}`) and `bad-tempo.txt` (`"tempo":"allegro"` → medium).

## 6. CAGED store additions (`src/lib/state/caged.svelte.ts`)

| Member | Kind | Behaviour |
|---|---|---|
| `tempo` | getter (`$state<Tempo>`, init `'medium'`) | session value; restored from prefs |
| `setTempo(t)` | method | invalid/equal → no-op; else `stopListen()`, set, `preferences.remember({ tempo: t })` |
| `restoreTempo(t)` | method | validate and set; no stop, no write |
| `listen()` | method | `buildCagedListen(...)`; `none` → no-op; `sequence` → `playback.sequence`; `timeline` → `playback.timeline`; records `listening = plan.source` |
| `listening` | getter | the `ListenSource` of the CAGED request while `playback.sequencePlaying`, else `null` (status text) |
| `carry(k: CagedCarry)` | method | `apply(withResolvedFocus(carryIntoCaged(view, k)))` |
| `showTriadLayer()` | method | Triad on (auto-focus nearest the nut if no focus), set = `defaultTriadSet` |
| `stopListen()` | private | `if (playback.sequencePlaying) playback.stop('view')` — called by `commitFocus`, `toggleLayer`, `selectTriadSet`, `setTempo` |
| `setLabelType(t)` | changed | no longer stops playback (spec: label type MUST NOT stop) |

`CagedDisplay` gains `listen: { enabled: boolean; reason: string | null; source: ListenSource | null }`.

Invariants:

- **P-1** (order): for every plan of kind `sequence` from a melodic layer, step pitches strictly rise
  to the maximum then strictly fall, the maximum appears once, and the first and last pitch are equal.
- **P-2** (region = drawing): for every key × quality × focused shape × generated compatible tuning ×
  fret count 12–24, `listenRegion(display.positions, layer, q)` (before dedupe) equals
  `layerNotes(focused, openPitches, rootPc, q, fretCount).filter(n => inLayer(n.degree, layer, q))`
  as `string:fret` sets.
- **P-3** (unisons): no two steps of a melodic plan share a pitch except the mirrored descent; each
  sounding position has the highest string number among positions of its pitch.
- **P-4** (scale bounds): every pitch of a pentatonic/scale plan ≥ the pitch of the region's lowest root.
- **P-5** (chord set): strum positions never include string 7, and never string 6 when altered.
- **P-6** (pitch source): every planned pitch = effective instrument's open pitch + fret.

## 7. Carry context (`src/lib/state/links.ts`) — R-11

```ts
export interface CagedCarry {
  readonly rootPc: PitchClass;
  readonly quality: CagedQuality;
  readonly spelling: SpellingOverride;
}
```

| Pair | Function | Result |
|---|---|---|
| Notes → CAGED | `carryFromNotes(n)` (existing) → `{ rootPc, quality: caged.quality, spelling: 'none' }` | only when exactly one note; same pc → no-op |
| CAGED → Notes | `carryFromCaged(c): CarryContext` | `{ kind: 'notes', selection: [root, third, fifth] }` |
| Triads → CAGED | `carryTriadsToCaged(t): CagedCarry` | major/minor: `{ t.rootPc, t.quality, t.spellingOverride }`; dim/aug: `{ t.rootPc, 'major', 'none' }` |
| CAGED → Triads | `cagedTriadCarry(c)` → existing `triads.carryTriad(pc, q, spelling)` | inversion/set/view/Compare kept (revalidated) |
| apply into CAGED | `carryIntoCaged(c, k): CagedViewState` | root + spelling + quality set; same object when all equal |

Never serialized; applied only from `linkTools` (nav activation) and the two shortcuts (ADR 0011).

## 8. Link shortcuts (`src/lib/state/links.svelte.ts`) — R-12

| Shortcut | Source | Availability | Effect |
|---|---|---|---|
| `openCagedFromNote(pc)` | Notes position card "CAGED in this key" | always | carry pc as key (Notes unchanged), one `goto('/caged')` |
| `openCagedFromTriads()` | Triads "View in CAGED" | `quality ∈ {major, minor}` else disabled + note | carry, `caged.showTriadLayer()`, one `goto('/caged')` |

Triads display gains `viewInCaged: { enabled: boolean }` (derived from quality).

## 9. State transitions (Listen)

```
idle ──Listen (enabled)──▶ playing(source)
playing ──natural end──▶ idle
playing ──Stop / hidden / navigate / instrument / view change (R-09)──▶ idle (sound + pulses end)
playing ──Listen again / any tap──▶ playing(new request)   (interrupt)
playing ──label type / connections──▶ playing (unchanged)
```
