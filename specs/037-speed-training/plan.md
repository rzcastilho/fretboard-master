# Implementation Plan: Speed Training Mode

**Branch**: `037-speed-training` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/037-speed-training/spec.md`

## Summary

This slice adds a third metronome mode, **⚡ Speed Training**, between `♩ Metronome` and
`+ Ratios Training`. The player sets Start BPM, Target BPM, Increment, Loops per step, # of
Beats, the Count In rows and At target (Hold or Stop). The metronome then plays Loops per step
loops at each tempo of the step schedule `Start, Start + Inc, …, Target`. The last step is
exactly Target. A Repeat Count In at the old tempo plays between steps. When the target is
reached, the run either holds at Target or ends one beat after the last beat.

Technically, the existing click scheduler gains an optional **tempo ramp** (R-01, R-02). A new
pure module, `src/lib/audio/metronome-ramp.ts`, lays the run out as blocks of slots, each at a
constant period. Block start times are computed once as an exact prefix sum, so the whole climb
is a single scheduled segment with no restart, gap or drift at step boundaries (FR-011). Stop is
an `endSlot` plus a new `onEnd` event, checked on the pump timer as well as on frames, so a
hidden tab still ends the run (R-05). The metronome store gains a third per-mode record,
`SpeedSettings`, with the Start/Target invariant enforced by two pure helpers (R-06). The
preferences record gains optional `metronome.speed` and `mode: "speed"` at `version: 1` (R-12).
The Ratios and Metronome code paths are untouched (FR-014).

Details: [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/),
[quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5.57 (runes), SvelteKit 2.70 with
`adapter-static`

**Primary Dependencies**: Paraglide JS (catalog) and Valibot 1 (preferences schema). No new
runtime dependency.

**Storage**: `localStorage` through `src/lib/prefs`. The record is `fretboard-master:prefs` at
`version: 1`, extended with the optional `metronome.speed` and `mode: "speed"`.

**Testing**:
- Vitest 5 + fast-check for the ramp layout, settings maths, codec, store, and components under
  jsdom.
- Fake clock, frames and audio port (`tests/unit/audio/support/fake-audio`).
- Playwright 1.63 + @axe-core/playwright, on the desktop project locally.

**Target Platform**: Evergreen desktop browsers, in windows 1024–2560 CSS px. The page reflows
down to 320 px, and phones are not blocked.

**Project Type**: Static web app (a single SvelteKit project).

**Performance Goals**:
- Click timing within the 2 ms jitter of ADR 0030 across step boundaries. The first loop
  click of step n + 1 comes exactly one previous-tempo beat after the last count-in click.
- A tab switch and its halt stay ≤ 300 ms.
- Building the ramp table is O(steps) ≤ 271 per Start or Resume.

**Constraints**:
- Initial JS ≤ 160 KB gzip (an estimated +3 KB).
- Design tokens only.
- Every string in en, pt-BR and es.
- `src/lib/audio` stays framework-free.
- Existing periodic scheduling stays byte-identical.

**Scale/Scope**:
- Two new source modules: `metronome-ramp.ts` and `AtTargetSelect.svelte`.
- Edits to 2 audio modules, 4 state modules, the prefs schema, 5 metronome components and 3
  catalogs (26 new keys).
- One new e2e spec, plus updates to `metronome-modes.spec.ts` and the screenshot baselines.
- The longest run is 271 steps × 16 loops × 16 beats.

## Constitution Check

*GATE: must pass before Phase 0 research, and re-checked after Phase 1 design. Result: PASS,
with no new violations. The 036 deviation (first-visit mode is Ratios) is carried forward
unchanged.*

- [x] **I. Musical Correctness**: N/A for theory. The mode shows and plays no notes, intervals
  or shapes, and `src/lib/theory` is untouched. Its "correctness" is tempo arithmetic, and that
  is covered by the table and property tests (SC-001–SC-003, E2–E5).
- [x] **II. On-Device, Static, Private**: Everything runs in the browser, with no network.
  Values live only in the local preferences record, and "Erase preferences" clears them. There
  is no share-link field and no new measurement event (FR-015), and the privacy text stays
  accurate.
- [x] **III. Pure Core, Thin Shell**: `speedSteps`, `withStartBpm`, `withTargetBpm` and
  `speedRunPlan` are pure in `metronome-settings.ts`. The ramp layout is pure in
  `src/lib/audio`, with no framework imports. State lives in the store, outside the components.
  Prefs import only types and mirror the defaults, with a parity test (C18).
- [x] **IV. Test-First**:
  - The ramp layout, settings maths, codec and store are built test-first (E1–E10, S6–S14,
    C9–C18).
  - Every acceptance scenario maps to a quickstart row with a unit or e2e test.
  - Audio timing is tested only through the injectable fake clock, frames and port.
- [x] **V. Accessible**:
  - Native radios for At target, with 44 px targets and a visible focus ring.
  - The checked state is shown by fill plus a glyph, not colour alone.
  - Polite announcements for each step change, Hold and Finish, so sound is not the only
    carrier.
  - On a Stop ending, focus returns to `Start Training`.
  - axe reports zero violations, and reflow works to 320 px (contracts/speed-training-ui.md
    §4–§5).
- [x] **VI. Performance Budgets**: There is no dependency, and about +3 KB gzip is gated by the
  bundle-size check (R-15). The scheduler lookahead, horizon and tap-to-sound path are
  unchanged.
- [x] **VII. Design System Fidelity**:
  - Tokens only, and no new token is expected.
  - Main controls are not behind a menu: At target is a visible radio pair, not a `<select>`.
  - No modal, no rewards or confetti at the target: Finish is a polite text announcement only.
  - 1024 px, 2560 px and the 320/375 px reflow, plus 200 % text zoom, are checked in three
    languages for the Speed settings, running and Hold views (T039).
  - The 036 Complexity Tracking entry (first visit opens on Ratios Training) still applies, is
    not widened, and is listed again in the PR.
- [x] **VIII. International**: 26 new keys in all three catalogs (R-13). The tab icon is SVG,
  not text. Each status part is its own message, because word order varies by language. No
  note names are involved.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `speed` is parsed per field with Valibot fallbacks, then the Target ≥ Start lift is
    applied (R13–R17). Parsing never throws.
  - `version: 1` is kept, and fixtures are only added.
  - Two forward-compatibility fixtures change their expected parse. Their files stay unchanged,
    and no released build ever wrote those values (R-12, recorded below).
  - Share links are untouched.
- [x] **X. Simplicity**:
  - The single scheduler and single store are extended rather than duplicated (R-02, R-11).
  - The ramp is a separate pure module because its layout is not periodic.
  - The `Grid` branch has exactly two real uses.
  - No speculative options are added (no tempo decrease, per-step loop counts or
    subdivisions, FR-015).
  - "Never blank": invalid stored values fall back to defaults.

Post-design re-check:
- The Phase 1 artifacts add no dependency and no new directory.
- The link codec and the theory, instrument and fretboard modules are untouched.
- The periodic scheduler path is preserved (E9).

The gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/037-speed-training/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01 … R-16
├── data-model.md        # Phase 1: settings, ramp layout, store state, stored record, catalog
├── quickstart.md        # Phase 1: commands and validation scenarios 1–16
├── contracts/
│   ├── click-engine-api.md      # ramp module, SegmentStart.ramp, onEnd, guarantees E1–E10
│   ├── metronome-store-api.md   # new getters and actions, guarantees S6–S14
│   ├── preferences-record.md    # speed / mode codec, guarantees C9–C18, fixtures
│   └── speed-training-ui.md     # tab bar, settings rows, running view, focus and announcements
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/audio/
├── metronome-ramp.ts          # NEW: RampPlan, toRampPlan, rampSlotAt/ClickAt/Offset/SlotFloor
├── metronome-cycle.ts         # SlotPosition gains optional `ramp` (types only)
└── metronome.ts               # SegmentStart.ramp, Grid.ramp branch in clickTime/skipTo/indexAt,
                               #   endSlot stop, onEnd event, HaltReason 'end'

src/lib/state/
├── metronome-settings.ts      # MetronomeMode + 'speed', METRONOME_MODES order, SpeedSettings,
│                              #   DEFAULT_SPEED_SETTINGS, speedSteps, withStart/TargetBpm,
│                              #   clampIncrement/Loops, speedRunPlan, toAtTarget; atLimit/stepSetting
├── metronome-view.ts          # statusParams: 'step' and 'hold' kinds
├── metronome.svelte.ts        # state.speed, finished; speed actions; bpm/steps/speedStatus;
│                              #   onEnd handling; announcements; remember/restore with speed
└── preferences.svelte.ts      # restore() passes p.metronome.speed

src/lib/prefs/
└── schema.ts                  # Preferences.metronome.speed, METRONOME_SPEED_DEFAULTS, MODES,
                               #   LIMITS; parse R13–R17; serialize W9–W12

src/lib/tools/metronome/
├── AtTargetSelect.svelte      # NEW: fieldset + two radios (Hold, Stop)
├── ModeTabs.svelte            # third tab and lightning-bolt SVG icon
├── MetronomePanel.svelte      # speed settings branch; tempo readout from metronome.bpm;
│                              #   focus Start on `finished`
├── StatusBox.svelte           # STEP · LOOP / STEP · HOLD rendering
└── ValueRow.svelte            # optional `floor`; write-back after onset (R-07)

messages/{en,pt-BR,es}.json    # 26 new keys (data-model §5)

tests/unit/audio/              # NEW metronome-ramp.test.ts; metronome.test.ts (ramp cases)
tests/unit/metronome/          # settings, view, store, panel, mode-tabs tests;
                               #   NEW at-target-select.test.ts, value-row.test.ts
tests/unit/prefs/              # schema.test.ts; fixtures/index.ts + 6 new fixture files
tests/unit/state/preferences-store.test.ts, tests/unit/erase-preferences.test.ts
e2e/metronome-speed.spec.ts    # NEW: quickstart scenarios 1–5, 8–14, 16
e2e/metronome-modes.spec.ts    # three tabs: order, keyboard wrap, widths
e2e/metronome.spec.ts          # new speed settings screenshot; tab-bar baselines regenerated in CI
```

**Structure Decision**: This is a single SvelteKit project, using existing directories only:
`src/lib/audio`, `src/lib/state`, `src/lib/prefs`, `src/lib/tools/metronome`, `messages`,
`tests/unit/audio`, `tests/unit/metronome`, `tests/unit/prefs`, `tests/unit/state` and `e2e`.
No new directory is created. The link codec (`src/lib/link`), theory, instrument, fretboard,
the route `src/routes/metronome` and `metronome-keys.ts` are not modified.

## Implementation notes

1. **Order** (test-first):
   1. `speedSteps` and the settings helpers.
   2. The ramp layout (`metronome-ramp.ts`).
   3. The scheduler ramp branch and `onEnd`.
   4. The codec and fixtures.
   5. The store (record, actions, announcements, end).
   6. Preferences wiring.
   7. Catalogs.
   8. `ValueRow`, `StatusBox`, `AtTargetSelect` and `ModeTabs`.
   9. `MetronomePanel`.
   10. The e2e spec.
   11. Screenshots.
2. **Scheduler branch**: `clickTime`, `skipTo` and `indexAt` test `g.ramp` once. The periodic
   branch must stay textually the same as in 036, so its existing tests are the guard (E9).
3. **Hidden-tab end**: `pump` checks the end condition before scheduling, so a Stop run ends
   even when `requestAnimationFrame` is paused (R-05).
4. **The write path** still sends the whole `metronome` object (036 R-10), now with `speed`.
5. **Focus on Finish**: the panel keeps the last-seen `finished` value and focuses
   `startButton` after `tick()` only when the value grows. Mount never steals focus.
6. **Snapshots**: the existing metronome baselines change because the tab bar now has three
   tabs. They are regenerated through `update-snapshots.yml`, and a new Speed Training
   settings baseline is added the same way.

## Assumptions and rejected alternatives

| Assumption / decision | Rejected alternative | Why rejected |
|---|---|---|
| One ramp segment per run (R-01) | Halting and restarting a segment at each step | It re-anchors and drops queued clicks, so there is an audible gap at each boundary (FR-011) |
| Before the first click with no count-in, the status shows `STEP 1/S · LOOP 1/L` (R-09) | `LOOP –/L` with new "none" strings | It adds strings with no user value, and the run is about to begin at loop 1 |
| Loops per step is 1–16 (spec assumption) | A larger range | The spec gives only the default; 16 matches # of Beats |
| At target is a radio pair (R-08) | A switch or a `<select>` | A switch has the wrong semantics, and a select hides a two-option choice behind a menu (VII) |
| The `metronome-bad-mode` and `metronome-other-mode` fixtures change their expected parse (R-12) | `version: 2`, or different stored key names | Version 2 discards every existing record. Other names contradict FR-013. No released build wrote these values |
| Step announcements fire at the first loop click of each step (R-10) | Announcing at the count-in before the step | FR-016 and the readout both change at the first loop click |
| `current` is narrowed to the shared fields, and a new `bpm` getter drives the readout (R-11) | A synthetic `bpm` on the speed record | It would invent a field that is not stored and blur which BPM the readout shows |

## Complexity Tracking

There is no new violation. One deviation is carried forward from 036 without change:

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| VII "Each tool opens in its simplest state": with nothing remembered, the tool still opens on Ratios Training (FR-013 "an unknown/omitted `mode` reads as `\"ratios\"`", inherited from 036 FR-014) | Approved in 036. This slice does not widen it: Speed Training is never the first-visit mode, and its own advanced choices default to the simplest run (Hold, Count In as in the other modes) | Switching the default to Metronome is out of scope for this slice and would break FR-014 ("stored record written before this feature MUST read as before"). It is listed again in the PR description for reviewer visibility |
