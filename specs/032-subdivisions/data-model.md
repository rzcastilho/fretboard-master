# Data Model: Subdivisions (032)

Extends the 031 model (`specs/031-metronome-tool-and-click-engine/data-model.md`). Only what
changes is listed. Nothing is persisted in this slice.

## 1. Subdivision (`src/lib/state/metronome-settings.ts`)

| Field / item | Type | Rule |
|---|---|---|
| `Subdivision` | `1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7 \| 8` | Clicks per beat. The stable identifier (slice 005 will store it). |
| `SUBDIVISIONS` | `readonly Subdivision[]` | `[1, 2, 3, 4, 5, 6, 7, 8]`, the dropdown order. |
| `DEFAULT_SUBDIVISION` | `Subdivision` | `3` (8th Triplets). |
| `toSubdivision(v: unknown)` | `Subdivision \| null` | The integer when `v` (number, or numeric string from `<select>.value`) is one of the eight; otherwise `null`. Never throws. |

Display names (not part of the identifier), from `subdivisionName(n)` in
`src/lib/state/metronome-subdivision-names.ts`:

| n | en | pt-BR | es |
|---|---|---|---|
| 1 | Quarter notes | Semínimas | Negras |
| 2 | 8th notes | Colcheias | Corcheas |
| 3 | 8th Triplets | Tercinas de colcheia | Tresillos de corchea |
| 4 | 16th notes | Semicolcheias | Semicorcheas |
| 5 | Quintuplets | Quintinas | Quintillos |
| 6 | Sextuplets | Sextinas | Seisillos |
| 7 | Septuplets | Septinas | Septillos |
| 8 | 32nd notes | Fusas | Fusas |

Option label: `{name} ({n})`, e.g. "8th Triplets (3)".

## 2. Run settings (`MetronomeSettings`)

| Field | Type | Range / default | Changed by |
|---|---|---|---|
| `bpm` | number | 30–300, 85 (031) | unchanged |
| `beats` | number | 1–16, 4 (031) | unchanged |
| `subdivision` | `Subdivision` | 1–8, **3** | `metronome.setSubdivision(v)` in the `settings` phase only |

- `DEFAULT_SETTINGS = { bpm: 85, beats: 4, subdivision: 3 }` (frozen).
- `SettingField` narrows to `'bpm' | 'beats'` (steppers only).
- Fixed for the whole run: `start()` and `resume()` pass `settings.subdivision` to each segment.
- Reset keeps it (FR-012). `screenChanged()` restores `DEFAULT_SETTINGS` (reopen shows 8th Triplets).

## 3. Segment and grid (`src/lib/audio/metronome.ts`)

`SegmentStart` gains `clicksPerBeat: number` (1–8; the scheduler treats anything else as 1).

Internal `Grid` gains `perBeat: number`.

**Click** (`clickAt(seg, j)`, pure):

| Field | Value |
|---|---|
| `index` | `j` (integer ≥ 0 within the segment) |
| `when` | `anchor + (j × period) / perBeat`, `period = 60 / bpm` |
| `slot` | `floor(j / perBeat)`, the 0-based beat within the segment |
| `beat` | `((startBeat − 1 + slot) mod beats) + 1` |
| `kind` | `j mod perBeat ≠ 0` → `'sub'`; else `beat === 1` → `'accent'`; else `'normal'` |
| `accent` | `kind === 'accent'` (kept for 031 callers and the log) |

`skipTo(seg, now)` = `max(0, ceil((now + START_LEAD_S − anchor) × perBeat / period))`: the next
due grid click, beat or soft (FR-015).

### State transitions (unchanged phases, refined events)

| Event | Effect |
|---|---|
| frame, audible index `k` | `slot = floor(k / perBeat)`; if `slot > reportedSlot` → `onBeat(beat of slot)` |
| `halt(reason)` | stop every pending source with `when > now`; return the beat of the last audible slot (0 if none) |
| skip-forward after suspension | `next = skipTo(...)`; reporting resumes from the slot last reached |

## 4. Click sound (`src/lib/audio/click.ts`)

| `ClickKind` | Hz | Peak | Length |
|---|---|---|---|
| `accent` | 1600 | 0.9 | 30 ms (031) |
| `normal` | 1000 | 0.55 | 30 ms (031) |
| `sub` (new) | 2400 | 0.25 (≤ 0.275) | 18 ms (≤ 20 ms) |

`CLICK_LENGTH_S: Record<ClickKind, number>`; `CLICK_S` = longest (0.03).

## 5. Display model (`src/lib/state/metronome-view.ts`)

`StatusParams` gains `sub: number` on both variants:

- `{ kind: 'beat', beat, beats, sub }` → `BEAT {beat}/{beats} · SUB {sub}`
- `{ kind: 'none', beats, sub }` → `BEAT –/{beats} · SUB {sub}`

`beatDots` is unchanged (one dot per beat).

## 6. Test-build log entry (`src/lib/audio/types.ts`)

The `click` entry gains `kind: ClickKind` and `slot: number`. All other fields keep their 031
meaning; for soft clicks `beat` is the owning beat and `accent` is `false`.
