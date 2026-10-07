# Quickstart: Themes, Motion, and Print

This guide covers how to run the slice and prove it works. Implementation details live in
[contracts/](./contracts/) and [data-model.md](./data-model.md), so they are not repeated here.

## 1. Prerequisites

```bash
mise install          # pinned Node and pnpm
pnpm install
pnpm build:test       # once; repeat only after changing src/ or static/
```

Local runs follow the constitution's verification tiers:

- `pnpm test:e2e:fast` runs the desktop project on installed Chrome.
- Never run the full `pnpm test:e2e` matrix or `pnpm lhci` locally.

## 2. Manual smoke run

```bash
pnpm dev   # http://localhost:5173
```

1. Set the OS to dark mode, then open `/caged`. The page and chrome are dark, and the board is
   a warm, dark wood.
2. Open the language and appearance disclosure, then choose **Light**. The surfaces turn light
   at once, and the board looks identical. Reload: there is no dark flash.
3. On Home, choose **Follow device** beside the language selector. Switch the OS theme: the
   app follows live.
4. DevTools → Rendering → emulate `prefers-contrast: more`. Lines and markers get bolder, and
   the board stays dark in both themes.
5. Triads tests:
   - Change the root. The markers slide along their strings.
   - Change the quality. Only the changed note moves.
   - Change the inversion. The shapes cross-fade.
6. Emulate `prefers-reduced-motion: reduce` and repeat step 5. Every change is instant.
7. In dark theme on CAGED, press Ctrl/Cmd+P. The preview shows a white page, a light board, all
   shapes and labels, the tuning, the description and the legend, and no navigation or buttons.
   Turn off "Background graphics": the board and markers are still there.

## 3. Targeted automated verification

```bash
# Unit (node/jsdom per file docblock)
pnpm vitest run tests/unit/prefs tests/unit/a11y tests/unit/reserved-colors.test.ts \
  tests/unit/headers.test.ts tests/unit/fretboard/transition.test.ts \
  tests/unit/state/theme.test.ts tests/unit/state/print.test.ts \
  tests/unit/theme-selector.test.ts tests/unit/language-panel.test.ts tests/unit/home-screen.test.ts

# e2e (desktop only)
pnpm test:e2e:fast e2e/theme.spec.ts e2e/motion.spec.ts e2e/print.spec.ts \
  e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts e2e/nojs.spec.ts e2e/preferences.spec.ts

# Regenerate intentionally changed light-theme baselines (one test name at a time)
pnpm playwright test e2e/caged-tm9.spec.ts -g "<test name>" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

End of slice, once: `pnpm verify`. That runs check, lint, format, Vitest with coverage, build,
the bundle-size check (≤ 150 KB) and the desktop e2e suite.

## 4. Scenario → test map

| Spec scenario | Test |
|---|---|
| US1-1, US1-2, US1-5 | `e2e/theme.spec.ts` "follows device" (`emulateMedia({ colorScheme })`, live flip) |
| US1-3 (no flash) | `e2e/theme.spec.ts` "pinned dark on light device: first frame dark" (init script samples the first rAF) and the reverse |
| US1-4, US1-10 | `e2e/theme.spec.ts` "Follow device clears pin"; `tests/unit/state/theme.test.ts`; `e2e/preferences.spec.ts` erase |
| US1-6 | `tests/unit/prefs/schema.test.ts` invalid `theme` cases; `tests/unit/prefs/theme-boot.test.ts` |
| US1-7 | `e2e/theme.spec.ts` "share link keeps pin" |
| US1-8 | `e2e/theme.spec.ts` "storage blocked" (existing fault-injection seam, ADR 0004) |
| US1-9, US1-11 | `tests/unit/theme-selector.test.ts`, `language-panel.test.ts`, `home-screen.test.ts`; `e2e/theme.spec.ts` keyboard flow in en, pt-BR, es |
| US2-1 | `e2e/theme.spec.ts` "on-board computed colours equal in light and dark" (Notes, Triads with comparison, CAGED with layers) and the edge contrast check |
| US2-2, US2-3 | `tests/unit/a11y/palette-contrast.test.ts` (standard set) |
| US2-4, US2-6 | `tests/unit/reserved-colors.test.ts`; `tests/unit/notice.test.ts` |
| US2-5 | `tests/unit/a11y/palette-cvd.test.ts` (standard, contrast-more and print) |
| US2-7, US3 axe | `e2e/a11y-audit.spec.ts` × {light, dark, contrast more} on every tool and About |
| US3-1…US3-5 | `palette-contrast.test.ts` (contrast-more set); `e2e/theme.spec.ts` contrast emulation (live, pinned) |
| US3-6 | `e2e/a11y-colour.spec.ts` forced colours (`emulateMedia({ forcedColors: 'active' })`): shapes and labels visible |
| US4-1, US4-2 | `tests/unit/fretboard/transition.test.ts` slide cases; `e2e/motion.spec.ts` root, key and note slide with `page.clock` |
| US4-3, US4-4 | `transition.test.ts` by-role and comparison; `e2e/motion.spec.ts` quality and comparison |
| US4-5 | `e2e/motion.spec.ts` cross-fade midpoint opacities |
| US4-6 | `e2e/motion.spec.ts` CAGED focus dim and scroll ≤ 500 ms, and no scroll when in view (existing `caged-focus.spec.ts` extended) |
| US4-7 | `tests/unit/caged/*` reveal order; `e2e/motion.spec.ts` layer reveal ≤ 300 ms |
| US4-8, US4-13 | `e2e/playback.spec.ts` (existing pulse) plus a reduced-motion and muted case |
| US4-9, US4-10 | `e2e/motion.spec.ts` "interrupt mid-transition" and "state first" |
| US4-11, US4-12, US4-14 | `e2e/motion.spec.ts` with `reducedMotion: 'reduce'`, toggled live |
| US4-15 | `motionKind` table tests; `e2e/motion.spec.ts` "instant changes" (`data-motion="none"`) |
| US5-1…US5-4, US5-6 | `e2e/print.spec.ts` (`emulateMedia({ media: 'print' })`, dark theme, every fit and arrangement, `page.pdf` with `printBackground: false`) |
| US5-5 | `e2e/print.spec.ts` "7 strings 24 frets ≥ 7 pt" at 4 printable widths |
| US5-7 | `palette-contrast.test.ts` and `palette-cvd.test.ts` (print set) |
| Edge: no-JS | `e2e/nojs.spec.ts` follows device, with no selector effect |
| Edge: 200% text | `e2e/text-zoom.spec.ts` theme selector rows |
| Budgets | `pnpm verify` bundle check; `e2e/perf.spec.ts` control → DOM final state ≤ 100 ms unchanged |

## 5. Expected outcomes

- All the tests above pass. axe reports zero violations in light, dark and contrast more.
- `node scripts/check-bundle-size.mjs build` prints ≤ 150 KB.
- Changed light-theme baselines are regenerated, and none are deleted. `git status` shows
  modified PNGs only under existing `*-snapshots/` folders, plus new ones for the
  dark, contrast and print shots.
