# Implementation Plan: Custom Tuning

**Branch**: `feature/011-custom-tuning` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-custom-tuning/spec.md`

## Summary

Add a **Custom** choice to the instrument panel (slice 009): six string rows (string 6 → 1),
each with lower / note / raise buttons that move the string one semitone within −7…+4 of
standard, play the new pitch, and update the preview. The tuning is modelled as a tagged union
`preset | custom(offsets)` kept in **canonical form** — any offsets that equal a preset *are*
that preset — so naming ("Drop D" vs "Custom"), spelling (preset spelling vs sharps), the badge,
the summary and storage all follow from one rule. Confirmed custom tunings drive every tool via
the existing `Instrument.openStrings`; Triads' existing "does not close" guidance already
handles unison/inverted sets and is pinned by new tests. Storage adds the optional
`customTuning` offsets field to the v1 preferences record (010 extension rule, no version
bump). Technical approach and alternatives: [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node 24.21.0 via mise

**Primary Dependencies**: Svelte 5 (runes) + SvelteKit `adapter-static`, Paraglide JS, Valibot
(all existing; **no new dependency**)

**Storage**: `localStorage` key `fretboard-master:prefs`, v1 record + optional `customTuning`
([contracts/storage-format.md](./contracts/storage-format.md))

**Testing**: Vitest + fast-check (units, properties, components), Playwright +
@axe-core/playwright (phone 360 px, desktop)

**Target Platform**: Evergreen browsers (last two majors), desktop and mobile; static hosting on
Cloudflare Pages

**Project Type**: Static single-page web application (SvelteKit, prerendered)

**Performance Goals**: control change → fretboard update ≤ 100 ms; instrument change ≤ 300 ms;
tap to sound ≤ 100 ms (Constitution VI)

**Constraints**: initial JS ≤ 85 KB gzip (currently ≈ 82.2 KB → budget for this slice
≈ 2.8 KB, R-11); fully offline; 320–2560 px; 200 % text zoom; WCAG 2.2 AA

**Scale/Scope**: 6 strings × 12 positions, 11 presets; ~3 new pure functions modules touched,
1 panel component extended, ~7 catalog messages, 6 fixture records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Pre-research result: **PASS**. Post-design re-check (after data-model and contracts): **PASS**,
one documented spec-wording deviation (Complexity Tracking).

**I. Musical Correctness**

- [x] Notes/pitches match the theory reference — open pitches derive from integer offsets over
  standard (TM-1 pitch arithmetic); SC-002 table test checks all 72 string positions.
- [x] Spelling rules — matched tunings use the preset's stored spelling; unmatched use the
  documented sharps rule (`spellSharp`), the only option until the accidental preference.
- [x] Shapes from configured tuning — tools receive a real `Instrument` built from the custom
  pitches; no tuning-specific drawing.
- [x] Theory test gates — triad table/property suites (005/006) keep gating; new pure code adds
  table tests (limits, matching) and properties (canonical round-trip, `spellSharp` pitch
  preservation). Existing NFR-9.3 property tests already use random tunings.
- [x] Notes sound at calculated pitch — panel plays `positionPitch(pending, {string, 0})`, the
  same value the label is built from.

**II. On-Device, Static, Private**

- [x] All in browser, no network, no identifiers; custom offsets stay in `localStorage` and are
  erased by the existing Erase action (FR-015).

**III. Pure Core, Thin Shell**

- [x] `theory` gains only pure `sharpSpelling`/`spellSharp`; `instrument` stays pure and imports
  only `theory` (lint-enforced); panel transitions are pure functions in
  `state/instrument-config.ts`; the component only dispatches and renders.
- [x] View state outside components — `customOpen` lives in `PanelState`, not the component.
- [x] Fretboard untouched; tools receive `Instrument` only.

**IV. Test-First**

- [x] instrument, theory, prefs and state modules built test-first (quickstart suite table).
- [x] Every acceptance scenario of US1–US5 mapped to a Vitest or Playwright test (SC-005);
  audio asserted through the existing injectable fake engine, no real time.

**V. Accessible by Default**

- [x] Native buttons (keyboard, Enter/Space), visible focus, 44 px targets, accessible names
  with string number and spoken note ("String 2, A sharp 3"), disabled state announced, focus
  rescue at limits (FR-023), polite `role="status"` for name line and order note, sound never
  the only carrier (note text always shown), axe in Custom state on phone and desktop.

**VI. Performance Budgets**

- [x] No dependency; memoized `tuningInstrument`; one pure transition per press. Bundle checked
  by the existing gate; lazy-load fallback for the rows documented (R-11). No budget change.

**VII. Design System Fidelity**

- [x] Rows sit in the existing panel (fretboard not covered), tokens only, order note in muted
  text (no error red, non-blocking, one line), no new modal, works 320–2560 px.

**VIII. International**

- [x] All new strings in `messages/en.json`; note names via `notation` (`pitchLabel`,
  `spokenNote`); glyphs ♯ ♭ only.

**IX. Untrusted Input, Versioned Formats**

- [x] `customTuning` parsed by a Valibot schema with per-field fallback; invalid → ignored,
  other fields kept, never throws; version stays 1 per the extension rule; six fixtures added,
  none removed.

**X. Simplicity and Incremental Delivery**

- [x] Slice follows breakdown wave 003-your-instrument/003. Shared sharp-spelling function has
  two real users (notation, instrument). No speculative accidental-preference parameter, no
  7-string or capo support (FR-020). Triads guidance reused, not rebuilt.

**Workflow gates**

- [x] ADR planned: `docs/adr/0014-custom-tuning-canonical-form.md` (changes ADR 0012 store
  contract and ADR 0013 record) — R-12.
- [x] Conventional Commits, PR to `main`, CI gates unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/011-custom-tuning/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01 … R-12
├── data-model.md        # Phase 1: Offsets, Tuning, PanelState, Preferences
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── tuning-api.md        # pure + store signatures
│   ├── custom-panel-ui.md   # panel UI, badge/summary, catalog messages
│   └── storage-format.md    # customTuning field, reader/writer rules, fixtures
├── checklists/          # from /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/lib/
├── theory/pitch.ts                  # + sharpSpelling, spellSharp
├── notation/notation.ts             # defaultSpelling delegates to sharpSpelling
├── instrument/
│   ├── custom-tuning.ts             # NEW: Offsets, limits, matchPreset, stepOffsets, invertedStrings
│   └── tunings.ts                   # + Tuning union, tuningFromOffsets, tuningStrings, tuningInstrument
├── state/
│   ├── instrument-config.ts         # tuningId → tuning; customOpen; chooseCustom, stepString
│   ├── instrument.svelte.ts         # chooseCustom, stepString, playString; confirm writes customTuning
│   └── preferences.svelte.ts        # restore via tuningOfPreferences
├── prefs/
│   ├── schema.ts                    # + customTuning field, tuningOfPreferences, serialize order
│   └── session.ts                   # PreferencesPatch accepts customTuning (type only)
└── shell/
    ├── InstrumentPanel.svelte       # Custom radio, string rows, status line, focus rescue
    ├── TuningBadge.svelte           # isStandard / tuningLabel
    ├── InstrumentSummary.svelte     # tuningLabel
    └── tuning-names.ts              # + tuningLabel
messages/en.json                     # + 7 messages (contracts/custom-panel-ui.md)
docs/adr/0014-custom-tuning-canonical-form.md   # NEW

tests/unit/
├── theory/pitch.test.ts
├── instrument/custom-tuning.test.ts            # NEW (+ custom-tuning.property.test.ts)
├── instrument/tunings.test.ts
├── state/instrument-config.test.ts, state/instrument-store.test.ts, state/preferences-store.test.ts
├── prefs/schema.test.ts, prefs/fixtures/{v1-custom,v1-custom-drop-d,custom-*}.txt + index.ts
├── instrument-panel.test.ts, tuning-badge.test.ts, home-screen.test.ts
└── triads/triads-guidance.test.ts, state/triads-store.test.ts   # unison / inverted set cases
e2e/
├── custom-tuning.spec.ts            # NEW: US1–US5 flows, axe, 320 px / 200 % zoom
└── preferences.spec.ts              # reload persistence, damaged customTuning
```

**Structure Decision**: Single SvelteKit project at the repository root, using the existing
directories `src/lib/{theory,notation,instrument,state,prefs,shell}`, `messages/`,
`tests/unit/`, `e2e/` and `docs/adr/` (all present today). The only new source file is
`src/lib/instrument/custom-tuning.ts`; everything else extends files shipped by slices 009/010.

## Phase 0 / Phase 1 Outputs

- Phase 0: [research.md](./research.md) — every unknown resolved from the repository; 12 decisions.
- Phase 1: [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md). No agent-context update script exists in
  `.specify/scripts/bash/`, so none was run.

## Complexity Tracking

No constitution violation. Assumptions are recorded for review:

| Item | Decision | Rejected alternative and why |
|---|---|---|
| **See all notes** destination (FR-014 / US4-3) | Spec amended to the shipped 006 C8 behaviour: switch Triads to its All notes view (R-08); spec, plan and T037 now agree. Amendment flagged for reviewer confirmation (Constitution IV) | Navigating to `/notes` would change a shipped, tested action (also used by the beyond-fret guidance) and contradicts the spec's own assumption that the existing actions are reused |
| `InstrumentConfig.tuningId` replaced by `tuning` union | Internal breaking change, all callers migrated in this slice (R-01) | Adding a parallel `offsets` field allows contradictory state |
| Sharp-spelling table moved from `notation` to `theory/pitch` | Two users, lint boundary forbids instrument → notation (R-03) | Duplicating the table creates two sources of truth |
| Bundle headroom ≈ 2.8 KB | Ship inline; lazy-load string rows only if the gate fails (R-11) | Lazy-loading up front adds a loading state for a tiny component (YAGNI) |
