# Contract: Preferences record and codec deltas (036)

This contract extends 035 `contracts/preferences-record.md` and lists only what changes.

## 1. Stored format (`fretboard-master:prefs`, `version: 1`, unchanged version)

```text
metronome?: {
  ratios?: { …unchanged 035 shape… },
  plain?: {
    bpm: integer 30..300,
    beats: integer 1..16,
    countIn: boolean,
    initialCountIn: integer 0..8
  },
  mode?: "plain"
}
```

The writer and reader rules are W5–W8 and R7–R12 in [data-model.md §3](../data-model.md).

Example (the acceptance case: plain 100 BPM / 3 beats, Ratios at 120 BPM, Metronome tab
selected):

```json
{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"metronome":{"ratios":{"bpm":120,"beats":4,"countIn":true,"initialCountIn":4,"repeatCountIn":2,"ratio":true,"loop1":3,"loop2":6},"plain":{"bpm":100,"beats":3,"countIn":true,"initialCountIn":4},"mode":"plain"}}
```

## 2. `src/lib/prefs/schema.ts` exports

| Export | Change |
|---|---|
| `Preferences.metronome` | becomes `{ ratios: MetronomeSettings; plain: PlainSettings; mode: MetronomeMode }` (type-only imports) |
| `METRONOME_PLAIN_DEFAULTS` | **new**: frozen, equal to `DEFAULT_PLAIN_SETTINGS` |
| `METRONOME_MODES` | **new**: `['plain', 'ratios'] as const`, mirrors the state constant |
| `DEFAULT_PREFERENCES.metronome` | `{ ratios: METRONOME_RATIOS_DEFAULTS, plain: METRONOME_PLAIN_DEFAULTS, mode: 'ratios' }` |
| `PRIVACY_CATEGORIES` | unchanged: `metronome` already maps to the "metronome settings" category |
| `parsePreferences` | adds `plain` and `mode` per R7–R12. Still total; never throws |
| `serializePreferences` | per W5–W8 |

## 3. Guarantees (unit tests in `tests/unit/prefs/schema.test.ts`)

- C1 (kept): `serializePreferences(DEFAULT_PREFERENCES)` is byte-identical to 035's output.
- C9: for every existing fixture in `tests/unit/prefs/fixtures/`, parsing and then serializing
  gives the same bytes as 035 did (the 035-era records are unaffected).
- C10: round-trip, `parsePreferences(serializePreferences(p))` deep-equals `p`. This is a
  fast-check property over the eight Ratios fields, the four plain fields and the mode.
- C11: any single invalid `plain` field resets only that field, and `ratios` and `mode` stay
  as stored. The same check runs the other way: an invalid `ratios` field leaves `plain` and
  `mode` untouched.
- C12: `plain` as `null`, an array, a string or `5` gives the plain defaults. `mode` as
  `"speed"`, `"PLAIN"`, `1`, `null` or `{}` gives `"ratios"`.
- C13: a record with only `{"metronome":{"mode":"ratios"}}` re-serializes with no `metronome`
  key.
- C14: parity, so `METRONOME_PLAIN_DEFAULTS` deep-equals `DEFAULT_PLAIN_SETTINGS`, and
  `METRONOME_MODES` equals the state module's `METRONOME_MODES`.
- C6 (kept): an unknown `speed` key is dropped on re-serialization.

New fixtures (added only, never removed): `metronome-plain.txt`, `metronome-mode-plain.txt`,
`metronome-bad-mode.txt`, `metronome-plain-invalid.txt`, `metronome-plain-array.txt`.

## 4. Session and privacy

- `src/lib/prefs/session.ts`: no change. Erase already returns `DEFAULT_PREFERENCES`.
- `about_privacy_stored`: no change (FR-013; "metronome settings" covers the mode and the plain
  values).
- Share links (`src/lib/link`): no change (FR-017).
