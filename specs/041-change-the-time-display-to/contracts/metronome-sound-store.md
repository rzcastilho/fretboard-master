# Contract: metronome store sound API (042)

Extends the 031–041 metronome store (`src/lib/state/metronome.svelte.ts`).

```ts
metronome.sound: ClickSound            // reactive; drives the select's value
metronome.setSound(v: unknown): void   // gesture
metronome.restoreSound(v: unknown): void
```

| Call | Phase | Effect |
|---|---|---|
| `setSound('wood')` | `settings` | `sound = 'wood'`; remember `{ metronome: { sound: 'wood' } }`; `playClickPreview(playback.clickSink(), 'wood')` once (silent when muted, nothing when audio unavailable) |
| `setSound('wood')` | `starting` / `running` / `paused` | `sound = 'wood'`; remember; `scheduler.setSound('wood')`; **no** preview; phase, beat, tempo, `generation` unchanged |
| `setSound('x')` / `setSound(3)` | any | ignored: no state change, no write, no sound |
| `setSound(current)` | any | allowed (re-remember is idempotent); preview still plays in `settings` |
| `restoreSound(v)` | any | `sound = toClickSound(v)`; no write; no sound; applies to the live scheduler too |

- `selectMode` never changes `sound` (one global value for all three modes).
- `beginSegment` passes `sound: state.sound`.
- Preferences store: `apply(p)` calls `metronome.restoreSound(p.metronome.sound)`; erase calls
  `metronome.restoreSound('click')`.
- Tests inject the preview through the existing `overrides` seam (or a new
  `overrides.preview`) so Vitest never needs a real `AudioContext`.
