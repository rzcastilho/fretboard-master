# Contract: Metronome store additions (`src/lib/state/metronome.svelte.ts`)

This contract extends `specs/037-speed-training/contracts/metronome-store-api.md`.

```ts
export const metronome: {
  // …existing…
  /** 038: plain mode, any phase. Uses the injectable clock. */
  tapTempo(): void;
  /** 038: settings phase, plain mode; ignores anything that is not 1–4. */
  setPlainSubdivision(v: unknown): void;
  /** Plain mode now returns subdivision > 1 ? subdivision : null. */
  readonly sub: number | null;
};
```

`resetMetronomeForTests(deps, settings, plain, mode, speed)` is unchanged. Its `plain` partial
can now carry `subdivision`, and the call also clears the tap run.

## Guarantees

| # | Guarantee |
|---|---|
| S15 | `tapTempo()` outside plain mode does nothing: no state change, no write, no announcement (FR-013) |
| S16 | In plain mode, a tap that yields `bpm === null`, or a bpm equal to `plain.bpm`, changes nothing and announces nothing |
| S17 | A tap that yields a new bpm in the `settings` phase commits `plain.bpm` (one `preferences.remember` call) and sets `announcement = "{bpm} BPM"` (FR-011, FR-015) |
| S18 | The same tap in `starting` or `running` also calls the scheduler's `retime(bpm)` once. The phase, `position` and `generation` are unchanged, so nothing restarts (FR-007) |
| S19 | The same tap in `paused` commits only. The next `toggle()` resumes at `position.slot + 1` with the new bpm (FR-007) |
| S20 | `reset()`, `selectMode()`, `screenChanged()` and `restore()` clear the tap run. After any of them, three taps change nothing. `toggle()` does not clear it |
| S21 | `setPlainSubdivision(v)` commits `plain.subdivision` for v ∈ {1, 2, 3, 4} (number or numeric string) in the settings phase and plain mode. Anything else, any other phase or any other mode is ignored |
| S22 | A plain run plays `clicksPerBeat = plain.subdivision`. The count-in is one click per slot (FR-009) |
| S23 | `sub` is `null` in plain mode with Quarter, and 2, 3 or 4 otherwise. Ratios and Speed are unchanged |
| S24 | Plain Start with subdivision ≠ 1 announces `metronome_announce_started[_count_in]` with `subdivision: subdivisionName(n)`. With 1 it announces the 036 `_plain` strings unchanged |
| S25 | Ratios and Speed records, their announcements and their runs are byte-identical to 037 (FR-013, FR-014) |
