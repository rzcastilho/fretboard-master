# Data Model: Practice Timer

**Feature**: `039-practice-timer` | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

## §1 Timer preset (remembered)

| Field | Type | Rule |
|---|---|---|
| `preset` | integer | 1–10 minutes. The default is 2. It is the only timer value written to storage |

- **Constants** (`src/lib/state/timer-model.ts`):
  - `TIMER_PRESETS = [1, 2, …, 10]`
  - `DEFAULT_TIMER_MINUTES = 2`
  - `toPreset(v: unknown): number | null` returns an integer 1–10, or `null` for anything else.
- **Mirror** (`src/lib/prefs/schema.ts`): `METRONOME_TIMER_DEFAULT = 2` and
  `METRONOME_LIMITS.timer = [1, 10]`, with a parity unit test.

## §2 Countdown (session only, never stored)

| Field | Type | Meaning |
|---|---|---|
| `status` | `'stopped' \| 'running' \| 'paused' \| 'finished'` | Phase |
| `remainingMs` | number ≥ 0 | Valid when `stopped` or `paused` (the held reading). `preset × 60 000` when stopped |
| `endsAt` | number | Valid when `running`: `clock.now()` at play + `remainingMs` |
| `seconds` | integer ≥ 0 | Derived, reactive: `ceil(remainingMs / 1000)`, or `ceil((endsAt − now) / 1000)` at the last tick. `0` when finished |
| `flashing` | boolean | True from zero detection until `FLASH_MS` (5000) later, or until play or a preset |
| `announcement` | string | Last polite announcement (§5). `''` after any user action |
| `sink` | `AudioSink \| null` | Captured at the last play gesture. Not reactive |
| `displayTimer`, `endTimer`, `flashTimer` | timer ids \| null | Cleared on every transition. Not reactive |

**Derived**: `readout = formatReadout(seconds)`, which is `MM:SS` zero-padded. 600 → `10:00`,
119 → `01:59`, 0 → `00:00`.

### State transitions

| From | Event | To | Effects |
|---|---|---|---|
| `stopped` | play | `running` | Capture the sink. `endsAt = now + remainingMs`. Arm the display and end timers. `announcement = ''` |
| `running` | pause | `paused` | `remainingMs = max(0, endsAt − now)`. Clear the timers. `announcement = ''` |
| `paused` | play | `running` | As stopped → running, from the held `remainingMs` (FR-005) |
| `finished` | play | `running` | `remainingMs = preset × 60 000` first, then as stopped → running (FR-006). Clear `flashing` |
| `running` | display tick, `seconds` > 0 | `running` | Recompute `seconds`. If `1 ≤ seconds ≤ 10` and it changed, set the announcement (§5). Re-arm the display tick |
| `running` | tick or end timer, `endsAt − now ≤ 0` | `finished` | `seconds = 0`. Clear the timers. `flashing = true`, with `flashTimer` set to `FLASH_MS`. `announcement = "Timer finished"`. `lateMs = now − endsAt`: if `lateMs ≤ 2000` and the sink is non-null, call `playChime(sink, lateMs)` |
| `finished` | flash timer | `finished` | `flashing = false`. The static finished style remains |
| any | `selectPreset(n)`, n valid | `stopped` | `preset = n`. `remainingMs = n × 60 000`. Clear the timers, `flashing` and the announcement. Remember `{ metronome: { timer: n } }`, including when `n` equals the current preset (FR-004, FR-011) |
| any | `selectPreset(x)`, x invalid | unchanged | No-op |
| any | `restore(n)` | `stopped` | As `selectPreset` but **without writing**. An invalid `n` falls back to 2 |

Metronome toggle, reset, mode switch and route change are **not** events of this machine
(FR-009).

## §3 Stored record

The record is `fretboard-master:prefs`, `version: 1` (unchanged). The `metronome` entry gains
an optional last key:

```jsonc
"metronome": { /* ratios?, plain?, speed?, mode? as in 035–038 */ "timer": 5 }
```

- `timer` is written only when it is not 2. The `metronome` entry is omitted when every part,
  including `timer`, is the default.
- Parse: `v.fallback(intIn([1, 10]), 2)` when `metronome` is a plain object. Otherwise 2.
- `Preferences.metronome.timer: number`, with `DEFAULT_PREFERENCES.metronome.timer = 2`.
- `PreferencesPatch.metronome?: Partial<Preferences['metronome']>`, which the session merges
  one level deep (R-06).

See [contracts/preferences-record.md](contracts/preferences-record.md).

## §4 Chime (audio)

| Property | Value |
|---|---|
| Length | `CHIME_S = 0.8` s (≤ 1 s, FR-018) |
| Partials | 880 Hz (amp 1), 1320 Hz (amp 0.5) |
| Envelope | 5 ms linear attack, then exponential decay to 0.1 % at the end |
| Peak | 0.5 after normalisation |
| Route | `AudioBufferSource → sink.destination` (volume → mute → output) |
| Test log | `{ type: 'chime', when, contextTime, lateMs }` (test builds only) |

See [contracts/chime-api.md](contracts/chime-api.md).

## §5 Announcements and catalog

There are 9 new keys, each in `messages/en.json`, `messages/pt-BR.json` and `messages/es.json`.

| Key | en | pt-BR | es |
|---|---|---|---|
| `timer_heading` | Timer | Temporizador | Temporizador |
| `timer_presets_label` | Timer length | Duração do temporizador | Duración del temporizador |
| `timer_preset` (`{minutes}`) | {minutes}m | {minutes}m | {minutes}m |
| `timer_start` | Start timer | Iniciar temporizador | Iniciar temporizador |
| `timer_pause` | Pause timer | Pausar temporizador | Pausar temporizador |
| `timer_readout_label` | Time remaining | Tempo restante | Tiempo restante |
| `timer_announce_second` | 1 second | 1 segundo | 1 segundo |
| `timer_announce_seconds` (`{count}`) | {count} seconds | {count} segundos | {count} segundos |
| `timer_announce_finished` | Timer finished | Temporizador concluído | Temporizador terminado |

Announcement rule: when a tick changes `seconds` to `s` with `2 ≤ s ≤ 10`, use
`timer_announce_seconds({ count: s })`. For `s = 1`, use `timer_announce_second()`. At zero,
use `timer_announce_finished()`. Otherwise the announcement is unchanged.

## §6 Design tokens (new, `src/lib/styles/tokens.css`)

| Token | Light / dark | Use |
|---|---|---|
| `--color-accent-secondary` | `light-dark(#1d6b45, #3fd99a)` (tuned in implementation to pass the contrast and reserved-colour tests) | Selected-pill outline (the source's "green role") |
| `--timer-readout-size` | `3.5rem` | Readout digits |
| `--timer-play-size` | `3rem` (≥ `--target-min`) | Round play/pause button |
| `--timer-ghost-opacity` | `0.12` | Unlit `88:88` layer |
| `--timer-flash-dim` | `0.25` | Flash low state |
| `--timer-flash-period` | `1s`, set to `0s` under reduced motion | Flash cycle |

- `prefers-contrast: more` maps `--color-accent-secondary` to `--color-text`. Forced colours
  map it to `Highlight`.
- The token must stay distinguishable from `--fb-color-fifth` under the existing
  `reserved-colors.test.ts` ΔE check, because constitution VII reserves the fifth's green for
  markers.
