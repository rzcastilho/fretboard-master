# Contract: Stored Preferences Format (v1)

**Feature**: `010-remembered-preferences` | Consumers: this app's future builds (format stability), 003-your-instrument, 004-caged, 006-sharing and later slices that extend the record.

## Keys

| Key | Owner | Lifetime |
|---|---|---|
| `fretboard-master:prefs` | `src/lib/prefs/storage.ts` | written on first change, rewritten on every change, removed by Erase or browser data clearing |
| `fretboard-master:probe` | `src/lib/prefs/storage.ts` | written, read and removed within the startup probe; never left behind |

Every key the app ever writes MUST start with `fretboard-master:`; Erase removes all of them
(FR-017). No cookies, `sessionStorage`, IndexedDB or network are used (FR-021).

## Record (JSON, UTF-8, single line)

| Field | JSON type | Constraint | Required on write |
|---|---|---|---|
| `version` | number | integer ≥ 1; this slice writes `1` | yes |
| `tuning` | string | `AF-1` … `AF-11` | yes |
| `frets` | number | integer 12–24 | yes |
| `muted` | boolean | – | yes |
| `volume` | number | 0 ≤ x ≤ 1, written as `control / 100` (multiples of 0.05) | yes |
| `lastTool` | string | `notes` \| `triads` | only when a tool was opened |
| `labels` | object | `{ notes: "name"\|"octave"\|"none", triads: "interval"\|"name" }` | yes |

Field order on write is the order above (stable serialization lets the session skip identical
writes).

## Reader guarantees (all versions, forever)

1. Absent, > 16 384 chars, non-JSON, or non-object → all defaults, no notice, no throw.
2. Each field validated on its own; invalid/missing → that field's default only.
3. Unknown fields ignored on read, not written back.
4. `version` missing, non-integer, or > 1 → read exactly like v1 (best effort, item by item);
   next write produces a v1 record.
5. Values are never rendered as HTML or executed.

## Extension rule for later slices

A later slice that adds a remembered item (custom tuning, string count, handedness, orientation,
tempo, notices, language, notation, accidentals, theme, CAGED tool/label):

- adds a new **optional** field with its own fallback; existing fields keep their names, types
  and defaults;
- bumps `version` only if an existing field's meaning changes, and then adds a reader for the
  older version — records written by v1 MUST keep loading (FR-004, Constitution IX);
- adds fixture records to `tests/unit/prefs/fixtures/` (fixtures are only added, never removed).

## Fixture records (seed for `tests/unit/prefs/fixtures/`)

| Name | Raw value | Expected `Preferences` |
|---|---|---|
| `v1-full` | `{"version":1,"tuning":"AF-3","frets":24,"muted":true,"volume":0.35,"lastTool":"triads","labels":{"notes":"octave","triads":"name"}}` | AF-3, 24, muted, 35, triads, octave, name |
| `bad-volume` | `{"version":1,"tuning":"AF-2","volume":3}` | AF-2, 22, false, 80, null, name, interval |
| `garbage` | `not json{` | defaults |
| `array` | `[1,2,3]` | defaults |
| `future` | `{"version":7,"tuning":"AF-5","handedness":"left","tempo":"slow"}` | AF-5, rest defaults |
| `wrong-types` | `{"tuning":null,"frets":"24","muted":"true","lastTool":"caged","labels":{"triads":"octave"}}` | defaults |
| `markup` | `{"tuning":"<img src=x onerror=alert(1)>"}` | defaults |
| `oversize` | 16 385 × `a` | defaults (not parsed) |
