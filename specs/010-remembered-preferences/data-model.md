# Data Model: Remembered Preferences, No Account

**Feature**: `010-remembered-preferences` | **Date**: 2026-10-03 | **Plan**: [plan.md](./plan.md)

## 1. `Preferences` (in memory, `src/lib/prefs/schema.ts`)

The validated, app-facing shape. Always complete: every field has a value.

| Field | Type | Allowed | Default (FR-018) |
|---|---|---|---|
| `tuningId` | `TuningId` | one of the 11 preset ids `AF-1`…`AF-11` (`isTuningId`) | `'AF-1'` |
| `fretCount` | `number` | integer, 12 ≤ n ≤ 24 (no clamping) | `22` (`DEFAULT_FRETS`) |
| `muted` | `boolean` | `true` / `false` only | `false` |
| `volume` | `number` | control scale 0–100, multiple of 5 | `80` |
| `lastTool` | `ToolId \| null` | `'notes'`, `'triads'`, or `null` | `null` |
| `labels.notes` | `LabelType` | `'name'`, `'octave'`, `'none'` | `'name'` |
| `labels.triads` | `TriadsLabelType` | `'interval'`, `'name'` | `'interval'` |

`DEFAULT_PREFERENCES` is a frozen object with the defaults above.

**Not part of the model (FR-002)**: selected notes, root, key, quality, inversion, string set,
shape in focus, layers, region, comparison, Notes "hide names", triads view mode.

## 2. `PreferencesRecord` v1 (stored, `localStorage['fretboard-master:prefs']`)

Exact serialized JSON written by this slice (see [contracts/storage-format.md](./contracts/storage-format.md)):

```json
{
  "version": 1,
  "tuning": "AF-3",
  "frets": 24,
  "muted": true,
  "volume": 0.35,
  "lastTool": "triads",
  "labels": { "notes": "octave", "triads": "name" }
}
```

- `lastTool` is **omitted** when `null`.
- Keys written: exactly `version`, `tuning`, `frets`, `muted`, `volume`, `lastTool` (optional),
  `labels.notes`, `labels.triads`.

### Mapping record ↔ model

| Record | → Model (read) | Model → Record (write) |
|---|---|---|
| `tuning` | valid preset id else `'AF-1'` | `tuningId` |
| `frets` | integer 12–24 else `22` | `fretCount` |
| `muted` | boolean else `false` | `muted` |
| `volume` | finite in [0,1] → `round(x·20)·5`, else `80` | `volume / 100` |
| `lastTool` | `'notes'`/`'triads'` else `null` | omitted if `null` |
| `labels.notes` | picklist else `'name'` | `labels.notes` |
| `labels.triads` | picklist else `'interval'` | `labels.triads` |
| `version` | positive integer accepted, otherwise ignored; never affects field reading | always `1` |
| unknown keys | dropped | not written |

### Validation rules (FR-005 – FR-008)

1. Raw string `null` (absent) → `DEFAULT_PREFERENCES`.
2. Raw string length > 16 384 → `DEFAULT_PREFERENCES`, no parse.
3. `JSON.parse` throws → `DEFAULT_PREFERENCES`.
4. Parsed value not a plain object (array, `null`, number, string, boolean) → `DEFAULT_PREFERENCES`.
5. Otherwise each field independently: valid → kept; invalid, wrong type, or missing → default.
6. Parsing never throws and never shows a notice.

Examples (US2 scenario 6): `volume: 3` → 80; `frets: 99` → 22; `frets: 13.5` → 22;
`tuning: "AF-99"` → `AF-1`; `muted: "true"` → `false`; `lastTool: "caged"` / `"home"` → `null`;
`labels.triads: "octave"` → `'interval'`; a custom-tuning object in `tuning` → `AF-1` with
`frets` kept.

## 3. `PrefsSession` (`src/lib/prefs/session.ts`, plain TS, no runes)

| Field | Type | Meaning |
|---|---|---|
| `available` | `boolean` | probe result, fixed for the session |
| `current` | `Preferences` | last loaded or remembered values |
| `lastWritten` | `string \| null` | serialization last successfully handed to `setItem`, or the raw value read at start if it re-serializes identically; `null` after erase |

### State transitions

```text
          start(storage)
              │ probe ok? ──no──► available=false, current=DEFAULT, (notice requested)
              │ yes
              ▼
   current = parse(readRaw())          (no write)
              │
   remember(patch) ── merged == current & serialized == lastWritten ──► no-op
              │ otherwise
              ▼
   current = merged; if available: try setItem(serialize(current)) catch {/* fire-and-forget */}
              │
   erase() ─► if available: remove all keys with prefix "fretboard-master:" (guarded)
              current = DEFAULT, lastWritten = null   (no write)
```

A record from an unknown/newer version is replaced by v1 at the **first** `remember` that
produces a different serialization than what was read; since the stored raw text differs
from the v1 serialization, `lastWritten` starts as `null` for such records and the next change
writes v1 (FR-004).

## 4. `preferences` runes store (`src/lib/state/preferences.svelte.ts`)

| Reactive field | Type | Source |
|---|---|---|
| `lastTool` | `ToolId \| null` | `start` (stored value), `toolOpened`, `erase` (→ `null`) |
| `noticeVisible` | `boolean` | `true` only from `start` when unavailable; `false` on dismiss or screen change |

Methods: `start(storage?)`, `toolOpened(id)`, `dismissNotice()`, `screenChanged()`, `erase()`,
plus `remember…` helpers called by the other stores. Module flag `noticeShown` ensures the notice
appears at most once per session (FR-012).

## 5. Touched existing entities

| Entity | Change |
|---|---|
| `InstrumentConfig` (`instrument-config.ts`) | unchanged shape; `instrument.restore(config)` sets `active` and applies to Notes/Triads views without notice or write |
| Playback state (`playback.svelte.ts`) | `restore({ muted, volume })` – no unlock, no write; `setMuted`/`setVolume` now also `remember` |
| `PlaybackEngine` (`audio/engine.ts`) | new `restore(muted, volume)` – assigns, ramps only if a context exists |
| `NotesViewState` / `TriadsViewState` | unchanged shape; `restoreLabelType(t)` sets the label type without writing; `reset()` keeps the remembered label type (initial view = defaults + preferred label type) |
| `Tool` (`shell/tools.ts`) | unchanged; `ToolId` picklist in prefs is checked against `TOOLS` by a unit test |
