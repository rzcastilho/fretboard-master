# Contract: Stored Preferences Format — `customTuning` extension (v1)

**Feature**: `011-custom-tuning` | Extends
[010 storage-format.md](../../010-remembered-preferences/contracts/storage-format.md) under
its "Extension rule for later slices". Keys, reader guarantees 1–5 and every existing field are
unchanged. `version` stays `1`.

## New field

| Field | JSON type | Constraint | Required on write |
|---|---|---|---|
| `customTuning` | array | exactly 6 elements; each an integer −7 ≤ x ≤ 4; order strings 6 → 1 (low → high); semitone offsets from standard E2 A2 D3 G3 B3 E4 | only when the confirmed tuning matches no preset |

Field order on write: `version`, `tuning`, `customTuning` (when present), `frets`, `muted`,
`volume`, `lastTool` (when present), `labels`.

## Writer rules

1. Unmatched custom tuning → `"tuning":"AF-1"` **and** `"customTuning":[…]`.
2. Preset (including a custom tuning that matches one — canonical form) → `"tuning":"AF-n"`,
   **no** `customTuning` key.
3. Erase removes the whole `fretboard-master:prefs` key (unchanged), so the custom tuning goes
   with it (FR-015).

## Reader rules (added to the 010 guarantees)

6. `customTuning` valid (rule above) → it **wins** over `tuning`. Its pitches are matched
   against the presets: a match loads as that preset (name and spelling of the preset), else as
   a custom tuning with sharps spelling.
7. `customTuning` present but invalid (not an array, length ≠ 6, any element non-number,
   non-integer, < −7 or > 4) → ignored; the tuning comes from `tuning` (with its own fallback to
   `AF-1`). Every other field is parsed exactly as without it. Never throws.
8. Records without `customTuning` (every record written before 011) load exactly as before
   (FR-017).
9. A record whose `customTuning` matches a preset is not canonical; the next write rewrites it as
   rule 2 (expected, not an error).

## Fixture records (added to `tests/unit/prefs/fixtures/`; existing ones untouched)

Expected column lists: tuning, frets, muted, volume, lastTool, notes label, triads label.
"custom […]" means the loaded tuning is `{ kind: 'custom', offsets: […] }`.

| Name | Raw value | Expected |
|---|---|---|
| `v1-custom` | `{"version":1,"tuning":"AF-1","customTuning":[-2,0,0,-1,0,0],"frets":24,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}` | custom [−2,0,0,−1,0,0] (D2 A2 D3 F♯3 B3 E4), 24, false, 80, null, name, interval |
| `v1-custom-drop-d` | `{"version":1,"tuning":"AF-1","customTuning":[-2,0,0,0,0,0],"frets":22}` | AF-4 (Drop D), 22, rest defaults |
| `custom-wrong-length` | `{"version":1,"tuning":"AF-3","customTuning":[0,0,0,0,0],"frets":20}` | AF-3, 20, rest defaults |
| `custom-out-of-range` | `{"version":1,"tuning":"AF-1","customTuning":[0,0,0,0,0,5],"muted":true}` | AF-1, 22, true, rest defaults |
| `custom-non-integer` | `{"version":1,"tuning":"AF-2","customTuning":[0,0,0.5,0,0,0]}` | AF-2, rest defaults |
| `custom-non-array` | `{"version":1,"tuning":"AF-1","customTuning":"-2,0,0,0,0,0","volume":0.5}` | AF-1, 22, false, 50, rest defaults |

Round-trip property (fast-check): for every valid `Offsets` `o`, serializing the preferences of
`tuningFromOffsets(o)` and parsing it back yields the same `Tuning`.
