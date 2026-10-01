# Data Model: Note Playback

**Feature**: `003-note-playback` | **Plan**: [plan.md](./plan.md) | Research: [research.md](./research.md)

All types are in-memory TypeScript. Nothing is persisted, sent over the network, or parsed from
untrusted input. Existing types reused unchanged: `Pitch` (`src/lib/theory/pitch.ts`, C4 = 60),
`Instrument`, `Position`, and `positionPitch` (`src/lib/instrument/instrument.ts`).
`FretboardProps` (`src/lib/fretboard/types.ts`) gains one optional `pulses` prop (§6).

## 1. Frequency (theory, pure)

| Field | Rule |
|---|---|
| `frequencyOf(p: Pitch): number` | `440 · 2^((p − 69)/12)` (12-TET, A4 = 440 Hz, R-03) |

Golden values: E2 (40) = 82.41 Hz, A1 (33) = 55.00, C3 (48) = 130.81, A4 (69) = 440.00,
E6 (88) = 1318.51.
Playable range guaranteed by synthesis: **A1 (33) … E6 (88)**. This range covers up to 7 strings,
24 frets, and any tuning whose lowest open string is ≥ A1 and whose string 1 + 24 frets is ≤ E6
(FR-005). A pitch outside the range is still rendered, but with clamped timbre parameters; the
accuracy guarantees apply only inside the range.

## 2. Playback request (input, `src/lib/audio/types.ts`)

```ts
type PlaybackRequest =
  | { kind: 'note'; position: Position }
  | { kind: 'chord'; positions: readonly Position[] }            // 1..7 positions
  | { kind: 'sequence'; steps: readonly (Position | readonly Position[])[]; bpm: number };
```

Validation (typed result, never throws, FR-018):

- Every position must satisfy `isValidPosition(instrument, p)`. Invalid positions are **dropped**
  from the request. A request left with no sounding position does nothing and returns `[]`.
- Inside one chord or one sequence step, duplicate positions are de-duplicated by `positionKey`.
- `bpm` is clamped to `[30, 300]`. A non-finite `bpm` becomes 30 (nearest bound of an undefined
  value is taken as the minimum; documented choice).
- Pitches are always `positionPitch(instrument, position)`, using the instrument passed with the
  call. A request never carries frequencies.

## 3. Time mark (output)

```ts
interface TimeMark { readonly position: Position; readonly onsetMs: number; readonly endMs: number }
```

| Request | onsetMs | endMs |
|---|---|---|
| `note` | 0 | 1500 |
| `chord` | 0 for all positions | 1500 |
| `sequence`, step i of k at tempo B (clamped) | `i · 60000/B` | `(i + 1) · 60000/B` (the next onset; the last step lasts one beat) |

Returned **synchronously**, in step order then input order. One mark per sounding position.
Time is relative to the request start.

## 4. Planned step (internal, pure `planRequest`)

```ts
interface PlannedStep { onsetMs: number; durationMs: number; pitches: readonly Pitch[]; positions: readonly Position[] }
interface Plan { steps: readonly PlannedStep[]; marks: readonly TimeMark[]; kind: PlaybackRequest['kind'] }
```

## 5. Sound state (`src/lib/state/playback.svelte.ts`, runes)

| Field | Type | Default | Rules |
|---|---|---|---|
| `availability` | `'idle' \| 'on' \| 'unavailable'` | `'idle'` | `idle` until the first unlock. `on` after a successful unlock. `unavailable` is terminal for the session (R-09) |
| `muted` | `boolean` | `false` | Independent of `volume`. Does not stop playback (FR-014) |
| `volume` | `number` 0–100, multiple of 5 | `80` | Input is clamped and snapped to step 5. Gain = `(volume/100)²` (R-07) |
| `sequencePlaying` | `boolean` | `false` | True from a sequence's start until its last `endMs`, `stop()`, or interruption. Drives Stop visibility (FR-012) |
| `pulses` | `readonly Pulse[]` | `[]` | See §6 |
| `noticeShown` | `boolean` | `false` | Set once, on the first failed unlock. Never reset during the session |
| `noticeVisible` | `boolean` | `false` | Becomes true together with `noticeShown`. Dismiss sets it to false |

Derived for the UI: `controlState = availability === 'unavailable' ? 'unavailable' : muted ?
'muted' : 'on'`. `idle` shows as `on`, because nothing has failed yet.

State resets on reload (module-level, nothing in storage). Persistence is out of scope
(003-your-instrument/002).

### Availability transitions

```text
idle ──(gesture: context created + resume() not rejected + synth loaded)──▶ on
idle ──(constructor throws / API missing / resume() rejects / synth rejects)──▶ unavailable  [+ notice once]
on   ──(resume() rejects later, device switch)──▶ on   (that request silent, pulse shown, EC-7.7)
unavailable ──(anything)──▶ unavailable                (no retry, no new notice)
```

### Synth loader states (engine-internal)

```text
not-started ──(host mounted, idle callback)──▶ loading ──resolve──▶ ready
                                              loading ──reject───▶ failed  → availability = unavailable on the next/pending gesture
tap while loading: pulse now; play only if ready ≤ 100 ms after the activation (injected clock), else drop the note (FR-017)
```

### Active request lifecycle (at most one)

```text
none ──play(req)──▶ active(id, sources, timers)
active ──play(req')──▶ [fade 10 ms + stop sources, clear pulses/timers] ──▶ active(id')
active ──stop() / hidden / pagehide / navigate / instrument change──▶ none (pulses cleared, sequencePlaying=false)
active ──last endMs reached──▶ none
```

## 6. Pulse and fretboard drawing (fretboard)

```ts
// src/lib/fretboard/types.ts — new type and one new optional prop
interface Pulse { readonly id: number; readonly position: Position; readonly durationMs: number }
interface FretboardProps { /* existing */ pulses?: readonly Pulse[] }

// internal drawing record produced by applyPulses (renderer-only, not part of DisplayModel)
interface DrawnMarker extends Marker { readonly pulse?: { readonly id: number; readonly durationMs: number } }
```

Rules (`applyPulses(markers, pulses): readonly DrawnMarker[]`, pure, `src/lib/fretboard/pulse.ts`,
R-12):

- A pulse at a position **with** a marker (first marker per position wins, as in 002): that
  marker keeps its `function` and `spelling`, and is drawn with `emphasis: 'highlighted'` and
  `pulse`.
- A pulse at a position **without** a marker: a transient drawn marker is appended,
  `{ string, fret, function: 'neutral', emphasis: 'highlighted', pulse }`.
- Invalid positions are ignored (same as the existing marker rule).
- Inputs are never mutated. An empty `pulses` returns the input markers unchanged.
- `pulse.id` increases monotonically per pulse, so re-sounding the same position re-keys the
  element and restarts the animation.
- Pulses affect **drawing only**. Cell accessible names, the text description, and its polite
  live region (002) keep using `model` without pulses, so pulses never spam screen-reader
  announcements or change a cell's announced function. The sounding note is still conveyed by a
  non-audio channel (the visual pulse) (FR-020).
- `DisplayModel` and `Marker` are **unchanged**. Tools keep passing their model, and the host
  passes `pulses={playback.pulses}` separately.

## 7. Synth (pure, `src/lib/audio/pluck.ts`)

```ts
interface Synth {
  renderVoice(pitch: Pitch, sampleRate: number, lengthSamples: number): Float32Array; // normalized, faded
  mixVoices(voices: readonly Float32Array[]): Float32Array; // 1/√n + static peak limiter ≤ 0.89
}
type SynthLoader = () => Promise<Synth>;
```

Invariants (tested offline at 44 100 and 48 000 Hz, A1–E6):

| Invariant | Threshold |
|---|---|
| Fundamental | within ±5 cents of `frequencyOf(pitch)` |
| A-weighted RMS, first 500 ms | within ±3 dB of the median across A1–E6 |
| f0 < 200 Hz: energy above 1.5·f0 / total energy, first 500 ms | ≥ 0.5 |
| Last 10 ms | linear fade to exactly 0 (≤ 20 ms) |
| `mixVoices` of any 1–7 voices | peak ≤ 0.89 (never clips at 100 % volume, gain ≤ 1) |
| Determinism | same `(pitch, sampleRate, length)` → identical samples |

## 8. Test-build log entry (only when `__FM_FAULT_INJECTION__`)

```ts
type AudioLogEntry =
  | { type: 'unlock'; state: AudioContextState }
  | { type: 'step'; requestId: number; kind: 'note' | 'chord' | 'sequence'; pitches: number[]; frequencies: number[]; when: number; contextTime: number; gain: number; scheduledAtMs: number }
  | { type: 'stop'; requestId: number; reason: 'interrupt' | 'stop' | 'hidden' | 'navigate' | 'instrument' }
  | { type: 'unavailable'; cause: 'context' | 'resume' | 'synth' };
```

`scheduledAtMs` is `performance.now()` read right after the step's last `source.start(when)` call. It lets the CI perf gate (`e2e/perf.spec.ts`) measure tap → sound scheduled against the activation event's `timeStamp` (constitution VI).
