# Quickstart: validate English, Portuguese, and Spanish (020)

Runnable checks proving the slice works end to end. Contracts:
[language-api.md](./contracts/language-api.md), [language-ui.md](./contracts/language-ui.md);
entities: [data-model.md](./data-model.md).

## Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
pnpm check            # compiles the three catalogs; fails on any key missing from English
```

Local verification follows the constitution's tiers (see `CLAUDE.md`): targeted Vitest and
`pnpm test:e2e:fast <specs>` on the `desktop` project during tasks; `pnpm verify` once at the
end. Do not run the full Playwright matrix or `pnpm lhci` locally.

## 1. Unit checks (Vitest)

```bash
pnpm vitest run \
  tests/unit/i18n/languages.test.ts \
  tests/unit/i18n/gaps.test.ts \
  tests/unit/i18n/paraglide-fallback.test.ts \
  tests/unit/i18n/missing-base-key.test.ts \
  tests/unit/i18n/catalogs.test.ts \
  tests/unit/i18n/glossary.test.ts \
  tests/unit/language-store.test.ts \
  tests/unit/language-selector.test.ts \
  tests/unit/language-panel.test.ts \
  tests/unit/prefs
```

Expected:
- `matchDeviceLanguage` table (contract §1) green, including SC-002's ten cases.
- Catalogs: zero missing / empty / extra / placeholder-mismatched / English-identical outside the
  allowlist (SC-001).
- Paraglide fallback fixture: key removed from `pt-BR` → English text for `pt-BR` (US5-1).
- Gap reporter: one `console.warn('[fretboard-master] missing text', { key, locale })` per key per
  locale per session; `fetch` and `localStorage.setItem` untouched (SC-007).
- Store: `start(null)` with device `['pt-PT']` → `pt-BR`, no storage write (US1-5);
  `choose('es')` → writes `"language":"es"`; `restore(null)` after erase → device language.
- Prefs fixtures: `bad-language.txt` → `language: null`, other fields kept; record without
  `language` serializes byte-identically to slice 019.
- Component tests: selector order/autonyms/`lang` attributes constant in all three UI
  languages; switching re-renders text without remounting (focused radio stays focused).

## 2. Missing English key fails the build (US5-2)

Automated by `tests/unit/i18n/missing-base-key.test.ts` (in the §1 Vitest run): a fixture file
calling `m.not_a_key()` is type-checked with the TypeScript compiler API and must report TS2339
"Property 'not_a_key' does not exist" (the same check `pnpm check` runs); a control call to an
existing key reports none.

## 3. End-to-end (Playwright, desktop project)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/languages.spec.ts e2e/languages-layout.spec.ts
```

Scenarios covered (each maps to an acceptance scenario):

| Scenario | Setup | Expect |
| --- | --- | --- |
| US1-1/3, SC-002 | context `locale` pt-PT, pt-BR, es-ES, es-MX, es-419, en-GB, en-US, fr, ja | `<html lang>` = pt-BR, pt-BR, es, es, es, en, en, en, en |
| US1-4 | init script `navigator.languages = ['fr-FR','es-MX']` | Spanish |
| US1-5 | pt-PT, no stored record | `localStorage` has no `language` |
| US2-1 | Triads comparison on, English → Español via panel | comparison stays, Spanish text, root label "T" |
| US2-2, SC-008 | every tool: open panel, pick | same URL and `history.length`, zero requests, state/focus/scroll unchanged, playback continues |
| US2-3 | pick Português, reload with device en-US | Portuguese |
| US2-4 | home | inline selector: English, Português, Español with `lang` |
| US2-5 | each switch | `<html lang>` and `document.title` updated |
| US2-6 | instrument panel / a notice open, switch | stays open, text updated |
| US3-1 | every screen × language | `<html lang>` + key sample from that catalog |
| US3-3, SC-005 | 320 px, 100 % | every notice ≤ 2 lines |
| US4-1/2, SC-004 | 320 px × {100 %, 200 %} × 7 views × 3 languages | no truncation, overlap, or page horizontal scroll |
| FR-014 | first load in es | no `hydration_mismatch` console message |
| erase | About → Erase in Portuguese with device en-US | English immediately |

New/changed screenshot baselines (only if a test adds one):

```bash
pnpm playwright test e2e/languages.spec.ts -g "<test name>" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

## 4. Manual smoke (optional)

```bash
pnpm build && node scripts/serve-build.mjs
```
Open `/triads` in a browser set to Spanish → interface Spanish; choose English in the app-bar
Language panel → instant switch, URL unchanged; reload → English (stored).

## 5. Budget

```bash
pnpm build && node scripts/check-bundle-size.mjs build
```
Expected: `initial JS gzip: ≈115–117 KB ≤ 120 KB` (101.4 KB before this slice, research R-06).

## 6. End of slice

```bash
pnpm verify
```
