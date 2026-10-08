# Quickstart: Validating the UI Refinement (029)

This is a run-and-check guide. The contracts are in `contracts/ui.md` and
`contracts/style-lint.md`, and the token values are in `data-model.md`.

## Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
```

## 1. Static guards (unit)

```bash
pnpm vitest run tests/unit/style-tokens.test.ts \
  tests/unit/a11y/palette-contrast.test.ts tests/unit/a11y/theme-tokens.test.ts \
  tests/unit/reserved-colors.test.ts tests/unit/no-raw-text.test.ts
```

Expected:
- the style lint reports zero findings (rules 1–5), and its self-test fixtures pass;
- the contrast and theme-token tests pass with the new tokens;
- no reserved colour appears in the chrome, and no raw text is added.

## 2. Build once, then the targeted e2e

```bash
pnpm build:test
pnpm test:e2e:fast e2e/ui-refinement.spec.ts
```

Expected (desktop project):
- **G-1**: zone C is the largest zone, and its top is in view, for each tool at 768×1024 and
  1440×900. At 320×568, zone C is larger than zones A, D and E.
- **G-2**: every zone-B control is inside the initial viewport at 768×1024 and 1440×900, and
  inside the viewport width at 320×568 (rows wrap).
- **G-3**: the page has no horizontal scroll.
- **Family equality**: the metrics in `contracts/ui.md` §2 are equal across Notes, Triads,
  CAGED and the shell panels. Selected differs from default in both weight and background.

## 3. Frozen fretboard snapshots: run without updating

```bash
pnpm test:e2e:fast e2e/fretboard.spec.ts -g "grayscale"
pnpm test:e2e:fast e2e/notation.spec.ts -g "accidental glyphs"
```

Expected: both pass against the **existing** baselines. If either fails, zone C geometry or a
fretboard token value changed. Fix the code, never the baseline.

## 4. Regression suites touched by restyling

```bash
pnpm test:e2e:fast e2e/text-zoom.spec.ts e2e/languages-layout.spec.ts e2e/theme.spec.ts \
  e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts e2e/responsive-layout.spec.ts \
  e2e/landscape.spec.ts e2e/print.spec.ts e2e/home.spec.ts e2e/navigation.spec.ts \
  e2e/a11y-keyboard.spec.ts e2e/motion.spec.ts
```

Expected: every non-screenshot assertion passes unchanged. axe reports zero violations.

## 5. Regenerate the intentionally changed baselines

For each changed screenshot test (TM-9 views, `arrangement-*`, `theme-dark-*`,
`sound-control-*`), run:

```bash
pnpm playwright test <spec> -g "<test name>" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

Then inspect the diffs. Only chrome changes: the board drawing is identical.

## 6. Manual look (optional)

Run `pnpm dev` and walk through home → Notes → Triads → CAGED → instrument panel → language
panel → about, in:
- light and dark themes;
- DevTools emulation of `prefers-contrast: more` and `prefers-reduced-motion`;
- pt and es;
- 200% zoom at 320 px.

Check that:
- nothing is truncated;
- the current nav item is bold and has its bar;
- selected options are filled and bold;
- hover changes only colour.

## 7. End of slice (once)

```bash
pnpm verify
```

Expected: check, lint, format, full Vitest with coverage, build, the bundle-size check
(≤ 150 KB gzip initial JS) and the full desktop Playwright suite all pass.
