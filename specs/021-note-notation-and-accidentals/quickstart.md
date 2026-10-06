# Quickstart: Validating Letters or Solfège, Sharps or Flats

**Feature**: `021-note-notation-and-accidentals` | Contracts:
[notation-api.md](./contracts/notation-api.md), [notation-ui.md](./contracts/notation-ui.md) |
Model: [data-model.md](./data-model.md)

This is a run guide, not an implementation. Keep local runs targeted
(Constitution "Verification tiers", `CLAUDE.md`).

## Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
```

On this macOS, e2e runs on installed Google Chrome (`pw.local.config.ts`).

## 1. Unit checks (Vitest)

```bash
pnpm vitest run \
  tests/unit/notation/notation.test.ts \
  tests/unit/notation/policy.test.ts \
  tests/unit/fretboard/label-fit.test.ts \
  tests/unit/fretboard/fretboard.test.ts \
  tests/unit/fretboard/description.test.ts \
  tests/unit/i18n/languages.test.ts \
  tests/unit/i18n/catalogs.test.ts \
  tests/unit/prefs/schema.test.ts \
  tests/unit/state/notation-store.test.ts \
  tests/unit/state/preferences-store.test.ts \
  tests/unit/state/notes-model.test.ts \
  tests/unit/instrument \
  tests/unit/notation-selector.test.ts \
  tests/unit/notation-toggle.test.ts \
  tests/unit/language-panel.test.ts \
  tests/unit/tool-layout.test.ts
```

Expected outcomes:

| Contract rule | Expected |
|---|---|
| N-2, N-3 | Solfège syllables per locale. A property test over every spelling × notation × locale finds no `#` or `[A-G…]b` |
| N-4, US4-3, US4-4 | "F sharp", "Fa sharp", "Fá sustenido", "Fa sostenido", "B double flat" |
| N-6 – N-9 | Policy table holds. Presets keep E♭. Triad and CAGED spelling is unchanged |
| F-1 | Existing Fretboard and description tests unchanged (Triads/CAGED byte-identical) |
| F-3 | `fitMarkerLabel` examples from data-model §11 |
| S-1, US1-4, US1-5 | es gives solfège, en/pt-BR give letters. An explicit pick survives a language change |
| P-1 – P-5 | New fixtures parse. Old fixtures round-trip byte-identically. Bad values fall back alone |
| I-1 | Custom tuning equal to Half step down gives `fixedSpelling: true` |
| T-1 | `tuningLabel` gives "Drop Re" / "Aberta em Sol" in solfège. DADGAD is literal |

Also run the theory gate (Constitution I). It must stay green untouched:

```bash
pnpm vitest run tests/unit/theory
```

## 2. End-to-end (Playwright, desktop project)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/notation.spec.ts e2e/notation-layout.spec.ts e2e/caged.spec.ts e2e/preferences.spec.ts e2e/perf.spec.ts
```

| Scenario | Spec / test |
|---|---|
| US1-1 / SC-001: es first visit, Notes naturals read Do Re Mi Fa Sol La Si | `notation.spec.ts` "spanish default" |
| US1-2, US1-3: en → solfège; pt-BR solfège reads Dó Ré Mi Fá Sol Lá Si | "switch to solfège" |
| US1-4, US1-5: explicit letters survive es → en; en/pt-BR default letters | "explicit choice sticks" |
| US2-1 / SC-002: bar toggle in each tool, no stale names, state kept, no reload | "toggle reaches every surface" (×3 tools) |
| US2-2: toggle ↔ panel agree | "one shared state" |
| US2-3: tuning, string names, selector, composition, description in solfège | "solfège everywhere" |
| US2-4 / SC-008: reload remembers; corrupt value → defaults, no error screen | "persistence" |
| US3-1 / SC-003: flats → D♭ E♭ G♭ A♭ B♭; Triads A major still A–C♯–E | "flats in notes, theory in triads" |
| US3-3: both → stacked on medium/root, sharp on small, card shows both | "both spellings" |
| US3-4, US3-5: Half step down keeps E♭; custom altered string follows policy | "string names" |
| US4-1 / SC-004: no `#` / `b` across 18 combinations × 3 tools | "no ascii accidentals" |
| US4-2: "Sol♯" min size, "So♯3" abbreviated, full name on card | "label fit" |
| US4-3, US4-4 / SC-005: aria and live-region text in full | "spoken names" |
| US4-5 / SC-007: 200 % text, no truncation or overlap | `notation-layout.spec.ts` |
| US5-1 … US5-5 / SC-006: CAGED tags letters, note once, on switch, never again | `caged.spec.ts` "solfège note" |
| FR-006 ≤ 100 ms | `perf.spec.ts` "notation switch" |

Axe runs inside the new specs (zero violations expected).

## 3. Screenshot fixtures (new tests only)

```bash
pnpm playwright test e2e/notation.spec.ts -g "accidental glyphs" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

Expected: F♯, Sol♯, F𝄪, and B𝄫 on root and medium markers, with glyphs at letter weight and
baseline.

## 4. Manual smoke (optional)

1. `pnpm dev`, then open `/notes` with the browser language set to Spanish. Naturals read Do Re
   Mi…
2. Open the language panel, pick Flats, and select D♭ / C♯. The markers read D♭.
3. Switch to `/triads`, A major. It reads A–C♯–E.
4. Pick Half step down. The 6th string reads Mi♭ (solfège) or E♭ (letters).
5. Clear storage, switch to solfège, and open `/caged`. The tags read "E shape" and the note
   shows once. Reload: no note.

## 5. Budget

```bash
pnpm build && node scripts/check-bundle-size.mjs build   # expect ≤ 120 KB gzip (R-15)
```

## 6. End of slice (once)

```bash
pnpm verify
```
