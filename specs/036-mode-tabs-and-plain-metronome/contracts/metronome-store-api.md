# Contract: Metronome store API deltas (036)

This contract extends 031 `contracts/metronome-store-api.md` and 035
`contracts/metronome-store-api.md`. It lists only what changes for
`src/lib/state/metronome.svelte.ts`; everything else stays as it is.

## Getters

| Getter | Type | Meaning |
|---|---|---|
| `mode` | `MetronomeMode` | **new**: the active tab; `'ratios'` with nothing remembered |
| `current` | `Readonly<PlainSettings>` | **new**: the active mode's `bpm`, `beats`, `countIn`, `initialCountIn` |
| `plain` | `Readonly<PlainSettings>` | **new**: the plain record, whichever mode is active |
| `settings` | `Readonly<MetronomeSettings>` | unchanged: the Ratios Training record |
| `sub` | `number \| null` | was `number`; `null` in plain mode (no `· SUB` part) |
| `dots` | `readonly DotState[]` | uses `current.beats` |

## Actions

| Action | Behaviour |
|---|---|
| `selectMode(v: unknown)` | **new**. If `v` is not a valid `MetronomeMode` or equals `mode`, nothing happens: no halt, no write. Otherwise, from any phase: halt the scheduler (`'leave'`), `generation++`, phase → `settings`, run position and sound notice cleared, `mode := v`, then `preferences.remember({ metronome: { ratios, plain, mode } })` |
| `setBpm`, `stepBpm`, `setBeats`, `stepBeats`, `setCountIn`, `setInitialCountIn`, `stepInitialCountIn` | settings phase only (as before); they edit the **active** mode's record |
| `setRepeatCountIn`, `stepRepeatCountIn`, `setRatio`, `setSubdivision`, `setLoop2` | as before in Ratios mode; no-ops in plain mode |
| `toggle()` | unchanged state machine. A plain-mode Start announces `metronome_announce_started_plain` / `_plain_count_in` and starts a segment from `plainRunPlan(plain)` |
| `reset()`, `screenChanged()` | unchanged. They keep `mode` and both records (FR-005) |
| `restore(m: { ratios; plain; mode })` | **replaces** `restoreSettings(s)`: halts any run and applies all three without writing. Called by `preferences.start()` and `preferences.erase()` |

Every write goes through one internal `commitMetronome()`. It skips the write when nothing
changed (shallow per-field equality per record, plus the mode). When something did change, it
writes the full `metronome` object, because `session.remember` replaces top-level keys.

## Test seam

`resetMetronomeForTests(deps?, settings?, plain?, mode?)` also resets `plain` (to
`DEFAULT_PLAIN_SETTINGS` merged with `plain`) and `mode` (default `'ratios'`).

## Guarantees (unit-tested in `tests/unit/metronome/store.test.ts`)

- S1: `selectMode('plain')` while `running`, `starting`, `paused` or during the count-in calls
  `halt` once. After it, `phase === 'settings'` and `position === null`, and a fake-clock
  advance yields no further `onBeat` / `onCountIn` effect.
- S2: `selectMode(mode)` with the active mode, or with `'speed'`, `null` or `3`, changes
  nothing and writes nothing, and a running session keeps running.
- S3: plain setters never change `settings`; Ratios setters never change `plain` (FR-005,
  SC-003). This is a property test over random sequences of setter calls.
- S4: a plain Start passes `clicksPerBeat: 1`, no `alternate`, and
  `initialCountIn = effectiveCountIn(plain)` to `ClickScheduler.start`, with
  `bpm`/`beats` taken from `plain`.
- S5: Ratios Training's start segment, announcements and `sub` are unchanged from 035
  (FR-016). The existing tests pass without edits apart from the renamed `restore`.
