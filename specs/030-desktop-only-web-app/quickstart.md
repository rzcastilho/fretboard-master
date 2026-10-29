# Quickstart: Validate the Desktop-Only Slice (030)

Prerequisites: `mise install`, `pnpm install`. Local runs follow CLAUDE.md verification tiers.

## 0. Baseline for SC-004 (before any change)

```bash
pnpm playwright test --list | tail -1     # record the total test count
```

## 1. Unit

```bash
pnpm vitest run tests/unit/layout.test.ts tests/unit/state/viewport.test.ts \
  tests/unit/prefs tests/unit/state/preferences-store.test.ts tests/unit/state/fit.test.ts \
  tests/unit/fretboard/fretboard.test.ts tests/unit/caged/caged-tool.test.ts \
  tests/unit/tool-layout.test.ts tests/unit/headers.test.ts
```

Expected: pass. `layout.test.ts` proves no width/height returns `narrow`, `medium` or
`landscape`; `schema.test.ts` proves records with `rotateHint` load with every other field kept.

## 2. E2E on desktop

```bash
pnpm build:test
pnpm test:e2e:fast e2e/desktop-only.spec.ts e2e/responsive-layout.spec.ts \
  e2e/caged-focus.spec.ts e2e/fretboard.spec.ts e2e/measurement.spec.ts e2e/share.spec.ts
```

Expected, per `contracts/ui-arrangements.md`:

| Scenario | Check |
|---|---|
| US1-1/2 | 1024×768 and 2560×1440, every route: no page horizontal scroll, axe 0 |
| US1-4 | resize 1024 ↔ 2560: `data-arrangement` ∈ {`wide-side`, `wide-stacked`} |
| US2-1 | CAGED at 390×844 and 600×900, empty storage: no rotate-hint notice |
| US2-2 | 1280×500: `wide-*`, no Panels button |
| US2-3/4 | `hasTouch` context: two-touch pinch leaves fit mode; tap on a position = click |
| US4 | prefs with `"rotateHint":true` and every fixture link open the expected view |
| US5 / SC-008 | 320×200 and 640×400, every route: `reflow`, no page horizontal scroll, no blocking dialog, axe 0 |
| FR-005 | `body` computed padding is 0 |

## 3. Screenshots (only changed tests)

```bash
pnpm playwright test e2e/responsive-layout.spec.ts -g "arrangement screenshot" \
  --project=desktop --update-snapshots
git status e2e/ | grep -c 'phone'   # expect 0 remaining phone baselines
```

## 4. Governing documents (SC-007)

```bash
grep -nEi "phone|portrait|landscape|safe.area|pinch|44 ?× ?44|360 px|320 to 2560" \
  .specify/memory/constitution.md CLAUDE.md specs/autonomous/fretboard-master/*.md
```

Expected: only lines carrying the slice-030 note, the device-class values in `04-data-model.md`,
and the Sync Impact Report history.

## 5. End of slice

```bash
pnpm verify
pnpm playwright test --list | tail -1     # compare with step 0: ≥ 30 % fewer tests (SC-004)
```

## 6. Performance (CI is authoritative)

CI's `perf` job runs `pnpm build && pnpm lhci` with the desktop preset. Expected: every URL
score ≥ 0.9, `interactive` ≤ 3000 ms on `/` and `/about`, ≤ 3500 ms on `/notes` and `/triads`,
CLS ≤ 0.1. Run `pnpm lhci` locally only to reproduce a CI failure.
