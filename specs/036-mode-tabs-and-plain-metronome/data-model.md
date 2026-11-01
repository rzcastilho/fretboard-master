# Data Model: Mode Tabs and Plain Metronome (036)

Extends the 031–035 metronome model. Anything not listed here is unchanged.

## 1. Types (`src/lib/state/metronome-settings.ts`, pure)

```text
MetronomeMode = 'plain' | 'ratios'
METRONOME_MODES: readonly MetronomeMode[] = ['plain', 'ratios']   // tab order (FR-001)
DEFAULT_MODE: MetronomeMode = 'ratios'                             // FR-014

PlainSettings {
  bpm: integer 30..300            default 85
  beats: integer 1..16            default 4
  countIn: boolean                default true
  initialCountIn: integer 0..8    default 4
}
DEFAULT_PLAIN_SETTINGS: Readonly<PlainSettings> (frozen)

MetronomeSettings (Ratios Training, 031–035): unchanged; structurally ⊇ PlainSettings
```

Validation rules, which reuse the existing clamps, so the ranges are the same as in Ratios
Training (FR-007):

| Field | Typed entry | Step |
|---|---|---|
| `bpm` | `clampBpm`: rounded to 30–300; NaN → 30 | ±1, held at the limits |
| `beats` | `clampBeats`: rounded to 1–16; NaN → 1 | ±1, held at the limits |
| `countIn` | booleans only; other values are ignored | n/a |
| `initialCountIn` | `clampCount(v, 4)`: rounded to 0–8; NaN → 4 | ±1, held at the limits |

Pure helpers:

- `effectiveCountIn(s: Pick<PlainSettings,'countIn'|'initialCountIn'>)`: `initialCountIn`
  when `countIn` is on, else 0. The same rule serves both modes.
- `plainRunPlan(p: PlainSettings): PlanFields`, which gives
  `{ clicksPerBeat: 1, initialCountIn: effectiveCountIn(p) }`. It has no `alternate`, so
  there is a single loop and no count-in between loops (FR-006, FR-008).
- `atLimit` / `stepSetting`: generic over `S extends PlainSettings` for
  `'bpm' | 'beats' | 'initialCountIn'`; `repeatCountIn` stays Ratios-only.
- `toMode(v: unknown): MetronomeMode | null`: one of `METRONOME_MODES`, otherwise null. It
  never throws.

## 2. Store state (`src/lib/state/metronome.svelte.ts`)

```text
state {
  mode: MetronomeMode                 // new; default 'ratios'
  settings: MetronomeSettings         // Ratios Training record (unchanged name)
  plain: PlainSettings                // new
  phase, position, initialTotal, announcement, soundNotice, generation   // shared, unchanged
}
```

Derived values:

| Getter | Ratios mode | Plain mode |
|---|---|---|
| `mode` | `'ratios'` | `'plain'` |
| `current` | `settings` (as `PlainSettings`) | `plain` |
| `sub` | unchanged (clicks per beat of the loop) | `null` |
| `dots` | `beatDots(settings.beats, beat)` | `beatDots(plain.beats, beat)` |
| `countIn` | unchanged | same rule (initial count-in only) |

### State transitions

```text
                 toggle (Start)          first click
   settings ─────────────────▶ starting ───────────▶ running
      ▲  ▲                                            │  ▲
      │  │ reset (values kept)                 toggle │  │ toggle (Resume)
      │  └──────────────────── paused ◀───────────────┘  │
      │                          └───────────────────────┘
      │
      └── selectMode(other) from ANY phase: halt('leave'), generation++, position cleared,
          soundNotice cleared, mode := other, remember(metronome)   (FR-004)

   selectMode(active) or selectMode(invalid): no state change, no write.
   screenChanged(): halt, mode and both records kept (035 FR-002).
```

- In settings, the setters act on `current` (the active mode's record). Ratios-only setters
  do nothing while `mode === 'plain'`. Outside `settings`, every setter does nothing, as today.
- Start in plain mode: the announcement is `metronome_announce_started_plain(_count_in)`, and
  `beginSegment` passes `bpm`/`beats` from `plain` with `...plainRunPlan(plain)`.
- Pause in plain mode: the announcement is `metronome_announce_paused` (beat n of N), the
  count-in variants as today, never `_paused_loop`.

## 3. Stored record (`fretboard-master:prefs`, `version: 1`)

```text
metronome?: {
  ratios?: { …8 fields, unchanged from 035… }     // only when non-default
  plain?:  { bpm, beats, countIn, initialCountIn } // only when non-default; all four, this order
  mode?:   "plain"                                 // only when not "ratios"
}                                                  // omitted when all three are omitted
```

The `Preferences` field becomes
`metronome: { ratios: MetronomeSettings; plain: PlainSettings; mode: MetronomeMode }`.
`DEFAULT_PREFERENCES.metronome` is
`{ ratios: METRONOME_RATIOS_DEFAULTS, plain: METRONOME_PLAIN_DEFAULTS, mode: 'ratios' }`
(frozen).

### Writer rules (extending 035's W1–W4)

- W5: `metronome` keys are written in the order `ratios`, `plain`, `mode`.
- W6: `plain` is written, with all four fields in the order above, when any field differs from
  `METRONOME_PLAIN_DEFAULTS`; otherwise it is omitted.
- W7: `mode` is written only when it is `"plain"`.
- W8: `metronome` is omitted when `ratios`, `plain` and `mode` are all omitted, so a 035-era
  record round-trips byte-identically.

### Reader rules (extending 035's R1–R6)

- R7: `ratios`, `plain` and `mode` are parsed independently. A failure in one never changes
  the others.
- R8: a `plain` that is missing, `null`, an array or a non-object gives
  `METRONOME_PLAIN_DEFAULTS`.
- R9: each `plain` field falls back to its own default when invalid (out of range, fraction,
  numeric string, `null`, wrong type). Values are never clamped.
- R10: `mode` other than exactly `"plain"` or `"ratios"` gives `"ratios"`.
- R11: unknown keys inside `metronome` (for example `speed`) and inside `plain` are dropped.
- R12: `metronome` itself being non-object gives all three defaults (as in 035's R-rules).

### Write triggers

| Event | Write |
|---|---|
| A different tab is selected | `{ metronome: { ratios, plain, mode } }`, with the new mode |
| A plain value changes in settings (step, committed typed value, switch flip) | the same full object |
| A Ratios value changes (035) | the same full object (previously `{ ratios }` only) |
| An equal value, the active tab, or an invalid input | none (the store's equality check plus the session's serialized-string skip) |
| Erase preferences | removes the stored record; the store goes back to defaults with mode `ratios` |

## 4. Relationships

```text
Preferences.metronome ──restore()──▶ metronome store { mode, settings, plain }
metronome store ──remember({metronome})──▶ PrefsSession (whole-key replace)
metronome store ──plainRunPlan / runPlanFor──▶ ClickScheduler.start(SegmentStart)
ModeTabs (UI) ──onselect(mode)──▶ metronome.selectMode
MetronomePanel ──metronome.current / mode──▶ ValueRow, CountInSettings, StatusBox
```
