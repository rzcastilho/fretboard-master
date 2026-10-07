# Quickstart: About Page, Privacy, and Keyboard Shortcuts

**Feature**: 027-about-privacy-and-shortcuts | **Plan**: [plan.md](./plan.md)

Validation guide only. Behaviour is defined in [contracts/ui.md](./contracts/ui.md) and
[contracts/pure-api.md](./contracts/pure-api.md); fields and strings in
[data-model.md](./data-model.md).

## 1. Prerequisites

```bash
mise install          # pinned Node and pnpm
pnpm install
```

## 2. Run the app

```bash
pnpm dev              # http://localhost:5173
```

Manual smoke (desktop, hardware keyboard):

1. Open `/about`: sections in order — What this app is, Marker legend (3 entries), Keyboard
   shortcuts (5 rows + switch), Privacy (9 statements + Erase my preferences), Version.
2. Switch language to Español and Português (Brasil) from the app bar: every section updates in
   place.
3. Open `/triads`: press `P` (Listen plays), `.` three times (root → 1st → 2nd → root), `,`,
   `L` (labels interval ↔ name), `N` (letters ↔ solfège).
4. Open `/caged`, choose a shape: `.`/`,` match Next/Previous shape and stop at the ends.
5. Open the instrument panel, choose Custom tuning, type `p`, `.`, `n` in the text field: no
   shortcut fires. `Ctrl+P` opens the browser print dialog, not Listen.
6. Turn **Keyboard shortcuts** off on About, reload, press `N` anywhere: nothing. Erase my
   preferences → switch is back on.
7. `/about#privacy` in a new tab lands on the Privacy section.

## 3. Targeted verification (constitution "Verification tiers")

Unit (per task):

```bash
pnpm vitest run tests/unit/state/shortcuts.test.ts tests/unit/state/shortcuts-store.test.ts \
  tests/unit/prefs/schema.test.ts tests/unit/state/preferences-store.test.ts \
  tests/unit/i18n/about-catalog.test.ts tests/unit/i18n/catalogs.test.ts tests/unit/csp.test.ts \
  tests/unit/shortcut-list.test.ts tests/unit/privacy-policy.test.ts \
  tests/unit/triads/choice-group.test.ts tests/unit/notation-toggle.test.ts \
  tests/unit/erase-preferences.test.ts
```

E2E (after `src/` changes):

```bash
pnpm build:test
pnpm test:e2e:fast e2e/about.spec.ts e2e/shortcuts.spec.ts e2e/privacy.spec.ts e2e/preferences.spec.ts
```

Bundle (end of slice): `pnpm build && node scripts/check-bundle-size.mjs build` — expect ≈ 139–140 KB
gzip, under 150 KB.

End of slice, once: `pnpm verify`. Do not run `pnpm test:e2e` or `pnpm lhci` locally.

## 4. Scenario → test map

| Spec scenario | Test | Verified |
|---|---|---|
| US1-1 About in Spanish | `e2e/about.spec.ts` "about in each language" (en, pt-BR, es) | [X] |
| US1-2 statements (1)–(8) | `tests/unit/privacy-policy.test.ts` (9 items rendered per locale) + `about-catalog.test.ts` (keys present, word caps, no jargon) | [X] |
| US1-3 Erase on About | `e2e/preferences.spec.ts` (existing erase flow, button now under `#privacy`) + `tests/unit/erase-preferences.test.ts` | [X] |
| US1-4 language switch keeps page | `e2e/about.spec.ts` "switch language on About" | [X] |
| US2-1 P = Listen (Triads) | `e2e/shortcuts.spec.ts` "P plays like Listen" (playback test hook: sequence started) | [X] |
| US2-2 `.`/`,` inversions | `e2e/shortcuts.spec.ts` "period and comma move the inversion" | [X] |
| US2-3 CAGED next/previous | `e2e/shortcuts.spec.ts` "period and comma step shapes" | [X] |
| US2-4 L and N remembered | `e2e/shortcuts.spec.ts` "L and N switch and persist across reload" | [X] |
| US2-5 text fields and modifiers | `tests/unit/state/shortcuts.test.ts` (table) + `e2e/shortcuts.spec.ts` "custom tuning field and Ctrl/Alt/Meta" | [X] |
| US2-6 screen-reader keys | `tests/unit/state/shortcuts.test.ts` reserved-key table (SC-005) | [X] |
| US2-7 switch off, persists, Erase resets | `tests/unit/state/shortcuts-store.test.ts` + `e2e/shortcuts.spec.ts` "switch off persists; erase turns it on" | [X] |
| US2-8 wrap / no wrap | `tests/unit/state/shortcuts-store.test.ts` + `e2e/shortcuts.spec.ts` | [X] |
| US2-9 Notes L cycle, N everywhere | `tests/unit/state/shortcuts-store.test.ts` + `e2e/shortcuts.spec.ts` | [X] |
| FR-009b `aria-keyshortcuts` | component tests (`choice-group`, `notation-toggle`, Listen/step) + `e2e/shortcuts.spec.ts` attribute check on/off | [X] |
| US3-1 no permission prompts | `e2e/privacy.spec.ts` spies + dialog listener | [X] |
| US3-2 same-origin only | `e2e/privacy.spec.ts` request log + `tests/unit/csp.test.ts` | [X] |
| US3-3 no identity inputs / identifiers | `e2e/privacy.spec.ts` + `tests/unit/prefs/schema.test.ts` known-keys case | [X] |
| SC-005 axe on About | `e2e/about.spec.ts` axe (light and dark) | [X] |
| SC-006 plain language, word caps | `tests/unit/i18n/about-catalog.test.ts` | [X] |

## 5. Expected outcomes

- All listed unit and e2e specs green on `desktop`; CI green on the full matrix.
- Stored record unchanged for users who never touch the switch; `"shortcuts":false` only when off.
- No change to `svelte.config.js` CSP or `static/_headers`.
