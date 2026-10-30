# Data Model: Count In (033)

Phase 1 output for [plan.md](./plan.md). Delta against
`specs/032-subdivisions/data-model.md`. Nothing here is persisted (S FR-013; remembered
settings are slice 008-ratios-training/005).

## 1. Count-in settings (part of `MetronomeSettings`)

`src/lib/state/metronome-settings.ts`

| Field | Type | Range | Default | Rule |
|---|---|---|---|---|
| `bpm` | number | 30–300 | 85 | unchanged |
| `beats` | number | 1–16 | 4 | unchanged |
| `subdivision` | `Subdivision` | 1–8 | 3 | unchanged |
| `countIn` | boolean | — | `true` | NEW. Switch state |
| `initialCountIn` | number (integer) | 0–8 | 4 | NEW. `clampCount(v, 4)`: round, clamp, NaN → 4 |
| `repeatCountIn` | number (integer) | 0–8 | 2 | NEW. `clampCount(v, 2)`: round, clamp, NaN → 2. Stored only; no playback effect in 033 |

Derived:

- `effectiveCountIn(s) = s.countIn ? s.initialCountIn : 0` — the *k* of a run.
- `SettingField = 'bpm' | 'beats' | 'initialCountIn' | 'repeatCountIn'` — fields with a stepper;
  `atLimit` / `stepSetting` cover them (− disabled at 0, + at 8).

Validation: the switch takes a boolean only; numeric setters clamp, never throw (C IX style,
even though nothing is parsed from storage yet).

Lifecycle: changed only in the `settings` phase (FR-005). Turning `countIn` off keeps both
counts (FR-003). Reset keeps all fields; leaving the route restores `DEFAULT_SETTINGS`
(FR-012).

## 2. Count-in phase (run state in the store)

`src/lib/state/metronome.svelte.ts` (internal `$state`, exposed through getters)

| Field | Type | Meaning |
|---|---|---|
| `countInTotal` | number 0–8 | *k* for the current run, fixed at Start (`effectiveCountIn`) |
| `countInClick` | number 0…k | Last count-in click that sounded; 0 = none yet |
| `stage` | `'count-in' \| 'loop'` | Which part of the run is showing |
| `beat` | number | unchanged (0 until the first loop beat) |

State transitions (`phase` is the 031 `RunPhase`):

```text
settings ──Start──▶ starting
   stage = k > 0 ? 'count-in' : 'loop', countInClick = 0, beat = 0

starting|running + onCountIn(n) ─▶ running, countInClick = n            (stage stays 'count-in')
starting|running + onBeat(b)    ─▶ running, beat = b, stage = 'loop'

running ──Pause──▶ paused    freeze on halt('pause'):
   { kind:'count-in', click }  → countInClick = click
   { kind:'beat', beat }       → beat = beat, stage = 'loop'
   { kind:'none' }             → unchanged (COUNT IN –/k or BEAT –/N)

paused ──Resume──▶ starting
   stage 'count-in' → segment countIn { from: countInClick, total: countInTotal }, startBeat 1
   stage 'loop'     → no countIn, startBeat = beat % beats + 1 (031 rule)

any run phase ──Reset──▶ settings   run fields cleared, settings kept
route left (screenChanged) ─▶ settings   run fields cleared, DEFAULT_SETTINGS
```

Invariants: `stage === 'count-in'` implies `countInTotal > 0` and `beat === 0`; once
`stage === 'loop'` it never returns to `'count-in'` within a run (no new count-in on Resume,
FR-011).

## 3. Count-in click (engine)

`src/lib/audio/metronome.ts`. A segment carries `countIn?: { from, total }`; remaining
`r = total − from`. Grid index *c* (integer, from 0):

| | Count-in click (c < r) | Loop click (c ≥ r, j = c − r) |
|---|---|---|
| `when` | `anchor + c × T` | `anchor + r × T + j × T / n` |
| `slot` | `c − r` (−r … −1) | `floor(j / n)` |
| `beat` | 0 | 032 rule from `startBeat` |
| `countIn` | `from + c + 1` (1…total) | `null` |
| `kind` | `'accent'` | 032 rule (`accent` / `normal` / `sub`) |

T = 60 / BPM. Slots are strictly increasing across the boundary; the frame loop reports once per
slot (`onCountIn` for negative slots, `onBeat` otherwise). `r = 0` reproduces 032 exactly.

`HaltedAt` (return of `halt()`):

```text
{ kind: 'count-in', click: number }  // last audible count-in click, 1-based
{ kind: 'beat', beat: number }       // last audible loop beat
{ kind: 'none' }                     // nothing audible yet in this segment
```

## 4. Display model

`src/lib/state/metronome-view.ts` (pure)

`StatusParams` gains two variants:

| kind | Fields | Text (en) |
|---|---|---|
| `beat` | beat, beats, sub | `BEAT 2/4 · SUB 3` (unchanged) |
| `none` | beats, sub | `BEAT –/4 · SUB 3` (unchanged) |
| `count-in` | click, total | `COUNT IN 2/4` |
| `count-in-none` | total | `COUNT IN –/4` |

`countInDot(click): DotState` → `'upcoming'` when click = 0, else `'lit'`.

The store exposes `metronome.countIn: { click: number; total: number } | null` (non-null only
while `stage === 'count-in'` in a run phase); `metronome.dots` returns `[]` during the count-in.

## 5. Click log entry (test builds only)

`AudioLogEntry` `click` gains `countIn: number | null`. `index` is the combined grid index *c*;
`slot` may be negative for count-in clicks; `pressedAtMs` is set on *c* = 0 of every segment, as
before.
