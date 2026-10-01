# Quickstart: Validate Note Playback

**Feature**: `003-note-playback` | **Plan**: [plan.md](./plan.md) |
Contracts: [playback-api](./contracts/playback-api.md), [sound-control-ui](./contracts/sound-control-ui.md),
[test-hooks](./contracts/test-hooks.md) | Types: [data-model.md](./data-model.md) | Research: [research.md](./research.md)

This is a run-and-verify guide. It lists commands and expected outcomes. Implementation belongs in
`tasks.md`.

## 1. Prerequisites

```bash
mise install                      # node + pnpm from mise.toml
pnpm install --frozen-lockfile    # no new dependencies in this slice (R-17)
pnpm exec playwright install --with-deps chromium firefox webkit
```

## 2. Static gates

```bash
pnpm lint            # incl. new audio boundaries (contracts/playback-api.md §4)
pnpm format:check
pnpm check           # svelte-check --fail-on-warnings
```

Expected: zero errors. Boundary sanity check: adding `import 'svelte'` to `src/lib/audio/schedule.ts`,
or `import '$lib/state/playback.svelte'` to `src/lib/fretboard/Fretboard.svelte`, must fail lint.
Revert after checking.

## 3. Unit and component tests (Vitest, deterministic)

```bash
pnpm test:unit --coverage
```

| Suite | Proves |
|---|---|
| `tests/unit/theory/pitch.test.ts` (extended) | `frequencyOf` table: E2 82.41, A1 55, C3 130.81, A4 440, E6 1318.51. Octave doubles (fast-check) — FR-001 |
| `tests/unit/audio/pluck.test.ts` | For every pitch A1–E6 at 44.1 and 48 kHz: ±5 cents (zoom-DFT), ±3 dB A-weighted of the median, f0 < 200 Hz → ≥ 50 % energy ≥ 1.5·f0, 10 ms fade to 0, determinism, `mixVoices` peak ≤ 0.89 for 1–7 voices — FR-004/005/006/021, SC-003, US6-2 |
| `tests/unit/audio/loudness.test.ts` | A-weighting filter response at 100 Hz / 1 kHz / 10 kHz within ±0.5 dB of IEC values |
| `tests/unit/audio/schedule.test.ts` | Marks for note/chord/sequence, tempo clamp 30–300 incl. NaN, invalid positions dropped, pitches from injected non-standard instrument (US1-3, US6-1…4, FR-018) |
| `tests/unit/audio/engine.test.ts` | Guarantees E1–E12 with the fake `AudioPort` + fake `TimerClock`: no context before gesture (US1-4), first-gesture note scheduled at `currentTime` ≤ 100 ms (US1-1, US1-5, SC-001), interruption (US4-1, SC-004), unavailable once + no retry (US5-1/2/4), device switch not unavailable (EC-7.7), synth-loading 100 ms window (FR-017), mute/volume ramps never stop sources (US3-2/3) |
| `tests/unit/fretboard/pulse.test.ts` | `applyPulses`: existing marker keeps function and is drawn highlighted, transient neutral marker for an empty position, invalid ignored, no mutation (US2-4) |
| `tests/unit/fretboard/fretboard.test.ts` (extended) | `pulses` prop draws `.pulse` markers keyed by id. Names and description unchanged by pulses. Reduced motion: no animation, highlighted state (US2-3, FR-008) |
| `tests/unit/state/playback.test.ts` | Defaults (not muted, 80 %), mute keeps volume, volume snaps to step 5, controlState mapping, notice once + dismiss, pulses add/remove on clock even when muted/unavailable (US2-1/2, US3-4, US5) |
| `tests/unit/sound-control.test.ts` | `aria-pressed`, disclosure open/Escape/outside close, no trap, unavailable → `aria-disabled` + disabled range, help first item = silent mode (US3-1/5, FR-010) |
| `tests/unit/stop-button.test.ts` | Hidden when idle; a sequence driven through `playback` shows Stop; activating it stops, clears pulses, hides itself (US4-2) |
| `tests/unit/playback-host.test.ts` | `visibilitychange`→hidden and `pagehide` call `stop('hidden')`; no resume on visible (US4-3, FR-013). Instrument change in `ToolPlaceholder` calls `stop('instrument')` (US4-4) |
| `tests/unit/notice.test.ts` (updated) | Generic `message` prop; not-found copy unchanged |
| `tests/unit/no-raw-text.test.ts`, `reserved-colors.test.ts` | New components use only catalog strings and reserved-color rules |

Coverage: `src/lib/theory/**` ≥ 95 % lines and branches; overall ≥ 80 %.

## 4. End-to-end (Playwright, test build)

```bash
pnpm build:test
pnpm test:e2e
```

New `e2e/playback.spec.ts` (phone 360, phone-touch 320, desktop). It reads the audio log hook
([test-hooks](./contracts/test-hooks.md)):

| Scenario | Expected |
|---|---|
| Load `/notes`, scroll the board, navigate to `/triads` and back | `__fmAudioLog` empty: no `unlock` entry (US1-4, FR-002) |
| First action: click "E, string 6, open" | Log: `unlock` then `step` with `pitches: [40]`, frequency ≈ 82.41. The marker gets `.pulse` for 1.5 s (US1-1, SC-002, US2-1) |
| Keyboard: focus the grid, move to string 5 fret 3, press Enter | `step` with pitch 48 (C3) (US1-2, keyboard parity) |
| Three rapid clicks on different positions | Two `stop` entries with `reason: 'interrupt'`. One `.pulse` at the end (US4-1, SC-004) |
| Mute, then click a position | `step` logged with `gain: 0` path. The pulse is still shown (US2-2, US3-2) |
| Reload after changing volume to 40 % and muting | Control shows not muted, slider 80 (US3-4) |
| Click, then `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` with `visibilityState` stubbed hidden; then visible | `stop` with `reason: 'hidden'`. No new `step` after becoming visible (US4-3, SC-006) |
| Click, then navigate via the app nav | `stop` with `reason: 'navigate'` (US4-4) |
| `__fmAudioFault = 'context'`, click twice | Exactly one notice text "Sound is not available on this device right now". The control shows unavailable. `.pulse` on both clicks (US5-1/2, SC-005) |
| `__fmAudioFault = 'synth'`, click | Same as above (US5-4) |
| Dismiss the notice | Notice gone and not shown again. Focus on the mute button (US5-3) |
| `emulateMedia({ reducedMotion: 'reduce' })`, click | Marker is highlighted with no running animation (`getAnimations().length === 0`) (US2-3) |
| axe on `/notes` with the panel open, the notice shown, and Stop visible (via a sequence fixture in the component test) | Zero violations (SC-009) |
| Context offline after load (`context.setOffline(true)`), click | `step` logged; `continuity.spec.ts` still records zero requests after load (FR-016, SC-008) |
| Grayscale screenshot of the sound control in its 3 states | States distinguishable without color (FR-010) |

`e2e/continuity.spec.ts`, `version-skew.spec.ts`, and `nojs.spec.ts` must stay green. Without JS,
the control renders in its default state and does nothing.

## 5. Budgets and production hygiene

```bash
pnpm build
node scripts/check-bundle-size.mjs build    # initial JS ≤ 80 KB gzip (expect +5–7 KB, R-10)
node scripts/check-no-fault-hook.mjs build  # no __fmAudioFault / __fmAudioLog in production
pnpm lhci                                   # Lighthouse mobile ≥ 90; perf.spec.ts tool open ≤ 300 ms
```

Expected: all pass. SC-007: time-to-interactive on `/notes` does not regress versus `main`
(Lighthouse TBT/TTI within noise), because the synth preload runs in an idle callback.

## 6. Manual listening check (not a CI gate)

On a phone (silent mode off) and a laptop: tap string 6 open, string 5 fret 3, string 1 fret 22.
Each note should sound like a clean plucked string with a clear attack and a natural decay, in tune
against a reference tuner app. Low E should be recognizable on the phone speaker. Plug in or
unplug headphones mid-note: the next tap plays (EC-7.7).
