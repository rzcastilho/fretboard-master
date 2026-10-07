---

description: "Task list for Themes, Motion, and Print (feature 026)"
---

# Tasks: Themes, Motion, and Print

**Input**: Design documents from `/specs/026-themes-motion-and-print/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pure-api.md, contracts/ui.md, quickstart.md

**Tests**: INCLUDED. Constitution IV (test-first) and plan.md require them. Write each test first, see it fail, then implement. Local runs stay targeted (CLAUDE.md "Verification during implementation"):

- Unit: `pnpm vitest run <touched test paths>`. A test that touches `document`, `window` or `localStorage` starts with `// @vitest-environment jsdom`.
- E2E: `pnpm build:test` once after changing `src/` or `static/`, then `pnpm test:e2e:fast <spec files>`.
- New or changed screenshot: `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots`. Regenerate baselines, never delete them.
- Never run `pnpm test:e2e` or `pnpm lhci` locally. Run `pnpm verify` once, at the end (T074).

**Organization**: grouped by user story. US1 and US2 are both P1; US2 depends on the Foundational palette, not on US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1 themes, US2 shared board and reserved colours, US3 contrast variant, US4 motion, US5 print
- Paths are relative to the repo root

---

## Phase 1: Setup

**Purpose**: baseline measurement, catalog keys, test helpers

- [X] T001 Measure the initial-JS gzip baseline with `pnpm build:test && node scripts/check-bundle-size.mjs build` and record the number and the remaining headroom under 136 KB in the header of `docs/adr/0024-theme-pin-boot-script-and-shared-board-palette.md` (create the file with title, status "Proposed" and this measurement; T069 completes it)
- [X] T002 [P] Add catalog keys `theme_label`, `theme_device`, `theme_light`, `theme_dark` to `messages/en.json`, `messages/pt-BR.json`, `messages/es.json` using the values in data-model.md §9 (Theme/Follow device/Light/Dark; Tema/Seguir o dispositivo/Claro/Escuro; Tema/Seguir el dispositivo/Claro/Oscuro)
- [X] T003 [P] Change the VALUES (not the key names) of the language disclosure button and region strings to "Language and appearance" / "Idioma e aparência" / "Idioma y apariencia" in `messages/en.json`, `messages/pt-BR.json`, `messages/es.json`. Read the key names from `src/lib/shell/LanguageButton.svelte` and `src/lib/shell/LanguagePanel.svelte`. Update any existing test that asserts the old accessible names (grep `tests/unit` and `e2e` for the old strings)
- [X] T004 [P] Create the token-sheet parser helper `tests/unit/a11y/tokens.ts`: reads `src/lib/styles/tokens.css`, returns per block (`:root`, `[data-theme]`, `@media (prefers-contrast: more)`, `@media (forced-colors: active)`, `@media print`) the custom-property map, and resolves `light-dark(a, b)` into its two arms. Reuse the contrast, CVD and CIEDE2000 maths from `tests/unit/a11y/color.ts`; add no dependency

**Checkpoint**: catalog parity test (`pnpm vitest run tests/unit/i18n`, or the existing parity test file) passes.

---

## Phase 2: Foundational (blocks all user stories)

**Purpose**: codec field, boot script, token restructuring with the shared palette, reconciliation module

**⚠️ CRITICAL**: no user story starts before this phase is complete.

### Tests first

- [X] T005 [P] Extend `tests/unit/prefs/schema.test.ts` with the `theme` cases from contracts/pure-api.md §1: absent → `null`; `"dark"`/`"light"` kept; `"system"`, `"Dark"`, `1`, `{}`, `null` → `null` with other fields unchanged; `serializePreferences(DEFAULT_PREFERENCES)` byte-identical to the current string (no `theme` key); `theme: 'dark'` serializes last, after `cagedNote`, as `…,"theme":"dark"}`; fast-check round trip over all fields including `theme`
- [X] T006 [P] Create `tests/unit/prefs/theme-boot.test.ts`: run `static/theme-boot.js` in `node:vm` with stub `localStorage` and `document.documentElement.dataset`, covering every row of contracts/pure-api.md §2 (absent key, valid dark, valid light, invalid/absent theme, non-JSON, JSON array, `null`, `getItem` throws, `localStorage` getter throws, raw longer than `MAX_RAW_LENGTH`). Add static assertions: file contains `PREFS_KEY` value verbatim, accepts exactly the `THEMES` values, has no `import`/`export`, never calls `setItem`/`removeItem`
- [X] T007 [P] Extend `tests/unit/headers.test.ts`: `static/_headers` has a `/theme-boot.js` rule with `Cache-Control: no-cache`; `svelte.config.js` CSP is unchanged (`script-src 'self'`); `src/app.html` contains exactly one `<script src="/theme-boot.js"></script>` in `<head>` and no inline script
- [X] T008 [P] Create `tests/unit/fretboard/transition.test.ts` for `reconcileMarkers` (contracts/pure-api.md §4): slide C→D pairs per string in fret order and no key spans two strings; more/fewer new markers than old get `enter: 'fade'` / absent old keys; slide with left-handed and 7 strings gives the same pairing; by-role C major→C minor keeps the third's key (fret −1) and root/fifth keys; role moving to another string gets a fresh key and `'fade'`; comparison markers carry `from` = base marker of the same role and base keys unchanged; cross-fade shares no key with `prev` and all modes `'fade'`; reveal gives new markers `enter: 'reveal'` and keeps existing keys; none keeps keys stable with no `'fade'`/`'reveal'`; pulsed marker keyed by `pulse.id` in every kind; fast-check properties (output markers equal `next` in order, keys unique, deterministic)
- [X] T009 [P] Create `tests/unit/a11y/palette-contrast.test.ts` using `tests/unit/a11y/tokens.ts`. For the standard, contrast-more and print sets assert every constraint in data-model.md §5: text ≥ 4.5 / 7 / 4.5; label vs each role fill ≥ 4.5 / 7 / 4.5; normal markers ≥ 3 / 4.5 / 3 vs `--fb-color-wood`; dimmed markers (role composited over wood at `--emph-dim-opacity`) ≥ 3 / 4.5 / 3 and opacity < 1; `--fb-color-line` and `--fb-color-nut` ≥ 3 / 4.5 / 3 and strictly lower than the minimum normal-marker contrast; outline/arrow/ring ≥ 3 / 4.5 / 3; arrow label vs halo; note-highlight, octave tones 1–7 and their label; board edge: `max(contrast(wood, surface), contrast(edge, surface)) ≥ 3` against both light and dark `--color-surface`; print wood is white or very light; neutral stroke ≥ 3 in print
- [X] T010 [P] Extend `tests/unit/a11y/palette-cvd.test.ts`: for the standard, contrast-more and print sets, each pair among `--fb-color-root`, `-third`, `-fifth` has CIEDE2000 ≥ 10 under full-severity protan, deutan and tritan simulation
- [X] T011 [P] Create `tests/unit/a11y/theme-tokens.test.ts`: every `--fb-color-*`, `--fb-octave-tone-*`, `--fb-region-band` and `--emph-*` token in the `:root` block is a literal (hex, with optional alpha) and is NOT written as `light-dark(...)`, `var(...)` of a surface token, or redefined under `[data-theme]`; the removed names listed in data-model.md §5 no longer appear anywhere in `src/`; no rule inside the board SVG styles in `src/lib/fretboard/Fretboard.svelte` references a `--color-*` surface token (exception: `--color-focus-ring*`)
- [X] T012 [P] Extend `tests/unit/reserved-colors.test.ts`: `--fb-color-root|third|fifth` are referenced only by `.marker.root|third|fifth .glyph` in `src/lib/fretboard/Fretboard.svelte` and the glyph fill in `src/lib/fretboard/MarkerSample.svelte`; no notice token resolves to error red for normal situations; buttons, links, focus rings, selection and notices never use the role tokens

### Implementation

- [X] T013 Add `THEMES = ['light', 'dark'] as const`, `type Theme`, `Preferences.theme: Theme | null` (default `null`) to `src/lib/prefs/schema.ts`: parse with `v.fallback(v.nullable(v.picklist(THEMES)), null)`, serialize last and only when non-null; `PREFS_VERSION` stays 1 (T005)
- [X] T014 Add `theme?: Theme | null` to `PreferencesPatch` in `src/lib/prefs/session.ts` and make `src/lib/state/preferences.svelte.ts` pass it through `remember` (T013)
- [X] T015 [P] Create `static/theme-boot.js`: ES2015, no module syntax; in try/catch read `localStorage.getItem(<PREFS_KEY value>)`, reject raw longer than `MAX_RAW_LENGTH`, `JSON.parse`, accept only an object whose `theme` is exactly `'light'` or `'dark'`, then set `document.documentElement.dataset.theme`; never throws, never writes storage (T006)
- [X] T016 [P] Add `<script src="/theme-boot.js"></script>` to `<head>` of `src/app.html` (parser-blocking, before stylesheets render) and a `/theme-boot.js` block with `Cache-Control: no-cache` to `static/_headers`. Leave the CSP in `svelte.config.js` untouched (T007)
- [X] T017 Restructure surface tokens in `src/lib/styles/tokens.css`: `:root { color-scheme: light dark }`, `:root[data-theme='light'] { color-scheme: light }`, `:root[data-theme='dark'] { color-scheme: dark }`. Write each surface token (`--color-surface`, `-surface-raised`, `-text`, `-text-muted`, `-accent`, `-accent-text`, `-border`, `-disabled-*`, `-focus-ring*`, `-notice-*`, `-hint-*`) once as `light-dark(<today's light>, <today's dark>)` and remove the `prefers-color-scheme: dark` block, so off-board visuals do not change. Risk R-01: if the production build down-levels `light-dark()`, raise `build.cssTarget` in `vite.config.ts`
- [X] T018 Add the "Fretboard palette — identical in light and dark" block to `src/lib/styles/tokens.css` (standard set in `:root`): every `--fb-color-*` token of data-model.md §5, `--fb-octave-tone-1…7`, `--fb-region-band`, `--fb-color-elevation`, as literal hex. Warm dark wood; `--fb-color-edge` per the 3:1 rule; `--fb-edge-width: 1`; `--emph-dim-opacity` raised to about 0.6 (and keep `--emph-dim-scale` < 1). Tune values until T009–T011 pass (T004, T009–T011)
- [X] T019 Add the contrast-more `--fb-color-*` set (`@media (prefers-contrast: more) :root`: warm, darker wood; 7:1 text and labels; 4.5:1 markers, lines, outlines, own `--emph-dim-opacity`, stroke widths not thinner, `--fb-edge-width` ≥ standard) and the print set (`@media print :root`: white or very light warm wood, dark lines/edge/numbers, darker role fills, white labels, neutral light fill with dark stroke, own dim opacity, `--fb-edge-width` ≥ standard) to `src/lib/styles/tokens.css`. Add `--print-board-inline: 190mm`, `--print-board-max-block: 55vh`, `--print-text-min: 7pt`. Move `Canvas`/`CanvasText` board mapping from `prefers-contrast` to `@media (forced-colors: active)` only. Tune until T009 and T010 pass for all three sets (T018)
- [X] T020 Create `src/lib/fretboard/transition.ts`: export `MotionKind`, `KeyedMarker`, `reconcileMarkers(prev, next, kind, generation)` with the exact rules of data-model.md §7 (slide per-string fret-order pairing; by-role keyed by `mk.id`, other string → fresh key + `'fade'`, comparison `from`; cross-fade fresh `${generation}:…` keys; reveal; focus/none stable keys; pulse key = `pulse.id`). Add `readonly motion?: MotionKind` to `DisplayModel` in `src/lib/fretboard/types.ts` (T008)

**Checkpoint**: `pnpm vitest run tests/unit/prefs tests/unit/a11y tests/unit/reserved-colors.test.ts tests/unit/headers.test.ts tests/unit/fretboard/transition.test.ts` is green. Foundation ready.

---

## Phase 3: User Story 1 — App matches my device and my choice (P1) 🎯 MVP

**Goal**: light/dark follows the device live, can be pinned (Follow device / Light / Dark), persists, no flash, never in share links, erased with preferences.

**Independent Test**: device dark + nothing stored → dark; pin Light → reload → light, no dark flash; choose Follow device → device applies again.

### Tests first

- [X] T021 [P] [US1] Create `tests/unit/state/theme.test.ts` (jsdom): `choose('dark')` sets `html[data-theme=dark]` and remembers `{ theme: 'dark' }`; `choose('device')` removes the attribute and remembers `{ theme: null }`; with storage unavailable the attribute is still set; `preferences.erase()` → `choice === 'device'` and no attribute; `opening.start(url)` leaves `choice` untouched; `start('light')` sets choice and attribute; export `resetThemeForTests`
- [X] T022 [P] [US1] Create `tests/unit/theme-selector.test.ts` (jsdom): group named from `m.theme_label()` containing three radios named from the catalog, exactly one checked and equal to `theme.choice`; arrow keys move and select; selecting calls `theme.choose`; labels have a ≥ 44 px target; renders correctly in en, pt-BR and es
- [X] T023 [P] [US1] Extend `tests/unit/language-panel.test.ts` (jsdom): the panel renders `ThemeSelector` after the notation selector; extend `tests/unit/home-screen.test.ts`: `ThemeSelector` sits in `header.top` beside `LanguageSelector` and is reachable with one activation
- [X] T024 [P] [US1] Create `e2e/theme.spec.ts` (first part): "follows device" (`emulateMedia({ colorScheme })`, live flip without reload, light when no setting); "pinned dark on light device: first frame dark" and the reverse (init script samples body background in the first `requestAnimationFrame`); "Follow device clears pin"; "share link keeps pin" (open `/triads?…`, pin kept, URL has no theme parameter); "storage blocked" via the existing fault-injection seam (ADR 0004); keyboard flow through the disclosure in en, pt-BR, es; theme switch during playback keeps sound and does not touch `data-motion`
- [X] T025 [P] [US1] Extend `e2e/preferences.spec.ts`: Erase my preferences returns the current tab to Follow device at once; records written without `theme` open as Follow device; a corrupted `theme` value follows the device and keeps other fields. Extend `e2e/nojs.spec.ts`: with JS off the device setting applies via CSS and there is no flash

### Implementation

- [X] T026 [US1] Create `src/lib/state/theme.svelte.ts` per contracts/pure-api.md §6: `ThemeChoice`, `theme.choice` (`$state`), `start(stored)`, `choose(c)` (set/remove `document.documentElement.dataset.theme` synchronously, then `preferences.remember({ theme })` fire-and-forget), `restore(null)`, `resetThemeForTests` (T021)
- [X] T027 [US1] Wire the store in `src/lib/state/preferences.svelte.ts`: call `theme.start(prefs.theme)` in `start()` and `theme.restore(null)` on erase. Confirm `src/lib/link/*` and the three view types never read `theme` (T026)
- [X] T028 [P] [US1] Create `src/lib/shell/ThemeSelector.svelte`: native radio `<fieldset class="theme" data-print="omit">` with a `<legend>`, three radios (device, light, dark) per contracts/ui.md §1, unique `name="theme-{uid}"`, ≥ 44 px labels, wraps at 320 px and 200% text, all text from the catalog, no colour transition (T022)
- [X] T029 [US1] Render `ThemeSelector` inside `src/lib/shell/LanguagePanel.svelte` after the notation selector; ensure the disclosure button and region use the renamed catalog values (T003, T028)
- [X] T030 [P] [US1] Render `ThemeSelector` beside `LanguageSelector` in `header.top` of `src/lib/shell/HomeScreen.svelte` (T028)

**Checkpoint**: `pnpm vitest run tests/unit/state/theme.test.ts tests/unit/theme-selector.test.ts tests/unit/language-panel.test.ts tests/unit/home-screen.test.ts tests/unit/prefs`, then `pnpm build:test && pnpm test:e2e:fast e2e/theme.spec.ts e2e/preferences.spec.ts e2e/nojs.spec.ts`. US1 is shippable alone.

---

## Phase 4: User Story 2 — Markers read the same in both themes (P1)

**Goal**: the fretboard uses only the shared `--fb-*` palette; surfaces are neutral; role colours are reserved; notices calm.

**Independent Test**: in each theme open Notes, Triads (with comparison) and CAGED (with layers); on-board computed colours are equal across themes; contrast, CVD and reserved-colour checks pass; axe reports zero violations.

### Tests first

- [X] T031 [P] [US2] Extend `e2e/theme.spec.ts` (second part): "on-board computed colours equal in light and dark" for Notes, Triads with comparison and CAGED with layers (compare computed `fill`, `stroke`, `opacity` and `color` of every element in the board SVG between `colorScheme: light` and `dark`); board outer boundary ≥ 3:1 against the surrounding surface in both themes
- [X] T032 [P] [US2] Extend `e2e/a11y-audit.spec.ts` with axe runs in light and dark on every tool and About, expecting zero violations; update `e2e/a11y-colour.spec.ts` expectations to the new `--fb-color-*` token names
- [X] T033 [P] [US2] Extend `tests/unit/notice.test.ts` (create if absent): a notice (fallback, limit reached) is dismissible, at most two lines, non-blocking and does not use error red

### Implementation

- [X] T034 [US2] Convert every colour reference inside `src/lib/fretboard/Fretboard.svelte` styles from removed `--color-*`/`--octave-tone-*`/`--region-band`/`--connection-ring` names to the `--fb-*` names of data-model.md §5; role tokens only in `.marker.root|third|fifth .glyph`; keep `--color-focus-ring-*` for the focus ring; add `stroke: var(--fb-color-edge)` and `stroke-width: var(--fb-edge-width)` on `.wood` (no literal width); dimmed markers use `--emph-dim-opacity` and `--emph-dim-scale` (T018, T011, T012)
- [X] T035 [P] [US2] Convert `src/lib/fretboard/MarkerSample.svelte` glyph fills to `--fb-color-root|third|fifth` and its other colours to `--fb-*`; update `src/lib/fretboard/LegendPanel.svelte` and `src/lib/fretboard/ViewAids.svelte` colour references the same way (T018)
- [X] T036 [P] [US2] Grep `src/` for every removed token name from data-model.md §5 (`--color-root`, `--color-third`, `--color-fifth`, `--color-fretboard-*`, `--color-neutral-note*`, `--color-marker-label`, `--octave-tone-*`, …) and migrate any remaining use (e.g. `src/lib/shell/`, `src/lib/tools/`, `src/lib/styles/global.css`); confirm T011 and T012 pass
- [X] T037 [US2] Regenerate the light-theme screenshot baselines intentionally changed by the dark board and dim opacity (TM-9 fixtures in `e2e/caged-tm9.spec.ts`, `e2e/notes-tm9.spec.ts`, `e2e/triads-tm9.spec.ts`, plus `e2e/fretboard.spec.ts`, `e2e/triads-compare.spec.ts`, `e2e/playback.spec.ts`, `e2e/notation.spec.ts`, `e2e/responsive-layout.spec.ts`), one test name at a time with the three-project `--update-snapshots` command. Add dark-theme shots for one view per tool. Delete none; review the diffs by eye (T034, T035)

**Checkpoint**: `pnpm vitest run tests/unit/a11y tests/unit/reserved-colors.test.ts tests/unit/notice.test.ts`, then `pnpm build:test && pnpm test:e2e:fast e2e/theme.spec.ts e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts` plus the regenerated TM-9 specs.

---

## Phase 5: User Story 3 — Higher-contrast variant (P2)

**Goal**: `prefers-contrast: more` layers a stronger variant over the active theme, with a warm dark board in both; forced-colors still wins.

**Independent Test**: emulate `prefers-contrast: more` in each theme; thresholds hold; shapes and labels unchanged.

### Tests first

- [X] T038 [P] [US3] Extend `e2e/theme.spec.ts` (third part): with `emulateMedia({ contrast: 'more' })` in light and dark the variant applies live (toggle without reload), the pinned theme is unchanged, the board stays a dark warm tone identical in both themes, stroke widths are not thinner than standard
- [X] T039 [P] [US3] Extend `e2e/a11y-audit.spec.ts` with axe under `contrast: 'more'` on every tool and About (zero violations); extend `e2e/a11y-colour.spec.ts` with `emulateMedia({ forcedColors: 'active' })`: marker shapes and labels remain visible and system colours are used (US3-6)

### Implementation

- [X] T040 [US3] Make surface tokens deepen under `@media (prefers-contrast: more)` in `src/lib/styles/tokens.css` so all non-board text reaches ≥ 7:1 in light and dark (add the cases to `tests/unit/a11y/palette-contrast.test.ts` first); confirm strokes/line widths tokens are ≥ standard (T019)
- [X] T041 [US3] Verify `src/lib/styles/tokens.css` and `src/lib/styles/global.css` forced-colors rules cover board, lines, outlines, rings and marker strokes with system colours after the `Canvas` move; fix gaps (T019, T039)

**Checkpoint**: `pnpm vitest run tests/unit/a11y`, then `pnpm test:e2e:fast e2e/theme.spec.ts e2e/a11y-audit.spec.ts e2e/a11y-colour.spec.ts`.

---

## Phase 6: User Story 4 — Motion that explains change (P2)

**Goal**: only the six design §3.5 situations animate, each within its limit, instant under reduced motion; state is final before animation.

**Independent Test**: make each change type with `page.clock`; check start/end/duration; repeat with reduced motion; playback emphasis stays as a plain state change.

### Tests first

- [X] T042 [P] [US4] Extend `tests/unit/triads/` (new file `tests/unit/triads/motion-kind.test.ts`): `motionKind(prev, next, ctx)` rows of data-model.md §7 for Triads: root → `slide`; quality only → `by-role`; comparison on/off → `by-role`; inversion or string set → `cross-fade`; `prev === null` → `'none'`; root+quality changed together from a link → `'none'`; `instrumentChanged` → `'none'`; `presentationChanged` → `'none'`; earliest row wins
- [X] T043 [P] [US4] Create `tests/unit/caged/motion-kind.test.ts`: key → `slide`; focus set/changed/cleared → `focus`; layer on/off → `reveal`; anything else, `prev === null`, instrument or presentation change → `'none'`. Pin the reveal order in `tests/unit/caged/` (new case on `appear` in `src/lib/state/caged-model.ts`): ascending pitch, ties from the lowest-pitched string, evenly spread start times
- [X] T044 [P] [US4] Create `tests/unit/notes/motion-kind.test.ts`: selected note → `slide`; anything else, `prev === null`, instrument or presentation change → `'none'`
- [X] T045 [P] [US4] Extend `tests/unit/fretboard/fretboard.test.ts` (jsdom): `svg[data-motion]` equals `model.motion ?? 'none'`; markers render keyed from `reconcileMarkers`; `none` gives `transition: none`; theme change does not alter `data-motion`
- [X] T046 [P] [US4] Create `e2e/motion.spec.ts` with `page.clock`: Triads root, CAGED key and Notes note slide along their own row only (y constant) within 300 ms, unpaired fade; quality change moves only the changed role, others identical transform and no opacity change; comparison on slides from base position with outline and arrow fading in and base markers still, off fades out; inversion and string-set cross-fade has both old and new opacity strictly in (0,1) at ≈150 ms and is done ≤ 300 ms; layer on reveals in ascending pitch order, last note opacity 1 ≤ 300 ms, layer off fades together; "state first" (description text, focus and `location.href` final at t=0); "interrupt mid-transition" (second change at ≈150 ms starts from the drawn transform, settles on latest); "instant changes" (tool switch, link open, instrument, tuning, string/fret count, handedness, orientation, language, notation, label type, fit mode, theme → `data-motion="none"`); same checks with `reducedMotion: 'reduce'` toggled live (everything 0 ms, CAGED region still brought into view)
- [X] T047 [P] [US4] Extend `e2e/caged-focus.spec.ts`: focus dims others and scrolls to the region within ≤ 500 ms (`--duration-medium`); no scroll when the region is already fully in view (`scrollLeft` unchanged); clearing focus restores emphasis without scrolling; reduced motion jumps instantly yet still reveals the region
- [X] T048 [P] [US4] Extend `e2e/playback.spec.ts`: one pulse for the note duration; under `reducedMotion: 'reduce'` no `marker-pulse` animation, marker has the highlighted state while sounding and returns afterwards, also when sound is muted

### Implementation

- [X] T049 [P] [US4] Add `motionKind(prev, next, ctx)` and `MotionContext = { instrumentChanged: boolean; presentationChanged: boolean }` to `src/lib/state/triads-view.ts` per data-model.md §7 (T042)
- [X] T050 [P] [US4] Add `motionKind` to `src/lib/state/caged-view.ts` (T043)
- [X] T051 [P] [US4] Add `motionKind` to `src/lib/state/notes-view.ts` (T044)
- [X] T052 [US4] In `src/lib/state/triads.svelte.ts`, `src/lib/state/caged.svelte.ts`, `src/lib/state/notes.svelte.ts` keep the previous view, compute `motionKind` (context from instrument and presentation changes) and attach it as `DisplayModel.motion`; make sure description, focus and share link are derived from the new state in the same update (T049–T051, T020)
- [X] T053 [US4] In `src/lib/fretboard/Fretboard.svelte` build the drawn list through `reconcileMarkers(prevKeyed, next, model.motion ?? 'none', generation)`; render keyed `{#each}` by `key`; set `data-motion` on the svg; use `--duration-short` for slide/by-role/cross-fade/reveal/layer-off and the token via `tokenDuration` from `src/lib/fretboard/motion.ts` (no literal durations); only `transform` and `opacity` transition; `none` → `transition: none` (T020, T045)
- [X] T054 [US4] In `Fretboard.svelte` implement per-kind drawing: unpaired enter/exit fades; cross-fade runs old fade-out and new fade-in concurrently; comparison enter writes the `from` transform first then sets the target on the next frame (same technique as the existing `mounted` CSSOM switch), outlines/arrows fade in; reveal uses `appear` to stagger so the last note completes ≤ `--duration-short`; layer-off fades all notes together (T053)
- [X] T055 [US4] In `Fretboard.svelte` move CAGED focus dim and the animated scroll to `--duration-medium` using the existing `scroll-animation.ts` clock seam; skip scroll when the region is fully in view; under reduced motion dim instantly and jump-scroll once (T053)
- [X] T056 [US4] Make interruption seamless: a new model update while a transition runs starts from the currently computed transform (read the computed style before re-keying) and always ends in the latest state (T053)
- [X] T057 [US4] Ensure the playback pulse in `Fretboard.svelte` / `src/lib/fretboard/pulse.ts` uses `pulse.id` keys, pulses once for the note duration, and under reduced motion shows only the `highlighted` state (no animation), also when muted (T048)

**Checkpoint**: `pnpm vitest run tests/unit/fretboard tests/unit/triads tests/unit/caged tests/unit/notes`, then `pnpm build:test && pnpm test:e2e:fast e2e/motion.spec.ts e2e/caged-focus.spec.ts e2e/playback.spec.ts`; then `pnpm test:e2e:fast e2e/perf.spec.ts` confirms control → DOM ≤ 100 ms.

---

## Phase 7: User Story 5 — Print a view for the classroom (P3)

**Goal**: print / save-as-PDF gives a white page, light board, every marker shape and label, tuning, description and legend, no chrome, whole neck on one page at ≥ 7 pt.

**Independent Test**: dark theme, CAGED view, `emulateMedia({ media: 'print' })` and `page.pdf({ printBackground: false })`.

### Tests first

- [X] T058 [P] [US5] Create `tests/unit/state/print.test.ts` (jsdom, stub `matchMedia`): `change` to matches → `active === true`; `afterprint` → `false`; `beforeprint` → `true`; `start()` twice registers once; without `window` it is a no-op
- [X] T059 [P] [US5] Extend `tests/unit/fretboard/fretboard.test.ts`: while `print.active` the board lays out with `fit = 'whole'` at `--print-board-inline` width, renders no minimap, renders the description visibly (`data-print="show"`, not `.sr-only`) and the legend even when collapsed
- [X] T060 [P] [US5] Create `e2e/print.spec.ts`: in dark theme with `emulateMedia({ media: 'print' })` page and board are light and every marker shape and label is kept (CAGED, Triads with comparison incl. dashed outlines, arrows, rings); heading, fret and string numbering, tuning, context description and legend present; navigation, app-bar buttons, language and appearance disclosure, zone-B controls, notices, minimap, panels and landscape panel hidden; same printed DOM across fit modes, scroll positions, phone/landscape/wide, contrast more and either theme; 7 strings × 24 frets fits one page width without crop and labels/numbering ≥ 7 pt at printable widths 718, 739 (portrait), 1047, 979 px (landscape) using `font-size × svg.clientWidth / viewBox.width` in pt; `page.pdf({ printBackground: false })` still renders board and markers; no `@page { size }` rule; Home and About print light without navigation; a view with no visible markers still prints board, numbering, context and tuning

### Implementation

- [X] T061 [US5] Create `src/lib/state/print.svelte.ts`: `print.active` (`$state`) true while `matchMedia('print').matches` or between `beforeprint`/`afterprint`; `print.start()` registers listeners once and is a no-op without `window`; flush synchronously (`flushSync`) on `beforeprint` so the print layout is in the DOM before the snapshot. Call `print.start()` on mount in `src/routes/+layout.svelte` (T058)
- [X] T062 [US5] Add the `@media print` rules to `src/lib/styles/global.css`: white page, `color-scheme: light`, `[data-print='omit'] { display: none }`, `[data-print='show']` visible (override `.sr-only` clipping), board svg `inline-size: 100%`, `max-block-size: var(--print-board-max-block)`, `break-inside: avoid`, scroller overflow visible, no `@page { size }`; print palette comes from `tokens.css` (T019)
- [X] T063 [US5] In `src/lib/fretboard/Fretboard.svelte` add the print layout branch: when `print.active` use `fit = 'whole'` and `containerWidth = px(--print-board-inline)` regardless of screen fit, scroll and arrangement; enforce the ≥ `--print-text-min` floor for labels and numbering in viewBox units; board and markers stay SVG fills so they print without background graphics (T061, T059)
- [X] T064 [P] [US5] Add `data-print="omit"` to `src/lib/shell/ToolLayout.svelte` (zone-B controls, landscape sliding panel), `AppNav.svelte`, `ShareButton.svelte`, `InstrumentButton.svelte`, `SoundControl.svelte`, `StopButton.svelte`, `NotationToggle.svelte`, `Notice.svelte`, `PrefsNotice.svelte`, `InstrumentPanel.svelte`, `LanguagePanel.svelte`, `LanguageButton.svelte` in `src/lib/shell/`, and `src/lib/fretboard/Minimap.svelte`; omit panel chrome in `src/lib/tools/SidePanels.svelte`. Leave `TuningBadge.svelte` printed
- [X] T065 [P] [US5] Mark the context description `data-print="show"` in `src/lib/tools/ContextZone.svelte` (and `src/lib/fretboard/ViewAids.svelte` where the description lives) and render the legend in `src/lib/fretboard/LegendPanel.svelte` while `print.active` even if collapsed
- [X] T066 [P] [US5] Make Home and About print as readable light pages without navigation: add `data-print` attributes in `src/lib/shell/HomeScreen.svelte` and the About route under `src/routes/` (confirm with the T060 Home/About cases)
- [X] T067 [US5] Regenerate/add print screenshots if `e2e/print.spec.ts` uses snapshots (three-project `--update-snapshots`), none deleted

**Checkpoint**: `pnpm vitest run tests/unit/state/print.test.ts tests/unit/fretboard`, then `pnpm build:test && pnpm test:e2e:fast e2e/print.spec.ts`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T068 [P] Extend `e2e/text-zoom.spec.ts` and `e2e/languages-layout.spec.ts`: theme selector rows readable at 200% text and 320 px in en, pt-BR, es without truncation or overlap
- [X] T069 [P] Update `docs/adr/0024-theme-pin-boot-script-and-shared-board-palette.md` (status Accepted; boot script, `light-dark()`, shared board palette, dim opacity change; R-01 risk outcome) and create `docs/adr/0025-change-kind-motion-and-print-layout.md` (per-tool `motionKind`, `reconcileMarkers`, print layout branch)
- [X] T070 Re-measure the bundle with `pnpm build:test && node scripts/check-bundle-size.mjs build`; if above 136 KB gzip, trim inside this slice (dead code, shared helpers). Do NOT raise the cap (FR-033). If still over, stop and record the gap in `plan.md` Complexity Tracking for a separate decision
- [X] T071 [P] Run the manual smoke steps of `specs/026-themes-motion-and-print/quickstart.md` §2 (`pnpm dev`) and note any deviation
- [X] T072 Run the full targeted verification of quickstart.md §3 (unit list and e2e list) and fix failures
- [X] T073 Check `git status`: modified PNGs only under existing `*-snapshots/` folders plus new dark/contrast/print shots; no snapshot removed; `src/lib/link/*` and theory code untouched
- [X] T074 Run `pnpm verify` once (check, lint, format, Vitest with coverage, build, bundle check, desktop e2e); do not run `pnpm test:e2e` or `pnpm lhci` locally
  - 2026-10-07: first run blocked at the bundle step (136.9 KB > 136 KB after trimming). Owner raised the cap to 150 KB (constitution 1.11.0). Second run: check, lint, format, 4532 unit tests, build and bundle (136.9 KB ≤ 150 KB) pass; desktop e2e 1297 passed, 15 failed. 12 were `perf.spec.ts` timing budgets under machine load and pass when re-run alone (`PW_WORKERS=1`). 3 were test races fixed in the specs: `caged-tunings` E11 now waits for the key-change slide's fade-outs, `caged-triad` T052 waits for `ts=` in the synced address, `home` safe areas checks the bottom inset at the end of the page (the theme choice made the header taller, FR-003). The three specs pass (81/81).

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (1) → Foundational (2) → user stories (3–7) → Polish (8)
- Within Phase 2: tests T005–T012 first; T013 → T014; T017 → T018 → T019 (same file, sequential); T015, T016, T020 independent of the token chain

### User story dependencies

- **US1**: needs Foundational (T013–T017). No dependency on other stories
- **US2**: needs T018–T019 (palette). Independent of US1; test T031 benefits from the US1 selector but can pin through `localStorage`/`emulateMedia`
- **US3**: needs T019 and US2's `Fretboard.svelte` conversion (T034, T035)
- **US4**: needs T020 and US2's T034 (same file `Fretboard.svelte`: do T034 before T053)
- **US5**: needs T019 (print set) and T034; T063 touches `Fretboard.svelte` after T053–T057 to avoid conflicts

### Within a story

- Tests first and failing, then implementation; stores/modules before components; same-file tasks sequential

### Same-file conflicts to respect

- `src/lib/styles/tokens.css`: T017 → T018 → T019 → T040 → T041
- `src/lib/fretboard/Fretboard.svelte`: T034 → T053 → T054 → T055 → T056 → T057 → T063
- `e2e/theme.spec.ts`: T024 → T031 → T038
- `e2e/a11y-audit.spec.ts`: T032 → T039
- `tests/unit/fretboard/fretboard.test.ts`: T045 → T059

---

## Parallel Examples

```text
# Phase 2 tests (all different files):
T005 schema.test.ts   T006 theme-boot.test.ts   T007 headers.test.ts   T008 transition.test.ts
T009 palette-contrast.test.ts   T010 palette-cvd.test.ts   T011 theme-tokens.test.ts   T012 reserved-colors.test.ts

# US1 after T026:
T028 ThemeSelector.svelte   T030 HomeScreen.svelte   (then T029 LanguagePanel.svelte)

# US4 classifiers:
T049 triads-view.ts   T050 caged-view.ts   T051 notes-view.ts

# US5 print markup:
T064 data-print="omit" across shell   T065 data-print="show" description and legend   T066 Home/About
```

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup, then Phase 2 Foundational (checkpoint green)
2. Phase 3 US1 (themes, pin, no flash) → validate → demoable
3. Phase 4 US2 (shared board) → ship together with US1, since the dark app needs the shared board to look right

### Incremental delivery

US1 + US2 (P1) → US3 (contrast, P2) → US4 (motion, P2) → US5 (print, P3) → Polish. Each story ends at a checkpoint with targeted tests; run `pnpm verify` only once at T074.

### Notes

- `[P]` means different files and no dependency on an incomplete task
- Commit after each task or logical group; never delete snapshots
- Keep every colour, duration and print size a token (no literals); only `transform` and `opacity` animate
