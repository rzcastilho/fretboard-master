# Data Model: Timer Linked to Metronome (041)

## 1. Timer link setting (remembered)

| Field | Type | Default | Where | Notes |
|---|---|---|---|---|
| `metronome.timerLink` | boolean | `false` | `Preferences['metronome']` in `src/lib/prefs/schema.ts`; runtime copy `timerLink.enabled` in `src/lib/state/timer-link.svelte.ts` | One value for all three mode tabs |

Validation (Constitution IX): `v.fallback(v.boolean(), false)`; a non-object `metronome` entry, a
missing key, or any non-boolean (`"true"`, `1`, `null`) reads as `false`. Other `metronome` fields
are parsed independently and are unaffected.

Serialization: inside the `metronome` entry, after `timer`, only when `true`
(`…,"timer":5,"timerLink":true}`). When every `metronome` field is default the entry is omitted, as
today. `PREFS_VERSION` stays `1` (additive field, research R-06).

Lifecycle: read once by `preferences.start()`; written on each toggle by
`preferences.remember({ metronome: { timerLink } })`; cleared by Erase preferences (key removed,
runtime value `false`).

## 2. Linked-run flags (session only, never stored)

Kept in the timer store (`src/lib/state/timer.svelte.ts`) beside its 039 state, not reactive to the
UI:

| Flag | Set by | Cleared by | Meaning |
|---|---|---|---|
| `armed` | `timer.arm()` (link, on metronome start with switch on) | `startArmed()`, `disarm()`, the timer's own `toggle()`, `selectPreset()`, `restore()` | A countdown will start on the first post-count-in beat |
| `held` | `timer.hold()` when the timer was `running` | `release()`, the timer's own `toggle()`, `selectPreset()`, `restore()` | The metronome paused this countdown and may resume it |

Invariants:
- `armed` ⇒ `status === 'stopped'` and the reading is the full selected duration (FR-004).
- `held` ⇒ `status === 'paused'`.
- `armed` and `held` are never both true.

## 3. State transitions (switch on)

Metronome phases: `settings`, `starting`, `running`, `paused`. Timer statuses: `stopped`, `running`,
`paused`, `finished`.

| Event (reported by metronome / timer) | Precondition | Timer effect | Metronome effect |
|---|---|---|---|
| `started` (settings → starting) | switch on | `arm()`: stopped at full duration, `armed` | — |
| `clicked('beat')` | `armed` | `startArmed()`: running from full duration | — |
| `clicked(any)` | `held` | `release()`: running from paused reading | — |
| `paused` (pause or audio suspend) | timer `running` | `hold()`: paused, `held` | — |
| `paused` | timer not running (incl. count-in) | none (`armed` kept) | — |
| `stopped` (Reset, Escape, tab switch, leave page, restore/erase, Speed Training end) | — | `restore(preset)`: stopped at full duration, flags cleared | — |
| timer `finished` | metronome not `settings` | flash + chime as 039 | `stopForTimer()`: halt to `settings`, values kept, no announcement, no `stopped` report |
| user timer play / preset | `armed` or `held` | 039 behaviour; flags cleared | none |
| switch on → off | `armed` | `disarm()` | none |
| switch off → on | — | none | none |

With the switch off, every row is a no-op and 039 behaviour applies (FR-002).
