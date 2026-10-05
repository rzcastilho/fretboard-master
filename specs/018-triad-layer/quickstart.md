# Quickstart: validate the CAGED Triad layer

Run guide for [plan.md](./plan.md). Contracts: [triad-layer-api.md](./contracts/triad-layer-api.md),
[triad-layer-ui.md](./contracts/triad-layer-ui.md). Data: [data-model.md](./data-model.md).

## 1. Prerequisites

```bash
mise install
pnpm install
```

## 2. Targeted checks during implementation (constitution "Verification tiers")

```bash
# Unit (theory, rules, model, store, links, controls)
pnpm vitest run tests/unit/theory/caged-triad.test.ts tests/unit/theory/caged-triad.property.test.ts \
  tests/unit/state/caged-layers.test.ts tests/unit/state/caged-triad.test.ts \
  tests/unit/state/caged-view.test.ts tests/unit/state/caged-model.test.ts \
  tests/unit/state/caged-store.test.ts tests/unit/state/links.test.ts tests/unit/state/triads-store.test.ts \
  tests/unit/triads/choice-group.test.ts tests/unit/fretboard tests/unit/caged

# E2E, desktop only, after any src/ change
pnpm build:test
pnpm test:e2e:fast e2e/caged-triad.spec.ts e2e/caged-layers.spec.ts e2e/linked-tools.spec.ts

# Screenshot baselines only for snapshot tests added or changed (if any)
pnpm playwright test e2e/caged-triad.spec.ts -g "<test name>" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

## 3. End of slice, once

```bash
pnpm verify   # check, lint, format, Vitest + coverage, build, bundle ≤ 120 KB, desktop e2e
```

Expected: theory coverage ≥ 95%, overall ≥ 80%, zero axe violations, bundle under 120 KB
(estimate +1.2–1.8 KB over 96.7 KB).

## 4. Manual walkthrough (dev server `pnpm dev`, open `/caged`)

| # | Steps | Expected |
|---|---|---|
| 1 | C major, standard 6-string. Tap the A shape tag. Turn on **Triad**. | Selector shows 6-5-4, 5-4-3 (disabled + note), 4-3-2, 3-2-1 (selected). Frets 5-5-3 on strings 3-2-1 enlarged with root/third/fifth glyphs, appearing low → high. Summary "C major, root position, strings 3-2-1, frets 5-5-3". |
| 2 | Switch labels to Note names | The three show C, E, G |
| 3 | Pick 4-3-2 | 5-5-5 (2nd inversion) highlighted; announcement names it |
| 4 | Arrow onto 5-4-3 | Focus lands, "unavailable" announced, selection unchanged |
| 5 | Turn Arpeggio on, then off | Triad unchanged |
| 6 | Select G shape (Next shape) | 3-2-1 unavailable there → moves to 6-5-4 (8-7-5) with announcement |
| 7 | **Open in Triads** | Triads: C major, root position (for 6-5-4 G-shape triad), set 6-5-4, Isolated |
| 8 | Back | CAGED as left: Triad on, set 6-5-4, G shape focused |
| 9 | D shape, set 3-2-1 → Open in Triads | Triads shows 2nd inversion at 12-13-12 (Octave up state) |
| 10 | **See all** with Chord off and only Triad on | Chord back on (announced), Triad switch still on, no triad drawn |
| 11 | Instrument: Half step down, key E major, A shape, Triad on | Note names are spelled from the real (sounding) pitch, per slice 015 rules; the triad is the same drawing as in standard tuning |
| 12 | Drop D, D major, E shape, set 6-5-4 | Uses string 6 from D2, or set disabled |
| 13 | 7-string | 7-6-5 offered first in the selector |
| 14 | Non-compatible custom tuning | Triad switch disabled beside the existing notice; state kept on return |
| 15 | Reset tool | Triad off; reload also clears it |
| 16 | OS reduced motion on, toggle Triad | Markers appear at once |

## 5. Acceptance-to-test map

| Story | Vitest | Playwright (`e2e/caged-triad.spec.ts`) |
|---|---|---|
| US1 (1–6) | theory anchors, resolution table, model labels, reveal ids | `US1: triad in the A shape`, label, set change, arpeggio-off, one marker, reduced motion |
| US2 (1–4) | availability, settle-move, all-unavailable | `US2: disabled sets reachable and explained`, moved announcement |
| US3 (1–4) | `carryCagedTriad` table | `US3: Open in Triads` (major, minor, octave up, return) |
| US4 (1–4) | toggle sequences, `ensureDrawable` | `US4: auto-focus`, focus cleared, See all restore, last-layer disabled |
| US5 (1–4) | Half step down, Drop D, 7-string, non-compatible | `US5: tunings` |
