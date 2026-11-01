# Contract: Preferences record and codec deltas (037)

This extends `specs/036-mode-tabs-and-plain-metronome/contracts/preferences-record.md` and lists
only what changes. The record stays at `version: 1`.

## 1. Stored format

The shape and the read and write rules are R13–R17 and W9–W12 in
[data-model.md §4](../data-model.md).

Example: Speed Training at 80→120/5 with Stop. The other modes are at their defaults, and the
Speed Training tab is selected.

```json
{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"metronome":{"speed":{"startBpm":80,"targetBpm":120,"increment":5,"loops":4,"beats":4,"countIn":true,"initialCountIn":4,"repeatCountIn":2,"atTarget":"stop"},"mode":"speed"}}
```

## 2. `src/lib/prefs/schema.ts` exports

| Export | Change |
|---|---|
| `Preferences.metronome` | gains `speed: SpeedSettings` (type-only import) |
| `METRONOME_SPEED_DEFAULTS` | **new**: frozen, equal to `DEFAULT_SPEED_SETTINGS` |
| `METRONOME_MODES` | `['plain', 'speed', 'ratios'] as const` |
| `METRONOME_LIMITS` | gains `increment: [1, 20]` and `loops: [1, 16]` |
| `DEFAULT_PREFERENCES.metronome` | gains `speed: METRONOME_SPEED_DEFAULTS` |
| `PRIVACY_CATEGORIES` | unchanged: `metronome` is still "metronome settings" |
| `parsePreferences` / `serializePreferences` | per R13–R17 and W9–W12. Still total; never throws |

## 3. Guarantees (`tests/unit/prefs/schema.test.ts`)

- **C1 (kept)**: `serializePreferences(DEFAULT_PREFERENCES)` is byte-identical to 036's output.
- **C9 (kept, one exception)**: every existing fixture file round-trips to the same bytes as in
  036. This includes `metronome-other-mode.txt`, whose `{"bpm":100}` speed object holds only an
  unknown key, gives speed defaults and is therefore omitted. The one exception is
  `metronome-bad-mode.txt`: its `"mode":"speed"` is now valid, so it re-serializes with
  `"mode":"speed"` kept, where 036 dropped it (R-12).
- **C10 (extended)**: the fast-check round trip now also covers the nine speed fields (with
  `targetBpm ≥ startBpm`) and all three modes.
- **C11 (extended)**: any single invalid `speed` field resets only that field. `ratios`,
  `plain` and `mode` stay as stored, and the reverse also holds.
- **C12 (restated)**: `mode: "speed"` now reads as `'speed'`. `"SPEED"`, `"PLAIN"`, `1`, `null`
  and `{}` read as `'ratios'`. `speed` as `null`, an array, `"x"` or `5` gives the speed
  defaults.
- **C15**: `{"startBpm":200,"targetBpm":150}` reads as Target 200 (R15). A `targetBpm` that is
  missing while `startBpm` is 290 reads as Target 290. The default 125 is lifted.
- **C16**: `atTarget` of `"HOLD"`, `true` or `1` gives `'hold'`. Numeric strings such as
  `"90"` for an integer field give that field's default.
- **C17**: key order. A record with all three modes non-default and `mode: "speed"` serializes
  `metronome` keys as `ratios, plain, speed, mode`, and `speed`'s nine keys in the data-model
  order.
- **C18**: parity. `METRONOME_SPEED_DEFAULTS` deep-equals `DEFAULT_SPEED_SETTINGS`, and
  `METRONOME_MODES` equals the state constant.
- **C6 (restated)**: unknown keys *inside* `speed` (for example `"bpm":100`) are dropped on
  re-serialization.

**Fixtures.** These are added only, never removed:
- `metronome-speed.txt`: the example above;
- `metronome-mode-speed.txt`: mode only;
- `metronome-speed-invalid.txt`: a few bad fields;
- `metronome-speed-target-below.txt`;
- `metronome-speed-array.txt`;
- `metronome-all-modes.txt`.

The existing `metronome-bad-mode.txt` and `metronome-other-mode.txt` files are unchanged. Their
expected parse in `fixtures/index.ts` changes as R-12 explains: mode `'speed'`, and speed
defaults.
