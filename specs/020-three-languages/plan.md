# Implementation Plan: English, Portuguese, and Spanish

**Branch**: `feature/020-three-languages` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-three-languages/spec.md`

## Summary

Ship the whole interface in English, Brazilian Portuguese, and Spanish, with instant in-place
switching. The approach keeps Paraglide JS's compiled catalogs and `baseLocale` strategy, so
prerendered HTML stays English. In the client `init` hook, Paraglide's `getLocale` is routed
through a Svelte `$state` rune with `overwriteGetLocale` (research R-01). The existing ~58
`m.*()` call sites and the pure display models (already evaluated inside `$derived`) then
re-render on switch. Nothing remounts, reloads, navigates, or fetches.

The active language comes from three sources, in order:
1. an optional `language` field added to the v1 preferences record (written only on an
   explicit pick);
2. otherwise, a pure device-language matcher over `navigator.languages`, using primary-subtag
   rules;
3. otherwise, English.

Where the selector lives:
- Home shows the selector inline.
- Tools and About get a non-modal "Language" disclosure panel in the app bar.

Two new catalogs (`messages/pt-BR.json` and `messages/es.json`) are drafted from the glossary.
A completeness, placeholder-parity, and English-identical-allowlist unit test guards them, and a
glossary list (`docs/i18n/glossary.md`) is kept for native review. Missing texts fall back to
English, which Paraglide's compiled output already does (measured). A gap list computed at build
time drives one console warning per key per locale (R-04). Layout is verified at 320 px and 200 %
text in all three languages.

**Recorded assumptions**:
- **Gap warning timing.** The gap warning fires when a locale becomes active, not when the
  missing string first renders. The rejected alternative was patching Paraglide's compiled
  output, which is fragile.
- **Plurals.** Count plurals keep the existing `_one`/`_other` key-pair pattern. The rejected
  alternative was Paraglide plural variants (R-07).
- **Panel type.** The language panel is a disclosure, not a `<dialog>` or popover (R-10).

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`), Svelte 5 (runes), SvelteKit 2 with `adapter-static`

**Primary Dependencies**:
- `@inlang/paraglide-js` 2.25.4 (existing; adds locales `pt-BR` and `es`)
- `valibot` (existing; one new optional field)
- No new runtime dependency

**Storage**: `localStorage` v1 preferences record (`fretboard-master:prefs`) via `src/lib/prefs`. The new optional field is `language`.

**Testing**:
- Vitest + @testing-library/svelte (jsdom) for units and components
- A Paraglide CLI fixture test for the fallback
- Playwright + @axe-core/playwright for e2e and layout

**Target Platform**: Static SPA on Cloudflare Pages, evergreen desktop and mobile browsers (last two majors), 320–2560 CSS px

**Project Type**: Single-project static web app (SvelteKit)

**Performance Goals**:
- Language switch is a pure re-render, within the "control change → update ≤ 100 ms" budget class.
- Switching makes zero network requests.

**Constraints**:
- Initial JS ≤ 120 KB gzip: measured 101.4 KB before the slice, about 115–117 KB projected (R-06).
- All catalogs ship in the initial bundle (FR-015, ADR 0002).
- No URL, cookie, or history changes.
- Prerender stays English.
- No hydration errors.

**Scale/Scope**:
- 353 existing messages plus about 4 new, × 3 languages
- 5 routes and 2 panels to verify at 320 px × {100 %, 200 %}
- About 14 tuning names, of which 5 stay in English

No open unknowns remain. All Phase 0 items are resolved in [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Initial check and post-design re-check both PASS. No violations, so Complexity Tracking is empty.

- [x] **I. Musical Correctness**: N/A for theory code. No file in `src/lib/theory` changes, and
  interval IDs and spellings are untouched. Only the root label text changes (`interval_root`
  R→T), and letter note names and ♯ ♭ 𝄪 𝄫 stay as they are (spec Clarifications).
- [x] **II. On-Device, Static, Private**: All catalogs ship in the bundle, and switching makes
  zero requests (SC-008, tested). Language lives only in local preferences and is erasable. The
  gap log is console-only, with no cookie and no identifier.
- [x] **III. Pure Core, Thin Shell**:
  - `src/lib/i18n` is pure, with a new ESLint DOM/framework boundary.
  - `navigator` and `document` are touched only in `state/language.svelte.ts`.
  - Theory never imports i18n, and view state stays in stores (switching does not remount).
- [x] **IV. Test-First / Tested Behavior**:
  - Matcher, gaps, prefs schema field, and catalog checks are written test-first.
  - Every acceptance scenario US1–US5 is mapped to a Vitest or Playwright test in
    [quickstart.md](./quickstart.md).
  - No timing-dependent tests.
- [x] **V. Accessible (WCAG 2.2 AA)**:
  - Native radio group with a translated legend, and a per-option `lang` attribute (WCAG 3.1.2).
  - `<html lang>` follows the active language (3.1.1).
  - The disclosure panel has Escape, a close button, focus return, and no trap. Targets use
    `--target-min`.
  - Screen-reader text is translated, and accidentals are still read in full ("C sustenido").
  - axe runs on the new specs.
- [x] **VI. Performance Budgets**: Projected about 115–117 KB, which is within the 120 KB cap.
  `check-bundle-size.mjs` gates it. A switch is an in-place re-render, with no added load-time
  work beyond one small synchronous resolution in `init`.
- [x] **VII. Design System Fidelity**:
  - The panel is non-modal and sits in the app bar, without covering the fretboard.
  - Main controls stay outside menus. All styling uses tokens.
  - Notices stay at most two lines in every language (SC-005 test).
  - Only the fretboard scrolls horizontally (SC-004 test).
- [x] **VIII. International From the First Line**:
  - Delivers the principle: three catalogs, layouts verified for text length and 200 % zoom.
  - A fourth language needs only a catalog file plus data registrations (FR-013, R-15).
  - Note names still come only from `src/lib/notation`.
- [x] **IX. Untrusted Input, Versioned Formats**:
  - `language` is parsed with a Valibot picklist; invalid values become `null` and other fields
    are kept.
  - Prefs format version stays 1 (additive field), and fixtures are added, never removed.
  - Language never enters share links, so link fixtures are unaffected.
- [x] **X. Simplicity**:
  - No new dependency, and no abstraction without two uses. `LANGUAGES` feeds the schema,
    selector, matcher, and tests.
  - The panel reuses the existing selector component on home.
  - Fallback is "never blank": missing text shows English.
- [x] **Stack and source layout**:
  - Paraglide, Valibot, and `localStorage` are behind `src/lib/prefs`.
  - New `src/lib/i18n` follows the existing `src/lib/<concern>` pattern, and routes are
    unchanged.
- [x] **Workflow gates**:
  - Conventional Commits, and the merge gate stays in CI.
  - New ADR 0019 records the reactive-locale decision (R-16).
  - Native-speaker glossary review is a pre-launch gate, not a merge gate.

## Project Structure

### Documentation (this feature)

```text
specs/020-three-languages/
├── plan.md              # This file
├── research.md          # Phase 0: R-01 … R-16
├── data-model.md        # Phase 1: Language, preference field, runtime state, catalogs, gap log, glossary
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── language-api.md  # Module contracts (i18n, store, prefs, catalogs)
│   └── language-ui.md   # Observable UI behavior (selector, panel, switch, layout)
├── checklists/          # From /speckit.specify
└── tasks.md             # Phase 2 (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
messages/
├── en.json                       # + language_* keys; catalog fragments fixed (R-07)
├── pt-BR.json                    # NEW
└── es.json                       # NEW
project.inlang/settings.json      # locales: ["en", "pt-BR", "es"]
vite.config.ts                    # define __FM_MISSING_TEXT__ (build + Vitest)
playwright.config.ts, pw.local.config.ts, playwright.local.config.ts, pw.ff.config.ts
                                  # use.locale = 'en-US' (R-12)
eslint.config.js                  # boundary for src/lib/i18n/**
docs/
├── adr/0019-reactive-locale-and-device-language.md   # NEW
└── i18n/glossary.md                                  # NEW (FR-008)
src/
├── app.d.ts                      # declare __FM_MISSING_TEXT__
├── hooks.client.ts               # unchanged call; preferences.start() now starts language
├── lib/
│   ├── i18n/                     # NEW, pure
│   │   ├── languages.ts          # LANGUAGES, LanguageTag, isLanguageTag, matchDeviceLanguage
│   │   └── gaps.ts               # findMissingKeys, takeUnreported, GAP_WARNING
│   ├── prefs/schema.ts           # + language field (parse/serialize)
│   ├── state/
│   │   ├── language.svelte.ts    # NEW runes store (overwriteGetLocale, html lang, gaps)
│   │   ├── preferences.svelte.ts # start → language.start; erase → language.restore(null)
│   │   └── triads-model.ts, caged-model.ts   # fragment concatenations → single messages
│   └── shell/
│       ├── LanguageSelector.svelte   # NEW
│       ├── LanguageButton.svelte     # NEW (app-bar toggle)
│       ├── LanguagePanel.svelte      # NEW (non-modal disclosure)
│       ├── HomeScreen.svelte         # inline selector
│       ├── ToolLayout.svelte         # LanguageButton + panel in header
│       └── *.svelte (CSS)            # wrap/min-size fixes found by layout spec
└── routes/about/+page.svelte     # LanguageButton + panel in header
tests/unit/
├── i18n/{languages,gaps,paraglide-fallback,missing-base-key,catalogs,glossary}.test.ts   # NEW
├── i18n/identical-allowlist.ts                                          # NEW
├── language-store.test.ts, language-selector.test.ts, language-panel.test.ts  # NEW
└── prefs/fixtures/{language-pt,language-es,bad-language,language-number}.txt  # NEW (add-only)
e2e/
├── languages.spec.ts             # NEW: detection, switching, persistence, per-screen sample
├── languages-layout.spec.ts      # NEW: 320 px × 100/200 % × 3 languages, notice lines
└── support/helpers.ts            # + expectNoTruncationOrOverlap, setTextScale
```

**Structure Decision**: Single SvelteKit project, using the existing directories `src/lib/prefs`,
`src/lib/state`, `src/lib/shell`, `src/routes`, `messages/`, `tests/unit/`, `e2e/`, and
`docs/adr/`. The only new source directory is `src/lib/i18n/`, for pure language data and logic.
It sits beside `src/lib/notation`, which is likewise pure and boundary-linted. The only new docs
directory is `docs/i18n/`, for the review glossary. No routes are added.

## Phase 0 / Phase 1 outputs

- [research.md](./research.md): reactive locale (R-01), init-time resolution (R-02), matching
  (R-03), fallback and gap warning (R-04, R-05), bundle (R-06), plurals and fragment audit
  (R-07), catalog tests (R-08), R/T (R-09), selector and panel (R-10), layout measurement
  (R-11), e2e locale pinning (R-12), glossary (R-13), erase and unavailable storage (R-14),
  fourth language (R-15), ADR (R-16).
- [data-model.md](./data-model.md), [contracts/language-api.md](./contracts/language-api.md),
  [contracts/language-ui.md](./contracts/language-ui.md), [quickstart.md](./quickstart.md).

## Risks

| Risk | Mitigation |
| --- | --- |
| Bundle exceeds 120 KB once two catalogs land | Measure right after the catalogs land, before UI work. First trim verbose prose; an amendment only as a last resort (R-06). |
| A string is computed outside a reactive scope and does not switch | The per-screen e2e sample in every language, plus a review grep for `m.` in module top-level constants. Display models already run in `$derived`. |
| Hydration mismatch when the first render is not English | Same pattern as the instrument restore (ADR 0013), plus an e2e assertion of no hydration warnings (contract language-ui §5). |
| Existing English e2e assertions break on non-English runners | `use.locale: 'en-US'` in every Playwright config (R-12). |
| Translation quality | Drafted from glossary file 10 §4. Every term is listed in `docs/i18n/glossary.md` for the pre-launch native review. |

## Complexity Tracking

No constitution violations, so nothing needs justification.
