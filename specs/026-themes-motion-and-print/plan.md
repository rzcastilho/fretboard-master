# Implementation Plan: Themes, Motion, and Print

**Branch**: `026-themes-motion-and-print` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-themes-motion-and-print/spec.md`

**Note**: This plan was produced by the `/speckit-plan` command, following its execution workflow.

## Summary

This is the third slice of wave 007 (comfort and launch readiness). It has four parts.

- **Themes.** The app gets light and dark themes that follow the device, a pinnable Follow
  device / Light / Dark choice, and no flash of the wrong theme.
- **Shared fretboard palette.** One warm, dark board palette is used in both themes, plus a
  higher-contrast variant when the device asks for it.
- **Motion.** Motion is limited to the six situations in design §3.5, and every one is instant
  under reduced motion.
- **Print.** A dedicated light print view (white page, light board, every shape and label,
  description and legend, the whole neck on one page, ≥ 7 pt).

The approach comes from [research.md](./research.md).

- **Theme mechanism** (R-01, R-02):
  - `color-scheme` on `:root` drives everything: `light dark` when unpinned, otherwise
    `[data-theme='light'|'dark']`.
  - Each surface token is written once as `light-dark(light, dark)`, and the dark media block
    goes away. The document's `color-scheme` always matches the effective theme, and following
    the device works with JS off.
  - A ~300 B same-origin, parser-blocking `static/theme-boot.js`, referenced from `app.html`,
    sets `data-theme` from the stored record before first paint. The CSP is unchanged: no
    inline script, `script-src 'self'`.
- **Persistence and UI** (R-03, R-04):
  - The v1 preferences record gets an optional `theme: 'light' | 'dark'` field, stored only
    when pinned, and Erase clears it. A small `theme.svelte.ts` store handles it.
  - `ThemeSelector.svelte` is a native radio fieldset. It sits inside the existing zone-A
    language disclosure (renamed "Language and appearance") and beside the language selector
    on Home.
- **Board palette** (R-05, R-06, R-07):
  - New `--fb-color-*` tokens hold literal hex values identical in both themes, with separate
    contrast-more and print sets. They replace every board use of surface tokens. Dimmed
    opacity rises to about 0.6 to keep dimmed markers ≥ 3:1.
  - `Canvas`/`CanvasText` move from `prefers-contrast` to `forced-colors`.
  - Unit tests over the token sheet enforce every contrast, CVD (ΔE2000 ≥ 10) and
    reserved-colour rule. An e2e test asserts the on-board computed colours are equal in light
    and dark.
- **Motion** (R-08, R-09):
  - Each tool's view module classifies a change as `slide`, `by-role`, `cross-fade`, `focus`,
    `reveal` or `none`, and the display model carries it.
  - A pure `reconcileMarkers` in `src/lib/fretboard/transition.ts` assigns marker keys:
    - per-string fret-order pairing for slides;
    - role ids for quality and comparison changes;
    - fresh keys for cross-fades.
  - Existing CSS transform transitions (ADR 0010) and Svelte fades do the drawing.
    `data-motion="none"` makes every other change instant.
  - CAGED focus moves to `--duration-medium`. Reduced motion relies on the existing `0s`
    tokens. State, description and link are always final first.
- **Print** (R-10, R-11):
  - A `@media print` block sets a light `color-scheme` and the print board palette.
  - `data-print="omit|show"` hides chrome and reveals the description and legend.
  - A tiny `print.svelte.ts` store (`matchMedia('print')` plus `beforeprint`/`afterprint`)
    makes the fretboard lay out in whole mode at a nominal 190 mm. That makes the print
    independent of screen fit, scroll and arrangement.
  - The SVG scales to the printable width (always ≥ 1×), with a 7 pt text floor in viewBox
    units, on one page and with no forced orientation.
- **Budget** (R-13): about 2.4 KB JS is estimated against about 2 KB of headroom under the
  136 KB cap. The slice measures first and trims inside itself. FR-033 forbids raising the cap
  in this spec.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static` (prerendered, single bundle, ADR 0002); plain ES2015 for `static/theme-boot.js`.

**Primary Dependencies**: existing only. Paraglide JS (catalog), Valibot (preferences schema), `@axe-core/playwright`, `@testing-library/svelte`, fast-check (dev). No new runtime or dev dependency. The CVD, CIEDE2000 and contrast maths already exist in `tests/unit/a11y/color.ts`.

**Storage**: `localStorage` through `src/lib/prefs`. There is one additive optional field, `theme`, in the existing v1 preferences record (format version unchanged). It is not in share links. Contrast, motion and print state are derived live and never stored.

**Testing**:
- Vitest: node environment for the codec, boot script (`node:vm`), `transition.ts`, the `motionKind` tables and the token-sheet contrast/CVD/reserved-colour scans; jsdom for the theme and print stores, `ThemeSelector`, `LanguagePanel`, `HomeScreen` and Fretboard component tests.
- Playwright: `emulateMedia` for `colorScheme`, `reducedMotion`, `contrast`, `forcedColors` and `media: 'print'`; `page.clock` for transition sampling; `page.pdf` for the background-graphics-off check; axe in light, dark and contrast more.
- Local runs use the `desktop` project only. CI runs the full matrix.

**Target Platform**: Evergreen browsers (last two majors; `light-dark()` needs Chrome 123, Firefox 120 or Safari 17.5), desktop and mobile, 320–2560 CSS px; browser print and save-as-PDF on A4 and US Letter, portrait and landscape.

**Project Type**: Static single-page web app (SvelteKit, prerendered, one JS bundle, Cloudflare Pages).

**Performance Goals**: Control change to fretboard final DOM state stays ≤ 100 ms, because animation is cosmetic on top. Tool switch ≤ 300 ms. Smooth scrolling at 7 strings × 24 frets with every CAGED layer on: only `transform` and `opacity` are transitioned, and keyed reconciliation is O(markers).

**Constraints**:
- Budget and CSP: initial JS ≤ 136 KB gzip (headroom ≈ 2 KB) at planning; raised to ≤ 150 KB by constitution 1.11.0 after T074. CSP unchanged (`script-src 'self'`, hash mode, no inline script).
- Tokens: every visual value and duration is a token, and no duration above `--duration-medium` (500 ms) is added.
- Colour: on-board colours are identical in light and dark. Role colours are reserved for markers and the legend sample. There is no in-app motion or contrast setting, and no custom palettes or export.
- Accessibility: WCAG 2.2 AA in both themes, plus 7:1 and 4.5:1 in the contrast variant.
- Print: ≥ 7 pt in print for 7 × 24 on A4 and Letter.

**Scale/Scope**:
- Code: 3 tools plus Home and About; 1 preferences field; 6 catalog keys × 3 locales (2 are value changes); 2 new pure modules (`transition.ts`, the `motionKind` helpers in 3 view modules); 2 new stores (`theme`, `print`); 1 new component (`ThemeSelector`); 1 static script; about 10 edited components; `tokens.css` and `global.css` restructured.
- Tests: about 8 snapshot suites regenerated; 3 new e2e specs (`theme`, `motion`, `print`) and about 6 edited; 2 ADRs.

All Technical Context items are resolved in research.md; no NEEDS CLARIFICATION remains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The pre-research and post-design results are the same. Post-design notes are folded into each
line.

- [x] **I. Musical Correctness**: No theory code changes. Motion only re-keys already-computed markers. Pairing works on (string, fret) and never alters spelling or positions, and the print view uses the same display model. The theory suites keep gating.
- [x] **II. On-Device, Static, Private**: The boot script is a same-origin static asset. It has no network access, no identifiers and no permissions. The theme pin stays in the local preferences record and is erasable through the existing Erase.
- [x] **III. Pure Core, Thin Shell**: `src/lib/theory` is untouched. The change kind is computed in each tool's view module, which is pure and in musical terms, so data still flows view state → display model → render. Marker keying, pairing, transitions and print layout live only in the fretboard renderer. Handedness is still applied only in geometry (pairing is by string and fret, not screen x). Tools do not draw.
- [x] **IV. Test-First / Tested Behavior**: The codec field, boot script, `reconcileMarkers`, the `motionKind` tables and the theme and print stores are written test-first ([contracts/pure-api.md](./contracts/pure-api.md)). Every US1–US5 scenario maps to a test ([quickstart.md](./quickstart.md) §4). Motion is tested with `page.clock` and the existing `Clock` seam, never real time. TM-9 fixtures are regenerated, never removed.
- [x] **V. Accessible by Default**: The native radio group has a name, checked state and arrow keys, with 44 px targets. Contrast thresholds are enforced on tokens in both themes, the contrast variant and print. Shape plus label stay the primary carriers, and emphasis is opacity plus size (dimmed opacity < 1 and scale < 1). `prefers-reduced-motion` and `prefers-contrast` are honoured live, and forced colours win. axe reports zero violations in light, dark and contrast more.
- [x] **VI. Performance Budgets**: Only `transform` and `opacity` animate, and state is final before any animation, so the 100 ms and 300 ms budgets are unaffected. Bundle: about +2.4 KB against about 2 KB headroom. The plan is measure first, then trim inside the slice (R-13), with no amendment in this spec. If the slice cannot fit, it stops and records the gap (see Complexity Tracking). Smooth-scroll budget: reconciliation is O(markers) per model change, with nothing per scroll frame.
- [x] **VII. Design System Fidelity**: The board stays warm and dark in both themes (design §3.2): wood and metal suggested by colour, never photorealistic. Surfaces are neutral. Role colours are reserved and scanned. Notices stay non-blocking, at most two lines, dismissible and never error red. Every colour, duration, stroke width and print size is a token (`--fb-color-*`, `--fb-edge-width` and the existing `--fb-string-width-*`, `--print-*`); `--fb-edge-width` has values in the standard, contrast-more and print sets. Motion explains change, only the changed note moves, and it stays within 300 ms or 500 ms. The emphasis levels are unchanged. Controls never cover the board.
- [x] **VIII. International**: Four new keys and two value changes, in en, pt-BR and es (catalog parity test, `no-raw-text` scan). The selector is tested at 200% text and 320 px in all three languages. No note names are formatted.
- [x] **IX. Untrusted Input, Versioned Formats**: The new `theme` field is validated with a Valibot picklist and falls back to Follow device on its own. The format version stays 1 (additive), and older records open unchanged. The boot script accepts only the two exact strings, never throws, and never renders stored content. Share-link format and fixtures are untouched.
- [x] **X. Simplicity, Incremental Delivery**: This follows breakdown wave 007 item 003. There are no new dependencies. Native radios are used instead of a new generic control, and there is one reconciliation function shared by three tools (two or more real uses), with no motion or contrast settings (YAGNI). Fallbacks: an unreadable pin follows the device, and storage failure keeps the choice for the session.

**Gate result**: PASS. One risk is recorded rather than a violation: Principle VI bundle
headroom (see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/026-themes-motion-and-print/
├── plan.md              # This file
├── research.md          # Phase 0 (R-01 … R-15)
├── data-model.md        # Phase 1: theme field and store, DOM attributes, variants, palette tokens, motion, print state, catalog keys
├── quickstart.md        # Phase 1: run, targeted verification, scenario → test map
├── contracts/
│   ├── pure-api.md      # codec, boot script, motionKind, reconcileMarkers, theme and print stores
│   └── ui.md            # selector DOM/ARIA, document theme table, board colours, motion and print behaviour, headers
├── checklists/          # from /speckit.specify and /speckit.clarify
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
src/app.html                        # EDIT: <script src="/theme-boot.js"> in <head> (no inline script)
static/
├── theme-boot.js                   # NEW: pre-paint data-theme from stored record (ES2015, ~300 B)
└── _headers                        # EDIT: /theme-boot.js Cache-Control: no-cache
src/lib/styles/
├── tokens.css                      # EDIT: color-scheme + [data-theme]; surface tokens as light-dark(); --fb-color-* shared palette;
│                                   #       contrast-more fb set; forced-colors system mapping; @media print palette + --print-* tokens
└── global.css                      # EDIT: @media print omit/show rules, white page, svg print sizing
src/lib/prefs/schema.ts             # EDIT: THEMES, Preferences.theme, parse/serialize
src/lib/prefs/session.ts            # EDIT: PreferencesPatch.theme
src/lib/state/
├── theme.svelte.ts                 # NEW: choice store, choose/restore, writes data-theme
├── print.svelte.ts                 # NEW: print.active from matchMedia('print') + before/afterprint
├── preferences.svelte.ts           # EDIT: theme.start on start, theme.restore on erase
├── triads-view.ts, caged-view.ts, notes-view.ts   # EDIT: motionKind classifier per tool
└── triads.svelte.ts, caged.svelte.ts, notes.svelte.ts  # EDIT: attach DisplayModel.motion
src/lib/fretboard/
├── transition.ts                   # NEW: MotionKind, KeyedMarker, reconcileMarkers
├── types.ts                        # EDIT: DisplayModel.motion
├── Fretboard.svelte                # EDIT: keyed list from reconcileMarkers, data-motion, fades per enter/exit,
│                                   #       focus dim/scroll on --duration-medium, --fb-* tokens only, edge stroke,
│                                   #       print layout branch, description data-print="show"
├── MarkerSample.svelte             # EDIT: --fb-color-* role tokens
├── LegendPanel.svelte, ViewAids.svelte  # EDIT: data-print="show"; render legend while print.active
└── Minimap.svelte                  # EDIT: data-print="omit"
src/lib/shell/
├── ThemeSelector.svelte            # NEW: Follow device / Light / Dark radios
├── LanguagePanel.svelte            # EDIT: renders ThemeSelector; data-print="omit"
├── HomeScreen.svelte               # EDIT: ThemeSelector beside LanguageSelector
├── ToolLayout.svelte, AppNav.svelte, ShareButton.svelte, InstrumentButton.svelte,
│   SoundControl.svelte, StopButton.svelte, NotationToggle.svelte, Notice.svelte,
│   PrefsNotice.svelte, InstrumentPanel.svelte  # EDIT: data-print="omit" (zone B, bar, notices, panels)
└── TuningBadge.svelte              # EDIT: stays printed (no omit)
src/lib/tools/SidePanels.svelte, ContextZone.svelte  # EDIT: omit panel chrome; zone D legend/description printable
src/routes/+layout.svelte           # EDIT: print.start() on mount
messages/{en,pt-BR,es}.json         # EDIT: theme_* keys; disclosure names → "Language and appearance"
tests/unit/
├── prefs/schema.test.ts            # EDIT: theme field cases
├── prefs/theme-boot.test.ts        # NEW: vm-run boot script table
├── a11y/tokens.ts                  # NEW: token-sheet parser (blocks, light-dark arms)
├── a11y/palette-contrast.test.ts   # NEW: FR-013/014/015/028 thresholds
├── a11y/palette-cvd.test.ts        # EDIT: standard, contrast-more and print sets
├── a11y/theme-tokens.test.ts       # NEW: fb tokens literal and identical; no surface tokens in board SVG rules
├── reserved-colors.test.ts         # EDIT: --fb-color-root|third|fifth; notice not error red
├── headers.test.ts                 # EDIT: /theme-boot.js
├── fretboard/transition.test.ts    # NEW: reconcile cases and properties
├── fretboard/fretboard.test.ts     # EDIT: data-motion, keys, print layout branch
├── state/theme.test.ts, state/print.test.ts   # NEW
├── triads/, caged/, notes/         # EDIT: motionKind tables; reveal order
└── theme-selector.test.ts, language-panel.test.ts, home-screen.test.ts  # NEW/EDIT
e2e/
├── theme.spec.ts                   # NEW: US1, US2-1, US3 (contrast emulation)
├── motion.spec.ts                  # NEW: US4 with page.clock and reduced motion
├── print.spec.ts                   # NEW: US5
├── a11y-audit.spec.ts, a11y-colour.spec.ts, nojs.spec.ts, preferences.spec.ts,
│   playback.spec.ts, caged-focus.spec.ts, text-zoom.spec.ts  # EDIT
└── *-snapshots/                    # REGENERATE light-theme baselines (none removed); ADD dark/contrast/print shots
docs/adr/
├── 0024-theme-pin-boot-script-and-shared-board-palette.md   # NEW
└── 0025-change-kind-motion-and-print-layout.md              # NEW
```

**Structure Decision**: This is the single SvelteKit project at the repository root, using the
layout the constitution already mandates. Every directory named above already exists: `src/`,
`src/lib/{styles,prefs,state,fretboard,shell,tools}`, `src/routes`, `static/`, `messages/`,
`tests/unit/{a11y,prefs,fretboard,state,triads,caged,notes}`, `e2e/` and `docs/adr/`.
- Token and print CSS stay in `src/lib/styles/`.
- The theme field goes in the existing preferences codec.
- Stores go in `src/lib/state/`, next to `language.svelte.ts` and `fit.svelte.ts`.
- Motion reconciliation goes beside the existing `motion.ts` and `scroll-animation.ts` in
  `src/lib/fretboard/`.
- The selector goes in `src/lib/shell/` beside `LanguageSelector`.
- The boot script goes in `static/`, next to `_headers` and `fonts/`.

## Phase overview (for /speckit-tasks)

1. **Setup**: Measure the bundle baseline (R-13). Add catalog keys. Add the token parser test
   helper.
2. **Foundations (test-first, blocking)**:
   - Codec `theme` field.
   - `theme-boot.js` plus `_headers` and `app.html`.
   - `light-dark()` surface tokens and the `color-scheme`/`data-theme` rules.
   - The `--fb-color-*` palette (standard, contrast-more, print) with the contrast, CVD and
     reserved scans green.
   - `transition.ts`.
3. **US1 themes (P1)**: theme store, `ThemeSelector` in `LanguagePanel` and `HomeScreen`, the
   erase hook, and `e2e/theme.spec.ts` (first-frame, live device, share link, storage blocked).
4. **US2 shared board (P1)**: switch `Fretboard.svelte` and `MarkerSample.svelte` to `--fb-*`
   only, the edge stroke and dimmed opacity, the on-board equality e2e, regenerated light
   baselines, and axe in both themes.
5. **US3 contrast variant (P2)**: the contrast-more fb set, the forced-colours mapping, and e2e
   emulation (live toggle, pinned theme).
6. **US4 motion (P2)**: `motionKind` per tool, model `motion`, Fretboard reconciliation,
   `data-motion`, focus at `--duration-medium`, layer-off fade, reduced-motion pulse check,
   and `e2e/motion.spec.ts`.
7. **US5 print (P3)**: print store, print palette and layout branch, omit/show attributes, and
   `e2e/print.spec.ts` (contents, fit and arrangement independence, 7 pt, background off).
8. **Polish**: ADRs 0024 and 0025; the bundle measure, then trim; 200% text and 320 px checks;
   `pnpm verify` once.

## Risks and mitigations

- **`light-dark()` down-levelled by the CSS minifier** (R-01): the pinned-dark-on-light-device
  e2e test against the production build catches it. Fallbacks: raise `build.cssTarget`, or use
  duplicated dark blocks guarded by an equality unit test.
- **Bundle headroom about 2 KB** (R-13): measure first, then trim inside the slice.
  Escalation is outside this spec (see Complexity Tracking).
- **Dimmed contrast on a dark board** forces `--emph-dim-opacity` up from 0.4 to about 0.6.
  Emphasis is still opacity plus size (Principle V), and the TM-9 baselines change
  intentionally.
- **Playwright print emulation does not fire `beforeprint`**: `print.svelte.ts` also listens to
  `matchMedia('print')` change, which `emulateMedia` triggers.
- **Real print snapshot timing**: Chrome fires `beforeprint` synchronously before layout. The
  store flushes synchronously (`flushSync`) so the print layout is in the DOM before the
  snapshot.
- **Existing selectors and snapshots that depend on the light board**: regenerate, never
  delete. `a11y-colour.spec.ts` expectations are updated to the new token names.
- **Comparison enter from the base position**: Svelte intros cannot set an initial transform.
  The renderer writes the `from` transform first, then sets the target on the next frame, which
  is the same technique as the existing `mounted` CSSOM switch.

## Complexity Tracking

No constitution principle is violated. The table records the assumptions and rejected
alternatives that the headless planning run had to choose without a human.

| Violation / assumption | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Static `theme-boot.js` outside the Vite bundle (not content-hashed; `no-cache` header) | FR-007 requires no flash, no inline script and no CSP relaxation. Only a parser-blocking same-origin script runs before first paint | Inline script needs a CSP hash, which the spec forbids. Applying the pin in `hooks.client` runs after paint, so the flash remains. A module script is deferred |
| Surface tokens rewritten as `light-dark()` | One value per token per theme, `color-scheme` always matching the effective theme, and no-JS device following | Duplicating the dark block for `[data-theme='dark']` and the media query drifts. It is kept only as a fallback if the build polyfill misbehaves |
| `--emph-dim-opacity` raised from 0.4 to about 0.6 in the standard palette | FR-014 requires dimmed ≥ 3:1 on a dark board, and 0.4 composites to about 2.2:1 | Keeping 0.4 and brightening the role colours cannot reach 3:1 without losing label ≥ 4.5:1 and the CVD separation |
| Print layout via a JS `print.active` branch (whole fit at nominal 190 mm) | FR-028/FR-030 require the same print whatever the screen fit, scroll and arrangement, plus a ≥ 7 pt floor | CSS-only scaling of the on-screen SVG depends on the screen's fit and container width. A second always-mounted print SVG doubles DOM cost |
| Change kind classified per tool (`motionKind`) rather than inferred by the renderer | The renderer cannot tell a root change from a key change, or an inversion from a set change, using markers alone | Per-tool marker ids encoding pairing would duplicate the rule in three tools and couple ids to motion |
| Bundle headroom risk (Principle VI, 136 KB) | About 2.4 KB is estimated against about 2 KB of headroom | Raising the cap requires an amendment, which spec FR-033 puts out of scope. The slice trims first, and if it is still over it stops with a recorded gap for a separate decision |
| Principle VI cap raised 136 → 150 KB (constitution 1.11.0, 2026-10-07) | After trimming (`theme-boot.js`, shared `byString` grouping in `transition.ts`, unit-table-free `printInlinePx`) initial JS is 136.9 KB gzip, 887 B over 136 KB; the rest is required behaviour (theme, motion, print) | Removing a user story to fit; the owner chose to amend the cap to 150 KB instead (Sync Impact Report in the constitution, `check-bundle-size.mjs`, ADR 0002) |
| Cross-fade timing: both fades run concurrently over `--duration-short` | The spec says "overlapping, both partly visible at the midpoint, neither alone for 300 ms" | Sequential fade-out then fade-in leaves the midpoint empty, which violates the spec |
| Theme choice not synced across open tabs | Spec default, and no existing preference syncs | A `storage` listener adds code and bundle bytes for an edge case the spec excludes |

### T070 bundle measurement (recorded gap)

Measured with the gate's own command (`pnpm build && node scripts/check-bundle-size.mjs build`,
production mode; the `build:test` bundle is larger because it includes fault injection):

| Step | Initial JS gzip | Limit | Over by |
|---|---|---|---|
| Baseline before 026 (ADR 0024) | 135.0 KB | 136 KB | under by 1.0 KB |
| End of Phase 7 | 137.2 KB | 136 KB | 1.2 KB |
| After trimming `static/theme-boot.js` (comments removed, 878 B to 385 B, lint-clean and prettier-formatted) | 137.0 KB | 136 KB | **1.0 KB** |

The remaining code (`transition.ts`, `motion-track.ts`, `print.svelte.ts`, `print-layout.ts`,
the theme store and selector, per-tool `motionKind`) has no dead exports: every export is used
by the renderer or a store. Cutting another 1.0 KB means dropping behaviour (for example
`adoptKeys`, or the print unit table), which the spec requires. Per FR-033 the cap is not
raised. **Gap: about 1.0 KB gzip, for a separate decision** (amend the Principle VI cap, or
remove a feature behaviour). `pnpm verify` fails its bundle check until that decision lands.

**Resolution (2026-10-07)**: the owner raised the Principle VI cap to 150 KB (constitution
1.10.0 → 1.11.0). Further trims in `transition.ts` and `print-layout.ts` saved 119 B; the
final production measurement is 136.9 KB, within the new cap.
