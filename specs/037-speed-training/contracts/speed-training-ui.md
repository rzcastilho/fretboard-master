# Contract: Speed Training UI (037)

This is a delta against `specs/036-mode-tabs-and-plain-metronome/contracts/mode-tabs-ui.md`.
Components live in `src/lib/tools/metronome/`.

## 1. Tab bar (`ModeTabs.svelte`)

- There are three `role="tab"` buttons in this order:
  - `metronome-tab-plain` (♩ Metronome);
  - `metronome-tab-speed` (⚡ Speed Training, lightning-bolt inline SVG, `aria-hidden`);
  - `metronome-tab-ratios` (+ Ratios Training).
- The tabs are equal width (`grid-auto-columns: 1fr`). At ≤ 30rem the icons are hidden and only
  the text shows, without truncation, in en, pt-BR and es at 320 px.
- Keyboard: ArrowLeft and ArrowRight wrap across the three tabs, and Home and End go to the
  first and last. Activation is manual (Enter or Space), with a roving tabindex.
- Selecting Speed Training during any run halts at once (store `selectMode`).

## 2. Settings view (`MetronomePanel.svelte`, `data-mode="speed"`, phase `settings`)

The rows appear in this order. The numeric rows are `ValueRow`s (slider, − / value / +).

| # | Row | id | Range | Value text |
|---|---|---|---|---|
| 1 | Start BPM | `metronome-start-bpm` | 30–300 | `{v} BPM` |
| 2 | Target BPM | `metronome-target-bpm` | slider 30–300; − disabled when value = Start (`floor = start`) | `{v} BPM` |
| 3 | Increment | `metronome-increment` | 1–20 | `{v} BPM` |
| 4 | Loops per step | `metronome-loops` | 1–16 | `{v}` |
| 5 | # of Beats | `metronome-beats` | 1–16 | `{v}` |
| 6 | Count In switch, then Initial Count In and Repeat Count In (both shown only while the switch is on) | (`CountInSettings`, `repeat = true`) | 0–8 | as today |
| 7 | At target | `AtTargetSelect`: `<fieldset>` and `<legend>`, radios "Hold" and "Stop" | — | — |
| 8 | `Start Training` button | `.start` | — | — |

There is no BPM row, no Subdivision ratio section and no Loop 1 or Loop 2 rows (US3-6).

`ValueRow` gains:
- `floor?: number`: the − button is disabled at `value <= floor`, and the default is `min`;
- a write-back of the `value` prop into the `<input>` after every `onset`, so a clamped commit
  snaps the slider back (R-07).

## 3. Running view (phases `starting`, `running`, `paused`)

- **`StatusBox`**. During loops the position line reads `STEP s/S · LOOP l/L`, and in Hold it
  reads `STEP S/S · HOLD`. Each part is a `nowrap` span, so the line wraps only at the ` · `
  separator. During a count-in it reads `COUNT IN n/M` or `COUNT IN –/M`, as today.
- The tempo readout shows `metronome.bpm` with the BPM unit.
- The dots show `speed.beats`, with beat 1 lit first. During a count-in a single dot shows, as
  today.
- **`RunControls`** is unchanged: Pause or Resume, and Reset.
- Space toggles, and Escape resets (`metronome-keys.ts` unchanged).

## 4. Focus and announcements

| Event | Focus | Polite announcement |
|---|---|---|
| Start | main run button (unchanged) | `Started, {start} to {target} BPM, {beats} beats[, count in {count}]` |
| First loop click of step s ≥ 2 | unchanged | `Step {s} of {S}, {bpm} BPM` |
| First Hold click | unchanged | `Holding at {bpm} BPM` |
| Stop run ends | `Start Training` button (the panel `$effect` on `metronome.finished`) | `Finished at {target} BPM` |
| Pause during loops | unchanged | `Paused, step {s} of {S}, loop {l} of {L}, beat {b} of {N}` |
| Pause in Hold | unchanged | `Paused, holding at {bpm} BPM, beat {b} of {N}` |
| Pause during a count-in | unchanged | the existing count-in paused strings |
| Resume / Reset | unchanged | the existing strings |

## 5. Visual and accessibility rules

- Every colour, spacing and radius comes from existing tokens, and no new token is expected.
  The radio pill reuses `--radius-md`, `--color-accent` and `--target-min`.
- The radios meet a 44 px target (`--target-min`). Focus is visible through
  `--color-focus-ring`, and the checked state is shown by a filled background **and** a check
  glyph, not by colour alone. Forced colours use `Highlight`.
- axe reports zero violations in the settings view, in the running view and in Hold.
- At 375 px and 320 px, and at 1024 px and 2560 px, in en, pt-BR and es, nothing is truncated
  or overlapping and there is no horizontal scroll (SC-006).
