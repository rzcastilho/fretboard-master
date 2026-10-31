# Data Model: Remembered Metronome Settings (035)

## 1. `MetronomeSettings` (existing, unchanged)

Source: `src/lib/state/metronome-settings.ts`. Restating it here because it becomes part of the
stored preferences.

| Field | Type | Range | Default | Stored as |
|---|---|---|---|---|
| `bpm` | integer | 30–300 | 85 | `bpm` |
| `beats` | integer | 1–16 | 4 | `beats` |
| `countIn` | boolean | — | `true` | `countIn` |
| `initialCountIn` | integer | 0–8 | 4 | `initialCountIn` |
| `repeatCountIn` | integer | 0–8 | 2 | `repeatCountIn` |
| `ratio` | boolean | — | `true` | `ratio` |
| `subdivision` (Loop 1) | `Subdivision` 1–8 | 1–8 | 3 (8th Triplets) | `loop1` |
| `loop2` | `Subdivision` 1–8 | 1–8 | 6 (Sextuplets) | `loop2` |

The stored record has one renamed field: in-memory `subdivision` is stored as `loop1`.

## 2. `Preferences` (extended)

`src/lib/prefs/schema.ts`:

```ts
interface Preferences {
  // … every existing field unchanged …
  /** 035; per mode. Absent or invalid in a stored record → defaults, field by field. */
  readonly metronome: { readonly ratios: MetronomeSettings };
}
```

- `DEFAULT_PREFERENCES.metronome = { ratios: METRONOME_RATIOS_DEFAULTS }`, frozen.
- `METRONOME_RATIOS_DEFAULTS` and `METRONOME_LIMITS` are declared in `schema.ts`
  (research R-02). A parity unit test checks them against `DEFAULT_SETTINGS` and the limits in
  `metronome-settings.ts` / `audio/schedule.ts`.
- `PRIVACY_CATEGORIES.metronome = ['metronome']`.
- `PreferencesPatch` needs no change: `Partial<Omit<Preferences,'labels'>>` already admits
  `{ metronome: { ratios } }`. A patch replaces the whole `metronome` object, which is correct
  because the store always sends the full settings.

## 3. Stored record (v1, unchanged version)

Key `fretboard-master:prefs`. When the settings differ from the defaults, the record ends with
this key:

```json
{ "version": 1, "tuning": "AF-1", "frets": 22, "muted": false, "volume": 0.8,
  "labels": { "notes": "name", "triads": "interval" },
  "metronome": { "ratios": { "bpm": 120, "beats": 2, "countIn": true, "initialCountIn": 4,
    "repeatCountIn": 2, "ratio": true, "loop1": 3, "loop2": 5 } } }
```

Writer rules:

- W1: omit `metronome` when all eight values equal the defaults.
- W2: otherwise write all eight, in the order `bpm, beats, countIn, initialCountIn,
  repeatCountIn, ratio, loop1, loop2`.
- W3: `metronome` is the last top-level key, after `shortcuts`.
- W4: never write other mode keys. Unknown keys read from storage are not kept.

Reader rules (each one is total and never throws):

- R1: if `metronome` is not a plain object (missing, `null`, an array, a primitive), all eight
  take their defaults.
- R2: if `metronome.ratios` is not a plain object, all eight take their defaults.
- R3: each field is validated on its own (integer and range, or boolean). On failure that field
  takes its default and the others are kept. Values are never clamped or rounded.
- R4: unknown keys in `metronome` or in `ratios` are ignored.
- R5: a whole record over 16,384 characters, or one that is not JSON, gives all preferences
  their defaults (existing behaviour).
- R6: reading `metronome` never changes any other field, and the other fields' readers ignore
  `metronome` (FR-009).

## 4. Metronome store state (runtime, extended behaviour)

`src/lib/state/metronome.svelte.ts`. The state shape is unchanged. Behaviour changes:

| Event | `phase` | `settings` | position / run | Write |
|---|---|---|---|---|
| App start (`preferences.start`) | `settings` | ← stored or defaults | cleared | none |
| Settings change (settings phase) | `settings` | ← new value | — | `remember` if the object changed |
| Start / Pause / Resume | per 031–034 | unchanged | per 031–034 | none |
| Reset | → `settings` | **kept** | cleared | none |
| Route left (`screenChanged`) | → `settings` | **kept** (was: defaults) | cleared, halted | none |
| Failure-view reset | → `settings` | kept | cleared | none |
| Erase (`preferences.erase`) | → `settings` | ← defaults | cleared, halted | none (the record is removed) |
| Reload during a run | `settings` (fresh module) | ← stored | none | none |

The running position (`position`, `initialTotal`, `generation`, scheduler) is never stored
(FR-004).

## 5. Relationships

- `preferences.svelte.ts` reads `Preferences.metronome.ratios` once, at start, and pushes it
  into `metronome.restoreSettings`. It also pushes the defaults on erase.
- `metronome.svelte.ts` sends the full settings back through `preferences.remember(...)` on
  every change.
- `src/lib/prefs/*` is still imported only by `preferences.svelte.ts` and by tests.
