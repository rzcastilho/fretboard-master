# Implementation Plan: Metronome Tool and Steady Click

**Branch**: `031-metronome-tool-and-click-engine` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/031-metronome-tool-and-click-engine/spec.md`

## Summary

Add a fourth tool, **Metronome** (`/metronome`). It has a home card (4th), a nav entry and a
`lastTool` value. It opens on a **Ratios Training** panel with BPM (30–300, default 85) and
# of Beats (1–16, default 4) rows, then a running view with a status box, a beat-dot row, Pause/Resume and a
`--color-danger` Reset. Space toggles and Esc resets.

Technical approach ([research.md](./research.md)):
- **Click engine**: a framework-free lookahead scheduler, `src/lib/audio/metronome.ts`. It starts
  pre-rendered synthesized tick buffers (`src/lib/audio/click.ts`) with
  `AudioBufferSourceNode.start(when)` at `anchor + n × 60/BPM` on the **existing** engine's
  `AudioContext`, through its volume→mute chain. That gives sample-accurate timing, no drift, and
  app-wide mute/volume for free (R-01, R-03, R-09).
- **Hidden tab**: a 1.5 s horizon survives timers throttled to 1 s. The clicks are outside the
  engine's "active request", so the unchanged `PlaybackHost` hidden rule (`playback.stop('hidden')`)
  cannot stop them (R-02, FR-016).
- **Display sync**: dots and status follow the audio clock on `requestAnimationFrame`, never
  scheduling time (R-06).
- **Run control**: Pause cancels unsounded sources and freezes on the last audible beat. Resume
  re-anchors within 20 ms (R-04, R-05). A generation-guarded state machine keeps at most one
  stream (R-10). Background suspension skips forward with no burst (R-07). With no Web Audio, the
  run is visual-only with a one-line notice (R-08).
- **Shell**: `ToolId` splits into `FretboardToolId | 'metronome'`. The Metronome renders its own
  slim `MetronomeLayout` (nav, sound, language), so no fretboard concern (share, instrument,
  tuning badge, Stop, P . , L N) can reach it (R-12). Like `ToolLayout`, it wraps the panel in a
  `<svelte:boundary>` that records the failure (`recordFailure(null, …)`, attributed to `'shell'`)
  and shows the shared `FailureView` with a reset, so a render error never leaves a blank main area.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Existing only: SvelteKit, Paraglide JS (messages), Valibot (prefs
schema), Web Audio API. **No new runtime dependency.**

**Storage**: None new. The existing `localStorage` preferences record gains one allowed
`lastTool` value (`'metronome'`). BPM and beats are not remembered (FR-019).

**Testing**: Vitest + fast-check (scheduler grid property, throttled-timer and suspension cases
with the existing `FakeAudioPort`/`FakeClock` fakes plus a `FakeFrames`); @testing-library/svelte
(jsdom) for components; Playwright desktop + @axe-core/playwright, reading the test-build
`__fmAudioLog` `click` entries.

**Target Platform**: Evergreen desktop browsers (Chromium, Firefox, Safari/WebKit), windows
1024–2560 CSS px, zoom reflow to 320 CSS px. iOS and phone lock are best-effort, untested
(constitution 2.0.0).

**Project Type**: Static single-page web app (SvelteKit, prerendered)

**Performance Goals**:
- Each click's scheduled time within 2 ms of `anchor + n·60/BPM` (exact by construction).
- No drift after 3000 clicks.
- First click ≤ 50 ms after Start or Resume, never truncated.
- Dot/status update ≤ one animation frame (≤ 20 ms) after the click's audible time.
- Tool open ≤ 300 ms. Tool screen interactive ≤ 3.5 s. Lighthouse ≥ 90.

**Constraints**:
- Initial JS ≤ 150 KB gzip (single bundle, ADR 0002; estimated +4–6 KB, measured at the end of the
  slice, R-17).
- Gap-free with main-thread timers at 1 Hz.
- No network or sample files (C II).
- All colours from tokens (C VII).
- Only `playback.svelte.ts` imports the engine (lint).

**Scale/Scope**:
- 1 route, about 5 new components (`MetronomeLayout`, `MetronomePanel`, `ValueRow`,
  `StatusBox`, `RunControls`).
- 3 pure state modules, 1 runes store, 2 audio modules.
- About 24 message keys × 3 languages.
- 2 new e2e specs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research gate: **PASS**. Post-design re-check (after data-model and contracts): **PASS**, with
no violations. The two readings below (C VII red; C VII "fretboard is the protagonist") are
interpretations the spec's clarifications require, recorded here as the spec asks.

### I. Musical Correctness
- [x] N/A. A click track has no notes, spellings, intervals or shapes, and `src/lib/theory` is not
  touched. The only "pitch" is the tick frequency, which is a timbre, not a musical note.

### II. On-Device, Static, Private
- [x] The click is synthesized in `src/lib/audio/click.ts` on the device, with no sample files,
  network, permissions or identifiers. The only stored data is the existing erasable `lastTool`
  preference.

### III. Pure Core, Thin Shell
- [x] Grid maths (`clickAt`, `skipTo`), settings, dot model and key matching are pure modules.
  Run state lives in `src/lib/state/metronome.svelte.ts`, outside components. Components only
  call store methods.
- [x] Audio stays framework-free, and only `playback.svelte.ts` imports the engine (it gains
  `clickSink()`). `state/metronome` imports `$lib/audio/metronome`, which the existing lint rule
  allows.
- [x] N/A: "fretboard reports musical terms / handedness in renderer". The Metronome renders no
  fretboard.

### IV. Test-First for Logic, Tested Behaviour for UI
- [x] Scheduler, click synth, settings, view and keys modules are built test-first.
- [x] Timing is verified only through the injectable `ClickPort`, `TimerClock` and `FrameClock`
  (SC-001/002/004/006 as Vitest with fakes), never real time.
- [x] Every acceptance scenario (US1–US4) maps to a Vitest or Playwright case in
  [quickstart.md](./quickstart.md).
- [x] N/A: TM-9 fixtures. Not a fretboard view.

### V. Accessible by Default
- [x] Every control works by keyboard: native range sliders, − / + buttons, Space/Esc with the
  guards in R-11.
- [x] Not colour alone: the Reset button has the ↺ icon plus the accessible name "Reset" and a
  tooltip. Dot states use opacity plus fill, and the same information is in the `BEAT n/N`
  status text.
- [x] Sound is never the only carrier: dots and status step on the audio clock, and they keep
  stepping in the visual-only fallback.
- [x] A polite live region announces run-state changes only.
- [x] Reduced motion means instant state changes.
- [x] Target size: Reset and pill buttons are ≥ `--target-min`.
- [x] Reflow to 320 CSS px: the slider shrinks first, and the pill is ≥ 96 px.
- [x] axe has zero violations in settings, running and paused views, in light and dark.

### VI. Performance Budgets
- [x] No budget change. The code joins the single bundle (estimated +4–6 KB gzip vs the 150 KB
  limit). `pnpm verify` checks it at the end of the slice. R-17 gives a lazy-route fallback if
  the check fails.
- [x] `/metronome` is added to Lighthouse with the tool-screen `interactive ≤ 3500` assertion.
- [x] `e2e/perf.spec.ts` gains `/metronome` cases (T057): tool open (home → card, nav → tool)
  median ≤ 300 ms, and Start Training tap-to-sound (pointerdown → first `click` `scheduledAtMs`)
  median ≤ 100 ms, at 4× CPU throttle, so CI enforces both budgets for the new route.
- [x] The tick buffers render once (about 1300 samples) and never block interactivity.

### VII. Design System Fidelity
- [x] All colours, sizes and durations come from tokens. The new tokens are `--color-danger`,
  `--color-danger-text`, `--pill-min-inline`, `--metronome-dot-size` and
  `--metronome-tempo-size`. Accent means `--color-accent`, never a literal orange.
- [x] Root, third and fifth colours are not reused. A unit test asserts that `--color-danger` has
  ΔE ≥ 10 from `--fb-color-root` in every set and is referenced only by `RunControls.svelte`.
- [x] **Reading of the "error red" clause** (spec clarification): Reset is a *destructive
  control*, not an error state. A dedicated `--color-danger` token for it, never used for
  errors or normal notices, does not violate "Error red MUST NOT be used for normal situations".
- [x] Position state uses the four emphasis levels: lit = highlighted, played = dimmed,
  upcoming = normal.
- [x] The "sound unavailable" notice is non-blocking, dismissible and one line.
- [x] The tool opens in its simplest state (85/4, settings view), and main controls are not behind
  a menu.
- [x] Works from 1024 to 2560 CSS px with no truncation.
- [x] **Reading of "the fretboard is the protagonist"**: this tool has no fretboard, so the
  clause applies vacuously. The breakdown's wave 008 (constitution X wave order) defines this
  non-fretboard tool.
- [x] No reward mechanics, confetti, overlays or modal dialogs.

### VIII. International From the First Line
- [x] About 24 new keys in `messages/{en,pt-BR,es}.json` in the same commit, including the status
  line and announcements. There is no hard-coded text, and the existing `no-raw-text` and i18n-gap
  tests cover them.
- [x] The pill and status layouts are tested with pt/es label lengths at 200 % text zoom.
- [x] N/A: note names and accidentals. None are shown.

### IX. Untrusted Input, Versioned Formats
- [x] `lastTool` picklist gains `'metronome'`. Parsing stays `v.fallback(…, null)`, and older
  builds fall back to `null` for it. A new compatibility fixture `last-tool-metronome.txt` is
  added and none are removed. The format version is unchanged because the change is additive.
- [x] N/A: share links. The Metronome has no share-link format (FR-023), and the link codec is
  untouched.

### X. Simplicity and Incremental Delivery
- [x] Wave 008, slice 001. Only the steady click and run controls ship. Subdivisions, count-in,
  Loop 2, tabs, remembered settings, tap tempo and a dedicated volume are excluded (FR-019).
- [x] No new runtime dependency.
- [x] `ValueRow` has two real uses (BPM, beats). No generic "scheduler framework" is added: the
  scheduler serves exactly one consumer.
- [x] Never blank: a render error in the panel shows `FailureView` inside `MetronomeLayout`'s
  `<svelte:boundary>` (recorded via `recordFailure`), with the app bar and nav still operable.
  No Web Audio means a visual run plus a one-line notice. An unrecoverable
  suspension means Paused, with an announcement.

### Technology Stack and Workflow
- [x] Web Audio in `src/lib/audio`. The stack row's "synthesized plucked string" describes the
  note synth. A synthesized click is a second Web Audio sound in the same module tree, not a stack
  replacement, so no amendment is needed.
- [x] The constitution's source-layout route list (`/`, `/notes`, `/triads`, `/caged`, `/about`)
  gains `/metronome` by the wave order. This is noted for a PATCH wording update at the wave-end
  compliance review. It is not a stack change.
- [x] ADR `docs/adr/0030-metronome-click-scheduler.md` records the shared-context lookahead
  scheduler, the hidden-rule exception and the `ToolId` split.
- [x] Verification tiers: targeted Vitest and `test:e2e:fast` per task, `pnpm verify` once.

## Project Structure

### Documentation (this feature)

```text
specs/031-metronome-tool-and-click-engine/
├── plan.md              # This file
├── research.md          # Phase 0: R-01…R-18 decisions
├── data-model.md        # Phase 1: settings, run phases, segment/click, dots, announcements, type changes
├── quickstart.md        # Phase 1: validation commands and scenario table
├── contracts/
│   ├── click-engine-api.md     # audio layer: click synth, scheduler, engine.sink, playback.clickSink
│   ├── metronome-store-api.md  # state: store, keys matcher, touched modules
│   └── metronome-ui.md         # route, DOM/ARIA, tokens, messages, test hooks
├── checklists/          # (from specify/clarify)
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── audio/
│   │   ├── click.ts                 # NEW  pure tick synthesis (accent / normal)
│   │   ├── metronome.ts             # NEW  lookahead click scheduler, clickAt/skipTo
│   │   ├── log.ts                   # NEW  shared test-build __fmAudioLog helper (moved from engine.ts)
│   │   ├── engine.ts                # EDIT + sink(); AudioPort latency fields
│   │   └── types.ts                 # EDIT + click / click-cancel log entries
│   ├── state/
│   │   ├── metronome-settings.ts    # NEW  pure clamp/step/defaults
│   │   ├── metronome-view.ts        # NEW  pure beatDots / status params
│   │   ├── metronome-keys.ts        # NEW  pure Space/Esc matcher
│   │   ├── metronome.svelte.ts      # NEW  runes store, owns the scheduler
│   │   ├── playback.svelte.ts       # EDIT + clickSink()
│   │   ├── shortcuts.svelte.ts      # EDIT runShortcut → false on 'metronome'
│   │   ├── links.svelte.ts, share.svelte.ts, instrument.svelte.ts   # EDIT narrow to FretboardToolId
│   ├── tools/
│   │   └── metronome/               # NEW  MetronomeLayout, MetronomePanel, ValueRow, StatusBox, RunControls (.svelte)
│   ├── shell/
│   │   ├── tools.ts                 # EDIT FretboardToolId, ToolId, 4th TOOLS entry
│   │   ├── screens.ts               # EDIT 'metronome' screen + title
│   │   ├── BarIcon.svelte           # EDIT metronome icon
│   │   ├── ShortcutList.svelte      # EDIT Space / Esc group
│   │   └── ToolLayout.svelte, ShareButton.svelte, TuningBadge.svelte, failure.ts  # EDIT types only (fault.ts keeps ToolId)
│   ├── prefs/schema.ts              # EDIT TOOL_IDS + 'metronome'
│   └── styles/tokens.css            # EDIT --color-danger(-text), --pill-min-inline, metronome sizes
├── routes/
│   ├── metronome/+page.svelte       # NEW
│   └── +layout.svelte               # EDIT beforeNavigate → metronome.screenChanged()
messages/{en,pt-BR,es}.json          # EDIT ≈24 keys each
lighthouserc.cjs                     # EDIT add /metronome
docs/adr/0030-metronome-click-scheduler.md   # NEW

tests/unit/
├── audio/click.test.ts, audio/metronome.test.ts      # NEW (fakes in audio/support/fake-audio.ts, extended)
├── metronome/{settings,view,keys,store,panel}.test.ts  # NEW
├── prefs/fixtures/last-tool-metronome.txt            # NEW fixture (added, never removed)
└── tools, screens, routes, reserved-colors, playback-host, shortcut-list, home-screen, app-nav tests  # EDIT
e2e/
├── metronome.spec.ts                # NEW flows, timing via __fmAudioLog, hidden page, fault
├── metronome-a11y.spec.ts           # NEW axe (3 views × 2 themes), keyboard-only, languages
└── home.spec.ts, navigation.spec.ts, about.spec.ts   # EDIT 4th card / nav / shortcut list
```

**Structure Decision**: This is the existing single SvelteKit project. Every directory above
already exists (`src/lib/audio`, `src/lib/state`, `src/lib/tools`, `src/lib/shell`,
`src/lib/prefs`, `src/lib/styles`, `src/routes`, `messages`, `tests/unit/audio`,
`tests/unit/prefs/fixtures`, `e2e`, `docs/adr`). Three new sub-directories follow existing
patterns: `src/lib/tools/metronome/` (like `src/lib/tools/caged/`), `src/routes/metronome/` (like
`src/routes/caged/`) and `tests/unit/metronome/` (like `tests/unit/caged/`). No new project or
package is added.

## Assumptions and rejected alternatives

| Decision (headless, no clarifier available) | Rejected alternative | Why |
|---|---|---|
| Lookahead scheduler on the engine's shared context, exposed via `engine.sink()` → `playback.clickSink()` | A new `'click'` `PlaybackRequest` kind | Requests are finite, and `halt()` on hidden/interrupt would stop the click (breaks FR-016) |
| 1.5 s horizon, 25 ms wake | AudioWorklet or Worker timer | Extra module/CSP surface. 1.5 s already meets SC-004 (C X YAGNI) |
| Own `MetronomeLayout`, `FretboardToolId` split | `ToolLayout` with guards | About 10 guards. Share/address effects would run for a tool with no link |
| No `measure.toolOpened('metronome')` this slice; `EVENT_TOOLS` unchanged | Extend the measurement wire allow-list | Changes the Pages Function contract (028) for an event the spec does not require. Can follow additively |
| Space/Esc always on (not gated by the character-key switch) | Gate them with `shortcuts.enabled` | WCAG 2.1.4 covers character keys only. These are the tool's transport keys |
| A separate, per-Start "sound unavailable" notice on the Metronome screen | Rely on the once-per-session global sound notice | The user may have dismissed the global one. FR-027 requires the notice on the run |
| `--color-danger` hex values in R-14 are starting points | Fixed values | Unit tests enforce contrast and ΔE. Values are tuned to pass |

## Complexity Tracking

No constitution violations require justification. The two C VII readings (destructive-control
red; no fretboard in a non-fretboard tool) are recorded in the Constitution Check above, as the
spec's clarifications require, for reviewer acknowledgement.
