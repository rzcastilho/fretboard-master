# Contract: Stored preferences, `metronome.plain.subdivision`

This contract extends `specs/037-speed-training/contracts/preferences-record.md`. The key is
`fretboard-master:prefs`, and `version: 1` is unchanged.

## Shape

```jsonc
{
  "version": 1,
  "metronome": {
    "plain": {
      "bpm": 100, "beats": 3, "countIn": true, "initialCountIn": 4,
      "subdivision": 3 // optional, integer 1–4; written only when ≠ 1
    },
    "mode": "plain"
  }
}
```

## Guarantees

| # | Guarantee |
|---|---|
| C19 | A record without `plain.subdivision` parses with `subdivision: 1`, and every other field is as in 037 |
| C20 | `subdivision` ∈ {1, 2, 3, 4} (integers) parses to that value |
| C21 | Any other `subdivision` (`"3"`, 2.5, 0, 5, -1, null, true, {}) parses to 1. The other plain fields, `ratios`, `speed` and `mode` keep their parsed values. Parsing never throws |
| C22 | Serialize writes `plain` only when it differs from `METRONOME_PLAIN_DEFAULTS`. Inside it, `subdivision` comes after `initialCountIn` and only when it is not 1. A plain record with subdivision 1 serializes byte-identically to 037 |
| C23 | A plain record that differs from the defaults only in `subdivision` is written (it counts as non-default) |
| C24 | `METRONOME_PLAIN_DEFAULTS` deep-equals `DEFAULT_PLAIN_SETTINGS`, including `subdivision: 1` (the existing parity test, extended) |
| C25 | Round trip: `parse(serialize(p))` deep-equals `p` for every valid `p` (the existing property, now with subdivision in 1–4) |
| C26 | Erase preferences restores `subdivision: 1` through `restore()` |

## Fixtures (added only)

| File | Content | Expected |
|---|---|---|
| `metronome-plain-subdivision.txt` | `plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 3 }, mode: "plain"` | plain as stored, `mode: 'plain'` |
| `metronome-plain-subdivision-invalid.txt` | `plain: { bpm: 100, beats: 3, countIn: false, initialCountIn: 2, subdivision: "3" }` | `subdivision: 1`, other fields kept |

The existing plain fixtures (`metronome-plain`, `metronome-plain-invalid`, `metronome-all-modes`
and any others with a `plain` entry) keep their files byte-for-byte. Only their expected value
in `fixtures/index.ts` gains `subdivision: 1`.
