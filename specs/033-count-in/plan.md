# Implementation Plan: Count In

**Branch**: `033-count-in` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/033-count-in/spec.md`

## Summary

Add a **Count In** switch (on by default) to the Ratios Training settings view, with
**Initial Count In** (0–8, default 4) and **Repeat Count In** (0–8, default 2) rows shown only
when it is on. Starting training with *k* = Initial Count In > 0 plays *k* accented clicks one
beat apart at the running BPM, shown by a single pulsing dot and `COUNT IN n/k`; the first
loop's beat 1 follows exactly one beat after the last count-in click. Pause/Resume during the
count-in continue from the frozen click; Resume after the loop started never plays a new
count-in. Repeat Count In is stored only (its playback is slice 008-ratios-training/004).

Technical approach (see [research.md](./research.md)):

- **Engine** (`src/lib/audio/metronome.ts`): one combined integer grid per segment: *r*
  remaining count-in clicks at `anchor + c × T`, then loop click *j* at
  `anchor + r × T + j × T / n`. Count-in slots are negative (−r … −1) so the 032 per-slot
  reporting, Pause and skip-forward rules extend without a second code path. New optional
  `SegmentStart.countIn: { from, total }`, new `onCountIn(click)` event, `halt()` returns a
  `HaltedAt` union. No `countIn` reproduces 032 exactly (R-01 – R-05).
- **State**: `MetronomeSettings` gains `countIn`, `initialCountIn`, `repeatCountIn` with
  `clampCount` (NaN → default) and `effectiveCountIn`; the store tracks `stage`,
  `countInClick`, `countInTotal`, freezes on `HaltedAt`, and resumes with `{ from, total }`
  only during the count-in stage (R-06, R-07).
- **UI**: new `CountInSettings.svelte` (global `.switch` family + two reused `ValueRow`s, rows
  removed from the DOM when off) between # of Beats and Loop 1; `StatusBox` shows
  `COUNT IN n/k` without the `· SUB` part and one dot that pulses via a CSS keyframe remounted
  per click (`--duration-base`, new `--metronome-pulse-scale` token, `animation: none` under
  reduced motion) (R-08, R-09).
- **Messages**: 14 new keys × en/pt-BR/es (labels, −/+ names, status, three announcements);
  glossary rows; ADR 0030 "Revision (033)" (R-10, R-12).
- **Existing tests**: 031/032 e2e specs that assert the loop's first click switch Count In off
  through a helper; the "metronome views" screenshot is re-baselined in CI (R-11).

Assumptions taken where the spec left a technical choice open (alternatives in research.md):
`halt()` changes its return type to a union rather than keeping a number (R-03); the switch shows
a visible On/Off word with its own metronome keys rather than reusing CAGED's (R-10); a paused
state after the last count-in click resumes straight into loop beat 1 within 50 ms (R-06);
the pulse is a 200 ms CSS scale keyframe to 1.25 (R-09).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Existing only: SvelteKit, Paraglide JS (messages), Web Audio API.
**No new runtime dependency.**

**Storage**: None. The three count-in settings are not remembered in this slice (FR-013;
slice 008-ratios-training/005 adds persistence); their flat integer/boolean form is ready for it.

**Testing**: Vitest + fast-check (combined-grid property over BPM 30–300 × k 0–8 × n 1–8,
Pause/Resume/skip-forward cases with the existing `FakeAudioPort` / `FakeClock` / `FakeFrames`);
@testing-library/svelte (jsdom) for the panel and `CountInSettings`; Playwright desktop +
@axe-core/playwright reading the test-build `__fmAudioLog` `click` entries (new `countIn` field).

**Target Platform**: Evergreen desktop browsers, windows 1024–2560 CSS px, zoom reflow to
320 CSS px (constitution 2.x, Principle VII).

**Project Type**: Static single-page web app (SvelteKit, prerendered)

**Performance Goals**:
- Every count-in and loop click within 2 ms of its ideal grid time; last count-in → beat 1 gap
  = 60/BPM ± 2 ms (SC-002), exact by construction (integer index, one anchor).
- First click (count-in or beat) ≤ 50 ms after Start/Resume (FR-007, SC-003).
- Dot/status update ≤ one animation frame after the click's audible time (unchanged).
- Pulse ≤ 200 ms (one beat at 300 BPM).

**Constraints**:
- Initial JS ≤ 160 KB gzip (151.2 KB after 032; expected growth < 2 KB, checked by `pnpm verify`).
- No sample files or network (C II); accent buffer reused.
- Colours, durations and sizes only from tokens; style lint (ADR 0028).
- `src/lib/audio` stays framework-free; only `metronome.svelte.ts` creates the scheduler.

**Scale/Scope**:
- 1 new component (`CountInSettings.svelte`), 1 new token.
- Edits to 2 audio modules (`metronome.ts`, `types.ts`), 3 state modules, 2 components.
- 14 new message keys × 3 languages.
- 1 new unit test file, 1 new e2e spec; 6 unit and 3 e2e specs edited; 1 screenshot re-baselined.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passing, no
violations.*

### I. Musical Correctness

- [x] Count-in timing is exact on the beat grid (`anchor + i × 60/BPM`), and the loop's beat 1
  lands exactly one beat after the last count-in click, as a musician's count-in requires.
- [x] N/A for table/property theory suites: no `src/lib/theory` change (no note, spelling,
  interval or shape is touched).

### II. On-Device, Static, Private

- [x] Clicks are the existing in-browser synthesized accent buffer; no samples, network,
  accounts, permissions or tracking.
- [x] Nothing is stored; no new preference in this slice.

### III. Pure Core, Thin Shell

- [x] Grid maths (`clickAt`, `skipTo`) stay pure and framework-free in `src/lib/audio`;
  `clampCount`, `effectiveCountIn`, `statusParams`, `countInDot` are pure in `src/lib/state`.
- [x] Run state (stage, count-in click) lives in the metronome store, not in components.
- [x] N/A for fretboard/handedness rules: the Metronome has no fretboard.

### IV. Test-First for Logic, Tested Behaviour for UI

- [x] Engine grid, settings, view and store changes are written test-first (quickstart §1).
- [x] Every acceptance scenario (US1-1…5, US2-1…7, US3-1…4, US4-1…2) maps to a Vitest or
  Playwright case (quickstart §1–2).
- [x] Timing verified only through the injectable clock, frames and fake audio port, or the
  test-build log; never real time.

### V. Accessible by Default

- [x] `role="switch"` button named "Count In" with `aria-checked`; sliders and −/+ named;
  keyboard-operable; standard focus ring; targets `--target-min` (44 px ≥ SC 2.5.8's 24 px).
- [x] Hidden rows are removed from the DOM (not reachable by keyboard or AT).
- [x] Sound is not the only carrier: `COUNT IN n/k` is real text and the dot changes state;
  works with sound unavailable or muted.
- [x] Switch state not by colour alone: thumb position plus a visible On/Off word.
- [x] `prefers-reduced-motion`: no pulse animation, state change only; `prefers-contrast` and
  forced colours use token/system colours; axe zero violations on settings (on/off) and
  running (count-in) views.
- [x] Reflow to 320 CSS px with no horizontal scroll (031 `ValueRow` narrow rule; status
  `nowrap` parts).

### VI. Performance Budgets

- [x] No new dependency; estimated < 2 KB gzip growth against the 160 KB budget, verified by
  the bundle-size check.
- [x] At most 8 extra pending sources within the 1.5 s horizon; per-tick work unchanged in kind.
  Tool open/interaction budgets unaffected.

### VII. Design System Fidelity

- [x] Tokens only: the global `.switch` family, `ValueRow`, dot tokens, `--duration-base`,
  `--ease-standard`, and one new `--metronome-pulse-scale` token; style lint applies.
- [x] Main controls visible on the settings view, not behind a menu; the tool opens in its
  default state (Count In on, 4, 2 per the spec's defaults).
- [x] Motion (≤ 200 ms pulse) explains the click and stays within the documented durations; no
  reward mechanics, no modal; existing sound-unavailable notice reused.
- [x] Works 1024–2560 CSS px without truncation (longer pt-BR/es labels fit the 36 rem panel).
- [x] N/A for note-function shapes/colours and the four emphasis levels: no fretboard markers.

### VIII. International From the First Line

- [x] All 14 new strings in `messages/{en,pt-BR,es}.json`; no hard-coded text; adding a
  language needs only catalogs.
- [x] Longer pt-BR/es labels checked at 320 px and 200 % text zoom (quickstart 2.13–2.14).
- [x] N/A for note-name formatting and accidentals: no note names shown.

### IX. Untrusted Input, Versioned Formats

- [x] Slider values are clamped by `clampCount` (NaN → default) and the switch accepts booleans
  only; the engine validates `countIn` and falls back to none. Nothing throws.
- [x] N/A for share links and stored formats: the Metronome has no share link and this slice
  persists nothing.

### X. Simplicity and Incremental Delivery

- [x] Extends the existing grid with a prefix instead of adding a second scheduler; reuses
  `ValueRow` and the global switch family.
- [x] `repeatCountIn` is stored but has no behaviour, as the spec (US4, FR-013) requires; no
  speculative repeat-count-in playback (slice 004).
- [x] Fallback: Web Audio unavailable → visual run with the existing notice, count-in still
  shown (E9).

### Technology Stack and Workflow

- [x] Stays within the mandated stack (Svelte 5, Paraglide, Web Audio, plain CSS tokens,
  Vitest/Playwright).
- [x] ADR 0030 gets a "Revision (033 count-in)" section; no new architectural decision (R-12).
- [x] Verification follows the tiers: targeted Vitest and `test:e2e:fast` per task, `pnpm
  verify` once; Linux screenshot baselines only via `update-snapshots.yml`; by-ear checks
  recorded as Manual checks (quickstart §5).

## Project Structure

### Documentation (this feature)

```text
specs/033-count-in/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-12
├── data-model.md        # Phase 1: settings, run stage, combined grid, HaltedAt, display model
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── click-engine-api.md     # metronome.ts / log entry deltas
│   ├── metronome-store-api.md  # settings, view, store deltas
│   └── metronome-ui.md         # switch/rows DOM+ARIA, single dot, status, messages, tokens
├── checklists/          # From specify/clarify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/audio/
├── metronome.ts                     # EDIT: countIn prefix on the grid, signed slots,
│                                    #       onCountIn, HaltedAt, combined skipTo
└── types.ts                         # EDIT: click log entry gains countIn

src/lib/state/
├── metronome-settings.ts            # EDIT: countIn/initialCountIn/repeatCountIn, clampCount,
│                                    #       effectiveCountIn, SettingField widened
├── metronome-view.ts                # EDIT: count-in StatusParams variants, countInDot
└── metronome.svelte.ts              # EDIT: stage/countInClick/countInTotal, setters,
                                     #       pause/resume rules, announcements

src/lib/tools/metronome/
├── CountInSettings.svelte           # NEW: Count In switch + Initial/Repeat ValueRows
├── MetronomePanel.svelte            # EDIT: mount CountInSettings; pass countIn to StatusBox
└── StatusBox.svelte                 # EDIT: COUNT IN n/k, single pulsing dot

src/lib/styles/tokens.css            # EDIT: --metronome-pulse-scale
messages/{en,pt-BR,es}.json          # EDIT: 14 new keys
docs/i18n/glossary.md                # EDIT: Count In / Initial / Repeat rows (draft)
docs/adr/0030-metronome-click-scheduler.md  # EDIT: Revision (033 count-in)

tests/unit/audio/metronome.test.ts
tests/unit/metronome/{settings,view,store,keys,panel}.test.ts
tests/unit/metronome/count-in-settings.test.ts   # NEW

e2e/metronome-count-in.spec.ts       # NEW: US1–US4 scenarios from __fmAudioLog
e2e/support/helpers.ts               # EDIT: countInOff(page)
e2e/metronome.spec.ts                # EDIT: count-in off where testing the loop; re-baseline "metronome views"
e2e/metronome-subdivisions.spec.ts   # EDIT: count-in off where testing the loop
e2e/metronome-a11y.spec.ts           # EDIT: axe with switch on/off and during count-in
```

**Structure Decision**: Single SvelteKit project. The feature extends the existing
`src/lib/audio`, `src/lib/state`, `src/lib/tools/metronome` and `src/lib/styles` modules from
slices 031/032, with `messages/`, `docs/`, `tests/unit/` and `e2e/` for catalogs, docs and
tests. No new top-level directory or route.

## Complexity Tracking

No constitution violations to justify. Design choices taken under spec ambiguity:

| Decision | Why | Simpler / other alternative rejected because |
|---|---|---|
| One combined grid with negative count-in slots (R-01) | Boundary gap exact by construction; Pause/skip-forward reuse 032 paths | Chained segments add jitter at the boundary and a second Pause path |
| `halt()` returns `HaltedAt` union instead of a number (R-03) | Store must freeze on a count-in click, not only a beat | Relying on the last frame event can lag the audio by a frame (why 031 made `halt` return the audible beat) |
| Optional `SegmentStart.countIn` (R-04) | Absent = exactly 032; existing callers and tests unchanged | Required fields would touch every test call for no gain |
| Separate start-announcement key with count-in (R-10) | Keeps the no-count-in announcement byte-identical to 032 (FR-016) | A conditional placeholder needs Paraglide variants for one case |
| Own `metronome_switch_on/off` keys instead of CAGED's (R-10) | Messages stay per tool | Cross-tool reuse couples wording of unrelated tools |
| Pause after the last count-in click resumes straight into loop beat 1 within 50 ms (R-06) | Consistent with the 031 Resume rule ("next due item at once") | Waiting one beat would add a silent gap the user never asked for |
| Existing 031/032 e2e tests switch Count In off via a helper (R-11) | They test the loop; the new default would otherwise shift their timing | A test-only URL flag would add a product switch used only by tests |
