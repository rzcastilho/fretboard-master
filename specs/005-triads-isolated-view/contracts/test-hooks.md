# Contract delta: Test-only instrument harness for Triads

**Feature**: `005-triads-isolated-view` | Base: [004 test-hooks](../../004-fretboard-notes-tool/contracts/test-hooks.md) (ADR 0004) | Research: R-15, R-16

## Allow-list extension (`src/lib/instrument/fixtures.ts`, `src/app.d.ts`)

```ts
var __fmInstrument: 'AF-7' | 'AF-21' | 'AF-4' | 'AF-1-12' | 'NC-UNISON' | undefined;
```

| Name | Strings (1 → 6) | Frets | Used for |
|---|---|---|---|
| `AF-4` | E4 B3 G3 D3 A2 D2 (Drop D) | 22 | wide stretch (US5-1), TM-9 view 12 |
| `AF-1-12` | E4 B3 G3 D3 A2 E2 | 12 | beyond-fret guidance (US8-1) |
| `NC-UNISON` | E4 B3 B3 D3 A2 E2 | 22 | does-not-close on 4-3-2 / 3-2-1; Another set → 5-4-3 (US8-2) |

- Same availability rule: read only when `__FM_FAULT_INJECTION__` (test/dev builds);
  `scripts/check-no-fault-hook.mjs` already scans production output for `__fmInstrument`.
- `TriadsTool` reads it once on mount and calls `triads.useInstrument(fixtureInstrument(name))`.
  Unknown → default instrument, never throws.

## TM-9 screenshot fixtures (`e2e/triads-tm9.spec.ts`)

Reached through product UI; one screenshot per Playwright project, named `tm9-view-N`.

| View | Instrument | Steps | Must show |
|---|---|---|---|
| 7 | default | root D♯/E♭, minor, 1st inversion, 4-3-2 | E♭–G♭–B♭ (default E♭, TM-4.3), G♭ in bass |
| 8 | default | root B, diminished, root position, 5-4-3 | B–D–F, ♭5 characteristic statement |
| 11 | default | root D♯/E♭, major, **Switch to D♯** | D♯–F𝄪–A♯, "F𝄪 sounds as G", suggestion E♭; note-name labels show F𝄪 |
| 12 | `AF-4` | C, major, root position, 6-5-4 | frets 10-7-5 and the Wide stretch mark |

Views 6, 9, 10, 13, 14 are added by the slices that ship Full neck, comparison, 7-string sets,
and All notes.
