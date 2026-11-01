# Implementation Plan: Mode Tabs and Plain Metronome

**Branch**: `036-mode-tabs-and-plain-metronome` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/036-mode-tabs-and-plain-metronome/spec.md`

## Summary

This slice adds a WAI-ARIA tab bar (`♩ Metronome`, `+ Ratios Training`) as the first row of
the metronome card. It also adds a plain **Metronome** mode: one click per beat at a fixed
BPM, beat 1 accented, the initial count-in only. Its settings are BPM, # of Beats, Count In
and Initial Count In.

The existing metronome store gains a `mode` and a second `PlainSettings` record. The single
click scheduler, run phases, keyboard rules and running view are shared. A plain run feeds
the unchanged audio engine a plan of `clicksPerBeat: 1` with no alternate loop. Switching tabs
reuses the store's `halt()` path, so sound stops at once from any phase. Each mode's values
and the selected mode persist in the existing `version: 1` preferences record as optional
`metronome.plain` and `metronome.mode` keys. These are omitted when default, so 035-era
records stay byte-identical. Details: [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5.57 (runes), SvelteKit with
`adapter-static`

**Primary Dependencies**: Paraglide JS (catalog), Valibot 1 (preferences schema). No new
runtime dependency.

**Storage**: `localStorage` through `src/lib/prefs` (record `fretboard-master:prefs`,
`version: 1`, extended with optional keys)

**Testing**: Vitest 5 + fast-check (store, settings maths, codec, components under jsdom);
Playwright 1.63 + @axe-core/playwright (desktop project locally)

**Target Platform**: Evergreen desktop browsers, windows 1024–2560 CSS px. The page must
reflow down to 320 px, and phones must not be blocked.

**Project Type**: Static web app (single SvelteKit project)

**Performance Goals**: A tab switch and its halt stay ≤ 300 ms (tool switch budget). Click
timing is identical to Ratios Training (same scheduler, SC-004).

**Constraints**: Initial JS ≤ 160 KB gzip (estimated +1.5 KB at most). Tokens only for visual
values. Every string comes from the catalog in en, pt-BR and es. No audio-engine changes.

**Scale/Scope**: One new component (`ModeTabs.svelte`). Edits to 4 metronome components,
2 state modules, the prefs schema and 3 catalogs. One new e2e spec and updates to 4 existing
specs' locators.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design. Result: PASS, no
violations.*

- [x] **I. Musical Correctness**: N/A for theory. The feature shows no notes, intervals or
  shapes and does not touch `src/lib/theory`. Click timing reuses the existing scheduler
  unchanged (R-02).
- [x] **II. On-Device, Static, Private**: All the work is client-side. The new values live
  only in the existing local preferences record and are erased by "Erase preferences". There
  is no network, no share-link field and no new measurement event (FR-017).
- [x] **III. Pure Core, Thin Shell**: `PlainSettings`, `plainRunPlan` and `toMode` are pure
  in `metronome-settings.ts`. State lives in the store, outside the components. The prefs
  module imports only types from `$lib/state`, and the defaults are mirrored with a parity
  test (R-10).
- [x] **IV. Test-First**: Settings maths, codec and store are built test-first (guarantees
  S1–S5 and C9–C14). Every acceptance scenario maps to a row of `e2e/metronome-modes.spec.ts`
  (quickstart). Timing is tested through the injectable fake clock and sink.
- [x] **V. Accessible**: The WAI-ARIA Tabs pattern with manual activation, a roving tabindex
  and a visible focus ring. The selected state is shown by an underline as well as colour,
  and forced colours are handled. The 44 px target, reflow to 320 px and zero axe violations
  are checked in e2e (R-06, R-09).
- [x] **VI. Performance Budgets**: No dependency. About +1.5 KB gzip at most, gated by the
  bundle-size check. The audio path is unchanged, and a switch does a synchronous halt plus
  one sub-1 KB write (R-13).
- [x] **VII. Design System Fidelity** (one recorded deviation): Colours come from tokens, and
  the new `--metronome-tab-underline` token gives the 2 px. Main controls are not behind a
  menu. There is no modal. The 1024–2560 px layouts and 320/375 px reflow are covered without
  truncation (R-09). **Deviation**: "Each tool opens in its simplest state" would point to the
  plain Metronome mode, but FR-014 keeps Ratios Training as the first-visit mode. This is
  recorded with its justification in Complexity Tracking and needs explicit reviewer approval
  (Governance, "Violations").
- [x] **VIII. International**: Six new keys and one rename, in all three catalogs (R-11). The
  icons are SVG, not text. The pt-BR and es label lengths are checked at 320 px in e2e. No
  note names are involved.
- [x] **IX. Untrusted Input, Versioned Formats**: The new keys are parsed with per-field
  Valibot fallbacks. An invalid value resets only itself, never across modes, and parsing
  never throws. `version: 1` is kept, and new fixtures are only added (C9–C14). Share links
  are untouched.
- [x] **X. Simplicity**: One store is extended rather than a second one added (R-01). The
  tab bar's mode list is the minimal array needed now. Speed Training's tab is not
  pre-built (YAGNI); slice 009/002 will add one array entry. The "never blank" rule holds:
  bad stored data falls back to defaults.

Post-design re-check: the Phase 1 artifacts add no dependency, keep the audio engine and link
codec untouched, and introduce one component with real use. The gate still passes.

## Project Structure

### Documentation (this feature)

```text
specs/036-mode-tabs-and-plain-metronome/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01 … R-13
├── data-model.md        # Phase 1: types, store state machine, stored record rules
├── quickstart.md        # Phase 1: validation scenarios and commands
├── contracts/
│   ├── metronome-store-api.md   # store getters/actions, guarantees S1–S5
│   ├── preferences-record.md    # codec deltas, guarantees C9–C14, fixtures
│   └── mode-tabs-ui.md          # tab bar DOM, keyboard, visuals, plain view
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/state/
├── metronome-settings.ts      # + MetronomeMode, METRONOME_MODES, PlainSettings, DEFAULT_PLAIN_SETTINGS,
│                              #   plainRunPlan, toMode; generic stepSetting/atLimit/effectiveCountIn
├── metronome-view.ts          # statusParams accepts sub: number | null
├── metronome.svelte.ts        # + mode, plain, current, selectMode, restore(); mode-aware start/pause
└── preferences.svelte.ts      # start()/erase() call metronome.restore(p.metronome)

src/lib/prefs/
└── schema.ts                  # Preferences.metronome {ratios, plain, mode}; METRONOME_PLAIN_DEFAULTS,
                               #   METRONOME_MODES; parse R7–R12; serialize W5–W8

src/lib/tools/metronome/
├── ModeTabs.svelte            # NEW: tablist/tab, roving tabindex, arrows/Home/End, SVG icons
├── MetronomePanel.svelte      # tab bar first row; tabpanel; plain vs ratios settings view; h2 removed
├── CountInSettings.svelte     # + optional `repeat` prop (hide Repeat Count In in plain mode)
└── StatusBox.svelte           # omit "· SUB n" when sub is null

src/lib/styles/tokens.css      # + --metronome-tab-underline: 2px
messages/{en,pt-BR,es}.json    # + metronome_modes_label, metronome_mode_plain, metronome_mode_ratios,
                               #   metronome_start_plain, metronome_announce_started_plain(_count_in);
                               #   − metronome_panel_heading

tests/unit/metronome/          # settings, view, store, panel, count-in-settings tests + new mode-tabs.test.ts
tests/unit/prefs/              # schema.test.ts + new fixtures (added only)
tests/unit/state/preferences-store.test.ts, tests/unit/erase-preferences.test.ts
e2e/metronome-modes.spec.ts    # NEW: quickstart scenarios 1–14
e2e/metronome{,-a11y,-remembered,-subdivisions}.spec.ts   # locator region → tabpanel
e2e/metronome.spec.ts-snapshots/                          # baselines regenerated in CI
```

**Structure Decision**: A single SvelteKit project, using the existing directories
`src/lib/state`, `src/lib/prefs`, `src/lib/tools/metronome`, `src/lib/styles`, `messages`,
`tests/unit/metronome`, `tests/unit/prefs` and `e2e`. No new directory is created. The audio
engine (`src/lib/audio`), link codec (`src/lib/link`) and route (`src/routes/metronome`) are
not modified.

## Implementation notes

1. **Order** (test-first): settings maths → codec and fixtures → store (`selectMode`,
   `current`, mode-aware Start/Pause, `restore`) → preferences wiring → catalogs →
   `StatusBox` / `CountInSettings` props → `ModeTabs` → `MetronomePanel` → e2e locator updates
   → new e2e spec → screenshots.
2. **The write path** always sends the whole `metronome` object (R-10). Otherwise the
   session's whole-key replace would drop the other mode's values.
3. **Focus**: switching keeps focus on the clicked tab (the bar stays mounted). Start and
   Reset keep their 031 focus moves.
4. **Snapshots**: the existing metronome baselines change because the heading is replaced by
   the tab bar. They are regenerated through `update-snapshots.yml`, and new plain-mode
   baselines are added the same way.

## Assumptions and rejected alternatives

| Assumption / decision | Rejected alternative | Why rejected |
|---|---|---|
| Tab icons are inline SVG (R-08) | Unicode `♩` in markup or the catalog | The system font stack does not reliably cover U+2669, and the icon would leak into translations |
| Switching does not post a live-region announcement (R-05) | Announce "Reset" or the mode name | The selected tab is already announced by AT, so a second message would repeat it, and "Reset" is wrong for a mode change |
| Panel name comes from the tabpanel; e2e locators change from `region` to `tabpanel` (R-07) | Keep a hidden `<h2>` | It would announce the mode twice and exist only for tests |
| Ratios-only setters are no-ops in plain mode (R-03) | They keep editing the Ratios record | It keeps the invariant that only the visible mode changes |
| Speed Training tab not pre-built | A hidden or disabled third tab | YAGNI (Principle X). The spec says it is not shown |

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| VII "Each tool opens in its simplest state": with nothing remembered the tool opens on Ratios Training (FR-014, US2-6), not on the simpler plain Metronome mode | FR-016 requires existing Ratios Training behaviour to stay unchanged. Users with a 035-era record (no `mode` key) and first-time users would otherwise land on a different mode than before, and the 035 record must stay byte-identical (FR-013, C1/C9), which works only if the omitted `mode` means `"ratios"`. Within Ratios Training the advanced options keep their existing off/default state | Defaulting to plain: an absent `mode` cannot tell "never chose" from "035 user on Ratios", so every existing user would be moved to a new mode, breaking FR-016 and changing the default-record semantics. **Needs explicit reviewer approval** (listed in the PR description, T035); if refused, switch `DEFAULT_MODE` to `'plain'` and update FR-014, US2-6 and the `mode` omission rule together |
