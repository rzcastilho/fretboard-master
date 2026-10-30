# Phase 1 Data Model: Metronome Tool and Steady Click

**Feature**: 031-metronome-tool-and-click-engine · **Research**: [research.md](./research.md)

Every entity lives in memory. There is no persistence (FR-017, FR-019), apart from the existing
`lastTool` preference field, whose allowed set grows by one value (§7).

---

## 1. MetronomeSettings (`src/lib/state/metronome-settings.ts`, pure)

| Field   | Type     | Range    | Default | Step | Rule |
|---------|----------|----------|---------|------|------|
| `bpm`   | integer  | 30–300   | 85      | 1    | `clampBpm` from `src/lib/audio/schedule.ts` (shares `MIN_BPM`/`MAX_BPM`), then `Math.round`. NaN → 30 |
| `beats` | integer  | 1–16     | 4       | 1    | `clampBeats`: NaN → 1, clamp, round |

- `DEFAULT_SETTINGS = { bpm: 85, beats: 4 }` (frozen).
- `stepSetting(settings, field, dir: 1 | -1)` returns a clamped copy. At a limit it returns the
  same object, and the UI disables the − or + button there (FR-003).
- `atLimit(settings, field, dir)` tells the UI when to disable a button.
- Settings are editable **only** in phase `settings`. Setters are no-ops in every other phase
  (edge case "Changing BPM or # of Beats is only possible in the settings view").

## 2. RunPhase and the session state machine (`src/lib/state/metronome.svelte.ts`)

```text
             start()                running resolves / visual fallback
 settings ───────────▶ starting ─────────────────────────────────────▶ running
    ▲                     │ reset()                                    │  ▲
    │                     ▼                                    pause() │  │ resume()
    └──────────────── settings ◀─── reset() ─────────────────── paused ◀┘  │
    ▲                                                            │  ──────┘
    └────────────────────────── reset() ◀──── running ───────────┘
 leave()/screenChanged(): any phase → settings with DEFAULT_SETTINGS (FR-017)
 suspension not recoverable (R-07): running → paused (last sounded beat)
```

| Phase      | Settings editable | Click stream | View shown |
|------------|-------------------|--------------|------------|
| `settings` | yes               | none         | Settings view (rows + Start Training) |
| `starting` | no                | pending (waiting for `running`) | Running view, beat 0 (all dots upcoming) |
| `running`  | no                | exactly one segment | Running view, Pause |
| `paused`   | no                | none (all unsounded clicks cancelled) | Running view, Resume |

- `toggle()` (Space, or the main button): `settings → start()`, `running → pause()`,
  `paused → resume()`, `starting → ignored` (FR-028).
- `reset()` (Esc, or the Reset button): `starting | running | paused → settings`, and keeps
  `settings` values. It does nothing in `settings` (Esc there does nothing, FR-010).
- `generation: number` increments on every transition. Async continuations that captured an
  older generation are dropped (R-10).

## 3. RunPosition (store, reactive)

| Field         | Type        | Meaning |
|---------------|-------------|---------|
| `beat`        | 0…`beats`   | Beat of the latest click whose audible time has been reached. `0` = no click sounded yet in this run |
| `bpm`, `beats`| from §1     | Snapshot taken at Start. Constant until Reset |
| `audio`       | `'sound' \| 'visual'` | `visual` when the sink is unavailable (FR-027) |
| `notice`      | `boolean`   | The one-line "sound unavailable" notice is visible (dismissible) |
| `announcement`| `string`    | Text of the polite live region (§6). Changes only on run-state transitions |

Pause freezes `beat`. Resume continues at `(beat mod beats) + 1`. When `beat = 0` at Pause,
Resume starts at beat 1.

## 4. Segment and Click (`src/lib/audio/metronome.ts`, framework-free)

**Segment**: one uninterrupted stretch of clicks on one grid. A new segment starts on every Start
and every Resume.

| Field        | Type    | Rule |
|--------------|---------|------|
| `anchor`     | seconds (audio or visual clock) | `clock.now() + START_LEAD_S` (0.02) once the clock is running |
| `period`     | seconds | `60 / bpm` |
| `startBeat`  | 1…beats | 1 on Start, `(frozen mod beats) + 1` on Resume |
| `beats`      | 1…16    | |
| `next`       | integer ≥ 0 | Index of the next click not yet scheduled |

**Click** *k* of a segment, pure, computed by `clickAt(segment, k)`:

| Field    | Formula |
|----------|---------|
| `index`  | `k` |
| `when`   | `anchor + k × period` (never accumulated; FR-014) |
| `beat`   | `((startBeat − 1 + k) mod beats) + 1` |
| `accent` | `beat === 1` (FR-007, FR-020: with `beats = 1` every click is accented) |

**PendingClick** (scheduler queue): `Click & { source: ClickSourceHandle | null }`. `source` is
`null` in visual mode. Entries leave the queue once `when + CLICK_S < now`. Pause/Reset cancel
every entry with `when > now` (R-05).

**Skip-forward rule** (R-07): on a wake, when `clickAt(seg, next).when < now`, set
`next = ceil((now + START_LEAD_S − anchor) / period)`. Missed clicks are never scheduled.

**Position at time t**: `positionAt(seg, t)` returns the beat of
`k = floor((t − anchor) / period)` when `k ≥ 0` and `k < next`, otherwise the previous value.
The store reads it on each animation frame with `t = audioNow − outputLatency` (R-06).

## 5. BeatDot (display model, `src/lib/state/metronome-view.ts`, pure)

`beatDots(beats, beat): readonly DotState[]` with `DotState = 'lit' | 'played' | 'upcoming'`:

| Condition         | State      | Emphasis level (C VII) | Token |
|-------------------|------------|------------------------|-------|
| `i === beat`      | `lit`      | highlighted            | `--color-accent` fill |
| `i < beat`        | `played`   | dimmed                 | `--color-accent` at the dimmed opacity token |
| `i > beat` or `beat = 0` | `upcoming` | normal          | `--color-border` (grey) |

On the loop wrap (beat N → 1), every dot except dot 1 goes back to `upcoming` (FR-025).
With `beats = 1`, the single dot is `lit` on every click.

`statusText(beat, beats)` → message `metronome_status_beat({ beat, beats })`, for example
"BEAT 2/4". When `beat = 0` it shows `–/N` through `metronome_status_beat_none({ beats })`.

## 6. Announcements (polite live region)

| Transition            | Message key                     | Params |
|-----------------------|---------------------------------|--------|
| → running (Start)     | `metronome_announce_started`    | `{ bpm, beats }` |
| → paused              | `metronome_announce_paused`     | `{ beat, beats }` |
| paused → running      | `metronome_announce_resumed`    | — |
| → settings (Reset)    | `metronome_announce_reset`      | — |

The live region is never written per beat (FR-011).

## 7. Tool and screen identity (existing types, extended)

| Type / constant | File | Change |
|-----------------|------|--------|
| `FretboardToolId` | `src/lib/shell/tools.ts` | **new**: `'notes' \| 'triads' \| 'caged'` |
| `ToolId` | `src/lib/shell/tools.ts` | `FretboardToolId \| 'metronome'` |
| `TOOLS` | `src/lib/shell/tools.ts` | 4th entry `{ id: 'metronome', path: '/metronome', … }` |
| `ScreenId`, `SCREENS`, `screenTitle` | `src/lib/shell/screens.ts` | adds `metronome` / `/metronome` |
| `TOOL_IDS` (prefs) | `src/lib/prefs/schema.ts` | adds `'metronome'` (the `lastTool` picklist). Format version unchanged; unknown values still fall back to `null` |
| `LinkedTool`, `LinkTool`, share/link codec, `failure.ts` (Metronome records with `null` → `'shell'`), `ToolLayout`, `ShareButton`, `TuningBadge`, `instrument.overrideNoticeFor` | various | narrowed to `FretboardToolId` (no behaviour change) |
| `EVENT_TOOLS` (measure wire) | `src/lib/measure/wire.ts` | **unchanged** (R-12) |
| `BarIconName` | `src/lib/shell/BarIcon.svelte` | adds `'metronome'` |

## 8. Audio log entries (test builds only, `src/lib/audio/types.ts`)

Two new entries are added to `AudioLogEntry`. App code never reads them.

```text
{ type: 'click', run, index, beat, accent, when, contextTime, pressedAtMs, scheduledAtMs }
{ type: 'click-cancel', run, count, reason: 'pause' | 'reset' | 'leave' | 'suspend' }
```

`run` is the store `generation` at segment start. `pressedAtMs` is set on the first click of a
segment (the Start or Resume press, `performance.now()`) and is `null` otherwise. `scheduledAtMs` is
`performance.now()` when the source is started, like the existing `step` entry; `e2e/perf.spec.ts`
uses it for the tap-to-sound budget.
