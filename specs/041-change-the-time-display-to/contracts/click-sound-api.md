# Contract: click sounds in `$lib/audio` (042)

Extends [031 click-engine-api](../../031-metronome-tool-and-click-engine/contracts/click-engine-api.md) §1–§2. Framework-free: no Svelte, `$app/*`, i18n, state, shell or prefs imports (lint rule).

## §1 `click.ts` (pure)

```ts
export const CLICK_SOUNDS: readonly ['click', 'wood', 'beep', 'rim', 'cowbell'];
export type ClickSound = (typeof CLICK_SOUNDS)[number];
export const DEFAULT_CLICK_SOUND: 'click';
export function toClickSound(v: unknown): ClickSound;
export function renderClick(kind: ClickKind, sampleRate: number, sound?: ClickSound): Float32Array;
```

- `sound` omitted or not a member → `'click'`.
- `renderClick(kind, rate, 'click')` equals the pre-042 output sample for sample.
- For every sound and kind: length `round(CLICK_LENGTH_S[kind] × rate)` (min 1); peak 0.9 /
  0.55 / 0.25; finite samples; deterministic (seeded `mulberry32`, no `Math.random`).
- Invalid `sampleRate` → 48 000 (unchanged behaviour).

## §2 Scheduler (`metronome.ts`)

```ts
interface SegmentStart { /* … 031–038 fields … */ readonly sound?: ClickSound }
interface ClickScheduler { /* … */ setSound(sound: unknown): void }
```

- `start` uses `segment.sound` (absent/invalid → `'click'`).
- `setSound(s)`: invalid → ignored. Valid → every click scheduled after the call uses `s`.
  Clicks already handed to `source.start` are not touched. Never changes `anchor`, `period`,
  `next`, `pending`, `live` or the beat reporting. Callable before anchoring and when not live
  (then it only sets the value for the next `start`).
- Log: each `click` entry carries `sound`.

## §3 Preview (`click-preview.ts`)

```ts
export function playClickPreview(sink: AudioSink, sound: ClickSound): boolean;
```

- Plays `renderClick('accent', rate, sound)` once at `port.currentTime` through
  `sink.destination` (volume → mute → output). Returns `false` and plays nothing when
  `port.state !== 'running'` or on any audio error; never throws.
- Logs `{ type: 'click-preview', sound, when, contextTime }` when it plays.
