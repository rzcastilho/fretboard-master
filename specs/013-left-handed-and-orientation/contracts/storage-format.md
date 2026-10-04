# Contract: Stored Preferences Format — `handedness` / `orientation` extension (v1)

**Feature**: `013-left-handed-and-orientation` | Extends
[010 storage-format.md](../../010-remembered-preferences/contracts/storage-format.md) under its
"Extension rule for later slices", [011](../../011-custom-tuning/contracts/storage-format.md)
and [012](../../012-seven-strings/contracts/storage-format.md). Key `fretboard-master:prefs`,
`version` stays `1`; every existing field and reader rule 1–14 is unchanged.

## New fields

| Field | JSON type | Allowed values | Default | Written |
|---|---|---|---|---|
| `handedness` | string | `"right"`, `"left"` | `"right"` | only when `"left"` |
| `orientation` | string | `"highest-top"`, `"lowest-top"` | `"highest-top"` | only when `"lowest-top"` |

Field order on write: `version`, `strings`?, `tuning`, `customTuning`?, `frets`, `muted`,
`volume`, `lastTool`?, `labels`, `handedness`?, `orientation`?.

## Writer rules

15. Right-handed and highest on top → neither key; output byte-identical to slice 012.
16. Left-handed → `"handedness":"left"`; lowest on top → `"orientation":"lowest-top"`.
17. Written on Confirm together with the instrument fields (one write per confirm).
18. Erase removes the whole key (unchanged) → both defaults on next load.

## Reader rules (each field falls back on its own, never throws, no notice)

19. `handedness` absent or not exactly `"right"`/`"left"` (e.g. `"LEFT"`, `1`, `null`) → right.
20. `orientation` absent or not exactly `"highest-top"`/`"lowest-top"` → highest-top.
21. An invalid value in one of the two never discards the other or any other field.
22. Records without either key (every record written before 013) load exactly as before.

**Older bundle reading a 013 record** (version skew): unknown keys are ignored → right /
highest-top, all other fields kept. No error.

**Share links**: never carry either field (FR-013).

## Fixture records (added to `tests/unit/prefs/fixtures/`; existing ones untouched)

Expected columns: handedness, orientation, plus any other field that differs from defaults.

| Name | Raw value | Expected |
|---|---|---|
| `left-only` | `{"version":1,"handedness":"left"}` | left, highest-top, rest defaults |
| `lowest-only` | `{"version":1,"orientation":"lowest-top"}` | right, lowest-top, rest defaults |
| `bad-handed` | `{"version":1,"handedness":"LEFT","orientation":"lowest-top","tuning":"AF-2"}` | right, lowest-top, AF-2, rest defaults |
| `left-lowest-full` | `{"version":1,"strings":7,"tuning":"AF-21","frets":24,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"handedness":"left","orientation":"lowest-top"}` | left, lowest-top, 7, AF-21, 24 — canonical (re-serializes byte-identical) |
| `bad-orientation` | `{"version":1,"handedness":"left","orientation":"lowest","frets":18}` | left, highest-top, 18 |

Every pre-013 fixture keeps its expected value with `right, highest-top` added to the expected
columns. `future` (`{"version":7,…,"handedness":"left",…}`) keeps its expected result: all
defaults (version ≠ 1 handling unchanged), i.e. right-handed.

Round-trip property (fast-check): for every `Preferences` value (any handedness × orientation ×
existing arbitraries), `parsePreferences(serializePreferences(p))` equals `p`; when both are
default the serialized string contains neither key.
