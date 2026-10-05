# Quickstart: CAGED Arpeggio, Pentatonic, and Scale Layers

**Feature**: 017-caged-layers | **Plan**: [plan.md](./plan.md)

This guide validates the slice end to end. Commands follow the constitution's verification
tiers and `CLAUDE.md`: run targeted tests locally, `pnpm verify` once at the end, and leave
the full matrix to CI.

## 1. Setup

```bash
mise install          # pinned Node + pnpm
pnpm install
```

## 2. Targeted checks during implementation

```bash
# Theory (Principle I gate: tables + properties)
pnpm vitest run tests/unit/theory/caged-layers.test.ts tests/unit/theory/caged-layers.property.test.ts tests/unit/theory/caged.test.ts

# Pure rules, view, model, store
pnpm vitest run tests/unit/state/caged-layers.test.ts tests/unit/state/caged-view.test.ts tests/unit/state/caged-model.test.ts tests/unit/state/caged-store.test.ts

# Prefs, renderer, component
pnpm vitest run tests/unit/prefs tests/unit/fretboard tests/unit/caged

# E2E (desktop only, installed Chrome)
pnpm build:test
pnpm test:e2e:fast e2e/caged-layers.spec.ts e2e/caged-focus.spec.ts e2e/caged.spec.ts

# New TM-9 screenshots (views 16, 17, 20)
pnpm playwright test e2e/caged-tm9.spec.ts -g "layers" --project=phone --project=phone-touch --project=desktop --update-snapshots

# Bundle (after US2 and at end of slice)
pnpm build && node scripts/check-bundle-size.mjs
```

## 3. Acceptance walkthrough (manual or e2e)

Open `/caged` (C major, standard tuning, 6 strings, 24 frets).

| # | Steps | Expected | Spec |
|---|---|---|---|
| 1 | Look at zone D | Chord, Arpeggio, Pentatonic and Scale rows, each with a sample; Chord on and disabled; the others off | US2-1 |
| 2 | Turn on Arpeggio | Arpeggio markers (smaller, lighter squares, circles and diamonds) appear low to high across the neck; Chord is now enabled | US3-1, US2-2 |
| 3 | Turn Chord off | Chord positions are drawn as arpeggio; Arpeggio becomes disabled ("At least one layer stays on.") | US2-2, FR-003 |
| 4 | Turn Chord on, turn Arpeggio off, choose shape **E**, turn on Scale | Region 7–10: s6 7 8 10 … s1 7 8 10 with degrees; chord notes keep the chord treatment; the others are outlined circles | US1-1, SC-002 |
| 5 | Switch Labels to **Note names** | Every marker shows its note name (F, B, …) | US1-2 |
| 6 | Turn on Pentatonic | F (s5 f8, s3 f10) and B (s6 f7, s4 f9, s1 f7) gain the inner dot; the Scale row shows the extra sample | US5-1, SC-004 |
| 7 | Choose **See all** | Pentatonic and Scale notes disappear; the switches stay on; the description says they show when a shape is in focus | US4-3 |
| 8 | Turn Chord off (Arpeggio off) with Scale on and E in focus, then choose **See all** | Chord turns back on and "Chord layer on." is announced; the Scale switch stays on | US2-7, FR-002 |
| 9 | Reset tool, switch to A minor, then with all shapes visible turn on Pentatonic | The first drawn shape takes focus; its pentatonic notes show | US4-2, SC-005 |
| 10 | Choose shape **E** (Em) | The box at frets 5–8: 5-8, 5-7, 5-7, 5-7, 5-8, 5-8 | US4-1 |
| 11 | Go to Notes, then back to CAGED | Layers as left | US2-4 |
| 12 | Reload | Chord only; labels still Note names | US2-4, US2-6 |
| 13 | DevTools → Application → localStorage | No layer data; `labels.caged: "name"` | US2-5 |
| 14 | Instrument: 7 strings (AF-21), D major, shape C, Scale on | String 7 shows string 2's frets; no chord marker on string 7 | US1-3, FR-007 |
| 15 | Instrument: Drop D (AF-4), D major, shape E, Scale on | String 6 shows 9, 11 and 12 (12 as a chord root) | FR-017 |
| 16 | 12 frets, a shape whose region passes fret 12, Scale on | Notes past fret 12 are absent with no notice; the occurrence is still drawn | US1-4 |
| 17 | C major, C shape at the nut, Scale on | No note below fret 0 | US1-5 |
| 18 | Emulate `prefers-reduced-motion: reduce`, toggle Scale | Notes appear in one frame | US1-6, FR-013 |
| 19 | A non-compatible tuning (e.g. Open G) | Layer switches are disabled ("Layers need a CAGED shape…"); their state is kept | FR-014 |
| 20 | Every layer on, E focused, read the description | Layers on, counts per layer in the region, extra-marked notes named | US6-3, FR-015 |

## 4. End of slice

```bash
pnpm verify    # check, lint, format, full Vitest + coverage, build, bundle size, full desktop Playwright
```

Expected:

- coverage is at least 95% on `src/lib/theory` and at least 80% overall;
- the bundle is at most 94 KB gzip. If it is over, follow plan Complexity Tracking row 1
  (constitution amendment 1.8.0);
- zero axe violations.
