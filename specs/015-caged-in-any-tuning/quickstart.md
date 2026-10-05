# Quickstart: CAGED Across Tunings (slice 015)

## 1. Set up and run

```bash
mise install          # pinned Node + pnpm
pnpm install
pnpm dev              # http://localhost:5173/caged
```

To pick a tuning by hand, open the instrument panel (header button), choose a preset (for
example Open G), and confirm.

## 2. Verification (constitution "Verification tiers")

| When | Command |
|---|---|
| Theory and state (per task) | `pnpm vitest run tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts tests/unit/state/caged-model.test.ts tests/unit/state/caged-store.test.ts tests/unit/state/instrument-store.test.ts tests/unit/state/links-store.test.ts tests/unit/instrument/tunings.test.ts` |
| Renderer and components | `pnpm vitest run tests/unit/fretboard/fretboard.test.ts tests/unit/fretboard/geometry.test.ts tests/unit/caged/caged-tool.test.ts tests/unit/tuning-badge.test.ts tests/unit/no-raw-text.test.ts` |
| E2E (after `src/` change) | `pnpm build:test`, then `pnpm test:e2e:fast e2e/caged-tunings.spec.ts e2e/caged.spec.ts` |
| New screenshots | `pnpm playwright test e2e/caged-tm9.spec.ts -g "Drop D\|Open G notice" --project=phone --project=phone-touch --project=desktop --update-snapshots` |
| End of slice, once | `pnpm verify` (includes bundle ≤ 90 KB and ≥ 95 % theory coverage) |

Do not run the full `pnpm test:e2e` matrix or `pnpm lhci` locally.

## 3. Manual validation scenarios

| # | Steps | Expected |
|---|---|---|
| Q1 | Instrument → Open G → Confirm; open CAGED | No board. The text reads "CAGED depends on the standard relationship between the strings, so its shapes don't exist in Open G." It is followed by the buttons **View in standard tuning** and **Go to Triads**. Key C and Major are still selected |
| Q2 | Q1 → View in standard tuning | Five C-major shapes as in Standard. The header shows "Temporary tuning: Standard" |
| Q3 | Q2 → choose key G, then Minor | The badge stays, and the shapes follow the key |
| Q4 | Q2 → reload | The notice is back. The prefs record in DevTools still says AF-8 |
| Q5 | Q2 → Notes → CAGED | The notice is back |
| Q6 | Q2 → click the badge | The panel shows Open G selected. Cancel → the temporary view stays. Badge → Confirm → the notice shows |
| Q7 | Q1 → Go to Triads | Triads opens, and the header badge reads "Open G" |
| Q8 | Standard, CAGED open → panel → DADGAD → Confirm | The notice appears at once, and the key and quality are kept |
| Q9 | Half step down, key E♭ major | The E shape at fret 0 has the tag "E shape · roots on strings 6, 4, 1". Tapping a root gives E♭ |
| Q10 | Half step down, key G♭ major | The E shape starts at fret 3 and spells G♭–B♭–D♭ |
| Q11 | Drop D, key D major | String 6 is labelled "altered". The E shape (frets 10–12) has string-6 D only at 12, and its tag reads "E shape · roots on strings 4, 1". The G shape (7–10) has string-6 A only at 7 |
| Q12 | Drop D, 12 frets, a key whose low G/E shape region has no chord tone on string 6 | No string-6 marker in that region, and "altered" is still shown |
| Q13 | Drop C, any key, compared with Whole step down | The same tag start frets |
| Q14 | 7-string, then Open G (7-string) → View in standard tuning | "Temporary tuning: 7-string standard", 7 string rows |
| Q15 | Drop D, left-handed, lowest-top | "altered" sits beside string 6's label on the mirrored side |
| Q16 | Screen reader on Drop D | The description starts "Tuning: Drop D. String 6 is altered: …" |

## 4. Acceptance traceability

| Spec item | Unit tests | E2E |
|---|---|---|
| US1-1 … US1-8 | caged-model M1/M2/M7, caged-store, instrument-store, links-store | E1–E8 |
| US2-1 … US2-3 | caged.test T7–T9, caged-model M5/M6 | E9, E10 |
| US3-1 … US3-6 | caged.test T1–T6, T10, T12; properties P1–P5; caged-model M3/M4 | E11–E13 |
| FR-013/FR-014, SC-007 | caged-model M8, fretboard marks | A1–A4 |
| SC-001 | caged.test classes + T11 | E14 |
| SC-005 | instrument-store (no `remember`) | E2, E4, E7 |
| SC-006 | — | perf case |
| FR-017 | caged-model M9 | E11 (accessible name "D … string 6 fret 12") |
