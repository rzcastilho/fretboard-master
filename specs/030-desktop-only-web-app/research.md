# Research: Desktop-Only Web Application (030)

All Technical Context unknowns are resolved below. Each entry: Decision, Rationale, Alternatives
considered. Code references are to the tree at `da84ac9`.

## R-01 Arrangement set after the slice

- **Decision**: `Arrangement = 'reflow' | 'wide-side' | 'wide-stacked'`. `arrangementFor` returns
  `reflow` when `width < 1024`, otherwise the existing neck-width test picks `wide-side` or
  `wide-stacked`. Height is no longer an input. `narrow`, `medium` and `landscape` are deleted,
  along with `NARROW_MAX`, `LANDSCAPE_MAX_HEIGHT` and `isPhoneLandscape`
  (`src/lib/shell/layout.ts`). `MEDIUM_MAX` becomes `REFLOW_MAX = 1023`.
- **Rationale**: FR-001/FR-002/FR-011 allow exactly one arrangement below 1024 CSS px and only
  desktop arrangements above. The wide pair already handles 1024–2560 (fretboard beside or above
  zone D). Removing the height input is what makes FR-002's "any window shape" true: a 1280×600
  or 320×200 (400 % zoom) window can no longer land in `landscape`.
- **Alternatives**: keep `medium` for 600–1023 — rejected, FR-002 names it for removal and it was
  only `wide-stacked` plus the compact bar. Keep the name `narrow` — rejected, the name ties the
  arrangement to small devices; `reflow` states its purpose (WCAG 1.4.10) and `data-arrangement`
  is not part of any stored or shared format, so the rename is free.

## R-02 What the reflow arrangement looks like

- **Decision**: `reflow` inherits today's `narrow` rules unchanged: single column B / C / E / D,
  compact icon-only app bar (labels as tooltips), the one-line context summary that expands on
  demand (`ContextZone`, `context-panel.svelte.ts`), wrapping note selector rows, tighter control
  gaps. Every CSS selector `[data-arrangement='narrow']` becomes `[data-arrangement='reflow']`; the
  `medium` and `landscape` selectors are deleted.
- **Rationale**: these rules are what already pass reflow and no-overflow checks at 320 px
  (`e2e/responsive-layout.spec.ts`, `languages-layout.spec.ts`, `notation-layout.spec.ts`). A
  1280×800 window at 400 % zoom is 320×200 CSS px, so the collapsed context summary is what keeps
  the fretboard reachable near the top. None of these rules depend on touch, orientation or safe
  areas, so FR-011's "no phone tuning" holds.
- **Alternatives**: a new reflow design — rejected, YAGNI and it would need new baselines and
  review for no user gain. Drop the context collapse — rejected, at 200 CSS px height zone D would
  push the fretboard off-screen on every control change.

## R-03 Provisional arrangement before first paint

- **Decision**: `static/theme-boot.js` writes `w <= 1023 ? 'reflow' : 'wide-side'`; the height
  read and the landscape branch go. `tests/unit/prefs/theme-boot.test.ts` keeps mirroring
  `arrangementFor` (same thresholds).
- **Rationale**: slice 031 added this to remove the hydration layout shift (CLS gate). It must
  keep matching `layout.ts`, or the shift returns.
- **Alternatives**: delete the boot script's arrangement — rejected, CLS regresses.

## R-04 No-JS CSS fallback

- **Decision**: in `src/lib/styles/tokens.css` delete the `@media (min-width: 600px)` block (it
  only re-declares the default) and its "600px: medium" comment. Keep the `min-width: 1024px`
  fallback. Update the "narrow/medium" token comment to "reflow".
- **Rationale**: the 1024 px query is the no-JS split between stacked and side-by-side, matching
  FR-010. 600 px has no meaning after the slice.

## R-05 Landscape side panel and bar

- **Decision**: delete `src/lib/tools/SidePanels.svelte`, its unit test, the `panels_open`,
  `panels_close`, `panels_region` messages (en, pt-BR, es), the `--landscape-bar-height` token,
  the `data-landscape` attribute on the tool header (`ToolLayout.svelte`), the `sr-only` landscape
  heading branch, and every `[data-arrangement='landscape']` / `header[data-landscape]` rule in
  `global.css`, `controls.css`, `tokens.css`. Tools that wrapped zones E and D in `SidePanels`
  render them directly (grid areas `e` and `d`). `BarIcon.svelte` stays: the compact bar in
  `reflow` still uses its icons; only its comment changes.
- **Rationale**: SidePanels existed only for `landscape` (it is `display: contents` elsewhere).
- **Alternatives**: keep SidePanels as inert wrapper — rejected, dead code (constitution: no dead
  code).

## R-06 Rotate hint and the stored `rotateHint` field

- **Decision**: delete `src/lib/state/rotate-hint.ts` and its test, the hint block in
  `CagedTool.svelte`, the `caged_rotate_hint` message in every catalog, and
  `preferences.rotateHintShown` / `markRotateHintShown`. Remove `rotateHintShown` from
  `Preferences`, `DEFAULT_PREFERENCES`, `PRIVACY_CATEGORIES.hints`, and `rotateHint` from
  `recordSchema` and `serializePreferences`. The preferences format version stays `1`.
- **Rationale**: Valibot `v.object` strips unknown keys, so a stored `"rotateHint": true` (or any
  invalid value) is ignored without error and every other field is kept (FR-013). The field was
  optional and defaulted to `false`, so removing it is not a format change: older builds still
  running in another tab (ADR 0002 version continuity) read its absence as "not shown", which is
  the pre-016 behavior. No migration is needed. Existing fixtures in
  `tests/unit/prefs/fixtures/index.ts` that carry `rotateHint` stay (fixtures are append-only in
  spirit); their expectations drop the field.
- **Alternatives**: keep parsing `rotateHint` into an unused field — rejected, dead state, and
  the privacy policy would keep naming a hint that no longer exists. Bump the format version —
  rejected, no reader needs to distinguish the records.
- **Privacy text**: `about_privacy_stored` names "hints shown"; `cagedNoteShown` remains in that
  category, so the wording stays true and needs no change.

## R-07 Pinch gesture

- **Decision**: delete `src/lib/fretboard/pinch.ts`, `tests/unit/fretboard/pinch.test.ts` and the
  pinch `$effect` in `Fretboard.svelte`. The pinch was the only emitter of
  `FitEvent { kind: 'request' }` (the fit control calls `fit.toggle()` directly), so remove that
  variant from `src/lib/fretboard/types.ts`, its `case` in `src/lib/state/fit.svelte.ts`, and its
  cases in `tests/unit/state/fit.test.ts` and `tests/unit/fretboard/fretboard.test.ts`.
- **Rationale**: FR-004. Single-pointer gestures (`interaction.ts` reducer: tap → activate, drag
  → scroll) are pointer-event based and already treat touch as click (FR-006). The small-tap
  notice in whole mode (`TARGET_MIN_PX`, `onfit({kind: 'small-tap'})`) stays: it fires on mouse
  clicks too, when columns are narrower than `--target-min` at a 1024 px window with 24 frets.

## R-08 Safe areas

- **Decision**: remove the four `padding-*: env(safe-area-inset-*)` lines on `body`
  (`global.css`) and `viewport-fit=cover` from the viewport meta in `src/app.html`. Keep
  `width=device-width, initial-scale=1`.
- **Rationale**: FR-005. Without `viewport-fit=cover` the browser letterboxes inside safe areas
  itself, so an unsupported phone visit is still not clipped (US5).
- **Alternatives**: drop the viewport meta entirely — rejected, phones would render at 980 px
  and break the "no blocking, content reachable" best-effort promise; desktop ignores it anyway.

## R-09 Touch-target size

- **Decision**: keep `--target-min: 44px` and every control size as is. Only the constitution
  rule changes: Principle V now requires WCAG 2.2 SC 2.5.8 (Target Size, Minimum, 24×24 CSS px)
  instead of 44×44 in comfortable mode.
- **Rationale**: FR-007 drops the requirement, FR-009 forbids changing existing desktop
  behavior. Shrinking targets would change every screenshot and layout for no requested benefit.
  A later slice may shrink them under the new rule.
- **Alternatives**: shrink to 24 px now — rejected, scope creep, breaks SC-001 baselines.

## R-10 Playwright projects

- **Decision**: `playwright.config.ts` projects become `desktop` (1280×800, unchanged),
  `firefox` and `webkit` (`@smoke`), `nojs`. `phone` and `phone-touch` are deleted.
  `pw.local.config.ts` filter becomes `['desktop', 'nojs']`. The minimum (1024×768) and wide
  (2560×1440) widths, and the reflow sizes, are covered by `setViewportSize` inside specs on the
  `desktop` project (FR-016), not by extra projects.
- **Rationale**: specs already resize inside tests; extra projects would re-run the whole suite
  and erase the SC-004 saving.
- **Browser zoom in tests**: Playwright cannot drive browser zoom. A 1280×800 window at 400 % zoom
  lays out as a 320×200 CSS px viewport and at 200 % as 640×400, with `devicePixelRatio` scaled.
  Tests use those viewport sizes (`deviceScaleFactor` left at 1, which only changes raster
  density, not layout). This is the verification FR-011 / SC-008 name.

## R-11 Triage of existing e2e specs

Every spec is classified; the task list follows this table.

| Kind | Specs / tests | Action |
|---|---|---|
| Phone-only, delete | `e2e/landscape.spec.ts`; `e2e/fretboard-touch.spec.ts`; the rotate-hint describe in `e2e/caged-focus.spec.ts` (≈ lines 450–600); `medium` tests in `e2e/responsive-layout.spec.ts` | Delete |
| Ran only on phone projects | `fretboard.spec.ts` tests skipped with `project.name === 'desktop'` (≈ 211, 245, 270, 412); `custom-tuning.spec.ts` "once per project"; `fretboard.spec.ts:78` `isMobile` skip | Set an explicit reflow viewport (320×800 or 640×400) and drop the skip, so they keep running on `desktop` |
| Narrow viewport, still-valid behavior | tests at 320/360/390/480/800 px in about, a11y-keyboard, caged-*, minimap-fit, share, triads-*, playback, text-zoom, languages-layout, notation-layout, home, navigation, instrument-panel, ui-refinement, print | Keep: they now exercise `reflow`. Rename size labels `phone` → `reflow`; widths unchanged |
| Rotate-hint workarounds | `measurement.spec.ts:189–194` filter, `open-link.spec.ts:569` comment, `share.spec.ts:133` comment | Remove the workaround or comment |
| Retitle | `share.spec.ts` "phone sends the view through the system sheet" — Web Share exists on desktop browsers | Retitle, behavior kept |
| Arrangement names | `responsive-layout.spec.ts` narrow tests, axe "narrow collapsed and expanded" | Rename to reflow |
| Screenshots | every `*-phone-{darwin,linux}.png`, `*-phone-touch-{darwin,linux}.png` under `e2e/*-snapshots/` | Delete; desktop baselines unchanged except `responsive-layout` reflow/medium shots (regenerate) |
| New | `e2e/desktop-only.spec.ts` | US1–US5 acceptance: 1024/2560 no overflow + axe; no rotate hint at 390×844 and 600×900; 1280×500 is wide not landscape; pinch on `hasTouch` desktop context does not change fit; tap = click; reflow at 320×200 and 640×400 for every route with axe and no page horizontal scroll; no safe-area padding on `body`; old prefs with `rotateHint` load |

## R-12 Unit tests to change

| File | Change |
|---|---|
| `tests/unit/layout.test.ts` | Rewrite for the three arrangements; property: no `(width, height)` ever returns a removed value; height has no effect |
| `tests/unit/state/viewport.test.ts` | Expectations for `reflow` |
| `tests/unit/tool-layout.test.ts`, `tests/unit/headers.test.ts` | Drop `data-landscape` and landscape heading cases; `app.html` meta without `viewport-fit=cover` |
| `tests/unit/side-panels.test.ts`, `tests/unit/state/rotate-hint.test.ts`, `tests/unit/fretboard/pinch.test.ts` | Delete |
| `tests/unit/fretboard/fretboard.test.ts` | Delete pinch cases; add "two touches never emit a fit request" |
| `tests/unit/caged/caged-tool.test.ts` | Delete rotate-hint cases; add "no notice at portrait size" |
| `tests/unit/prefs/schema.test.ts`, `tests/unit/state/preferences-store.test.ts` | Delete `rotateHint` read/write cases; add: a record with `rotateHint` (true, invalid) parses with every other field kept and serializes without it; arbitraries drop the field |
| `tests/unit/prefs/theme-boot.test.ts` | Thresholds per R-03 |

## R-13 Lighthouse desktop profile

- **Decision**: `lighthouserc.cjs` `collect.settings` becomes `{ preset: 'desktop' }` (formFactor
  desktop, 1350×940 screen emulation, 40 ms RTT, 10 Mbps, CPU slowdown 1×, simulated). Shared
  assertion `categories:performance` `minScore: 0.9`; `interactive` ≤ 3000 ms for `/` and
  `/about`, ≤ 3500 ms for `/notes` and `/triads`; CLS ≤ 0.1 and the TBT warning unchanged. URL list
  unchanged.
- **Rationale**: FR-017/FR-018. Lighthouse's desktop preset is the "mid-range laptop on
  broadband" profile; it is the standard desktop scoring profile, so "performance score" means the
  same thing as in PageSpeed Insights desktop. With CPU 1× and 10 Mbps the 145 KB bundle that
  forced 1.12.0's relaxed values no longer dominates, so the tighter targets are realistic.
- **Risk**: if the first CI run misses the new values, the slice does not relax them on its own;
  that needs another amendment (Principle VI). Quickstart step 6 runs lhci once locally only to
  confirm, as CLAUDE.md permits when reproducing CI.
- **Alternatives**: custom throttling object — rejected, non-standard and harder to compare.

## R-14 Constitution amendment: version and content

- **Decision**: 1.12.0 → **2.0.0** (MAJOR). Principle VII's device-priority bullet and Principle
  V's touch-target bullet are redefined; VI's reference profile and table change. Exact clause
  text is in `contracts/constitution-amendment.md`.
- **Rationale**: the Governance section: "MAJOR: removing or redefining a principle".

## R-15 Product specification and ADRs

- **Decision**: edit the clauses listed in `contracts/governing-docs.md`, each with a trailing
  note `*[Changed by slice 030: desktop-only target.]*`. New ADR
  `docs/adr/0029-desktop-only-target.md` supersedes the landscape-arrangement and pinch parts of
  ADR 0023 (status "Partially superseded by 0029") and any phone-only part of 0001, 0005, 0025
  found when editing (status line plus pointer; bodies untouched).
- **Rationale**: FR-020/FR-022; ADRs are superseded, never deleted.

## R-16 CI and tooling

- **Decision**: `.github/workflows/update-snapshots.yml` runs `--project=desktop` only.
  `ci.yml` `e2e` job (currently disabled by `dc90d02`) keeps running `pnpm test:e2e`, which now
  has no phone projects; re-enabling it is not part of this slice. `CLAUDE.md` screenshot row
  becomes `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`,
  and the `test:e2e` line drops "phone, phone-touch". `scripts/verify.mjs` needs no change (it
  already runs `desktop`).
- **SC-004 measurement**: compare `pnpm playwright test --list | tail -1` totals before and after
  (test count is the time proxy: same machine, same specs). Before: three Chromium layout
  projects; after: one. Expected reduction well over 30 %.

## R-17 Device class in measurement

- **Decision**: unchanged (`src/lib/measure/device.ts`, wire format). `04-data-model.md` keeps
  `phone, tablet, desktop` as the device-class values.
- **Rationale**: spec assumption and edge case "Anonymous measurement".
