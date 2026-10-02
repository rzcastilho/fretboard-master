# Contract delta: Test-only instruments

**Feature**: `006-full-neck-and-all-notes` | Base: [005 test-hooks](../../005-triads-isolated-view/contracts/test-hooks.md) (ADR 0004) | Research: R-13

```ts
var __fmInstrument: 'AF-7' | 'AF-21' | 'AF-4' | 'AF-1-12' | 'NC-UNISON' | 'AF-8' | 'SHORT-7' | undefined;
```

| Name | Strings (1 → 6) | Frets | Used for |
|---|---|---|---|
| `AF-8` | D4 B3 G3 D3 G2 D2 (Open G) | 22 | TM-9 view 14 (G major, All notes) |
| `SHORT-7` | E4 B3 G3 D3 A2 E2 | 7 | US5-3: A major 3-2-1 shows only root 2-2-0 and 1st 6-5-5, no message |

Same availability rule (test/dev builds only; `scripts/check-no-fault-hook.mjs` already scans
production output). TM-9 additions to `e2e/triads-tm9.spec.ts`:

| View | Instrument | Steps | Must show |
|---|---|---|---|
| 6 | default | A, major, set 3-2-1, Full neck | six tagged shapes (C1) |
| 9 | default | G♯/A♭ spelled A♭ (Switch spelling if the default differs), augmented, set 6-5-4, Full neck | A♭–C–E, same drawing 4 frets apart, tags relative to A♭ |
| 14 | `AF-8` | G, major, All notes | every G, B, D by function |
