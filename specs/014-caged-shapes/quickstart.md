# Quickstart: Validating the Five CAGED Shapes

**Feature**: `014-caged-shapes` | **Plan**: [plan.md](./plan.md)

These are runnable checks that prove the slice works end to end. Expected values come from the
spec and [data-model.md](./data-model.md). Interfaces come from [contracts/](./contracts/).
Local runs follow the constitution's verification tiers (CLAUDE.md). The full browser matrix
runs only in CI.

## Prerequisites

```bash
mise install
pnpm install
```

## 1. Per-task checks (targeted)

```bash
# Theory (table + property, test-first)
pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts
# State / model / store
pnpm vitest run tests/unit/state/caged-view.test.ts tests/unit/state/caged-model.test.ts tests/unit/state/caged-store.test.ts
# Shell + prefs + fretboard touch points
pnpm vitest run tests/unit/tools.test.ts tests/unit/screens.test.ts tests/unit/routes.test.ts \
  tests/unit/prefs tests/unit/state/preferences-store.test.ts tests/unit/state/links-store.test.ts \
  tests/unit/state/instrument-store.test.ts tests/unit/fretboard/fretboard.test.ts tests/unit/caged
# E2E (desktop project only)
pnpm build:test
pnpm test:e2e:fast e2e/caged.spec.ts e2e/caged-tm9.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts \
  e2e/resilience.spec.ts e2e/preferences.spec.ts e2e/perf.spec.ts
# New screenshot baselines (TM-9 view 15 and its left-handed variant)
pnpm playwright test e2e/caged-tm9.spec.ts -g "tm9 view 15" --project=phone --project=phone-touch --project=desktop --update-snapshots
```

## 2. End of slice (once)

```bash
pnpm verify   # check, lint (theory boundary), format, Vitest + coverage, build, bundle ≤ 90 KB, e2e desktop
```

Expected results:

- `src/lib/theory` coverage is ≥ 95 % lines and branches.
- The bundle check passes. The estimate is 88–89 KB against the 90 KB cap (research R-12).
  If it fails, stop and raise a constitution amendment. Do not ship over budget.

## 3. Scenario checklist

Each scenario maps to an automated test. The second column is the expected outcome.

| # | Scenario (spec) | Expected |
|---|---|---|
| Q1 | US1-1 Home | The third card is "CAGED", with "How does the whole neck connect?" and a thumbnail. Nav order is Notes, Triads, CAGED. `/caged` loads |
| Q2 | US1-2 Open | "C major". No layer, label or connection controls |
| Q3 | US1-3 C major AF-1 22 frets | Tags in order C, A, G, E, D. Start frets 0, 3, 5, 8, 10. Markers match TM-6.1 shifted 0. Labels R/3/5 |
| Q4 | US1-4 Tags | "C shape · roots on strings 5, 2" … "D shape · roots on strings 4, 2". No two tag boxes intersect. Roots are square markers |
| Q5 | US1-5 24 frets | Tags at frets 0 and 12 both read "C shape · roots on strings 5, 2". Nine tags in total |
| Q6 | US2-1 Pick G | G 0, E 3, D 5, C 7, A 10 |
| Q7 | US2-2 D♭ / F♯ | D♭: C1 A4 G6 E9 D11. F♯: E2 D4 C6 A9 G11 |
| Q8 | US2-3 Spelling | C♯/D♭ major → "D♭ major". Minor → "C♯ minor". Switch → "D♭ minor". Major → "D♭ major" |
| Q9 | US2-4 Below nut | G major: there is no C-shape tag below fret 7. The first tag is G at 0 |
| Q10 | US3-1 G minor | Gm 0, Em 3, Dm 5, Cm 7, Am 10. Tags "Gm shape · …" |
| Q11 | US3-2 C minor frets | The marker set equals TM-7.1. Cm's muted strings stay empty: there is no marker on string 6 in frets 0–3 or on string 1 in frets 0–2 (string 1 fret 3 belongs to Am) |
| Q12 | US3-3 Minor labels | Third markers are labelled "♭3" |
| Q13 | US4-1 12 frets C | No D tag. Status "With 12 frets, 4 shapes fit on the fretboard" |
| Q14 | US4-2 G/12, any/22, any/24 | No fit note |
| Q15 | US4-3 7 strings AF-21 | No marker on string 7. Markers are identical to AF-1 on strings 6–1 |
| Q16 | US4-4 Change frets, strings, handedness, orientation | Immediate redraw. The key/quality heading is unchanged |
| Q17 | US5-1 Half step down | C major: C1 A4 G6 E9 D11, with "C shape" … tags |
| Q18 | US5-2 Drop D, Open G | The exact message, zero markers, zero tags, no fit note, no buttons in zone C. Controls visible |
| Q19 | US5-3 Back to Standard | Shapes are redrawn for the kept key and quality |
| Q20 | US6-1 Session | G minor → Triads → CAGED: G minor is shown. Triads is still C major |
| Q21 | US6-2 Continue | After opening CAGED, home shows "Continue" on the CAGED card (also after a reload, from storage) |
| Q22 | US6-3 History | After 3 key changes, one browser Back leaves `/caged` |
| Q23 | US6-4 Reset | Reset tool → "C major", no override. The instrument summary is unchanged |
| Q24 | FR-013 Left-handed + lowest-on-top | Same tag texts and marker set. Tag order is mirrored. axe is clean |
| Q25 | FR-014 a11y | Tab order is per contracts/caged-ui §6. Tags are not focusable. The description lists the five occurrences. axe has zero violations at 320 px and 2560 px |
| Q26 | TM-9 view 15 | The screenshot fixture matches on phone, phone-touch and desktop, plus the left-handed variant (part of view 22) |
| Q27 | SC-004 / perf | Key change → board updated ≤ 100 ms. Open CAGED ≤ 300 ms (`e2e/perf.spec.ts`) |

## 4. Manual smoke (optional)

```bash
pnpm dev   # open http://localhost:5173/caged
```

Pick each of the 12 keys in major and minor, then compare against the TM-6.2 table. Switch the
instrument to Drop D and back.
