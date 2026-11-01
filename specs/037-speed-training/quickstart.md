# Quickstart: validating Speed Training (037)

This guide shows how to prove the slice works. The interfaces are specified in
[contracts/](contracts/) and the types and rules in [data-model.md](data-model.md); this file
does not repeat them.

## Prerequisites

- Run `mise install` and `pnpm install` once.
- Local e2e runs use installed Google Chrome (`pw.local.config.ts`).
- Run `pnpm build:test` after any change under `src/`. A running `serve-build` server is reused.

## Targeted runs (per task or checkpoint)

```bash
# Pure maths, scheduler and store (node and jsdom docblocks as per CLAUDE.md)
pnpm vitest run tests/unit/audio/metronome-ramp.test.ts tests/unit/audio/metronome.test.ts \
  tests/unit/audio/metronome-cycle.test.ts
pnpm vitest run tests/unit/metronome/
pnpm vitest run tests/unit/prefs/schema.test.ts tests/unit/state/preferences-store.test.ts \
  tests/unit/erase-preferences.test.ts

# E2E (desktop project only)
pnpm build:test
pnpm test:e2e:fast e2e/metronome-speed.spec.ts e2e/metronome-modes.spec.ts

# New or changed screenshot (desktop only; Linux baselines come from update-snapshots.yml)
pnpm playwright test e2e/metronome.spec.ts -g "speed training settings" --project=desktop --update-snapshots
```

At the end of the slice, run this once: `pnpm verify`.

## Scenarios

| # | Scenario | Where | Expected outcome |
|---|---|---|---|
| 1 | Three tabs (FR-001) | e2e | Tabs in the order Metronome, Speed Training, Ratios Training, all the same width. Arrow keys, Home and End move focus, and Enter selects. At 320 px only text shows, untruncated, in en, pt-BR and es |
| 2 | First-use defaults (US3-1) | e2e | Start 85, Target 125, Increment 5, Loops per step 4, # of Beats 4, Count In on (4, 2), At target Hold. No BPM, ratio or Loop rows (US3-6) |
| 3 | Target never below Start (US3-2/3) | unit S11 and e2e | Filling the Target slider with 60 while Start is 85 leaves both the slider and the pill at 85, and Target − is disabled. Start 130 lifts Target to 130. Start 100 leaves it at 130 |
| 4 | Ranges (US3-4) | unit | Increment is 1–20 and Loops per step 1–16. Typed or out-of-range values clamp |
| 5 | Count In off (US3-5) | e2e | The Initial and Repeat rows are hidden. A run starts directly at `STEP 1/S · LOOP 1/L` |
| 6 | 9-step climb (SC-001, US1-1/2/4) | unit S6 (fake clock) | 80→120/5, 4 loops of 4 beats: `COUNT IN 1/4`, then `STEP 1/9 · LOOP 1/4` … `STEP 9/9 · LOOP 4/4`. A 2-click count-in comes between steps, at the previous tempo. The readout changes at each step's first loop click |
| 7 | Overshoot step (SC-002, US1-3) | unit S7 and E-tests | 80→102/5 gives `[80, 85, 90, 95, 100, 102]` and `STEP n/6` |
| 8 | Fast real run (US1, FR-006/011) | e2e | Start 290, Target 300, Increment 5, 1 loop, 1 beat, Count In on (1, 1). The audio log gives intervals ≈ 60/290 up to and including the boundary count-in click, then 60/295, then 60/300, each within 2 ms. The `.position` text passes `STEP 1/3 · LOOP 1/1`, `STEP 2/3`, `STEP 3/3` |
| 9 | Hold (US2-1) | unit S8 and e2e | After the last loop, the status reads `STEP 3/3 · HOLD`, clicks go on at 60/300 with no count-in, and `Holding at 300 BPM` is announced |
| 10 | Stop (US2-2, SC-004) | unit S9 and e2e | With At target set to Stop, the run returns to settings about one beat after the last beat. The audio log has no click after the last loop beat. Focus is on `Start Training`, the live region reads `Finished at 300 BPM`, and the values are unchanged |
| 11 | Single step (US2-3) | unit and e2e | Start 300 forces Target 300. The run shows `STEP 1/1` and then Hold or Stop |
| 12 | Pause, resume, reset (US4, SC-005) | unit S10, S13 and e2e | Pause during step 2 loop 1 announces `Paused, step 2 of 3, loop 1 of 1, beat 1 of 1`. Resume continues with no count-in. Reset or Escape returns to settings, and the next Start begins at step 1. Space toggles |
| 13 | Tab switch mid-run (US4-3) | e2e | Selecting Metronome during a Speed run stops the click at once, with no new log `click` entries. Going back shows the speed values unchanged |
| 14 | Remembered settings (FR-013) | e2e and unit C15–C18 | After setting 80→120 with Stop and reloading, the Speed Training tab is selected with the same values. Erase preferences resets to the defaults and the Ratios tab |
| 15 | Old records (FR-014, SC-007) | unit C1 and C9 | 035 and 036 fixtures read and re-serialize as before, with the noted `metronome-bad-mode` exception. The existing metronome specs pass |
| 16 | Accessibility (SC-006) | e2e | axe reports zero violations in settings, running and Hold. Every control works by keyboard. Settings, running and Hold at 1024 px, 2560 px, 375 px and 320 px in three languages, and at 200 % text zoom at 320 px, show no truncation and no horizontal scroll |

## Manual checks (recorded in tasks.md, listed in the PR)

- Listen by ear to a 100→120/5 run with 2 loops: the step boundaries should sound with no gap,
  flam or extra click, and the count-in should be at the old tempo.
- In a real Firefox or Safari window, check that a hidden tab still ends a Stop run (R-05).
