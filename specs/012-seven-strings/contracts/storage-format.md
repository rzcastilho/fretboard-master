# Contract: Stored Preferences Format — `strings` extension (v1)

**Feature**: `012-seven-strings` | Extends
[010 storage-format.md](../../010-remembered-preferences/contracts/storage-format.md) under its
"Extension rule for later slices" and
[011 storage-format.md](../../011-custom-tuning/contracts/storage-format.md). Key
`fretboard-master:prefs`, `version` (stays `1`), reader guarantees 1–9 and every existing field
are unchanged.

## New field

| Field | JSON type | Constraint | Required on write |
|---|---|---|---|
| `strings` | number | exactly `6` or `7` | only when the confirmed string count is 7 |

Field order on write: `version`, `strings` (when present), `tuning`, `customTuning` (when
present), `frets`, `muted`, `volume`, `lastTool` (when present), `labels`.

## Changed constraints (only when `strings` is 7)

| Field | 6 strings (unchanged, 011) | 7 strings |
|---|---|---|
| `tuning` | AF-1 … AF-11 | AF-21, AF-22, AF-23, AF-3 … AF-11 (canonical: never AF-1/AF-2) |
| `customTuning` | 6 integers −7 … 4, strings 6 → 1, over E2 A2 D3 G3 B3 E4 | 7 integers −7 … 4, strings 7 → 1, over B1 E2 A2 D3 G3 B3 E4 |

## Writer rules

1. 6 strings → no `strings` key; output byte-identical to slice 011 (SC-006).
2. 7 strings, preset → `"strings":7,"tuning":"AF-n"` (n per the 7-string list), no
   `customTuning`.
3. 7 strings, unmatched custom → `"strings":7,"tuning":"AF-21","customTuning":[7 offsets]`.
4. Erase removes the whole key (unchanged).

## Reader rules (added; each field falls back on its own, never throws)

10. `strings` absent, not a number, or not exactly 6 or 7 (e.g. `8`, `6.5`, `"7"`) → 6.
11. `tuning` is normalized for the read count: with 7, AF-1 → AF-21 and AF-2 → AF-22; with 6,
    AF-21 / AF-22 / AF-23 → AF-1. Any other invalid id → the count's standard (AF-1 or AF-21).
12. `customTuning` is valid only when its length equals the read count (and rule 7 of 011
    holds element-wise); otherwise ignored and the tuning comes from `tuning` (rule 11).
13. A valid `customTuning` wins and is canonicalized against the count's presets (a match loads
    as that preset, e.g. `[-2,0,0,0,0,0,0]` → AF-23 Drop A).
14. Records without `strings` (every record written before 012) load exactly as before.

**Older bundle reading a 7-string record** (version skew): ignores `strings`, rejects `AF-21`
and a 7-long `customTuning` → 6-string standard, other fields kept. No error.

## Fixture records (added to `tests/unit/prefs/fixtures/`; existing ones untouched)

Expected columns: strings, tuning, frets, muted, volume, lastTool, notes label, triads label.

| Name | Raw value | Expected |
|---|---|---|
| `v1-seven-standard` | `{"version":1,"strings":7,"tuning":"AF-21","frets":24,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}` | 7, AF-21, 24, false, 80, null, name, interval |
| `v1-seven-drop-a` | `{"version":1,"strings":7,"tuning":"AF-23","frets":22}` | 7, AF-23, 22, rest defaults |
| `v1-seven-drop-d` | `{"version":1,"strings":7,"tuning":"AF-4","frets":22}` | 7, AF-4 (A1 D2 A2 D3 G3 B3 E4), 22, rest defaults |
| `v1-seven-custom` | `{"version":1,"strings":7,"tuning":"AF-21","customTuning":[-3,0,0,0,0,0,0],"frets":22}` | 7, custom [−3,0,0,0,0,0,0] (G♯1 E2 …), 22, rest defaults |
| `v1-seven-custom-drop-a` | `{"version":1,"strings":7,"tuning":"AF-21","customTuning":[-2,0,0,0,0,0,0]}` | 7, AF-23, rest defaults |
| `seven-af1` | `{"version":1,"strings":7,"tuning":"AF-1"}` | 7, AF-21, rest defaults |
| `seven-af2` | `{"version":1,"strings":7,"tuning":"AF-2","frets":20}` | 7, AF-22, 20, rest defaults |
| `six-af21` | `{"version":1,"strings":6,"tuning":"AF-21","frets":18}` | 6, AF-1, 18, rest defaults |
| `strings-absent-af23` | `{"version":1,"tuning":"AF-23"}` | 6, AF-1, rest defaults |
| `strings-invalid` | `{"version":1,"strings":8,"tuning":"AF-4","muted":true}` | 6, AF-4, 22, true, rest defaults |
| `strings-string` | `{"version":1,"strings":"7","tuning":"AF-21"}` | 6, AF-1, rest defaults |
| `seven-custom-six-long` | `{"version":1,"strings":7,"tuning":"AF-23","customTuning":[-2,0,0,0,0,0]}` | 7, AF-23 (custom ignored), rest defaults |
| `six-custom-seven-long` | `{"version":1,"tuning":"AF-3","customTuning":[0,0,0,0,0,0,0]}` | 6, AF-3 (custom ignored), rest defaults |

Every pre-012 fixture (`v1-full`, `v1-custom`, `v1-custom-drop-d`, `custom-*`, `future`, …)
keeps its expected value with `strings = 6` added to the expected column only.

Round-trip property (fast-check): for each count and every valid `Offsets` `o` of that length,
serializing the preferences of `{stringCount: count, tuning: tuningFromOffsets(o)}` and parsing
back yields the same count and `Tuning`; for count 6 the serialized string has no `strings` key.
