# Quickstart: validate Describe This View, Legend, and the accessibility audit

Contracts: [view-aids-ui.md](./contracts/view-aids-ui.md),
[description-legend-api.md](./contracts/description-legend-api.md). Entities:
[data-model.md](./data-model.md). Decisions: [research.md](./research.md).

## 0. Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
pnpm build:test       # once, and again after any src/ change
```

E2E locally runs the `desktop` project only (`pnpm test:e2e:fast`, installed Chrome).

## 1. Unit (pure modules, tokens)

```bash
pnpm vitest run \
  tests/unit/fretboard/description.test.ts \
  tests/unit/fretboard/legend.test.ts \
  tests/unit/fretboard/announce.test.ts \
  tests/unit/fretboard/view-aids.test.ts \
  tests/unit/fretboard/fretboard.test.ts \
  tests/unit/a11y/palette-cvd.test.ts \
  tests/unit/a11y/focus-ring.test.ts \
  tests/unit/reserved-colors.test.ts tests/unit/no-raw-text.test.ts
```

Expected:
- Triads A major, first inversion, 4-3-2 (en) → exactly
  `A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root.`
- Same in pt-BR + solfège → Portuguese words, solfège names, accidentals spelled out.
- Left-handed / strings-on-top variants → identical strings.
- Announcer: first update silent; 3 updates within 500 ms → one emit 500 ms after the last.
- Legend fixtures table in the API contract all pass; CAGED + Pentatonic → groups Chord,
  Arpeggio, Pentatonic.
- CVD: every root/third/fifth pair ΔE00 ≥ 10 (protan, deutan, tritan × light, dark).
- Focus ring: two-tone min contrast ≥ 3:1 against wood and every marker fill, both themes.

## 2. E2E (spec files this slice adds/edits)

```bash
pnpm test:e2e:fast e2e/view-aids.spec.ts e2e/a11y-keyboard.spec.ts \
  e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts
# plus every pre-existing spec edited for the relabel/debounce, e.g.
pnpm test:e2e:fast e2e/fretboard.spec.ts e2e/triads.spec.ts e2e/caged-layers.spec.ts \
  e2e/caged-triad.spec.ts e2e/languages.spec.ts e2e/notation.spec.ts \
  e2e/instrument-panel.spec.ts e2e/open-link.spec.ts
```

Scenarios proven (spec acceptance → spec file):

| Scenario | Spec file | Expected |
|---|---|---|
| US1-1..7 description text per tool, empty view | `view-aids.spec.ts` | panel text equals expected; never blank |
| US2-1/2 one announcement 500 ms after last change, focus unchanged | `view-aids.spec.ts` (`page.clock`) | live region empty at 499 ms, final text at 501 ms; `document.activeElement` unchanged |
| US2-3 arrow keys across positions | `view-aids.spec.ts` | live region unchanged |
| US2-4 panel closed still announces | `view-aids.spec.ts` | live region updated |
| US2-5 language change | `view-aids.spec.ts` | one announcement in Portuguese |
| US3-1..6 Legend contents, updates, Escape, Tab | `view-aids.spec.ts` | exact entry names; Escape → focus on Legend button |
| US4-1..5 keyboard-only flows, ring visible, scroll into view | `a11y-keyboard.spec.ts` | tasks completed with keyboard only; two ring rects on focus |
| US5-1..5 colour independence | `a11y-colour.spec.ts` + unit CVD | rect/circle/polygon glyphs with labels under each simulation |
| US6-1 axe matrix | `a11y-audit.spec.ts` | zero violations, 7 targets × 2 themes × 3 languages × panel states |
| US6-3 sound has visible counterpart | `a11y-audit.spec.ts` | pulse/progress element present during playback |
| SC-008 320 px / 200 % | `view-aids.spec.ts` | `expectNoTruncationOrOverlap` passes with both panels open |

## 3. Screenshots (only tests whose pixels change: new fifth colour, two-tone ring, relabelled button)

```bash
pnpm playwright test <spec> -g "<test name>" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

## 4. Manual (record results in `docs/accessibility-audit.md`)

1. Run `pnpm build:test && pnpm preview`; open `/triads` with VoiceOver (macOS/iOS) and NVDA
   (Windows) if available: change inversion → one polite announcement, focus unchanged.
2. Keyboard only through `/`, `/notes`, `/triads`, `/caged`, `/about`, instrument panel,
   share, shared-view notices: visible focus everywhere, logical order, no trap.
3. 320 px wide window and 200 % browser zoom with Legend + description open: reflow, no
   overlap, no page-level horizontal scroll.
4. Every sound (position tap, Triads listen, CAGED listen): visible pulse/progress.
5. Status messages (notices, copy confirmation, layer on/off) announced politely, no focus move.
6. Check names/roles/states of toggles, selectors, steppers, tabs, panels in the
   accessibility tree.

## 5. End of slice

```bash
pnpm verify          # check, lint, format, full Vitest + coverage, build, bundle size, desktop e2e
```

Expected: green; initial JS ≤ 128 KB gzip (bundle-size check).
