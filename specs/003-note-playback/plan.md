# Implementation Plan: Note Playback

**Branch**: `feature/003-note-playback` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-note-playback/spec.md`

## Summary

Make every fretboard position audible at its real pitch. A fretboard position played by pointer
or keyboard unlocks Web Audio on that same gesture. The note sounds at `positionPitch(instrument,
position)` converted to 12-TET frequency (A4 = 440 Hz) and is scheduled at the audio clock's
current time (≤ 100 ms). The sounding position pulses on the board for exactly the note's time
marks, and it still pulses when sound is muted or unavailable; under reduced motion the pulse is a
plain `highlighted` state. A sound control in every application bar offers mute, a 0–100 % volume
slider, and help that lists silent mode first. A Stop button appears while a sequence plays. A new
request, a hidden page, a route change, or an instrument change stops playback. If audio cannot
start, one notice per session appears and the control shows unavailable. The reusable playback API
takes `note` / `chord` / `sequence` requests in musical terms and returns time marks synchronously,
for later tools.

Technical approach (details in [research.md](./research.md)):

- **Synthesis** (R-01, R-02): an extended Karplus-Strong string written as a pure TypeScript
  render function. It uses seeded noise excitation with a pick-position comb, a decay-stretch loss
  filter with per-pitch loop gain, an all-pass fractional-delay tuning stage, and a baked
  2 ms/10 ms fade. It is rendered on the main thread into an `AudioBuffer` at request time. There
  is no AudioWorklet: a worklet would add a post-load request (ADR 0002 continuity, CSP). This
  render needs none.
- **Measurable timbre** (R-04–R-06): per-voice loudness normalization by A-weighted RMS (first
  500 ms). Offline Vitest suites check ±5 cents, ±3 dB, and the low-note harmonic share across
  A1–E6 at 44.1/48 kHz, using an independent analysis helper.
- **Graph and mixing** (R-07): buffer source → voice gain → volume gain (`(v/100)²`) → mute gain →
  destination. Chords and sequence steps are mixed in pure code with `1/√n` and a static peak
  limiter (≤ −1 dBFS), so "7 notes never clip" is proven offline.
- **Engine** (R-08–R-11): a lazy `AudioContext` created inside the first sound-asking gesture,
  `resume()` not awaited before scheduling, one active request, and 10 ms fade interruption. Pure
  `planRequest` produces the time marks, and sequences are scheduled sample-accurately on the
  audio clock. Unavailable is terminal and produces one notice. A device switch is not
  unavailable. The synth ships in the single bundle behind an injectable loader, which models the
  spec's loading/failed states and the 100 ms window.
- **State and UI** (R-12–R-15): `src/lib/state/playback.svelte.ts` (runes) holds mute, volume,
  availability, pulses, Stop visibility, and the notice flags. Pulses reach `Fretboard` through a
  new `pulses` prop that changes drawing only (names and live description untouched). New
  components: `SoundControl`, `StopButton`, and `PlaybackHost`. `Notice` is generalized to two
  uses.
- **Tests** (R-16): a fake `AudioPort` and a fake `TimerClock` for all timing logic. Test-build-only
  `__fmAudioFault` / `__fmAudioLog` hooks for Playwright under the ADR 0004 build flag, with the
  CI gate extended.

**Assumptions recorded** (spec silent; most defensible option chosen; the rejected alternative
follows each one):

- The clarification's "output limiter/compressor" is met by a **static peak limiter on the mixed
  buffer**. Rejected: `DynamicsCompressorNode` (cannot be tested offline, colours the attack,
  redundant once peaks are bounded) (R-07).
- Volume maps to gain with a squared taper (80 % → 0.64). Rejected: linear (50–100 % barely
  differ audibly) (R-07).
- A marker drawn as sounding becomes `highlighted` for the pulse in **both** motion modes.
  Rejected: keeping its original emphasis during the animated pulse (the modes would show
  different state) (R-12).
- Pulses are a separate `Fretboard` prop that affects drawing only. Rejected: merging pulses into
  `DisplayModel` (it would re-announce the live description and change cell names on every tap)
  (data-model §6).
- "Unavailable" is triggered only by a constructor throw, a `resume()` rejection, or a synth load
  rejection on the **first** unlock. Rejected: a resume timeout (false positives on slow devices)
  (R-09).
- The sound "material" is bundled code, so in production it is ready at once. The loading state
  exists only behind the loader seam (tests, fault hook). Rejected: a separately fetched worklet
  or chunk (post-load request, version skew) (R-10).
- The view-state stop trigger (FR-014) has no source yet: no view-state store exists until 004.
  The playback contract records the obligation for the future store. Rejected: inventing a
  view-state store now (Principle X) (R-15).
- The sound control also appears in the Home screen's top header, which plays the
  application-bar role there (design §layout zone A). Rejected: tool screens only (spec says
  "every screen showing the bar").

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) on Node.js 24.21.0 (build/test, pinned in `mise.toml`); Svelte 5 (runes)

**Primary Dependencies**: Runtime unchanged: `svelte` 5, `@sveltejs/kit` 2 (`adapter-static`, `bundleStrategy: 'single'`), `@inlang/paraglide-js` 2. Browser Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `GainNode`). **No new runtime or dev dependencies** (R-17): the DSP, A-weighting, PRNG, and test analysis are in-repo.

**Storage**: N/A. Mute and volume live in memory for the session only (FR-009). Nothing goes to `localStorage`, the URL, or the network. Persistence arrives in 003-your-instrument/002.

**Testing**: Vitest (jsdom) for pure DSP and analysis (offline renders), schedule, `applyPulses`, the engine with a fake `AudioPort` + fake `TimerClock`, runes state, and components (`@testing-library/svelte`). Playwright (phone 360, phone-touch 320, desktop; firefox/webkit smoke) with the test-build audio log/fault hooks and `@axe-core/playwright`. Lighthouse CI, `check-bundle-size.mjs`, and `check-no-fault-hook.mjs`.

**Target Platform**: Last two major versions of evergreen browsers, desktop and mobile (all ship `AudioContext`; Safari's `interrupted` state handled, R-09); static hosting on Cloudflare Pages.

**Project Type**: Static web application (SvelteKit, fully prerendered), single project at the repository root.

**Performance Goals**: Tap → note scheduled ≤ 100 ms after unlock (render of a 1.5 s voice ≈ < 1 ms desktop, a few ms on a 4× throttled phone; 7-voice chord well within budget). Synth preload runs in an idle callback after mount, with zero effect on fretboard interactivity (SC-007). Pulse start ≤ one frame after the request. Initial JS ≤ 80 KB gzip (estimate +5–7 KB). Lighthouse mobile ≥ 90.

**Constraints**: No `AudioContext` before a sound-asking gesture. Zero network requests after load (ADR 0002 continuity test, FR-016). CSP unchanged (`script-src 'self'`, `style-src 'self'`; the pulse duration is set through CSSOM only client-side). Every visual value is a token and every string is in the catalog. WCAG 2.2 AA, zero axe violations. 320–2560 px with only the board scrolling horizontally. Deterministic behavior tests only (no real-time audio measurement); the only wall-clock check is the constitution VI tap-to-sound budget gate in `e2e/perf.spec.ts` (4× CPU throttle, median), like the navigation gate.

**Scale/Scope**: Pitch range A1–E6 (56 pitches) × 2 sample rates in offline suites. 1 new `src/lib/audio` module (≈ 6 files), 1 new `src/lib/state` file, 1 new fretboard helper, 3 new shell components, 2 edited components (`Fretboard`, `Notice`), 5 edited hosts (`ToolLayout`, `ToolPlaceholder`, about page, `HomeScreen`, root layout). 14 catalog keys, 4 tokens, 1 ADR + 1 ADR amendment, about 10 new or extended unit suites, and 1 new e2e spec.

All Technical Context unknowns are resolved in research.md (R-01–R-18). No open unknowns remain.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check (before Phase 0): **PASS**. No principle is violated. The single tension, Principle
VII "motion duration from tokens" versus "the pulse lasts the note's duration", is resolved by the
design doc itself (motion table: "duration of the note"). The scale and opacity of the pulse are
tokens.

Post-design re-check (after Phase 1): **PASS**. data-model, contracts, and quickstart introduce no
deviation. The design choices discovered in Phase 1 (buffer render instead of worklet, pulses as
a drawing-only prop) were made specifically to keep ADR 0002, the CSP, and Principle V's live
region rules intact.

### I. Musical Correctness (NON-NEGOTIABLE)

- [x] Every note played matches the theory reference: pitch = open-string pitch + fret
  (`positionPitch`, TM-1), frequency via `frequencyOf` in theory with table + property tests (R-03).
- [x] Triad spelling: N/A. This slice spells nothing new; audio consumes pitch numbers, never
  spellings.
- [x] Computed from configuration: requests carry positions plus the instrument in use; pitches
  are never hard-coded. A non-standard injected instrument is tested (US1-3).
- [x] Theory merge gate: this slice adds only `frequencyOf` to `theory`. It ships with its
  table/property tests and passes the existing TM-1/TM-3 suites. Triad/CAGED suites are not
  introduced here (no such code).
- [x] Each note sounds at its calculated pitch: ±5 cents verified offline for A1–E6 at 44.1/48 kHz
  (FR-005, R-02, R-06).

### II. On-Device, Static, Private by Design

- [x] All synthesis runs in the browser (main-thread render + Web Audio); the server serves only
  static files.
- [x] No network after load: the synth is in the single bundle, with no worklet or sample fetch
  (R-01, R-10). The continuity spec and an offline e2e case verify it (FR-016, SC-008).
- [x] No accounts, identifiers, or personal data. Mute and volume stay in memory.
- [x] No third-party content; CSP unchanged.
- [x] No device permissions: audio *output* needs none, and the microphone stays blocked by
  `Permissions-Policy`.
- [x] Preferences in local storage: N/A. Nothing is persisted in this slice (FR-009); that comes
  in 003-your-instrument/002.
- [x] Anonymous measurement: N/A. No events are emitted (FR-022).

### III. Pure Core, Thin Shell

- [x] `src/lib/theory` stays pure (only arithmetic added). `src/lib/audio` pure parts (`pluck`,
  `loudness`, `schedule`) have no DOM or Svelte. New ESLint boundaries are in
  contracts/playback-api.md §4.
- [x] One-way flow: tap (control action) → `playback` state (pulses) → `pulses` prop → fretboard
  render. The fretboard does not import audio or state.
- [x] Tools don't calculate theory or draw: hosts call `playback.note(position, instrument)`.
  Pitch math lives in theory/instrument and drawing in the fretboard.
- [x] Handedness/orientation: untouched. Pulses are positions in musical terms, mapped to screen
  only inside the renderer.
- [x] Events in musical terms: playback consumes the `(string, fret)` from `onactivate`, with no
  coordinates.
- [x] View state outside tool components: playback state lives in `src/lib/state`. The view-state
  stop obligation is recorded for 004 (R-15).

### IV. Test-First for Logic, Tested Behavior for UI

- [x] Test-first modules: `theory` (`frequencyOf`), and audio `pluck` / `loudness` / `schedule` /
  `engine`, `fretboard/pulse`, and `state/playback`. Each suite is written and seen failing before
  its implementation (quickstart §3).
- [x] Every acceptance scenario is automated: US1 1–5, US2 1–4, US3 1–5, US4 1–4, US5 1–4, US6 1–4
  (26 scenarios) map to Vitest/Playwright rows in quickstart §3–§4. Edge cases (device switch,
  loading window, offline, reduced motion, other instruments) are included.
- [x] TM-9 screenshot fixtures: N/A. TM-9 covers triad/CAGED views; this slice adds only the
  grayscale sound-control state screenshot.
- [x] Deterministic: injectable `AudioPort` and `TimerClock`, seeded noise, and offline renders.
  No real-time audio in any test (clarification, R-16).
- [x] Bug fixes start with a failing test (standing rule; no bugs carried in).

### V. Accessible by Default (WCAG 2.2 AA)

- [x] Keyboard: Enter/Space activation plays like a tap. Mute, settings, slider, Stop, and Dismiss
  are native buttons or inputs. The disclosure closes on Escape with no focus trap (FR-010).
- [x] Focus visible: existing focus token on all new targets. Stop and Dismiss never drop focus to
  `body`.
- [x] Not color alone: the three sound states use distinct icon shapes plus labels; the pulse uses
  emphasis (opacity + size) plus motion. A grayscale screenshot verifies the states.
- [x] Touch targets ≥ 44 × 44 px (`--target-min`) for mute, settings, slider thumb row, Stop, and
  Dismiss.
- [x] Text description: unchanged and computed without pulses, so taps don't spam the polite live
  region (data-model §6).
- [x] `prefers-reduced-motion`: the pulse becomes a plain `highlighted` switch for the same
  interval (FR-008). `prefers-contrast: more` strengthens the panel border.
- [x] Sound never the only carrier: every sounding position pulses visually even when muted or
  unavailable (FR-007, FR-020).
- [x] Accidentals read in full: N/A for new text (no note names added); existing cell names
  unchanged.
- [x] axe zero violations on the control, the open panel, Stop, and the notice (SC-009).

### VI. Performance Budgets Are Gates

- [x] Home ≤ 3 s / Lighthouse ≥ 90: no work at load beyond an idle-callback preload with no
  `AudioContext`; lhci re-run.
- [x] Tool open/switch ≤ 300 ms: unchanged path; `perf.spec.ts` re-run.
- [x] Control change → fretboard update ≤ 100 ms: the pulse is a reactive prop update on the same
  keyed marker layer.
- [x] Instrument change ≤ 300 ms: N/A. There is no instrument-change UI yet; `stop('instrument')`
  is O(active voices).
- [x] Tap → sound ≤ 100 ms after unlock: scheduled at `ctx.currentTime` with no look-ahead,
  verified with the injected clock (SC-001). The render cost is bounded (R-01). CI gate: a
  4× CPU-throttled tap-to-sound median ≤ 100 ms case in `e2e/perf.spec.ts` (T082); a regression
  fails the build.
- [x] Initial JS ≤ 80 KB gzip: `check-bundle-size.mjs`, estimate +5–7 KB (R-10).
- [x] Sound material never blocks interactivity: the synth preload is idle-scheduled and creates
  no context (FR-017, SC-007).
- [x] Smooth scrolling: no scroll-path changes. The pulse is a CSS transform on one marker.
- [x] Regressions fail the build; no budget raised.

### VII. Design System Fidelity

- [x] Fretboard is the protagonist: the control sits in the app bar (zone A), the panel opens in
  the bar flow, and nothing overlays the board.
- [x] Simplest state: sound on at 80 %, panel closed, no Stop.
- [x] Main controls not behind a menu: mute is always visible. Only volume and help sit in the
  disclosure (clarification).
- [x] Note-function code unchanged. A transient marker uses the existing `neutral` shape.
- [x] Root/third/fifth colors not reused: the new icons use text and accent tokens only
  (`reserved-colors.test.ts`).
- [x] All visual values are tokens (`--pulse-scale`, `--pulse-opacity-peak`, `--sound-panel-width`,
  `--icon-size`). The pulse duration is data (the note length) per the design doc motion table.
- [x] Position state only via the four emphasis levels: a pulse = `highlighted` plus a motion
  token.
- [x] Notices: one non-blocking, dismissible, ≤ 2-line notice in notice tokens with no error red
  (reused `Notice`).
- [x] No rewards, mascots, or tutorials.
- [x] 320–2560 px: the header wraps and only the board scrolls (e2e at 320/360/1280).
- [x] Motion explains change: only the sounding marker moves, once, for the note's duration.

### VIII. International From the First Line

- [x] All 14 new strings live in `messages/en.json` (contracts/sound-control-ui.md §5). The volume
  value uses a placeholder template.
- [x] Note names only from `src/lib/notation`: N/A, no note names produced by audio or UI here.
- [x] Accidental glyphs: N/A, no accidentals in the new strings.
- [x] Layout handles longer PT/ES strings and 200 % zoom: labels are visually hidden or wrap; the
  help panel wraps; the notice is checked at 320 px.
- [x] New language = new catalog file only.

### IX. Untrusted Input, Versioned Formats

- [x] Share links / stored preferences: N/A. None are read or written (state is in memory).
- [x] Format versions / link fixtures: N/A. No format introduced.
- [x] No input rendered as HTML: the only external inputs are the test-build globals
  (`__fmAudioFault` from an enum allow-list; `__fmAudioLog` write-only). Both are absent from
  production and CI-gated (contracts/test-hooks.md).

### X. Simplicity and Incremental Delivery

- [x] Third slice of wave 001-mvp, shippable alone: every tool screen plays notes; later tools
  reuse the API.
- [x] No speculative abstractions: the `chord`/`sequence` API is required by the spec (FR-018,
  US6) for named later tools. `Notice` is generalized only now that it has two uses. `AudioPort`
  and `SynthLoader` are seams mandated by Principle IV (injectable audio context).
- [x] Runtime dependencies: none added (R-17).
- [x] Never blank: audio failure → one notice + unavailable state + pulses keep working (adjust
  and tell, FR-015).

### Stack & Workflow gates

- [x] Stack: Web Audio API, synthesized plucked string (Karplus-Strong) in `src/lib/audio`,
  unlocked on the first gesture, exactly per the "Audio" row. Svelte 5 runes store in
  `src/lib/state`. Plain CSS tokens. Vitest + Playwright + axe.
- [x] No stack replacement, so no constitution amendment is needed.
- [x] Tooling unchanged (`mise.toml`); no new packages.
- [x] Merge gate: lint (new audio/state boundaries), format, svelte-check, Vitest coverage
  (theory ≥ 95 %, overall ≥ 80 %), Playwright phone/desktop with axe, bundle size, Lighthouse,
  no-fault-hook.
- [x] ADRs: new `docs/adr/0007-main-thread-karplus-strong-playback.md` (R-18); ADR 0004 amended for
  the audio hooks.
- [x] Conventional Commits; branch `feature/003-note-playback` via PR with preview deployment.

## Project Structure

### Documentation (this feature)

```text
specs/003-note-playback/
├── plan.md                    # This file
├── research.md                # Phase 0 output (R-01 – R-18)
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output (validation guide)
├── contracts/                 # Phase 1 output
│   ├── playback-api.md        # Pure modules, engine, playback state, caller obligations, lint boundaries
│   ├── sound-control-ui.md    # SoundControl / StopButton / notice DOM+ARIA, pulse rendering, catalog keys, tokens
│   └── test-hooks.md          # __fmAudioFault / __fmAudioLog (test builds only)
├── checklists/
│   └── requirements.md        # From /speckit.specify
└── tasks.md                   # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

Existing paths are marked `(edit)`. Everything else is new.

```text
eslint.config.js                      (edit) boundaries for src/lib/audio, src/lib/state; fretboard ↛ audio/state
messages/en.json                      (edit) +14 sound/playback keys
scripts/check-no-fault-hook.mjs       (edit) needles __fmAudioFault, __fmAudioLog
src/
├── app.d.ts                          (edit) __fmAudioFault / __fmAudioLog globals
├── routes/
│   ├── +layout.svelte                (edit) <PlaybackHost/>, beforeNavigate → playback.stop('navigate')
│   └── about/+page.svelte            (edit) <SoundControl/> + <StopButton/> in the app bar
├── lib/
│   ├── theory/
│   │   └── pitch.ts                  (edit) frequencyOf
│   ├── audio/                        # new module (constitution source layout)
│   │   ├── types.ts                  # PlaybackRequest, TimeMark, Plan, Synth, SynthLoader
│   │   ├── schedule.ts               # planRequest, clampBpm (pure)
│   │   ├── pluck.ts                  # extended Karplus-Strong renderVoice + mixVoices (pure)
│   │   ├── loudness.ts               # A-weighting IIR + aWeightedRms (pure)
│   │   ├── prng.ts                   # mulberry32 (pure, seeded excitation)
│   │   └── engine.ts                 # AudioPort graph, unlock, interrupt, pulses timers, test-build log/fault
│   ├── state/                        # new module (constitution source layout)
│   │   └── playback.svelte.ts        # runes state + facade over the engine
│   ├── fretboard/
│   │   ├── types.ts                  (edit) Pulse, FretboardProps.pulses
│   │   ├── pulse.ts                  # applyPulses (pure)
│   │   └── Fretboard.svelte          (edit) draws pulses (keyed, .pulse, --pulse-duration)
│   ├── shell/
│   │   ├── SoundControl.svelte       # mute + settings disclosure (volume, help) + notice slot
│   │   ├── StopButton.svelte
│   │   ├── PlaybackHost.svelte       # preload on idle, visibilitychange/pagehide → stop
│   │   ├── Notice.svelte             (edit) generic message/ondismiss
│   │   ├── ToolLayout.svelte         (edit) SoundControl + StopButton in header
│   │   ├── ToolPlaceholder.svelte    (edit) onactivate → playback.note; pulses prop; instrument-change stop
│   │   └── HomeScreen.svelte         (edit) SoundControl + StopButton in header.top
│   └── styles/
│       └── tokens.css                (edit) --pulse-scale, --pulse-opacity-peak, --sound-panel-width, --icon-size
src/routes/[...unknown]/+page.svelte  (edit) Notice message prop
tests/unit/
├── theory/pitch.test.ts              (edit) frequencyOf table + property
├── audio/
│   ├── support/analysis.ts           # independent zoom-DFT pitch, FFT-domain A-weighted RMS, harmonic share
│   ├── support/analysis.test.ts      # self-test of the analysis helpers
│   ├── support/fake-audio.ts         # recording fake AudioPort + fake TimerClock
│   ├── pluck.test.ts
│   ├── loudness.test.ts
│   ├── prng.test.ts
│   ├── schedule.test.ts
│   └── engine.test.ts
├── fretboard/pulse.test.ts
├── fretboard/fretboard.test.ts       (edit) pulses prop
├── state/playback.test.ts
├── sound-control.test.ts
├── stop-button.test.ts
├── playback-host.test.ts
├── tool-placeholder.test.ts          # onactivate wiring, pulses, instrument-change stop
├── home-screen.test.ts               (edit) header controls
├── tool-layout.test.ts               (edit) header controls
├── routes.test.ts                    (edit)
├── version.test.ts                   (edit)
├── no-fault-hook.test.ts             (edit) audio needles
└── notice.test.ts                    (edit)
e2e/
├── playback.spec.ts                  # US1–US5 flows via audio log/fault hooks, axe, grayscale states
└── support/helpers.ts                (edit) injectAudioFault, readAudioLog
docs/adr/
├── 0004-test-only-fault-injection.md (edit) audio hooks amendment
└── 0007-main-thread-karplus-strong-playback.md
```

**Structure Decision**: Single static web project at the repository root, continuing the layout
that 001/002 established. These directories exist today: `src/lib/{theory,instrument,notation,fretboard,shell,styles}`,
`src/routes`, `messages/`, `tests/unit/{theory,instrument,notation,fretboard}`, `e2e/`,
`scripts/`, `static/`, and `docs/adr/`. This slice creates two constitution-listed modules for
their first real use: `src/lib/audio` (synthesis, scheduling, engine) and `src/lib/state` (the
playback runes store, the first app-wide state). It also adds `tests/unit/audio/` and
`tests/unit/state/` under the existing Vitest include glob `tests/unit/**/*.test.ts`. `link` and
`prefs` still wait for their slices (Principle X). No routes are added. App-bar placement edits
the three existing headers (`ToolLayout`, about page, `HomeScreen`).

## Complexity Tracking

No constitution violations. The table records the deliberate interpretations a reviewer should
approve (from the Summary's assumptions), not violations.

| Decision | Why Needed | Simpler / Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Static peak limiter on the mixed buffer stands in for the clarification's "limiter/compressor" | Makes FR-021 provable offline in Vitest | `DynamicsCompressorNode`: not runnable in jsdom, colours attacks, redundant once peaks ≤ −1 dBFS |
| Synth bundled, behind an injectable `SynthLoader` with loading/failed states | FR-017 and US5-4 require modeling load delay and failure, while ADR 0002 forbids post-load requests | A separate worklet/chunk fetch: breaks the continuity/version-skew guarantees and needs a CSP change |
| `pulses` as a separate drawing-only `Fretboard` prop | Keeps the live description and cell names stable (Principle V) while satisfying FR-007 | Merging into `DisplayModel`: re-announces on every tap and leaks transient playback state into tool models |
| View-state stop trigger deferred to 004 as a contract obligation | No view-state store exists yet; FR-014 is otherwise met for route and instrument changes | Creating a view-state store now: speculative abstraction (Principle X) |
