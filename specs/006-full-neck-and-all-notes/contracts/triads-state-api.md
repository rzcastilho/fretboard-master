# Contract delta: Triads state API

**Feature**: `006-full-neck-and-all-notes` | Base: [005 triads-state-api](../../005-triads-isolated-view/contracts/triads-state-api.md) | Data model: [§3, §4](../data-model.md) | Research: R-03, R-04, R-08, R-10, R-11

## 1. Pure view state — `src/lib/state/triads-view.ts`

```ts
export type TriadsView = 'isolated' | 'full-neck' | 'all-notes';
export const TRIADS_VIEWS: readonly TriadsView[];
// TriadsViewState gains: readonly view: TriadsView   (initial 'isolated')

export function setView(s: TriadsViewState, v: TriadsView): TriadsViewState;
export function seeAllNotes(s: TriadsViewState): TriadsViewState;
export function selectShape(s: TriadsViewState, inv: Inversion, octave: number, i: Instrument): TriadsViewState;
export function resetTriads(i: Instrument): TriadsViewState;
```

Guards added to existing transitions: `setInversion`, `setStringSet` no-op in `all-notes`;
`octaveUp`, `octaveDown` no-op outside `isolated`. Full table in data-model §3.

## 2. Display model — `src/lib/state/triads-model.ts`

`buildTriadsModel(s, instrument): TriadsDisplay` stays the single derivation (pure + paraglide).
New fields: `view`, `controls`, `octave.applies`, `seeAllNotes`; `shape` gains kinds `chain` and
`all-notes`; `composition.name.inversion` / `composition.lowToHigh` nullable; `model.tags`,
`model.autoScroll`, `model.description` set per data-model §4. Re-exports `TRIADS_VIEWS` and
`type TriadsView` so components never import `theory/*`.

Helper exported for the tool: `tagTarget(display, id): { inversion: Inversion; octave: number } | null`
(maps a fretboard tag id back to a chain shape).

## 3. Store — `src/lib/state/triads.svelte.ts`

| Action | Calls | Playback |
|---|---|---|
| `setView(v)` | `apply(setView(view, v))` | stops iff view changed (C13) |
| `seeAllNotes()` | `apply(seeAllNotes(view))` | stops (C13) |
| `selectTag(id)` | `tagTarget` → `apply(selectShape(view, inv, octave, instrument))` | stops iff inversion or occurrence changed (C3) |
| `reset()` | `apply(resetTriads(instrument))` | stops iff state changed |
| `anotherSet()` | unchanged (005); view kept (C8) | stops (set changed) |
| `listen()` | unchanged: `playback.sequence(display.listenSteps, LISTEN_BPM, instrument)` — steps now view-dependent | new sequence interrupts |

All existing actions unchanged. No `prefs` import (FR-019).

## Tests

- `tests/unit/state/triads-view.test.ts`: every row of data-model §3 (incl. no-op identity, guards, view kept across root/quality/set/label changes, reset → isolated).
- `tests/unit/state/triads-model.test.ts`: per-view table of data-model §4; US1-1/2, US2-1/4, US3-1..4, US4-1/2 (exact steps: 24 for A major 3-2-1; A2 s5f0, C♯3 s5f4, E3 s4f2), US5-3, SC-003 (12 roots × 4 qualities), SC-004, C10, C18 description strings, double-accidental spelling (D♯ major → F𝄪 marker).
- `tests/unit/state/triads-store.test.ts`: playback stop matrix for C13 using the fake engine; selectTag highlight + occurrence; reset.
