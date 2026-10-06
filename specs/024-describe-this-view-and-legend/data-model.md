# Data Model: Describe This View, Legend, and Accessibility Audit

**Feature**: 024-describe-this-view-and-legend | **Date**: 2026-10-06

No persisted data. No share-link or preference fields change (Legend/description open state is
component-local, FR-012). All entities below are in-memory, derived per render.

---

## 1. DisplayModel (extended) — `src/lib/fretboard/types.ts`

Existing fields unchanged. Two optional additions:

| Field | Type | Set by | Meaning |
|---|---|---|---|
| `wideStretch` | `boolean?` | Triads model (isolated wide shape; full neck when any shown tag is wide) | View-level mark for the Legend's *wide stretch* entry. Drawing unaffected. |
| `legendGroups` | `readonly LegendGroup[]?` | CAGED model only | Group labels and kind membership for the Legend. Absent → flat list. |

Validation: `legendGroups` kinds must be members of `LegendKind`; unknown/empty groups are
dropped by `legendGroups()` (§4), never thrown.

## 2. View description (derived string)

`description = model.description ?? describeView(instrument, model)` — unchanged rule.

Structure (FR-003): `summary` + `" "` + entries joined by `"; "` (+ tool-composed tail).

| Part | Source | Rule |
|---|---|---|
| Summary | `model.summary` or tool-composed `model.description` | Triads isolated: `{chord}, {inversion}, strings {spokenList}: ` ; Notes/CAGED unchanged except CAGED note names |
| Entries | Position entries (§3) | Only highlighted/normal emphasis (generic rule); tool-composed content otherwise |
| Empty | `summary` alone, else `fretboard_description_empty` | Never `''` (FR-007) |

Invariants:
- Pure function of (instrument, model, locale, notation, accidental policy). Same input → same
  string (FR-006).
- Independent of focus, pulses, handedness and orientation (FR-004, FR-011).

## 3. Position entry

| Field | Type | Rule |
|---|---|---|
| `string` | `number` 1..stringCount | — |
| `fret` | `number` 0..fretCount | 0 → word "open" (`…_entry_open`) |
| `note` | spoken string | From `src/lib/notation` only (`spokenNote` / `spokenMarker`); accidentals in words |
| `function` | word or absent | root/third/fifth; degree name for scale degrees (CAGED `intervalName`); absent for Notes |

Ordering: `b.string - a.string || a.fret - b.fret` (FR-004). Duplicates by `positionKey`
removed, first wins.

## 4. Legend

### LegendKind (closed union) — `src/lib/fretboard/legend.ts`

`'root' | 'third' | 'fifth' | 'degree' | 'neutral' | 'selected' | 'octave' | 'arpeggio' |
'triadLayer' | 'extra' | 'connection' | 'comparison' | 'wideStretch' | 'alteredString'`

Order of the union is the display order.

### Detection (`legendKinds(model)`)

A marker *counts* iff `emphasis ∈ {highlighted, normal, dimmed}`. See research R-07 for the
per-kind predicate. View-level kinds: `comparison` also from `arrows.length > 0`;
`wideStretch` from `model.wideStretch`; `alteredString` from `stringMarks.length > 0`.

### LegendGroup

| Field | Type | Rule |
|---|---|---|
| `label` | `string` (localized) | e.g. "Chord", "Arpeggio", "Pentatonic", "Scale", "Triad" |
| `kinds` | `readonly LegendKind[]` | Filtered to in-use kinds; a kind keeps only its first group; empty groups dropped; in-use kinds in no group go to a trailing unlabeled group |

### LegendEntry (render record)

| Field | Type | Source |
|---|---|---|
| `kind` | `LegendKind` | — |
| `name` | `string` | `legend_<kind>_name` |
| `meaning` | `string` | `legend_<kind>_meaning` (shape + meaning in words) |
| `sample` | `MarkerSample` props | `{fn, layer?, extra?, emphasis?, tone?, variant?, ring?}`; text sample for `wideStretch`, `alteredString` |

State: recomputed whenever `model` changes (FR-014). Empty → `legend_empty`.

## 5. Announcer — `src/lib/fretboard/announce.ts`

| State | Meaning |
|---|---|
| `baseline: string \| undefined` | First text seen; never announced |
| `pending: string \| null` + timer handle | Latest text waiting for 500 ms of quiet |
| `announced: string` | Last text emitted |

Transitions:
- `update(t)` first call → `baseline = announced = t`.
- `update(t)` with `t !== lastSeen` → clear timer; `pending = t`; set timer (500 ms).
- `update(t)` with `t === lastSeen` → no-op (focus moves, pulses).
- timer fires → if `pending !== announced` then `emit(pending)`, `announced = pending`.
- `dispose()` → clear timer.

## 6. UI state — `ViewAids.svelte` (component-local)

| Field | Initial | Persisted |
|---|---|---|
| `descriptionOpen` | `false` | No |
| `legendOpen` | `false` | No |
| `liveText` | `''` | No |

## 7. Design tokens (new / changed) — `src/lib/styles/tokens.css`

| Token | Light | Dark | Contrast more |
|---|---|---|---|
| `--color-focus-ring-outer` (new) | `#1a1d21` | `#ffffff` | `CanvasText` |
| `--color-focus-ring-inner` (new) | `#ffffff` | `#101317` | `Canvas` |
| `--color-fifth` (changed, R-11 candidate) | `#188450` | `#94ecbc` | unchanged rule |

Validation: `tests/unit/a11y/palette-cvd.test.ts` (ΔE00 ≥ 10 for root/third/fifth pairs under
3 simulations × 2 themes; label contrast ≥ 4.5) and `tests/unit/a11y/focus-ring.test.ts`
(two-tone min contrast ≥ 3 against wood and every marker fill token, both themes).

## 8. Audit record — `docs/accessibility-audit.md`

| Column | Type |
|---|---|
| Success criterion | WCAG 2.2 id + name (A and AA) |
| Screens checked | routes/states |
| Method | axe / e2e spec path / manual |
| Result | `pass` \| `fixed` \| `deferred` |
| Fix reference | spec/commit/task id |
| Deferral reason + follow-up slice | required iff `deferred` |

Plus sections: colour-blindness results table (ΔE per pair/sim/theme before → after), focus
ring contrast table, sound → visible counterpart inventory.
