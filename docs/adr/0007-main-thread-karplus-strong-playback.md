# ADR 0007: Main-thread Karplus-Strong playback

- **Status**: Accepted
- **Source**: research R-01, R-07, R-10 (spec 003-note-playback)

## Context

Note playback must synthesize plucked-string sound with no recorded samples, start within the
100 ms tap-to-sound budget, never clip, and keep the guarantees of ADR 0002 (single bundle: zero
requests after load, safe across version skew). The constitution allows Karplus-Strong or an
`AudioWorklet`.

## Decision

- **R-01 Buffer render, not AudioWorklet.** An extended Karplus-Strong string model is a pure
  function, `renderPluck(pitch, sampleRate, lengthSamples): Float32Array` in
  `src/lib/audio/pluck.ts`. The engine renders on demand on the main thread, copies the samples
  into an `AudioBuffer`, and plays it through an `AudioBufferSourceNode`. A 1.5 s note is about
  72 000 iterations, well under the latency budget even for a 7-note chord.
  - Continuity: `audioWorklet.addModule(url)` is a separate network request. It would break the
    zero-requests-after-load guarantee (`e2e/continuity.spec.ts`).
  - Version skew: a worklet file fetched mid-session can mismatch the running bundle
    (`e2e/version-skew.spec.ts`).
  - CSP: a `blob:` worklet URL would need `script-src blob:`, relaxing the policy.
  - Testability: a pure function runs in Node and Vitest, so pitch (±5 cents), A-weighted level
    and harmonic energy are measured offline and deterministically.
- **R-07 Pure mix and static limiter.** A chord or sequence step is mixed in pure code
  (`mixVoices`): each voice gets `1/√n`, then a static peak limiter caps the buffer at 0.89
  (−1 dBFS). The graph is `source → voice gain → volume gain → mute gain → destination`, with a
  squared volume taper and a separate mute node. "A 7-note set never clips at 100 %" is provable
  offline. A `DynamicsCompressorNode` was rejected: it cannot run in jsdom and colours attacks.
- **R-10 Bundled synth behind the loader seam.** The synth ships inside the single bundle and is
  reached through an injectable `SynthLoader = () => Promise<Synth>`. Production resolves
  immediately. The loader starts on idle after the fretboard is interactive and does not create
  an `AudioContext`. Tests drive delayed and rejecting loaders to exercise the spec's
  loading/failed states.

## Consequences

- No new network request, chunk or CSP change. Initial JS grows by about 5–7 KB gzip, inside the
  80 KB budget.
- Long sustains cost main-thread time at request time instead of real-time CPU in a worklet. This
  is acceptable at the 1.5 s note length. Revisit if notes become much longer.
- DSP, mixing and limiting are covered by plain unit tests.

## Alternatives considered

- AudioWorklet Karplus-Strong: real-time and CPU-efficient, but needs an extra module request and
  is only testable in a browser.
- Recorded samples: ruled out by the constitution stack row, and about 0.5–2 MB on first load.
- `OscillatorNode` additive synthesis: no natural pluck attack or decay without many nodes per
  note.
- Dynamic `import()` of the synth: with the single-bundle strategy it is inlined, so no gain.
