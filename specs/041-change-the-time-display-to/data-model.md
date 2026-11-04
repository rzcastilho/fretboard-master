# Data Model: Digital Time Display and More Metronome Sounds (042)

## 1. ClickSound (`src/lib/audio/click.ts`)

```ts
export const CLICK_SOUNDS = ['click', 'wood', 'beep', 'rim', 'cowbell'] as const;
export type ClickSound = (typeof CLICK_SOUNDS)[number];
export const DEFAULT_CLICK_SOUND: ClickSound = 'click';
export function toClickSound(v: unknown): ClickSound; // unknown → 'click'
```

- Order is the display order of the select.
- Each sound × `ClickKind` (`accent` | `normal` | `sub`) yields one buffer.
- Invariants (unit-tested for every sound):
  - length = `round(CLICK_LENGTH_S[kind] × rate)` (≤ `CLICK_S`);
  - peak |x| = 0.9 / 0.55 / 0.25 for accent / normal / sub (so accent > normal > sub);
  - deterministic: two renders with the same arguments are identical;
  - `click` renders byte-identical to the pre-042 `renderClick(kind, rate)`;
  - first and last samples near 0 (no click-pop beyond the envelope).

## 2. Sound preference (`src/lib/prefs/schema.ts`)

`Preferences['metronome']` gains:

| Field | Type | Default | Stored as | Parse rule |
|---|---|---|---|---|
| `sound` | `ClickSound` | `'click'` | `metronome.sound`, last key, only when ≠ `'click'` | `isPlainObject(metronome)` then `v.fallback(v.picklist(CLICK_SOUNDS), 'click')`; anything else → `'click'`, other fields unaffected |

`DEFAULT_PREFERENCES.metronome.sound = 'click'`. `PREFS_VERSION` stays `1`. Privacy category:
`metronome` (unchanged).

## 3. Metronome store state (`src/lib/state/metronome.svelte.ts`)

- New `state.sound: ClickSound` (default `'click'`), global across `ratios` / `plain` / `speed`.
- Transitions:
  - `setSound(v)` (gesture): `toClickSound`-validated; ignores non-members (no write). Sets
    state, `preferences.remember({ metronome: { sound } })`, then:
    - phase `settings` → plays one accent preview (R-9);
    - phase `starting` / `running` / `paused` → `scheduler?.setSound(sound)`; no preview.
  - `restoreSound(v)` (from stored prefs or erase): sets state, no write, no sound.
  - `beginSegment` passes `sound: state.sound` in `SegmentStart`.
- Mode switch, reset, pause/resume never change `sound`.

## 4. Scheduler (`src/lib/audio/metronome.ts`)

- `SegmentStart.sound?: ClickSound` — absent/invalid → `'click'`.
- `ClickScheduler.setSound(sound: unknown): void` — invalid ignored; otherwise the next
  `schedule()` call uses it. Works whether or not the segment is live/anchored; no-op on grid.
- Buffer cache: `WeakMap<ClickSink, Map<ClickSound, Record<ClickKind, AudioBuffer>>>`.
- `AudioLogEntry` `click` gains `sound: ClickSound`; new entry
  `{ type: 'click-preview'; sound: ClickSound; when: number; contextTime: number }`.

## 5. Messages (`messages/{en,es,pt-BR}.json`)

Added: `metronome_sound_label`, `metronome_sound_click`, `metronome_sound_wood`,
`metronome_sound_beep`, `metronome_sound_rim`, `metronome_sound_cowbell`.

| Key | en | es | pt-BR |
|---|---|---|---|
| `metronome_sound_label` | Click sound | Sonido del clic | Som do clique |
| `metronome_sound_click` | Click | Clic | Clique |
| `metronome_sound_wood` | Wood block | Bloque de madera | Bloco de madeira |
| `metronome_sound_beep` | Beep | Pitido | Bipe |
| `metronome_sound_rim` | Rim | Aro | Aro |
| `metronome_sound_cowbell` | Cowbell | Cencerro | Cowbell |

Removed: `metronome_switch_on`, `metronome_switch_off`, `caged_switch_on`, `caged_switch_off`.

## 6. Font asset

| File | Content |
|---|---|
| `static/fonts/fm-timer-digits.woff2` | DSEG7 Classic Bold subset, U+0030–U+003A |
| `static/fonts/OFL-DSEG.txt` | SIL OFL 1.1 text with DSEG copyright line |

CSS family `'FM Timer Digits'`; token `--font-family-timer`.
