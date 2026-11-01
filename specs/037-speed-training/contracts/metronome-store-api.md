# Contract: Metronome store API (037)

This is a delta against `specs/036-mode-tabs-and-plain-metronome/contracts/metronome-store-api.md`.
The module is `src/lib/state/metronome.svelte.ts`. It is still the only module that creates a
`ClickScheduler`.

## 1. Getters

| Getter | Change |
|---|---|
| `mode` | now `'plain' \| 'speed' \| 'ratios'` |
| `current` | narrowed to `Readonly<SharedSettings>` (`beats`, `countIn`, `initialCountIn`) of the active mode |
| `settings`, `plain` | unchanged |
| `speed` | **new**: `Readonly<SpeedSettings>` |
| `bpm` | **new**: the tempo the readout shows. Plain and Ratios give the record's `bpm`. Speed gives the tempo of the last slot that sounded (`position.ramp.bpm`), or `speed.startBpm` before the first click |
| `steps` | **new**: `speedSteps(speed).length` |
| `speedStatus` | **new**: `{ kind: 'step', step, steps, loop, loops } \| { kind: 'hold', steps } \| null`. Null outside Speed mode and during a count-in. Before the first click it is `{ step: 1, loop: 1 }` |
| `finished` | **new**: a counter, bumped once per Stop ending |
| `sub` | `null` in Speed mode |
| `countIn`, `dots`, `beat`, `position`, `phase`, `announcement` | unchanged contract; in Speed mode they read the speed record and the ramp position |

## 2. Actions

All setters work only in the settings phase while `mode === 'speed'`, unless noted. They are
no-ops otherwise. Each commit assigns the record and then calls `remember()`. An equal record
commits nothing and writes nothing.

| Action | Effect |
|---|---|
| `setStartBpm(v)` / `stepStartBpm(dir)` | `withStartBpm`: Target is lifted when Start passes it, and is untouched when Start is lowered |
| `setTargetBpm(v)` / `stepTargetBpm(dir)` | `withTargetBpm`: a value below Start commits Start. `stepTargetBpm(−1)` at Target = Start is a no-op |
| `setIncrement(v)` / `stepIncrement(dir)` | 1–20 |
| `setLoops(v)` / `stepLoops(dir)` | 1–16 |
| `setAtTarget(v)` | `'hold'` or `'stop'`; any other value is ignored |
| `setBeats`, `stepBeats`, `setCountIn`, `set/stepInitialCountIn`, `set/stepRepeatCountIn` | in Speed mode they edit `speed`. Repeat Count In is accepted (unlike in plain mode) |
| `setBpm`, `stepBpm`, `setRatio`, `setSubdivision`, `setLoop2` | no-ops in Speed mode |
| `toggle()` | In Speed mode, Start begins the run with `speedRunPlan(speed)`, slot 0, and announces `metronome_announce_started_speed(_count_in)`. Pause and Resume are as before (`startSlot = slot + 1`) |
| `reset()`, `selectMode(v)`, `screenChanged()` | unchanged. `selectMode` accepts `'speed'` |
| `restore(r)` | `r` gains `speed: SpeedSettings` |

## 3. Guarantees (tests in `tests/unit/metronome/store.test.ts`, fake clock, port and frames)

- **S6**: with Start 80, Target 120, Increment 5, 4 loops and 4 beats, Count In on (4 and 2),
  the run plays `4 + 144 + 16` clicks. The status line goes `COUNT IN 1/4 … 4/4`, then
  `STEP 1/9 · LOOP 1/4`, and so on until `STEP 9/9 · LOOP 4/4`. `bpm` reads 80 through step 1
  and its following count-in, then 85 from the first loop click of step 2 (SC-001, FR-006).
- **S7**: 80→102/5 gives `steps = 6`, and the `bpm` values seen at each step's first loop
  click are `[80, 85, 90, 95, 100, 102]` (SC-002).
- **S8**: Hold. After the last loop of step S, the next slot reports `speedStatus` as
  `{ kind: 'hold', steps: S }` and announces `Holding at {T} BPM` once. The clicks go on at
  60/T with no count-in. Pause, then Resume, continues in Hold at the next beat with no new
  count-in.
- **S9**: Stop. At `anchor + tailT0`, `phase` becomes `'settings'`, `finished` is bumped once,
  the announcement is `Finished at {T} BPM` and no click has an index ≥ `endSlot`. The speed
  record is unchanged.
- **S10**: step announcements fire exactly once per step s ≥ 2, at its first loop click. Loops
  and beats are never announced. Pause gives `metronome_announce_paused_step` during loops,
  `metronome_announce_paused_hold` in Hold, and the existing count-in strings during a
  count-in.
- **S11**: the Target and Start rules. `stepTargetBpm(−1)` and `setTargetBpm(start − 10)` keep
  Target = Start, `setStartBpm(target + 5)` raises Target, and `setStartBpm(start − 5)` leaves
  Target unchanged.
- **S12**: mode isolation. Edits in Speed mode never change `settings` or `plain`, and the
  other way round. `selectMode('speed')` during a Ratios run halts at once, with no further
  click.
- **S13**: Reset, Escape, a tab switch or a route change during a run, whether paused or not,
  stops with no further click and keeps the values. The next Start begins at slot 0, at step 1.
- **S14**: `remember()` sends `{ ratios, plain, speed, mode }` as one object (the 036 whole-key
  replace rule).
