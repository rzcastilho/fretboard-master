# Implementation Plan: Subdivisions

**Branch**: `032-subdivisions` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/032-subdivisions/spec.md`

## Summary

Add a **Loop 1** subdivision dropdown to the Ratios Training (Metronome) settings view and make
the 031 click engine play evenly spaced soft clicks inside each beat. The eight options are
identified by their clicks per beat (1–8, default 3 = 8th Triplets). While running, each beat
plays its usual click (accent on beat 1, normal on beats 2…N) followed by *n* − 1 soft clicks;
the status line reads `BEAT 2/4 · SUB 3`; dots still move once per beat.

Technical approach (see [research.md](./research.md)):

- **Engine** (`src/lib/audio/metronome.ts`): keep one integer click index `j` per segment and
  schedule click `j` at `anchor + (j × 60/BPM) / n`. `j mod n = 0` is a beat click, else a soft
  click. Beats are reported per slot `floor(j / n)`, so soft clicks never move the dots; Pause
  stops every pending source (soft included) and freezes on the slot's beat; skip-forward lands
  on the next due grid click. With `n = 1` the sequence is exactly 031's (R-01, R-02, R-04).
- **Sound** (`src/lib/audio/click.ts`): third `ClickKind` `'sub'`: 2400 Hz sine burst, peak 0.25
  (≤ half of normal's 0.55), 18 ms long (≤ 20 ms), so 25 ms spacing at 300 BPM × 8 stays
  distinct; accent/normal unchanged (R-03).
- **State**: `MetronomeSettings.subdivision: Subdivision` (1–8), `metronome.setSubdivision()`
  in the settings phase only; Reset keeps it, leaving the route restores the default; start
  announcement names it (R-05, R-08).
- **UI**: new `SubdivisionSelect.svelte` (native `<select>`, visible label as accessible name,
  token-only scoped styles, decorative `currentColor` chevron, native arrow in forced colours),
  placed between # of Beats and Start Training; `StatusBox` appends ` · SUB n` with wrap only at
  the separator (R-06, R-07).
- **Messages**: 11 new keys × en/pt-BR/es plus the changed start announcement; glossary rows
  for the eight names (R-08).

Assumptions taken where the spec left a technical choice open (alternatives in research.md):
the soft click's exact pitch/peak/length (2400 Hz / 0.25 / 18 ms, within the spec's bounds);
scoped select styles rather than a new ADR 0028 control family (single use); the ADR 0030
revision instead of a new ADR.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Existing only: SvelteKit, Paraglide JS (messages), Web Audio API.
**No new runtime dependency.**

**Storage**: None. The subdivision is not remembered (FR-012, FR-016); its integer form is
ready for slice 005.

**Testing**: Vitest + fast-check (grid property over BPM 30–300 × n 1–8 for 10 minutes, Pause
and skip-forward cases with the existing `FakeAudioPort` / `FakeClock` / `FakeFrames`);
@testing-library/svelte (jsdom) for the panel; Playwright desktop + @axe-core/playwright reading
the test-build `__fmAudioLog` `click` entries (new `kind`, `slot` fields).

**Target Platform**: Evergreen desktop browsers, windows 1024–2560 CSS px, zoom reflow to
320 CSS px (constitution 2.0.0).

**Project Type**: Static single-page web app (SvelteKit, prerendered)

**Performance Goals**:
- Every click (beat or soft) scheduled within 2 ms of `anchor + j·(60/BPM)/n`, exact by
  construction, no drift over 10 minutes.
- 300 BPM × 32nds: 40 clicks/s, none dropped, merged or cut off (soft click 18 ms < 25 ms gap).
- First click ≤ 50 ms after Start/Resume (unchanged).
- Dot/status update ≤ one animation frame after the beat click's audible time (unchanged).

**Constraints**:
- Initial JS ≤ 150 KB gzip (expected growth < 1.5 KB, measured by `pnpm verify`, R-10).
- No sample files or network (C II).
- Colours only from tokens; style lint (ADR 0028).
- `src/lib/audio` stays framework-free; only `playback.svelte.ts` imports the engine.

**Scale/Scope**:
- 1 new component (`SubdivisionSelect.svelte`), 1 new state module
  (`metronome-subdivision-names.ts`).
- Edits to 2 audio modules + types, 3 state modules, 2 components.
- 11 new message keys × 3 languages + 1 changed key.
- 1 new e2e spec, 2 edited e2e specs, 1 screenshot test re-baselined.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passing, no
violations.*

### I. Musical Correctness

- [x] Subdivision counts and names match standard terminology (8th triplet = 3, quintuplet = 5,
  sextuplet = 6, septuplet = 7, 32nd = 8 per beat); timing is exact `j/n` of the beat.
- [x] N/A for table/property theory suites: no `src/lib/theory` change (no spelling, interval or
  shape touched).

### II. On-Device, Static, Private

- [x] The soft click is synthesized in the browser; no sample files, network, accounts,
  permissions or tracking.
- [x] Nothing is stored; no new preference.

### III. Pure Core, Thin Shell

- [x] Grid maths (`clickAt`, `skipTo`) and click synthesis stay pure and framework-free in
  `src/lib/audio`; settings/view helpers stay pure in `src/lib/state`.
- [x] View state (the subdivision) lives in the metronome store, not the component.
- [x] N/A for fretboard/handedness rules: the Metronome has no fretboard.

### IV. Test-First for Logic, Tested Behaviour for UI

- [x] `click.ts`, `metronome.ts` grid, `metronome-settings.ts` and `metronome-view.ts` changes
  are written test-first (quickstart §1).
- [x] Every acceptance scenario (US1-1…5, US2-1…5, US3-1…4) maps to a Vitest or Playwright case
  (quickstart §1–2).
- [x] Timing verified only through the injectable clock, frames and fake audio port, or the
  test-build log; never real time.

### V. Accessible by Default

- [x] Native `<select>`: full keyboard operation, visible label "Loop 1" as accessible name,
  standard focus ring, target ≥ `--target-min` (≥ 24 px, SC 2.5.8).
- [x] Sound is not the only carrier: the status line shows `SUB n` as text and the dots show
  the beat; works with sound unavailable.
- [x] Reflow to 320 CSS px: select shrinks with the column, status wraps only at ` · `.
- [x] Forced colours and `prefers-contrast` themes handled (native arrow, token colours); axe
  zero violations on settings and running views.

### VI. Performance Budgets

- [x] No new dependency; estimated < 1.5 KB gzip growth, verified by the bundle-size check.
- [x] Up to ~60 pending buffer sources at 300 × 8 is trivial for Web Audio; main-thread work
  per tick unchanged in kind (R-04). Tool open/interaction budgets unaffected.

### VII. Design System Fidelity

- [x] Tokens only (`--color-surface-raised`, `--color-text`, `--color-border`, `--radius-md`,
  `--space-*`, `--target-min`); style lint applies.
- [x] Main control visible, not behind a menu; tool still opens in its simplest state (defaults).
- [x] No reward mechanics, no modal; existing sound-unavailable notice reused.
- [x] Works 1024–2560 CSS px with no truncation (long pt-BR/es option names fit the 36 rem panel).
- [x] N/A for note-function shapes/colours and the four emphasis levels: no fretboard markers.

### VIII. International From the First Line

- [x] Every new string in `messages/{en,pt-BR,es}.json`; names mapped via message functions,
  no hard-coded text; adding a language needs only catalogs.
- [x] Longer pt-BR/es names verified at 320 px and 200 % text zoom (quickstart §2.10–11).
- [x] N/A for note-name formatting and accidentals: no note names shown.

### IX. Untrusted Input, Versioned Formats

- [x] The `<select>` value is parsed by `toSubdivision()` against the allowed set; invalid →
  ignored, never throws.
- [x] N/A for share links and stored formats: the Metronome has no share link and this slice
  persists nothing.

### X. Simplicity and Incremental Delivery

- [x] Single integer grid extends 031's formula rather than adding a second scheduler; no
  speculative "Loop 2" or volume options (FR-016).
- [x] No new abstraction with a single use (no global select family); no new dependency.
- [x] Fallback: Web Audio unavailable → visual run with the existing notice and `SUB n` shown.

### Technology Stack and Workflow

- [x] Stays within the mandated stack (Svelte 5, Paraglide, Web Audio, plain CSS tokens,
  Vitest/Playwright).
- [x] ADR 0030 gets a "Revision (032)" section for the grid and third click kind (R-11).
- [x] Verification follows the tiers: targeted Vitest and `test:e2e:fast` per task, `pnpm verify`
  once at the end.

## Project Structure

### Documentation (this feature)

```text
specs/032-subdivisions/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-11
├── data-model.md        # Phase 1: Subdivision, settings, grid click, click kinds, status
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── click-engine-api.md     # click.ts / metronome.ts / log entry deltas
│   ├── metronome-store-api.md  # settings, names, view, store deltas
│   └── metronome-ui.md         # select DOM/ARIA/tokens, status line, messages
├── checklists/          # From specify/clarify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/audio/
├── click.ts                         # EDIT: ClickKind 'sub', CLICK_LENGTH_S per kind
├── metronome.ts                     # EDIT: clicksPerBeat, j/n grid, slot-based onBeat, 3 buffers
└── types.ts                         # EDIT: click log entry gains kind, slot

src/lib/state/
├── metronome-settings.ts            # EDIT: Subdivision, SUBDIVISIONS, toSubdivision, default 3
├── metronome-subdivision-names.ts   # NEW: subdivisionName / subdivisionLabel over m.*
├── metronome-view.ts                # EDIT: statusParams(beat, beats, sub)
└── metronome.svelte.ts              # EDIT: setSubdivision, clicksPerBeat to segments, announcement

src/lib/tools/metronome/
├── SubdivisionSelect.svelte         # NEW: Loop 1 native select + chevron
├── MetronomePanel.svelte            # EDIT: mount the select; pass sub to StatusBox
└── StatusBox.svelte                 # EDIT: " · SUB n" suffix, wrap at separator

messages/{en,pt-BR,es}.json          # EDIT: 11 new keys, start announcement
docs/i18n/glossary.md                # EDIT: eight subdivision name rows (draft)
docs/adr/0030-metronome-click-scheduler.md  # EDIT: Revision (032) section

tests/unit/audio/{click,metronome}.test.ts
tests/unit/metronome/{settings,view,store,keys,panel}.test.ts
tests/unit/i18n/identical-allowlist.ts       # EDIT: new identical keys

e2e/metronome-subdivisions.spec.ts   # NEW: US1–US3 scenarios from __fmAudioLog
e2e/metronome.spec.ts                # EDIT: status suffix, start announcement; re-baseline "metronome views"
e2e/metronome-a11y.spec.ts           # EDIT: axe on settings view with the select, all themes
```

**Structure Decision**: Single SvelteKit project. The feature extends the existing
`src/lib/audio`, `src/lib/state` and `src/lib/tools/metronome` modules from slice 031, with
`messages/`, `tests/unit/` and `e2e/` for catalogs and tests. No new top-level directory or
route.

## Complexity Tracking

No constitution violations to justify.

| Decision | Why | Simpler / other alternative rejected because |
|---|---|---|
| Scoped `<select>` styles instead of a new `controls.css` family (ADR 0028) | Only one select in the app | A global family with one use is a speculative abstraction (C X); add it when a second select appears |
| Soft click = 2400 Hz / 0.25 / 18 ms (assumption; spec gives only bounds) | Higher, quieter, shorter than both beat clicks; 7 ms silence at 25 ms spacing | Same pitch as normal at lower gain: beat harder to pick out at speed |
| Announcement message changed in place (adds `{subdivision}`) | Spec FR-015 requires naming the subdivision | A separate follow-up announcement would double screen-reader chatter |
