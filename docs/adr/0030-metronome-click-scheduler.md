# ADR 0030: Metronome click scheduler on the shared audio context

- **Status**: Accepted
- **Source**: spec 031-metronome-tool-and-click-engine (research R-01 to R-03, R-12, R-18)

## Context

The Metronome needs an endless click stream with at most 2 ms jitter, which keeps running when the
tab is hidden, and which obeys the app-wide mute and volume. The playback engine plans finite
requests, keeps at most one active, and halts it on `hidden`, `navigate` and note interrupts.
The fretboard tools share `ToolId`, but the Metronome has no link format, share button or tuning.

## Decision

- **Lookahead scheduler on the shared context.** `src/lib/audio/metronome.ts` exports
  `createClickScheduler(deps)`. A main-thread timer wakes every 25 ms and queues each click due
  within a 1.5 s horizon with `AudioBufferSourceNode.start(when)` on the engine's `AudioContext`.
  Click _n_ is at `anchor + n × 60 / bpm`, computed from the anchor, never accumulated. The click
  passes through the existing `volume → mute → destination` chain, so mute and volume need no new
  code, and no second context (Safari limits live contexts) needs its own unlock.
- **Hidden-page rule exception.** Clicks are not part of the engine's active request, so the
  engine's `halt()` never touches them. Note playback still stops when the page is hidden. The
  click keeps going, as FR-016 requires. The horizon covers browsers' roughly 1 s hidden-tab timer
  throttling.
- **Engine boundary kept.** Only `playback.svelte.ts` imports the engine and exposes
  `playback.clickSink()`. Only `metronome.svelte.ts` creates a scheduler. `src/lib/audio/**`
  imports nothing from Svelte, state, shell or prefs.
- **`ToolId` / `FretboardToolId` split.** `ToolId = FretboardToolId | 'metronome'` lists every
  tool (nav, home cards, `lastTool`). `FretboardToolId = 'notes' | 'triads' | 'caged'` is used by
  the layout, share, links, failure attribution and the link codec, so exhaustiveness checks prove
  that no fretboard path accepts `'metronome'`.

## Alternatives rejected

- `setInterval` plus play-now: tens of ms of jitter and drift.
- A `'click'` `PlaybackRequest`: finite, single, halted on `hidden`, which breaks FR-016.
- An AudioWorklet or a Worker timer: an extra module or CSP review for no gain at a 1.5 s horizon.
  The worklet stays the fallback if field reports show gaps.
- One long pre-rendered buffer: cannot change mute or volume per click, and Pause needs surgery.
- Reusing `ToolLayout` with guards: about ten guards, and Share and address-sync effects would run
  for a tool with no link.

## Consequences

- Click timing is independent of main-thread jitter, and the Metronome follows mute and volume.
- Up to about 8 sources are pending at 300 BPM. Pause stops each one exactly.
- Adding a tool without a fretboard means extending `ToolId` only, not `FretboardToolId`.

## Revision (032 subdivisions)

Source: spec 032-subdivisions (research R-11). This refines the scheduling decision above. It adds
no new architectural decision.

- **Integer click-index grid.** Click _j_ is at `anchor + j × (60 / BPM) / n`, where _n_ is the
  subdivision count. The time is computed from the anchor and the integer index, never
  accumulated, so the grid stays exact at any _n_.
- **Per-slot `onBeat`.** Beat reporting is tied to the slot: the click at `j mod n = 0` is the
  beat, and `onBeat` fires once per beat slot, not once per click.
- **Halt of soft sources.** Pause and a subdivision change stop every pending source, soft ticks
  included, so no stale tick sounds after the change.
- **Skip-forward.** After a stall or a change, the scheduler skips to the next due grid click
  rather than playing a burst of late clicks.
- **Third click kind.** A `sub` click joins the beat and accent clicks: 2400 Hz, gain 0.25, 18 ms.
  The beat click stays lower and louder than the ticks.
- **Consequence.** Up to about 60 sources can be pending at 300 BPM × 32nds within the 1.5 s
  horizon. Pause still stops each one exactly.
