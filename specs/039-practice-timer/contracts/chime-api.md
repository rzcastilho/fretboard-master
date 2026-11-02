# Contract: Chime synthesis and playback

**Module**: `src/lib/audio/chime.ts`. It is framework-free: no Svelte, no app-state imports,
only `./types`, `./log` and the `AudioSink` type from `./engine`. See
[research.md](../research.md) R-04 and R-05, and [data-model.md](../data-model.md) §4.

```ts
export const CHIME_S = 0.8;
export function renderChime(sampleRate: number): Float32Array;
/** Starts the chime now on the sink's context. Never throws. */
export function playChime(sink: AudioSink, lateMs: number): boolean;
```

| # | Guarantee |
|---|---|
| A1 | `renderChime(48000).length === round(0.8 × 48000)`. A non-finite or non-positive rate falls back to 48 000 |
| A2 | The peak absolute sample is 0.5 (± 1e-6). The first sample is 0. The last 10 ms stay below 0.1 % of the peak × 2 |
| A3 | Spectrum: the dominant bins are at 880 Hz and 1320 Hz (a DFT spot check at those frequencies versus 1000 Hz and 2400 Hz, the click frequencies) |
| A4 | `playChime` creates one buffer and one `AudioBufferSourceNode` on `sink.port`, connects it to `sink.destination` (never to `port.destination` directly), and starts it at `port.currentTime` |
| A5 | When `sink.port.state !== 'running'`, `playChime` returns `false` and creates nothing |
| A6 | If any Web Audio call throws, `playChime` returns `false`. The error is swallowed with a comment explaining that audio failure must not affect the timer (FR-008) |
| A7 | In test builds (`__FM_FAULT_INJECTION__`), a successful call appends `{ type: 'chime', when, contextTime, lateMs }` to `__fmAudioLog`. `AudioLogEntry` gains that variant |
| A8 | `playChime` never touches the playback engine's active request or any `ClickScheduler`. Mute and volume apply only through `sink.destination` |
| A9 | The source disconnects itself on `ended` |
