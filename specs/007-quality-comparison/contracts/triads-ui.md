# Contract delta: Triads tool UI

**Feature**: `007-quality-comparison` | Base: [006 triads-ui](../../006-full-neck-and-all-notes/contracts/triads-ui.md) | State: [triads-state-api](./triads-state-api.md) | Renderer: [fretboard-model](./fretboard-model.md)

## Components (`src/lib/tools/triads/`)

| Component | Change |
|---|---|
| `TriadsCompare.svelte` (new, zone E, next to the fretboard per design §4) | Rendered only when `display.compare.offered`. It contains a **Compare** toggle button (`aria-pressed`, `triads_compare_toggle`). When Compare is on, it also shows a `ChoiceGroup` named `triads_compare_group` with options `display.compare.options`, labelled by `qualityName`, with the current `display.compare.quality` checked. Targets are at least 44×44 px, and the order is toggle → list |
| `TriadsSecondary.svelte` | Adds a **Listen to comparison** button (`triads_compare_listen`) after **Listen**. It is rendered only when `display.compare.on && display.compare.offered` (C14) and is `aria-disabled` when `!listenComparison.enabled` |
| `TriadsTool.svelte` | Wires `onsetcompare`, `oncomparequality`, `onlistencomparison`. It renders `Notice` for `triads.notice`: `compare-swapped` → `triads_compare_swapped({ quality: qualityName(q) })`; `compare-omitted` → `triads_compare_omitted_one/other({ notes: noteLabel list })`. `ondismiss` → `triads.dismissNotice` |
| `CompositionPanel.svelte` | When `composition.comparison` is non-null, it shows two columns (first, comparison) in a grid that stacks at narrow width. In both columns, changed intervals and notes are `<strong>` with a visible `triads_compare_changed` tag. The comparison heading carries a dashed swatch (`aria-hidden`). Symmetry and characteristic notes appear in the column of their quality |

## Keyboard and focus (FR-017)

The Tab order is Compare toggle → quality radios (arrow keys move within the group, as in the
existing `ChoiceGroup`) → Listen → Listen to comparison. Turning Compare off while focus is in
the list returns focus to the toggle; there is no focus loss. Every new control has the
standard focus ring tokens.

## Behaviour checklist (each becomes a test)

| Scenario | Unit (Vitest) | E2E (Playwright, phone 360 px + desktop) |
|---|---|---|
| US1-1 major vs minor: one note at two frets, dashed, 1-fret arrow toward nut | triad-compare, triads-model, fretboard.test | `e2e/triads-compare.spec.ts` (new) |
| US1-2 minor vs diminished, fifth −1 | triad-compare, triads-model | ✓ |
| US1-3 major vs augmented, fifth +1 | triad-compare, triads-model | ✓ |
| US1-4 list excludes the current quality | triads-model (M1), triads-compare component | ✓ |
| US1-5 Compare off → single triad, no arrows or dashes | triads-model, fretboard.test | ✓ |
| US1-6 not colour alone | fretboard.test (dash attribute + arrow present per comparison marker) | ✓ grayscale screenshot |
| US1-7 panel two columns, emphasis | composition-panel.test | ✓ |
| US2-1 Full neck pairs per shape; G 4-3-2 0-0-0 off-nut B♭, 12-12-12 → 12-12-11 | triads-model (M6) | ✓ |
| US2-2/3 Compare survives view switches; hidden in All notes | triads-view (S6), triads-tool | ✓ |
| US3-1 G 2nd inversion 4-3-2 → 12-12-12 / 12-12-11 | triad-compare (T5), triads-model | ✓ + TM-9 sample 10 screenshot |
| US3-2 no octave fits → off-board arrow with name | triads-model with `SHORT-7` and `AF-1-12` | ✓ with a fixture instrument |
| US3-3 same octave always | triads-model | — |
| US4-1 root change keeps Compare | triads-view, triads-store | ✓ |
| US4-2 swap + notice | triads-view (S5), triads-store (A2), triads-tool | ✓ |
| US4-3 inversion and set change recalculate | triads-model | — |
| US5-1 only the third slides (no Compare) | fretboard.test (node identity + transform) | ✓ (data-key node stable) |
| US5-2 comparison quality change slides only changed notes | fretboard.test | — |
| US5-3 reduced motion instant | fretboard.test (token 0) | ✓ `emulateMedia({ reducedMotion })` |
| US5-4 other motion rules unchanged | triads-model (M7: root, inversion and string-set changes change every marker id; quality change keeps them), fretboard.test (new id → new DOM node, no transform transition) | ✓ root change: no `data-key` node survives |
| US6-1 block, rest, block at calculated pitch | schedule.test (empty rest step), triads-store with fake engine | `e2e/playback.spec.ts` (+ comparison) |
| US6-2 omitted notes + one-line notice | triads-store (A3), triads-tool | — |
| US6-3 stop on any listed change | triads-store (A1) | ✓ (one change) |
| US6-4 Listen to comparison hidden when off | triads-secondary.test | — |
| FR-016 description | triads-model (M8; accidentals spoken in full) | — |
| SC-006 axe zero violations on comparison states | — | axe on Isolated + Full neck with Compare on |
| SC-007 / FR-021 100 ms | — | `e2e/perf.spec.ts`: Compare on, comparison-quality change |
| 320 px / 200 % zoom no truncation | — | ✓ |
| `no-raw-text`, `reserved-colors` | existing suites cover new files | — |

## Test hooks

No new hooks. The existing `__fmInstrument` fixtures (`SHORT-7`, `AF-1-12`, `AF-8`) drive
the off-board and alternate-tuning cases.
