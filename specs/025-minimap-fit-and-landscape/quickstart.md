# Quickstart: Minimap, Fit to Screen, and Landscape (025)

How to run, see and verify this slice. Commands follow the verification tiers in `CLAUDE.md`
and the constitution (targeted locally; full matrix in CI only).

## 1. Setup and run

```bash
mise install && pnpm install
pnpm dev                       # http://localhost:5173
```

Manual checks (browser devtools device toolbar):

| Viewport | Open | Expect |
|---|---|---|
| 320×640, instrument 7 strings / 24 frets | `/triads` | comfortable mode, minimap under the board, Fit to screen in Actions; context panel collapsed to one line |
| same | tap minimap far right | board shows fret 24; window at the end; slider reads "Frets … to 24 of 24" |
| same | Fit to screen | whole neck visible, minimap gone, button pressed; tap a position → nearest selected + notice |
| 800×1280 | any tool | board full width; Actions and Details side by side below |
| 1440×900, 24 frets | any tool | wide-stacked: board full width, no Fit to screen, no minimap |
| 1440×900, 12 frets | any tool | wide-side: Details in the right column |
| 2560×1440, 24 frets | any tool | wide-side |
| 844×390 | `/caged`, focus a shape | icon-only bar, one-row strip, board fills the rest; Panels opens Actions + Details on the right; Escape closes, focus back on Panels; no rotate hint |
| any, browser text size 200% | each tool | no clipped text, nothing overlapping, all controls reachable |

## 2. Targeted verification while implementing

```bash
# Unit (pure, test-first)
pnpm vitest run tests/unit/fretboard/geometry.test.ts tests/unit/fretboard/minimap.test.ts \
  tests/unit/fretboard/pinch.test.ts tests/unit/layout.test.ts \
  tests/unit/state/fit.test.ts tests/unit/state/context-summary.test.ts

# Components (jsdom)
pnpm vitest run tests/unit/fretboard/minimap-component.test.ts tests/unit/fit-toggle.test.ts \
  tests/unit/side-panels.test.ts tests/unit/context-zone.test.ts tests/unit/no-raw-text.test.ts

# E2E (desktop project only, after changing src/)
pnpm build:test
pnpm test:e2e:fast e2e/minimap-fit.spec.ts e2e/responsive-layout.spec.ts e2e/landscape.spec.ts \
  e2e/text-zoom.spec.ts e2e/a11y-audit.spec.ts

# New/changed screenshots only
pnpm playwright test e2e/responsive-layout.spec.ts -g "arrangement screenshot" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots

# Bundle (R-14)
pnpm build && node scripts/check-bundle-size.mjs build

# End of slice, once
pnpm verify
```

Pinch e2e (`fretboard-touch.spec.ts`) runs on `phone-touch` in CI; locally it may be run once
with `--project=phone-touch` only to reproduce a CI failure.

## 3. Acceptance scenario → test map

| Scenario | Test |
|---|---|
| US1.1 7 strings, 24 frets, 320 → comfortable + minimap | `e2e/minimap-fit.spec.ts` "minimap at 320 with 7 strings" |
| US1.2 tap far end → fret 24 | `minimap-fit` "tap far end shows last fret"; unit `minimapTapScroll` |
| US1.3 dots at highlighted positions, window = visible stretch | `minimap-component` dots/window; e2e dot count = highlighted count |
| US1.4 window follows scroll | `minimap-fit` "window follows scroll" |
| US1.5 left-handed mirrored, same frets | `minimap-fit` "left-handed mirror"; unit mirrored tap |
| US1.6 neck fits → no minimap | `responsive-layout` "1440 / 24 frets" |
| US1.7 arrow keys move window, announce range | `minimap-fit` "keyboard"; `minimap-component` aria-valuetext |
| US2.1 Fit to screen → whole, no minimap | `minimap-fit` "fit to screen" |
| US2.2 back to comfortable, area still in view | `minimap-fit` "return keeps highlighted region"; unit anchor rule |
| US2.3 pinch toggles | `fretboard-touch.spec.ts` "pinch toggles fit" (phone-touch); unit `reducePinch` |
| US2.4 1440/24: no button, pinch no-op | `responsive-layout` "1440 / 24 frets"; unit `fit.handle` request ignored |
| US2.5 whole-mode tap → nearest + notice | `minimap-fit` "small-fret notice" |
| US2.6 accept → comfortable with tap in view | `minimap-fit` "accept notice centres tap" |
| US2.7 mode kept across tool switch / resize | `minimap-fit` "mode persists across tools and resize" |
| US3.1 narrow order | `responsive-layout` "narrow order" (bounding boxes) |
| US3.2 two rows + strip, no menu | `responsive-layout` "narrow zone B rows" |
| US3.3 collapsed summary, expandable | `responsive-layout` "context summary"; `context-zone` component; unit summaries |
| US3.4 medium side by side | `responsive-layout` "medium" |
| US3.5 wide-side | `responsive-layout` "1440 / 12" and "2560 / 24" |
| US3.6 wide-stacked | `responsive-layout` "1440 / 24" and "1024 / 24" |
| US3.7 only fretboard scrolls | `responsive-layout` "no page horizontal scroll" (320, 600, 1024, 1280, 2560, landscape) |
| US4.1 rotate with shape in focus | `landscape.spec.ts` "rotate keeps CAGED focus" |
| US4.2 icon bar, strip, panel | `landscape` "arrangement" |
| US4.3 panel open/close, focus return, board usable | `landscape` "sliding panel"; `side-panels` component |
| US4.4 state kept on rotate/resize | `landscape` "state survives rotation"; `responsive-layout` "wide threshold keeps state" |
| US4.5 every function reachable | `landscape` "function inventory" (same control names as portrait) |
| US5.1 200% no truncation/overlap | `text-zoom.spec.ts` per arrangement |
| US5.2 summary readable at 200% | `text-zoom` "summary wraps" |
| FR-019 rotate hint not in landscape | `landscape` "no rotate hint" |
| FR-024 axe zero | `a11y-audit.spec.ts` new targets (contracts/ui.md §11) |
| Reduced motion instant jump | `minimap-fit` "reduced motion" |
