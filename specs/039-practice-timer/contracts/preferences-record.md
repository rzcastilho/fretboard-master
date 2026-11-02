# Contract: Stored preferences, `metronome.timer`

This extends `specs/038-tap-tempo-and-metronome-subdivisions/contracts/preferences-record.md`.
The key is `fretboard-master:prefs`, and `version: 1` is unchanged. See
[research.md](../research.md) R-06 and R-07.

## Shape

```jsonc
{
  "version": 1,
  "metronome": {
    // ratios?, plain?, speed?, mode? exactly as in 035–038
    "timer": 5 // optional, integer 1–10; written only when ≠ 2; always the last key
  }
}
```

## Guarantees

| # | Guarantee |
|---|---|
| C27 | A record with no `metronome.timer`, including every 035–038 fixture, parses with `metronome.timer: 2`. Every other field is as before |
| C28 | `timer` ∈ {1, …, 10} (integers) parses to that value |
| C29 | Any other `timer` (`"5"`, 5.5, 0, 11, -1, null, true, `{}`) parses to 2. `ratios`, `plain`, `speed`, `mode` and every non-metronome field keep their parsed values. Parsing never throws |
| C30 | Serialize writes `timer` only when it is not 2, as the last key of the `metronome` entry. With `timer: 2` the output is byte-identical to 038 for every input. A record whose only non-default value is `timer` writes `"metronome":{"timer":n}` |
| C31 | Round trip: `parse(serialize(p))` deep-equals `p` for every valid `p` (the existing fast-check property, with `timer` drawn from 1–10) |
| C32 | `session.remember({ metronome: { timer: 5 } })` keeps the stored `ratios`, `plain`, `speed` and `mode`. `session.remember({ metronome: { ratios, plain, speed, mode } })` keeps the stored `timer` (one-level merge) |
| C33 | `METRONOME_TIMER_DEFAULT === DEFAULT_TIMER_MINUTES`, and `METRONOME_LIMITS.timer` equals `[min(TIMER_PRESETS), max(TIMER_PRESETS)]` (parity test) |
| C34 | `preferences.start()` applies `timer.restore(p.metronome.timer)`. `preferences.erase()` applies `timer.restore(2)` and removes the stored key (Erase preferences) |
| C35 | Share links are unchanged: no timer field is encoded or decoded (FR-016) |

## Fixtures (added only, in `tests/unit/prefs/fixtures/`)

| File | Content | Expected |
|---|---|---|
| `metronome-timer.txt` | `metronome: { timer: 5 }` | `metronome.timer: 5`, all else default |
| `metronome-timer-with-plain.txt` | `metronome: { plain: {…038 plain…}, mode: "plain", timer: 10 }` | plain and mode as stored, `timer: 10` |
| `metronome-timer-invalid.txt` | `metronome: { mode: "speed", timer: "7" }` | `timer: 2`, `mode: 'speed'` kept |
