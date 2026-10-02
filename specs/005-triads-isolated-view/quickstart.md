# Quickstart: Triads Isolated View — validation guide

**Feature**: `005-triads-isolated-view` | Plan: [plan.md](./plan.md) | Contracts: [contracts/](./contracts/)

## Prerequisites

```bash
mise install          # pinned Node + pnpm (mise.toml)
pnpm install
```

## 1. Theory gates (Principle I — must pass before merge)

```bash
pnpm test:unit tests/unit/theory          # triad spelling + shape tables and properties
pnpm vitest run --coverage                # ≥ 95% lines/branches on src/lib/theory, ≥ 80% overall
```

Expected: TM-4.2 (68), TM-4.3 (20), TM-5.5 (48) table tests green; NFR-9.3 property suite runs
≥ 1,000 random tunings (SC-004) green. See guarantees T1–T11 in
[contracts/triads-theory-api.md](./contracts/triads-theory-api.md).

## 2. State and model

```bash
pnpm test:unit tests/unit/state/triads-view.test.ts tests/unit/state/triads-model.test.ts tests/unit/state/triads-store.test.ts
```

Expected: keep/reset rules (data-model §4), guarantees M1–M8
([contracts/triads-state-api.md](./contracts/triads-state-api.md)), playback stop on every
state change.

## 3. Components

```bash
pnpm test:unit tests/unit/triads tests/unit/fretboard tests/unit/notation tests/unit/notes
```

Expected: interval labels render (R, ♭3, ♯5…), F𝄪 in note-name mode, `aria-disabled` octave
and Listen buttons, guidance has no error color, NotesActions unchanged after `ChoiceGroup`
extraction, `tests/unit/no-raw-text.test.ts` green (no hard-coded UI text).

## 4. End-to-end (phone 360 px + desktop, axe)

```bash
pnpm build:test
pnpm test:e2e e2e/triads.spec.ts e2e/triads-tm9.spec.ts e2e/perf.spec.ts
```

Manual smoke (`pnpm dev`, open `/triads`):

| Step | Expected |
|---|---|
| Open | C major — Root position; markers on string 3 fret 5 (R), string 2 fret 5 (3), string 1 fret 3 (5) |
| Label → Note names | markers read C, E, G |
| Root A, 1st inversion, set 4-3-2 | 11-9-10 on strings 4-3-2: C♯ (third), E (fifth), A (root); "A major — 1st inversion" |
| Root D♯/E♭, major | E♭–G–B♭ (default); **Switch to D♯** shown |
| Switch to D♯ | D♯–F𝄪–A♯, "F𝄪 sounds as G", suggestion E♭; shape does not move |
| Augmented | symmetry statement; diminished → ♭5 characteristic |
| C major, root position, 3-2-1 (5-5-3) | Octave down disabled; Octave up → 17-17-15, then Octave up disabled |
| C major, 1st inversion, 6-5-4 (12-10-10) | single occurrence on 22 frets: both octave buttons disabled, not error-styled |
| Listen | three notes low→high, then a chord; markers pulse even when muted |
| Keyboard only | Tab through all controls, arrows within groups, focus visible |

Injected instruments (test builds; set in devtools before navigating, see
[contracts/test-hooks.md](./contracts/test-hooks.md)):

| `globalThis.__fmInstrument` | Selection | Expected |
|---|---|---|
| `'AF-4'` | C major, root, 6-5-4 | 10-7-5 + "Wide stretch" mark |
| `'AF-1-12'` | C diminished, root, 5-4-3 | empty board, "This shape lies beyond fret 12", octaves + Listen disabled, panel shows C–E♭–G♭ |
| `'NC-UNISON'` | default (3-2-1) | "This triad does not close…" + **Another set** → selects 5-4-3 and shows a shape |

## 5. Full merge gate

```bash
pnpm check && pnpm lint && pnpm format:check && pnpm test:unit && pnpm build && pnpm test:e2e && pnpm lhci
```
