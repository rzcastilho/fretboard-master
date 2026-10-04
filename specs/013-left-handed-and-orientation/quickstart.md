# Quickstart: Validating Left-Handed Mode and String Orientation

**Feature**: `013-left-handed-and-orientation` | **Plan**: [plan.md](./plan.md)

Runnable checks that prove the slice works end to end. Expected values come from the spec and
[data-model.md](./data-model.md); interfaces from [contracts/](./contracts/).

## Prerequisites

```bash
mise install          # Node + pnpm pinned in mise.toml
pnpm install
```

## 1. Gates (must all pass, CI parity)

```bash
pnpm check            # paraglide compile + svelte-check (strict TS)
pnpm lint             # incl. theory import boundary
pnpm format:check
pnpm test:unit        # Vitest: ≥95 % theory coverage, ≥80 % overall
pnpm build && node scripts/check-bundle-size.mjs   # initial JS ≤ 90 KB gzip
pnpm test:e2e         # Playwright phone 360 px + desktop, axe zero violations
```

## 2. Focused unit suites

```bash
pnpm vitest run tests/unit/fretboard            # geometry 4-combination table, moveFocus, nut-offset scroll
pnpm vitest run tests/unit/state/instrument-config.test.ts tests/unit/state/instrument-store.test.ts
pnpm vitest run tests/unit/prefs                # 5 new fixtures + round-trip property
pnpm vitest run tests/unit/presentation-boundary.test.ts
pnpm vitest run tests/unit/instrument-panel.test.ts tests/unit/home-screen.test.ts tests/unit/tuning-badge.test.ts
```

Expected: data-model §4 invariants hold for 4 combinations × {6, 7} strings × {12, 24} frets;
every transition row of data-model §3; every fixture of
[storage-format.md](./contracts/storage-format.md); all pre-013 tests green except the two
placeholder `screenOrder` tests that are replaced (research R-13).

## 3. Scenarios (`pnpm dev`, open http://localhost:5173; automated in `e2e/handedness.spec.ts`)

| # | Steps | Expected | Spec |
|---|---|---|---|
| Q1 | Home → summary button → Handedness: Left-handed → Confirm → Fretboard Notes | `.string-label` column rightmost; `.nut` right of fret 1; fret numbers increase leftward; summary ends "left-handed" | US1-1, FR-015 |
| Q2 | Left-handed → Triads, A major, 3-2-1, Full neck | nut right; tags right → left: root, 1st, 2nd | US1-2 |
| Q3 | Left-handed → Triads comparison on | arrows point the mirrored way, label states the fret distance | US1-3 |
| Q4 | Left-handed → Notes with a region (e.g. 5–8) | band covers frets 5–8, mirrored | US1-4 |
| Q5 | Left-handed, focus cell string 3 fret 5 → ArrowLeft / ArrowRight | 3:6 / 3:4 | US1-5, FR-010 |
| Q6 | Left-handed, highest on top | fret numbers below the board, tags above | US1-6, FR-005 |
| Q7 | Each combination: tap string 3 fret 5 | same note, same reported position (`__fmFretboardEvents`, audio log) | US1-7, FR-008 |
| Q8 | Open panel, choose Left-handed, check preview, Close | preview mirrored while open; board stays right-handed after close | US1-8, FR-002 |
| Q9 | Strings on top: Lowest → Confirm; tap top string fret 0 | string 6 on top; E2 plays; reported 6:0 | US2-1/2 |
| Q10 | 7 strings + lowest on top | string 7 on top, thickest | US2-3, FR-006 |
| Q11 | Triads Full neck, switch to lowest on top | fret numbers above, tags below | US2-5 |
| Q12 | Lowest on top, focus string 5 → ArrowUp | focus on string 6 | US2-6 |
| Q13 | Left-handed + screen reader (or Tab/arrow + accessible-name assertions) | cells read nut → body; description text identical to right-handed; no "left"/"right" | US3, FR-009 |
| Q14 | Left + lowest → Confirm → reload | both still applied | US4-1/2 |
| Q15 | Seed `{"version":1,"handedness":"LEFT","orientation":"lowest-top","tuning":"AF-2"}` → load | right-handed, lowest on top, Half step down; no error | US4-3 |
| Q16 | Seed a pre-013 record (`v1-full`) → load | loads as before, right / highest | US4-4 |
| Q17 | Erase preferences → reload | right / highest | US4-5 |
| Q18 | Storage unavailable (existing fault hook) → set left | applies for session; existing storage notice | US4-6 |
| Q19 | Non-default instrument → Restore default → Confirm | right / highest + other defaults | US4-7, FR-012 |
| Q20 | 320 px, 24 frets, left-handed, Notes no region | only the board scrolls; nut and fret 1 visible unscrolled | US5-1, FR-014 |
| Q21 | Left-handed, change frets 22 → 24 and back | neck grows leftward; same frets stay in view | US5-3 |
| Q22 | Scroll mid-neck, switch handedness | same frets in view (mirrored), no animation | FR-014, FR-017 |
| Q23 | Switch handedness in Triads with a notice-free view | no "We adjusted the view…" notice, view state unchanged, sound not stopped | FR-017 |
| Q24 | All 4 combos × 320 / 768 / 2560 px × 6/7 strings × 12/24 frets | no page horizontal scroll, axe zero violations, targets ≥ 44 px | US5, SC-007 |
| Q25 | Home with left-handed confirmed | every tool-card thumbnail has nut on the right | FR-015 |
| Q26 | Each of the 4 combinations: Triads, C major, 3-2-1 → change quality major → minor | only the third's marker moves (same DOM node, changed `transform`, slides toward the nut — rightward when left-handed); root and fifth markers are the same DOM nodes with unchanged `transform`; board updated ≤ 100 ms | US5-4, FR-021 (006), FR-013 (007) |

Seeding a record in Playwright (production startup path, no new test hook):

```ts
await page.addInitScript(() =>
  localStorage.setItem('fretboard-master:prefs', '{"version":1,"handedness":"left"}')
);
```

## 4. Teacher-review fixture and performance

```bash
pnpm playwright test e2e/triads-tm9.spec.ts -g "view 22"   # TM-9 view 22 = view 6 left-handed
pnpm playwright test e2e/perf.spec.ts -g "handedness"       # switch → board updated ≤ 100 ms
```

First run with `--update-snapshots` creates `tm9-view-22-{desktop,phone,phone-touch}-darwin.png`;
review by eye: nut on the right, tags root → 1st → 2nd running right to left, fret numbers below.
