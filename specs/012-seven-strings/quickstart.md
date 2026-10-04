# Quickstart: Validating Seven-String Guitars

**Feature**: `012-seven-strings` | **Plan**: [plan.md](./plan.md)

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
pnpm build && node scripts/check-bundle-size.mjs   # initial JS ≤ 85 KB gzip
pnpm test:e2e         # Playwright phone 360 px + desktop, axe zero violations
```

## 2. Focused unit suites

```bash
pnpm vitest run tests/unit/theory/pitch.test.ts tests/unit/theory/triad-shape.test.ts
pnpm vitest run tests/unit/instrument tests/unit/state/instrument-config.test.ts
pnpm vitest run tests/unit/state/notes-adapt.test.ts tests/unit/state/triads-view.test.ts
pnpm vitest run tests/unit/prefs
```

Expected: new table tests reproduce TM-5.5 7-6-5 (12 shapes), the derived 7-string preset rows,
every transition row of data-model §4/§6 and every fixture of
[storage-format.md](./contracts/storage-format.md); all pre-012 tests unchanged and green
(SC-006).

## 3. Manual / Playwright scenarios (`pnpm dev`, open http://localhost:5173)

| # | Steps | Expected |
|---|---|---|
| Q1 | Home → Instrument → "7 strings" → Confirm → Notes | 7 rows; string 7 open label B; no tuning badge; summary "7 strings · standard tuning · right-handed" |
| Q2 | Q1, tap string 7 fret 0 | plays B1 (≈ 61.7 Hz; test hook records pitch 35) |
| Q3 | Panel with 7 strings, read tuning list | 12 rows in FR-003 order; no "Standard"/"Half step down" rows; Drop D row "A1 D2 A2 D3 G3 B3 E4" |
| Q4 | 7 strings → Drop A → Confirm; tap string 7 fret 0 | badge "Drop A"; plays A1 (pitch 33) |
| Q5 | 6-string Drop D confirmed → panel → 7 strings | Drop D stays checked, preview shows A1 D2 A2 D3 G3 B3 E4; Confirm → badge "Drop D" |
| Q6 | 7 strings → Custom → lower string 7 repeatedly | stops at E1, "Lower string 7" disabled, no error text; at A1 name line "Drop A", at G♯1 "Custom" |
| Q7 | Notes, 7-string standard, all notes, region frets 0–5 | string 7 shows B C C♯ D D♯ E (TM-9 view 4 screenshot fixture) |
| Q8 | Drop A, Notes, open card string 7 fret 12 | unisons: string 6 fret 5, string 5 fret 0 |
| Q9 | Notes filter strings 1–3 only → 7 strings → Confirm | string 7 off; strings 1–3 still the only ones on; no notice |
| Q10 | 7 strings, Notes filter only string 7 → 6 strings → Confirm | all six on; "We adjusted the view to the new instrument" |
| Q11 | 7-string standard, Triads, set 7-6-5, C major root position | frets 13-12-10; E minor root position → 5-3-2 (TM-9 view 13 fixture) |
| Q12 | Q11, panel → 6 strings → Confirm | set 6-5-4, notice shown and announced politely |
| Q13 | Triads on 6-5-4 with 7 strings → 6 strings | no change, no notice |
| Q14 | 7-6-5, frets 12 | "This shape lies beyond fret 12" guidance for C major root position |
| Q15 | 7 strings confirmed → reload | 7-string instrument restored; `localStorage['fretboard-master:prefs']` contains `"strings":7` |
| Q16 | Restore default in panel → Confirm | 6 strings, Standard, 22 frets; stored record has no `strings` key |
| Q17 | Close panel after choosing 7 strings without Confirm | instrument still 6 strings |
| Q18 | Keyboard: focus fretboard, ArrowDown from string 6 | focus reaches string 7; screen-reader text "String 7, …" with accidentals in full |

Automated homes: Q1–Q6, Q15–Q17 → `e2e/instrument-panel.spec.ts` / new
`e2e/seven-strings.spec.ts`; Q7–Q10 → `e2e/notes.spec.ts`, `e2e/notes-tm9.spec.ts`; Q11–Q14 →
`e2e/triads.spec.ts`, `e2e/triads-tm9.spec.ts`; Q18 → `e2e/fretboard.spec.ts`. Each runs an axe
scan (SC-008).

## 4. Performance (SC-005, NFR-1.6)

```bash
pnpm build:test && pnpm playwright test e2e/perf.spec.ts
```

New cases with 7 strings × 24 frets at 4× CPU throttle: Confirm → updated board ≤ 300 ms,
control change → board ≤ 100 ms, and the scroll/drag smoothness check passes; a geometry
assertion confirms bounding boxes of root markers on neighboring strings at the same fret do not
intersect.
