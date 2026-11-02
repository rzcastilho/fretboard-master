# Implementation Plan: Timer Linked to Metronome

**Branch**: `041-add-and-option-to-initialize` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/041-add-and-option-to-initialize/spec.md`

## Summary

Add a "Start and stop with metronome" switch to the Timer card (off by default, remembered as
`metronome.timerLink`). While it is on, starting the metronome arms the practice timer at its full
duration and starts the countdown on the first loop click after the count-in. Pausing the metronome
pauses that countdown and the next click resumes it. Any other stop resets the timer to full, and
the countdown reaching `00:00` halts the metronome while keeping 039's finished flash and chime.

Technical approach (research R-01 to R-05): a new `src/lib/state/timer-link.svelte.ts` store owns
the switch and connects the two existing stores through one observer slot on each:
`metronome.observeRun()` reports `started` / `clicked` / `paused` / `stopped`, and
`timer.onFinished()` reports zero. The pending start and the metronome-paused state are two flags
in the timer store (`armed`, `held`). The timer's own controls clear both flags, so a user action
always wins (FR-008). The metronome gains `stopForTimer()`, a halt with no announcement and no
`stopped` report. Neither store imports the other, so 039's independence stays structural when the
switch is off.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Svelte 5 runes, SvelteKit `adapter-static`

**Primary Dependencies**: existing only: Paraglide JS (messages), Valibot (prefs schema), Web Audio via `$lib/audio` (unchanged). No new runtime dependency.

**Storage**: `localStorage` via `src/lib/prefs`: one new boolean `timerLink` in the existing `metronome` entry, format version 1 unchanged (R-06)

**Testing**: Vitest (+ jsdom for the card) with injected scheduler clock/frames and timer clock; Playwright + axe with `page.clock` (R-08)

**Target Platform**: evergreen desktop browsers (last two majors), offline-capable PWA build

**Project Type**: static single-page web app (SvelteKit, prerendered)

**Performance Goals**: countdown start within 100 ms of the first post-count-in click (FR-005, one animation frame in practice); metronome silent within 1 s of the finished state (SC-003, same task in practice)

**Constraints**: initial JS ≤ 180 KB gzip (expected delta < 1 KB); no network; no new tokens; no change to 039 behaviour when off

**Scale/Scope**: 1 new state module, 3 touched stores (metronome, timer, preferences), 1 schema field, 1 component row, 1 message × 3 catalogs, 1 new e2e spec, ~6 unit test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Musical Correctness**: N/A. No note, interval, shape or pitch is computed or changed; the click and chime sounds are untouched.
- [x] **II. On-Device, Static, Private**: all logic runs in the browser and works offline; the only stored value is a device-local boolean, erasable with Erase preferences (FR-011, FR-014).
- [x] **III. Pure Core, Thin Shell**: no `src/lib/theory` change; link state lives in `src/lib/state`, not in `TimerCard.svelte`; the component only reads `timerLink.enabled` and calls `setEnabled`.
- [x] **IV. Test-First / Tested Behavior**: prefs schema and the store seams are written test-first; every acceptance scenario maps to a unit test in `timer-link.test.ts` and an e2e test in `metronome-timer-link.spec.ts`; timing uses injected clocks/frames and `page.clock` (R-08).
- [x] **V. Accessible by Default**: native `role="switch"` button with `aria-checked`, label as accessible name, keyboard toggle, focus ring and `--target-min` target from the shared switch pattern; state not by colour alone (On/Off word); finished state still visual + chime + polite announcement (FR-001, FR-010); axe in e2e.
- [x] **VI. Performance Budgets**: < 1 KB added to the single bundle (180 KB budget); no work on the hot path beyond one function call per audible click.
- [x] **VII. Design System Fidelity**: reuses `.switch` styles and existing tokens; no modal, no reward mechanics; the card wraps at 1024–2560 px and reflows at 320 px / 200 % (FR-013). Advanced behaviour is off by default ("simplest state").
- [x] **VIII. International**: one new key `timer_link_label` in `messages/en.json`, `pt-BR.json`, `es.json`; the On/Off words reuse existing keys (FR-012).
- [x] **IX. Untrusted Input, Versioned Formats**: `timerLink` parsed with `v.fallback(v.boolean(), false)`, other fields unaffected; version stays 1 because the field is additive; three new compatibility fixtures are added and none removed (contracts/preferences-record.md).
- [x] **X. Simplicity**: one small module and two single-slot observer seams, each with one consumer. This is the minimum shape that avoids a metronome ↔ timer import cycle (R-01). No new dependency, no share-link or measurement change.
- [x] **Workflow gates**: Conventional Commits on the `041-…` branch; the local runs are the targeted ones in quickstart.md, with `pnpm verify` once at the end. The Timer card screenshot baselines are regenerated only through `update-snapshots.yml`.

**Post-design re-check (after Phase 1)**: all gates still pass. The design adds no theory code, no
network path, no stored run state and no new visual token. The observer seams were checked against
Principle X: each is a nullable single function or object, not a generic event system, and both
stores behave exactly as in 039 with nothing attached.

## Project Structure

### Documentation (this feature)

```text
specs/041-add-and-option-to-initialize/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-08
├── data-model.md        # Phase 1: setting, session flags, transition table
├── quickstart.md        # Phase 1: validation commands and smoke steps
├── contracts/
│   ├── timer-link-api.md       # store + seam TypeScript surface
│   ├── preferences-record.md   # stored `metronome.timerLink` cases and fixtures
│   └── timer-card-ui.md        # the switch's markup, name and behaviour
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/state/
├── timer-link.svelte.ts      # NEW: switch state, observer wiring, link reactions
├── metronome.svelte.ts       # + observeRun(), stopForTimer(); report from start/onBeat/onCountIn/pauseState/reset/halt/onEnd
├── timer.svelte.ts           # + arm/startArmed/disarm/hold/release/onFinished; toggle/selectPreset/restore clear flags
└── preferences.svelte.ts     # start(): timerLink.restore(p.metronome.timerLink); erase(): timerLink.restore(false)
src/lib/prefs/
└── schema.ts                 # Preferences.metronome.timerLink, parseTimerLink, serialize after `timer`
src/lib/tools/metronome/
└── TimerCard.svelte          # + switch row
messages/
├── en.json, pt-BR.json, es.json   # + timer_link_label

tests/unit/
├── metronome/timer-link.test.ts        # NEW
├── metronome/timer-store.test.ts       # + seam tests
├── metronome/store.test.ts             # + observer / stopForTimer tests
├── metronome/timer-card.test.ts        # + switch tests (jsdom)
├── prefs/schema.test.ts                # + timerLink parse/serialize
├── prefs/fixtures/                     # + metronome-timer-link*.txt, index.ts entries
└── erase-preferences.test.ts           # + erase turns the link off
e2e/
└── metronome-timer-link.spec.ts        # NEW
```

**Structure Decision**: single SvelteKit project. The new logic goes in the existing
`src/lib/state/` (beside `metronome.svelte.ts` and `timer.svelte.ts`). The persisted field goes in
`src/lib/prefs/schema.ts`, the UI in `src/lib/tools/metronome/TimerCard.svelte`, strings in
`messages/`, unit tests in `tests/unit/metronome/` and `tests/unit/prefs/`, and the user-flow test
in `e2e/`. No new directories.

## Complexity Tracking

No constitution violations. Assumptions and rejected alternatives recorded for review:

| Decision / assumption | Why | Alternative rejected because |
|---|---|---|
| Separate `timer-link.svelte.ts` with single-slot observers on both stores | The link goes both ways; this is the only acyclic shape (R-01) | Link in metronome store: still needs a timer → metronome path and grows a 619-line store. `$effect` watchers: cannot tell a timer stop from a Reset, async |
| Pending start = first `onBeat` after `start()` (animation-frame reported) | Matches the heard click within one frame (R-02) | Count-in-length offset from `start()`: start lead and latency live inside the scheduler |
| Hidden tab during the count-in: the countdown starts when the first beat is reported after the tab is shown | Frames do not run in hidden tabs; the spec's hidden-tab case is about zero, which is unaffected | Reporting from the `setTimeout` pump changes 031's visual-sync contract for all users |
| `halt()` reports `stopped` only from a non-`settings` phase | A tab switch with the metronome already stopped must not reset a timer started with its own play | Reporting every halt: would reset an independent countdown on tab switches and on boot `restore` |
| `held` survives switch off | FR-016: toggling resets nothing; resume checks the switch at the event | Clearing on off: off → on during a pause would strand the paused countdown |
