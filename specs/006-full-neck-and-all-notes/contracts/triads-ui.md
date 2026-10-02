# Contract delta: Triads tool UI

**Feature**: `006-full-neck-and-all-notes` | Base: [005 triads-ui](../../005-triads-isolated-view/contracts/triads-ui.md) | State: [triads-state-api](./triads-state-api.md)

## Components (`src/lib/tools/triads/`, `src/lib/tools/`)

| Component | Change |
|---|---|
| `TriadsControls.svelte` (zone B) | New first group **View** (`ChoiceGroup`: Isolated / Full neck / All notes; `onview`). Inversion and String set groups get `disabled={!display.controls.inversion}` / `…stringSet` and `aria-describedby` → hint `triads_hint_all_notes` shown only in All notes. Values stay checked. |
| `ChoiceGroup.svelte` | New `disabled?: boolean`: `aria-disabled="true"` on group and radios; click/arrow/Home/End ignored; checked radio stays focusable; disabled tokens (greyed text + border, no error red). Notes usage unchanged. |
| `TriadsTool.svelte` | Passes `ontag={(id) => triads.selectTag(id)}` to `Fretboard`; renders `WideStretchMark` only for `shape.kind === 'shown'`; wires `onview`, `onseeallnotes`, `onreset`. |
| `TriadsGuidance.svelte` | Adds **See all notes** button (`triads_see_all_notes`) for both `beyond` and `does-not-close` when `display.seeAllNotes`; **Another set** unchanged. Rendered for Isolated and Full neck; never in All notes (C7, C9). |
| `TriadsSecondary.svelte` (zone E) | Octave buttons `aria-disabled` when `!octave.applies` with hint `triads_hint_octave_isolated` via `aria-describedby`; new **Reset tool** button (`triads_reset`). Listen unchanged. |
| `CompositionPanel.svelte` (zone D) | `name.inversion === null` → `triads_name_no_inversion`; `lowToHigh === null` → line hidden (C10). |

## Behaviour checklist (each becomes a test)

| Scenario | Unit (Vitest) | E2E (Playwright, phone 360 px + desktop) |
|---|---|---|
| US1-1 six shapes + tags | triads-model, triads-tool | `e2e/triads-full-neck.spec.ts` |
| US1-2 tap "2nd" | triads-store, triads-tool | ✓ |
| US1-3/4 control changes in Full neck | triads-model | ✓ (one) |
| US1-5 keyboard tags | fretboard.test | ✓ Tab order + Enter/Space |
| US2-1..4 All notes | triads-model, triads-controls | `e2e/triads-all-notes.spec.ts` |
| US3-1..4 guidance actions | triads-guidance, triads-store | ✓ with `AF-1-12`, `NC-UNISON` |
| US4-1..4 Listen | triads-store (fake clock/engine) | `e2e/playback.spec.ts` (step count, pulse when muted) |
| US5-1..3 teaching cases | triad-chain tests, triads-model | ✓ `SHORT-7` no message |
| SC-007 axe | — | axe on both views, both profiles |
| SC-008 320–2560 px, 200 % zoom | — | no page horizontal scroll; tags not overlapping |
| SC-006 / FR-021 100 ms | — | `e2e/perf.spec.ts` view switch + tag tap |
| TM-9 views 6, 9, 14 | — | `e2e/triads-tm9.spec.ts` screenshots |
