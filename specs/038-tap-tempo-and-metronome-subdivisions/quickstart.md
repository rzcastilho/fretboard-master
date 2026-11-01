# Quickstart: Tap Tempo and Metronome Subdivisions (038)

This guide shows how to check that the slice works end to end. The interfaces are in
[contracts/](contracts/) and the shapes in [data-model.md](data-model.md).

## Prerequisites

- Run `mise install` and `pnpm install` once.
- Local runs follow `CLAUDE.md`'s verification tiers: targeted Vitest, then
  `pnpm build:test` and `pnpm test:e2e:fast <spec>` on the desktop project, then `pnpm verify`
  once at the end.

## Commands

```bash
# Unit (per task)
pnpm vitest run tests/unit/metronome/tap-tempo.test.ts tests/unit/metronome/keys.test.ts \
  tests/unit/metronome/store.test.ts tests/unit/metronome/panel.test.ts \
  tests/unit/metronome/value-row.test.ts tests/unit/metronome/status-box.test.ts \
  tests/unit/audio/metronome.test.ts tests/unit/prefs/schema.test.ts \
  tests/unit/shortcut-list.test.ts

# E2E (after changing src/)
pnpm build:test
pnpm test:e2e:fast e2e/metronome-tap-subdivision.spec.ts e2e/metronome-modes.spec.ts e2e/metronome-remembered.spec.ts

# Changed screenshots (plain settings gain the Subdivision row), desktop baseline only;
# Linux baselines come from .github/workflows/update-snapshots.yml
pnpm playwright test e2e/metronome.spec.ts -g "metronome plain-mode views" --project=desktop --update-snapshots

# End of slice, once
pnpm verify
```

## Validation scenarios

Each row is an acceptance scenario or edge case with the test that proves it. "Unit" rows use
the fake clock from `tests/unit/audio/support/fake-audio`. "E2E" rows use
`page.clock.install()` and `page.clock.runFor(ms)` between taps.

| # | Scenario (spec) | Steps | Expected | Test |
|---|---|---|---|---|
| 1 | US1 1 | Plain at 85. Tap the BPM pill value 4× with 500 ms gaps | The pill shows 120, the status region says "120 BPM", the stored `plain.bpm` is 120 | Unit (T3, S17) + E2E |
| 2 | US1 2 | Plain at 85. Tap 3× | The value stays 85, no announcement, no storage write | Unit (T2, S16) + E2E |
| 3 | US1 3 | Tap 4× with 100 ms gaps | 300 | Unit (T4) + E2E |
| 4 | US1 4 | Tap 2×, wait 2100 ms, tap 3× more | The value is unchanged. A 4th tap of the new run sets the BPM | Unit (T5) + E2E |
| 5 | US1 5 | Tap 5× (500, 500, 500, 400 ms) | Tap 4 gives 120. Tap 5 gives `round(60000/475)` = 126 | Unit (T6) |
| 6 | US1 6 | Plain at 100, Start, advance `page.clock` to BEAT 2, tap 4× with `runFor(500)` between taps | The phase stays running, the beat number keeps advancing with no reset to 1, the tempo readout shows 120, `__fmAudioLog` has a `click-cancel` entry with `reason: 'retime'`, and the click times after the cancel follow the new period | Unit (E11–E15, S18: exact click times) + E2E (`page.clock`: readout, continuity, cancel entry) |
| 7 | US1 7 | Focus on the body. Press `T` 4× at 500 ms | 120, as in row 1 | Unit (keys) + E2E |
| 8 | FR-005 | Shortcuts off in About, back to the Metronome page, press `T` 4× | BPM unchanged. Clicking the tap button 4× still gives 120 | Unit (keys) + E2E |
| 9 | FR-005 | Focus the Subdivision select and press `T` 4×. Hold `T` (repeat). Press Ctrl+T in a fake event | Nothing taps | Unit (keys) |
| 10 | FR-006 | Pause the run, tap 4× at 500 ms, Resume | The new BPM applies on Resume, and the beat continues from the paused beat + 1 | Unit (S19) + E2E |
| 11 | FR-006 | Tap during the count-in | The count-in continues (`COUNT IN n/M` advances) and later beats use the new tempo | Unit (E15) |
| 12 | Space/Enter | Focus the tap button and press Space 4× and Enter 4× | Each press taps. Space does not start the metronome | Unit (panel) + E2E |
| 13 | US2 1 | Plain at 90, Triplets, Start | Status `BEAT n/4 · SUB 3`. The log per beat is `accent|normal` then 2× `sub` at a third of 666.7 ms (±10 ms, SC-004) | Unit (S22) + E2E |
| 14 | US2 2 | 8ths and 16ths | `· SUB 2` / `· SUB 4`, and 1 or 3 `sub` clicks per beat | Unit + E2E |
| 15 | US2 3, FR-014 | Quarter | No `· SUB`. The click log is identical to 036 for the same settings | Unit (E20, S23) + E2E |
| 16 | US2 4 | Triplets with a count-in of 4 | The 4 count-in clicks are all `accent` with no `sub` between them | Unit (S22) |
| 17 | US2 5, SC-005 | Choose Triplets, reload | The plain select shows "8th Triplets (3)", and the Ratios Loop 1 and Loop 2 values are unchanged | E2E (`metronome-remembered.spec.ts`) |
| 18 | FR-011 | Stored `subdivision: "3"` or `9` | Reads as Quarter, and the other plain fields are kept | Unit (C21, fixtures) |
| 19 | FR-013 | Ratios and Speed tabs | No tap button (the pill is an `<output>`), `T` does nothing, no Subdivision row | Unit (panel, keys) + E2E (`metronome-modes.spec.ts`) |
| 20 | Edge: tab or Reset | Tap 3×, switch to Ratios and back (or Reset), tap 1× | No change: the run was cleared | Unit (S20) |
| 21 | FR-015 | Start with Triplets | Announces "Started, 90 BPM, 4 beats, 8th Triplets, count in 4" | Unit (S24) |
| 22 | FR-005 About | Open About | The Metronome list shows `T`, "Tap tempo (Metronome mode)", in en, pt-BR and es | Unit (`shortcut-list.test.ts`) + E2E |
| 23 | FR-016, SC-006 | 320 px width (and 1024 / 2560) in en, pt-BR and es, plain settings and running | No horizontal scroll, axe reports 0 violations, the tap button is at least `--target-min` | E2E |
| 24 | Edge: 16ths at 300 | Unit: 16ths at 300 BPM for 10 s on the fake clock | 20 clicks/s, every click time exact to 1e-9 | Unit |

## Manual checks (human; listed in the PR)

- By ear, in Chrome and Firefox on desktop: Triplets at 90 BPM sound even, and the soft clicks
  are the Ratios soft sound.
- By ear: while running at 100 BPM, tap about 140 BPM. The click changes within two beats with
  no stutter, doubled click or gap.
- On a touch screen (not a target, but not blocked): fast taps on the tempo readout are not
  delayed and do not zoom.
