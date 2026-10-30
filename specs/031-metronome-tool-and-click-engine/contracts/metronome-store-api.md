# Contract: Metronome state (`src/lib/state/`)

Modules:
- `metronome-settings.ts`: pure. Settings maths ([data-model §1](../data-model.md)).
- `metronome-view.ts`: pure. `beatDots`, `statusParams` ([data-model §5](../data-model.md)).
- `metronome-keys.ts`: pure. `matchMetronomeKey` ([research R-11](../research.md)).
- `metronome.svelte.ts`: the runes store. It is the only module that creates a `ClickScheduler`.

## 1. Store

```ts
export type RunPhase = 'settings' | 'starting' | 'running' | 'paused';

export const metronome: {
  readonly phase: RunPhase;
  readonly settings: Readonly<MetronomeSettings>;   // { bpm, beats }
  readonly beat: number;                             // 0…beats, audible beat
  readonly dots: readonly DotState[];                // derived: beatDots(settings.beats, beat)
  readonly announcement: string;                     // polite live-region text (run-state changes only)
  readonly soundNotice: boolean;                     // "sound unavailable" one-liner visible

  setBpm(v: number): void;        // settings phase only; clamped 30–300, rounded
  stepBpm(dir: 1 | -1): void;
  setBeats(v: number): void;      // settings phase only; clamped 1–16, rounded
  stepBeats(dir: 1 | -1): void;

  /** Gesture handler. settings→start, running→pause, paused→resume, starting→ignored. */
  toggle(): void;
  /** Gesture handler. starting|running|paused → settings, values kept; no-op in settings. */
  reset(): void;
  dismissSoundNotice(): void;

  /** Route left (beforeNavigate, component teardown): halt, phase settings, DEFAULT_SETTINGS. */
  screenChanged(): void;
};

/** Test seam: inject scheduler deps (fake sink/clock/frames) and reset state. Vitest only. */
export function resetMetronomeForTests(deps?: Partial<SchedulerDeps>): void;
```

Guarantees:

| # | Guarantee | Spec |
|---|-----------|------|
| M1 | First open: `phase = 'settings'`, `settings = { bpm: 85, beats: 4 }` | US3-1 |
| M2 | `setBpm`/`setBeats`/`step*` outside `settings` do not change values | Edge case |
| M3 | `toggle()` from settings calls `playback.clickSink()` synchronously, in the same call stack (gesture) | FR-015 |
| M4 | `toggle()` ×10 within 1 s (fake clock) leaves at most one live segment and logs no duplicate `(run, index)` | FR-028 |
| M5 | Pause on audible beat 3 of 4 → `beat = 3`, frozen. Resume → next `onBeat` is 4, then 1 | SC-006 |
| M6 | `reset()` keeps `settings`, `phase = 'settings'`, `beat = 0`, and the scheduler has halted | US2-3 |
| M7 | `screenChanged()` restores `DEFAULT_SETTINGS` | FR-017 |
| M8 | `playback.stop('hidden')` and a `visibilitychange` to hidden leave `phase = 'running'` | FR-016, SC-004 |
| M9 | `announcement` changes exactly on Start, Pause, Resume and Reset, never on `onBeat` | FR-011 |
| M10 | When the sink is `null` or `running` resolves `false`, the run proceeds (`beat` steps) and `soundNotice = true` | FR-027 |
| M11 | `onSuspended` → `phase = 'paused'` at the last audible beat, with the paused announcement | FR-026 |
| M12 | Muting through `playback.setMuted(true)` mid-run leaves `phase = 'running'` | FR-018 |

## 2. Keys (`metronome-keys.ts`)

```ts
export type MetronomeKeyAction = 'toggle' | 'reset';
export function matchMetronomeKey(
  e: ShortcutEventLike & { readonly targetActivates?: boolean },
  ctx: { readonly phase: RunPhase; readonly disclosureOpen: boolean }
): MetronomeKeyAction | null;
```

| Input | Result |
|-------|--------|
| `' '` (Space), no guard hit, target does not activate natively | `'toggle'` |
| Space on `button`, `a`, `summary`, checkbox/radio/button-type input | `null` (native activation is the one toggle) |
| Space on `input[type=range]` | `'toggle'` |
| `'Escape'`, phase ≠ settings, no disclosure open | `'reset'` |
| `'Escape'` in settings, or with a disclosure open | `null` |
| Ctrl/Meta/Alt/AltGraph, `repeat`, `isComposing`, `defaultPrevented`, text input/textarea/select/contenteditable target | `null` |

These keys do not depend on the character-key shortcut switch (`shortcuts.enabled`).

## 3. Existing modules touched

| Module | Change |
|--------|--------|
| `state/shortcuts.svelte.ts` `runShortcut` | Returns `false` for every action when `screen === 'metronome'` (FR-023: P . , L N inert) |
| `routes/+layout.svelte` `beforeNavigate` | Also calls `metronome.screenChanged()` (FR-017) |
| `state/preferences.svelte.ts` `toolOpened` | Accepts `'metronome'` through `TOOL_IDS` (FR-022) |
| `shell/PlaybackHost.svelte` | **Unchanged**. The hidden rule calls `playback.stop('hidden')`, which by contract does not reach the metronome |
