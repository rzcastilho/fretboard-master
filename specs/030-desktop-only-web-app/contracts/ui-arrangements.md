# Contract: Arrangements and Interaction (030)

Replaces `specs/025-*/contracts/ui.md` §5 (arrangements) and §7 (landscape) for every later
slice. Zone letters as in design §5: A app bar, B controls, C fretboard, D context, E actions.

## 1. Arrangement selection

`arrangementFor({ width, neckWidth, chrome }) → Arrangement` (pure, `src/lib/shell/layout.ts`).
Height is not an input.

| Condition (CSS px, `window.innerWidth`) | Arrangement | Grid areas | App bar |
|---|---|---|---|
| `width ≤ 1023` | `reflow` | `'b' 'c' 'e' 'd'`, one column | compact (icons, labels as tooltips) |
| `width ≥ 1024` and `neckWidth ≤ wideLeftColumn(width)` | `wide-side` | `'b d' 'c d' 'e d'`, 3fr / 1fr | full |
| `width ≥ 1024` and `neckWidth > wideLeftColumn(width)` | `wide-stacked` | `'b b' 'c c' 'e d'` | full |

- `data-arrangement` on the tool grid and on `:root` takes only these three values. Before mount,
  `static/theme-boot.js` writes `reflow` or `wide-side` by the same 1023/1024 split.
- No-JS fallback (`tokens.css`): stacked below 1024 px, side-by-side from 1024 px.
- The About screen uses the same compact-bar rule (`reflow` → compact).

## 2. Reflow guarantees (FR-011)

Below 1024 CSS px, from 320 CSS px wide and any height ≥ 200 CSS px:

- every function on every route is available, no control is truncated or overlapping, in en,
  pt-BR and es, and with 200 % text zoom at 1024 px;
- the page never scrolls horizontally; only the fretboard scroller does;
- zone D shows its one-line summary with an expand control; the expanded state is session-only
  and shared across tools (unchanged from 025);
- no orientation handling, safe-area padding, gesture or phone-only notice exists.

## 3. Removed surface

| Removed | Was |
|---|---|
| Arrangements `narrow`, `medium`, `landscape` | 025 |
| `SidePanels` (Panels button, sliding region), messages `panels_open`, `panels_close`, `panels_region` | 025 US4 |
| `header[data-landscape]`, `--landscape-bar-height`, landscape `sr-only` heading | 025 US4 |
| Rotate hint notice, message `caged_rotate_hint` | 016 US4 |
| Two-finger pinch on the fretboard, `FitEvent { kind: 'request' }` | 025 R-06 |
| `env(safe-area-inset-*)` body padding, `viewport-fit=cover` | 001 |

## 4. Interaction (unchanged, restated)

- Pointer input of any type (mouse, pen, touch) goes through the single-pointer gesture reducer:
  tap/click activates the position, drag scrolls the fretboard. A touch tap is a click (FR-006).
- Multi-touch on the fretboard has no product effect; the browser's own page zoom is not
  prevented.
- The fit control is the only way to switch comfortable / whole-neck sizing. The whole-mode
  small-target notice still appears when a clicked column is narrower than `--target-min`.
- Keyboard model, focus order, announcements, themes, motion, contrast and print: unchanged
  (FR-009).

## 5. Test profiles (FR-015, FR-016)

| Project | Use | Viewport |
|---|---|---|
| `desktop` | full suite | 1280×800; specs resize to 1024×768, 2560×1440, and reflow sizes 640×400 (200 % zoom) and 320×200 (400 % zoom) |
| `firefox`, `webkit` | `@smoke` navigation | default desktop |
| `nojs` | `nojs.spec.ts` | default desktop |

`phone` and `phone-touch` do not exist. Screenshot baselines exist for `desktop` only.
