# Implementation Plan: Alternate Two Ratios

**Branch**: `034-alternating-ratios` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/034-alternating-ratios/spec.md`

## Summary

Add a **SUBDIVISION RATIO** section (an `h3` in small caps with an on/off switch, on by default)
and a **Loop 2** dropdown (eight options, default Sextuplets) to the Ratios Training settings
view. When the section is on, a run plays Initial Count In → Loop 1 (*N* beats) → Repeat
Count In → Loop 2 (*N* beats) → Repeat Count In → Loop 1 … at one constant BPM. `SUB` always
shows the playing loop's clicks per beat, and a repeat count-in shows `COUNT IN n/r` with the
single pulsing dot. When the section is off, Loop 1 repeats with no repeat count-in, as in 033.
Pause and Resume keep the exact cycle position.

Technical approach (see [research.md](./research.md)):

- **Engine**: a new pure module `src/lib/audio/metronome-cycle.ts` describes the run as a
  prefix of *k* initial count-in slots and then a repeating cycle `Loop 1 (N) · Repeat (r) ·
  Loop 2 (N) · Repeat (r)` (or `Loop 1 (N)` when off). A slot is one beat of time. Click and
  slot indices map to times with integer division by the cycle length, and the time is
  `anchor + (slot − startSlot)·T + sub·T/n`. Nothing is accumulated, so switches have no gap
  and no drift by construction (R-01, R-02).
- **Segment start**: `SegmentStart` replaces `startBeat` and `countIn` with
  `initialCountIn`, `alternate: { clicksPerBeat, repeatCountIn }` and a run-global `startSlot`.
  Resume is `startSlot = lastSlot + 1` (R-03). Events and `halt()` carry a `SlotPosition`
  (loop, beat, count-in click and total, repeat flag). The change is additive for existing
  consumers (R-04). Skip-forward and the audible index work on the cycle in O(1) (R-05). The
  log entry gains `phase` and uses run-global `slot` (R-06).
- **State**: `MetronomeSettings` gains `ratio` (default `true`) and `loop2` (default `6`), with
  `toRatio`, `effectiveRepeatCountIn` and `runPlanFor`. The store keeps one `position:
  SlotPosition | null` instead of `stage`/`countInClick`/`countInTotal`, and exposes `sub`
  (R-07, R-08).
- **UI**: a new `RatioSettings.svelte` (an `h3` header with the global `.switch` labelled by
  the header, then Loop 1, then Loop 2 only when on). `SubdivisionSelect` gains `id`/`label`
  props. `StatusBox` receives the playing loop's `sub` (R-09).
- **Messages**: 5 new keys × en/pt-BR/es, glossary rows, and an ADR 0030 "Revision (034)"
  (R-10, R-12).
- **Existing tests**: 031–033 e2e specs whose assertions span more than one loop turn the
  section off with a new `ratioOff(page)` helper. The engine tests migrate to `startSlot`, and
  the "metronome views" screenshot is re-baselined in CI (R-11).

Assumptions where the spec left a technical choice open (alternatives are in research.md and
Complexity Tracking):

- `SegmentStart` drops `startBeat`/`countIn` instead of keeping a compatibility layer (R-03).
- The log `slot` becomes run-global and non-negative (R-06).
- The switch's accessible name comes from `aria-labelledby` on the `h3`, not from a separate
  message key (R-09).
- A pause on the last beat of a loop resumes straight into repeat click 1 within 50 ms (R-08).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Existing only: SvelteKit, Paraglide JS (messages), Web Audio API.
**No new runtime dependency.**

**Storage**: None. `ratio` and `loop2` are not remembered in this slice (FR-012). Slice
008-ratios-training/005 adds persistence, and their flat boolean/`Subdivision` form with
`toRatio`/`toSubdivision` is ready for it.

**Testing**:
- Vitest + fast-check: a new `metronome-cycle` table and property tests (BPM 30–300 × N 1–16 ×
  k, r 0–8 × n1, n2 1–8, ≥ 100 cycles), plus engine tests with the existing `FakeAudioPort` /
  `FakeClock` / `FakeFrames`.
- @testing-library/svelte (jsdom) for `RatioSettings` and the panel.
- Playwright desktop + @axe-core/playwright, reading the test-build `__fmAudioLog` `click`
  entries (new `phase` field).

**Target Platform**: Evergreen desktop browsers, windows 1024–2560 CSS px, zoom reflow to
320 CSS px (constitution 2.1.0, Principles V and VII).

**Project Type**: Static single-page web app (SvelteKit, prerendered)

**Performance Goals**:
- Every click within 2 ms of its ideal time. Phase boundary gap = 60/BPM ± 2 ms, with no drift
  after ≥ 100 cycles (SC-002). This is exact by construction: integer slots, one anchor.
- First click ≤ 50 ms after Start/Resume (FR-009).
- Status and dot update ≤ one animation frame after a slot's audible time (unchanged).
- `slotAt`/`clickAt`/`skipTo` are O(1) per call (at most 4 phases, ≤ 8 sub-steps).

**Constraints**:
- Initial JS ≤ 160 KB gzip. Expected growth < 2 KB, checked by `pnpm verify`.
- No sample files or network (Principle II). The accent, normal and sub buffers are reused.
- Colours, sizes and durations come only from tokens; no new token. Style lint applies (ADR 0028).
- `src/lib/audio` stays framework-free, and only `metronome.svelte.ts` creates the scheduler.

**Scale/Scope**:
- New: 1 audio module (`metronome-cycle.ts`) and 1 component (`RatioSettings.svelte`).
- Edited: 2 audio modules (`metronome.ts`, `types.ts`), 2 state modules (settings, store) and
  3 components (`MetronomePanel`, `SubdivisionSelect`, unchanged-markup `StatusBox` props).
- Messages: 5 new keys × 3 languages.
- Tests: 2 new unit test files and 1 new e2e spec. About 6 unit and 4 e2e specs are edited,
  and 1 screenshot is re-baselined.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passing, no
violations.*

### I. Musical Correctness

- [x] The beat grid stays exact across loop switches. Each loop's beat 1 lands exactly one beat
  after the previous phase's last click, and the tempo is constant, as a ratio exercise needs.
- [x] N/A for the table/property theory suites: no `src/lib/theory` change (no note, spelling,
  interval or shape is touched).

### II. On-Device, Static, Private

- [x] Clicks are the existing synthesized buffers, made in the browser. There are no samples,
  network calls, accounts, permissions or tracking.
- [x] Nothing is stored, and this slice adds no preference.

### III. Pure Core, Thin Shell

- [x] The cycle arithmetic is in the pure, framework-free `src/lib/audio/metronome-cycle.ts`.
  `toRatio`, `effectiveRepeatCountIn` and `runPlanFor` are pure in `src/lib/state`.
- [x] The run position (`SlotPosition`) lives in the metronome store, not in components.
- [x] N/A for fretboard/handedness rules: the Metronome has no fretboard.

### IV. Test-First for Logic, Tested Behaviour for UI

- [x] The cycle module, engine, settings and store changes are written test-first, with table
  and property tests (quickstart §1).
- [x] Every acceptance scenario (US1-1…6, US2-1…6, US3-1…4, US4-1…4) maps to a Vitest or
  Playwright case (quickstart §1–2).
- [x] Timing is verified only through the injectable clock, frames and fake audio port, or the
  test-build log; never real time.

### V. Accessible by Default

- [x] The `role="switch"` button is named "Subdivision ratio" via `aria-labelledby` and exposes
  `aria-checked`. The Loop 2 select has a `<label>`. Both are keyboard-operable with the
  standard focus ring, and targets use `--target-min` (44 px, above SC 2.5.8's 24 px).
- [x] When the section is off, the Loop 2 row is removed from the DOM, so it is not in the tab
  order or the accessibility tree.
- [x] Sound is not the only carrier: `SUB s` and `COUNT IN n/r` are real text, and the dots
  change. This works with sound unavailable or muted.
- [x] The switch state is not shown by colour alone: thumb position plus a visible On/Off word.
- [x] Reduced motion: the 033 pulse rule is reused. `prefers-contrast` and forced colours use
  token/system colours. axe reports zero violations on settings (on/off), loop and repeat
  count-in views.
- [x] Reflow to 320 CSS px with no horizontal scroll: the header row wraps and the selects are
  full width.

### VI. Performance Budgets

- [x] No new dependency. Estimated growth is < 2 KB gzip against the 160 KB budget, verified
  by the bundle-size check.
- [x] Per-tick work stays O(1), and pending sources stay within the 032 bound (≤ 60 at
  300 BPM × 8). Tool open and interaction budgets are unaffected.

### VII. Design System Fidelity

- [x] Tokens only: the global `.switch` family, the 032 select styling, and font/space tokens
  for the header. No new token, and no hard-coded colour for the "green" switch.
- [x] The main controls are visible on the settings view, not behind a menu. The tool opens in
  the spec's default state (section on, Loop 1 8th Triplets, Loop 2 Sextuplets).
- [x] There is no new motion beyond the 033 pulse, no reward mechanics and no modal. The
  existing sound-unavailable notice is reused.
- [x] Works from 1024 to 2560 CSS px without truncation, and the longer pt-BR/es header fits
  the 36 rem panel.
- [x] N/A for note-function shapes/colours and the four emphasis levels: there are no
  fretboard markers.

### VIII. International From the First Line

- [x] All 5 new strings are in `messages/{en,pt-BR,es}.json`, with no hard-coded text. Small
  caps comes from CSS, not uppercase strings.
- [x] Longer pt-BR/es texts are checked at 320 px and 200 % text zoom (quickstart 2.10).
- [x] N/A for note-name formatting and accidentals: no note names are shown (subdivision names
  come from the 032 message keys).

### IX. Untrusted Input, Versioned Formats

- [x] `toRatio` accepts booleans only (otherwise `true`), and Loop 2 goes through
  `toSubdivision` (otherwise 6). The engine's `toRunPlan` clamps every field. Nothing throws.
- [x] N/A for share links and stored formats: the Metronome has no share link and this slice
  persists nothing.

### X. Simplicity and Incremental Delivery

- [x] One scheduler and one grid, extended to a cycle; no second scheduler or chained
  segments. `SubdivisionSelect` gains props only now that it has its second real use (Loop 2).
- [x] Exactly two loops at one BPM, so there is no generic N-loop list, per-loop tempo or
  per-loop beat count (spec scope).
- [x] Fallback: if Web Audio is unavailable, the run is visual with the existing notice, and
  the cycle still drives `SUB` and the count-in view.

### Technology Stack and Workflow

- [x] Stays within the mandated stack (Svelte 5, Paraglide, Web Audio, plain CSS tokens,
  Vitest/Playwright).
- [x] ADR 0030 gets a "Revision (034 alternating ratios)" section. There is no new
  architectural decision (R-12).
- [x] Verification follows the tiers: targeted Vitest and `test:e2e:fast` per task, then
  `pnpm verify` once. Linux screenshot baselines come only from `update-snapshots.yml`, and
  by-ear checks are recorded as Manual checks (quickstart §5).

## Project Structure

### Documentation (this feature)

```text
specs/034-alternating-ratios/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-12
├── data-model.md        # Phase 1: settings, run plan, slot/click indexing, SlotPosition, store, view
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── click-engine-api.md     # metronome-cycle.ts, SegmentStart, events/halt, log entry
│   ├── metronome-store-api.md  # settings, store, view deltas
│   └── metronome-ui.md         # header/switch/Loop 2 DOM+ARIA, running view, messages
├── checklists/          # From specify/clarify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/audio/
├── metronome-cycle.ts               # NEW: RunPlan, toRunPlan, slotAt, slotStart, clickAt,
│                                    #      SlotPosition (pure)
├── metronome.ts                     # EDIT: SegmentStart (startSlot, initialCountIn, alternate),
│                                    #       cycle-based schedule/skipTo/audibleIndex,
│                                    #       onBeat/onCountIn(…, at), HaltedAt = SlotPosition
└── types.ts                         # EDIT: click log entry gains phase; slot run-global

src/lib/state/
├── metronome-settings.ts            # EDIT: ratio, loop2, toRatio, effectiveRepeatCountIn,
│                                    #       runPlanFor
├── metronome-view.ts                # (unchanged signatures; reused)
└── metronome.svelte.ts              # EDIT: position: SlotPosition, sub getter, setRatio,
                                     #       setLoop2, startSlot resume, announcements

src/lib/tools/metronome/
├── RatioSettings.svelte             # NEW: h3 header + switch, Loop 1, Loop 2 (when on)
├── SubdivisionSelect.svelte         # EDIT: id and label props
├── MetronomePanel.svelte            # EDIT: mount RatioSettings; pass metronome.sub to StatusBox
└── StatusBox.svelte                 # (markup unchanged)

messages/{en,pt-BR,es}.json          # EDIT: 5 new keys
docs/i18n/glossary.md                # EDIT: Subdivision ratio / Loop 2 rows (draft)
docs/adr/0030-metronome-click-scheduler.md  # EDIT: Revision (034 alternating ratios)

tests/unit/audio/metronome-cycle.test.ts     # NEW: table + property tests
tests/unit/audio/metronome.test.ts           # EDIT: migrate to startSlot; cycle cases
tests/unit/metronome/{settings,view,store,panel}.test.ts  # EDIT
tests/unit/metronome/ratio-settings.test.ts  # NEW (jsdom)

e2e/metronome-ratios.spec.ts         # NEW: US1–US4 from __fmAudioLog
e2e/support/helpers.ts               # EDIT: ratioOff(page)
e2e/metronome.spec.ts                # EDIT: ratioOff where needed; re-baseline "metronome views"
e2e/metronome-subdivisions.spec.ts   # EDIT: ratioOff where needed
e2e/metronome-count-in.spec.ts       # EDIT: run-global slot assertion; ratioOff where needed
e2e/metronome-a11y.spec.ts           # EDIT: axe with section on/off and during repeat count-in
```

**Structure Decision**: Single SvelteKit project. The feature extends the existing
`src/lib/audio`, `src/lib/state` and `src/lib/tools/metronome` modules from slices 031–033,
and uses `messages/`, `docs/`, `tests/unit/` and `e2e/` for catalogs, docs and tests. No new
top-level directory or route.

## Complexity Tracking

There are no constitution violations to justify. Design choices taken where the spec was
ambiguous:

| Decision | Why | Simpler / other alternative rejected because |
|---|---|---|
| Cyclic slot grid in a new pure `metronome-cycle.ts` (R-01, R-02) | Gap-free, drift-free switches by construction; one Pause/skip path; testable without fake audio | Chained per-phase segments add boundary jitter and a second Pause path; two schedulers can overlap |
| `startSlot` replaces `startBeat` + `countIn.from` (R-03) | One integer encodes loop, phase and beat or click; Resume is `last + 1` | A compatibility layer gives two ways to express one position (YAGNI); only the store and engine tests call it |
| Events keep their names and gain `SlotPosition` as a second argument (R-04) | Additive; existing consumers and tests unchanged | A single `onSlot` event renames every engine expectation for no behaviour gain |
| Log `slot` becomes run-global, non-negative (R-06) | Negative slots are undefined for repeat count-ins in later cycles | Keeping 033's negative slots cannot describe a repeat count-in |
| Switch named via `aria-labelledby` on the `h3` (R-09) | The name is exactly the translated header; no duplicate key | A separate `aria-label` key could drift from the visible header |
| Loop 2 hidden (not disabled) when off (spec clarification) | Follows the 033 Count In precedent | A disabled select stays in the accessibility tree, which the clarification rejects |
| Existing tests use `ratioOff(page)` / `ratio: false` (R-11) | They test single-loop behaviour that the new default would change after beat *N* | A test-only URL flag adds a product surface used only by tests |
