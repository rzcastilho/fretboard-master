# Research: Describe This View, Legend, and Accessibility Audit

**Feature**: 024-describe-this-view-and-legend | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

Every Technical Context unknown is resolved below. Measurements were taken on the current
`feature/024-describe-this-view-and-legend` tree (tokens from `src/lib/styles/tokens.css`).

---

## R-01 One description path, extended rather than duplicated

**Decision**: Keep `DisplayModel.description ?? describeView(instrument, model)` in the
fretboard as the single source of the description text (FR-006). Tools keep composing
`summary` / `description` in their pure display-model builders
(`src/lib/state/{notes,triads,caged}-model.ts`). This slice:

- realigns the Triads isolated single-shape `summary` to the FR-003 form
  (`triads_desc_shape` rewritten; see R-03);
- realigns CAGED note entries to include the note name (`caged_description_note`,
  `caged_description_note_open` gain `{note}`);
- makes the generic empty text name the first action (R-04);
- leaves every other composed description untouched apart from those rules.

**Rationale**: Constitution III (one-directional flow: view state → display model → render) and
VIII (one spoken form via `src/lib/notation`). The code survey shows the toggle, visible `<p>`,
and `aria-live="polite" aria-atomic="true"` region already exist in `Fretboard.svelte`
(lines ~664–1014). A second description path would let panel and fretboard drift apart.

**Alternatives considered**: A new `describe(tool, viewState)` service per tool — rejected,
duplicates the display model and breaks C-III. Generating the description inside the renderer
from markers only — rejected, loses tool summaries (key, inversion, layers).

---

## R-02 Position order

**Decision**: String-major from the highest string number (lowest pitch) to string 1; within a
string, ascending fret. Implemented as the existing comparator
`(a, b) => b.string - a.string || a.fret - b.fret`, now asserted in all three tools. The Triads
isolated entries (currently a summary without per-position entries) are produced in that order
from `positions`; CAGED `o.notes` are sorted with the same comparator before formatting.
Handedness/orientation are renderer-only (C-III), so the order cannot depend on them; a unit
test asserts identical text for right/left × both orientations.

**Rationale**: Spec Clarifications + 002 data-model §8 + 013 R-05.

**Alternatives considered**: Visual order (top-to-bottom as drawn) — rejected, varies with
orientation and handedness (FR-004).

---

## R-03 Triads single-shape wording and list conjunction

**Decision**:

- New/rewritten catalog keys (en, pt-BR, es):
  - `triads_desc_shape`: `"{chord}, {inversion}, strings {strings}: {entries}."`
  - `list_and_two`: `"{a} and {b}"` / `"{a} e {b}"` / `"{a} y {b}"`
  - `list_and_many`: `"{head}, and {last}"` / `"{head} e {last}"` / `"{head} y {last}"`
    (English Oxford comma, matching the spec example "4, 3, and 2").
  - Inversion words for descriptions in lower-case prose: `triads_desc_inversion_root`
    ("root position"), `triads_desc_inversion_first` ("first inversion"),
    `triads_desc_inversion_second` ("second inversion"). The visible control labels
    ("1st inversion") are unchanged.
- A pure helper `spokenList(items: readonly string[]): string` in
  `src/lib/fretboard/description.ts` joins with the catalog keys (1 item → item, 2 → two,
  ≥3 → `head` joined by ", " + many).
- Entries use the existing `fretboard_description_entry[_open]` keys with
  function words from `FUNCTION_NAME`, joined by "; ".
- Wide stretch appends `" " + triads_desc_wide_stretch()` after the closing period.

Expected English output for A major, first inversion, 4-3-2:
`A major, first inversion, strings 4, 3, and 2: string 4, fret 11, C sharp, third; string 3, fret 9, E, fifth; string 2, fret 10, A, root.`

**Rationale**: FR-003 exact text. Catalog-based conjunctions keep "adding a language = new
catalog files only" (C-VIII) and give deterministic output in jsdom/Node where
`Intl.ListFormat` locale data could differ.

**Alternatives considered**: `Intl.ListFormat` — rejected for determinism and because the
result must match catalog-reviewed glossaries. Reusing `triads_inversion_first` ("1st
inversion") — rejected, the spec requires "first inversion" in prose.

---

## R-04 Empty view text

**Decision**: `fretboard_description_empty` becomes "Nothing is displayed." and tools that have
an obvious first action supply it through `summary`:

- Notes, no selection and background "none": `notes_desc_empty` = "No notes selected. Pick a
  note in the note selector." (existing background summaries remain when notes are drawn).
- Triads guidance views already pass the guidance text as `summary` (triads-model line ~376);
  kept.
- CAGED never has an empty board while a key is set (shapes always exist); the existing
  "no shapes fit" text is kept.

`describeView` returns `summary` alone when it exists and no entries qualify, and
`fretboard_description_empty` only when neither exists — never an empty string (FR-007).

**Alternatives considered**: A generic "pick something" sentence — rejected, the spec requires
naming the tool's actual first action.

---

## R-05 Announcement: 500 ms trailing debounce with an injectable timer

**Decision**: New pure module `src/lib/fretboard/announce.ts`:

```ts
export interface AnnouncerTimer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
export function createAnnouncer(opts: {
  delayMs: number; // ANNOUNCE_DELAY_MS = 500
  timer: AnnouncerTimer;
  emit: (text: string) => void;
}): { update(text: string): void; dispose(): void };
```

Rules: the first `update` only records the baseline (no announcement on first render); each
later `update` with text different from the last *seen* text restarts the timer; when the timer
fires, `emit` is called iff the text differs from the last *announced* text (A → B → A within
500 ms announces nothing). `ViewAids.svelte` wires it with `globalThis.setTimeout/clearTimeout`
so Playwright's `page.clock` controls it; Vitest uses `vi.useFakeTimers()`.

To guarantee a re-announcement even when two successive announcements are equal strings
separated by other content, the live region is cleared (`''`) and set again in the next
microtask; with `aria-atomic="true"` this re-reads in NVDA, JAWS and VoiceOver.

**Rationale**: FR-008/FR-010, SC-002, C-IV deterministic timing. Precedent: `STEP_WINDOW_MS =
500` in `caged-focus.ts` and the `page.clock` pattern in `e2e/caged-focus.spec.ts`.

**Alternatives considered**: Leading-edge throttle — rejected, announces an intermediate
state. Debouncing inside each tool store — rejected, three copies and it would delay the
visible panel (the panel updates immediately; only speech is delayed).

**Impact on existing tests**: unit tests in `tests/unit/fretboard/fretboard.test.ts`
(~lines 549, 626, 1983–1999) and e2e specs that read `[aria-live="polite"]` immediately after a
change (`caged-layers`, `caged-triad`, `triads`, `languages`, `notation`, `instrument-panel`,
`open-link`, `fretboard`) must advance fake time 500 ms or assert the visible panel instead.
Listed as a task group.

---

## R-06 Describe this view control and panel placement

**Decision**: Extract the toggle, panel, live region and the new Legend into
`src/lib/fretboard/ViewAids.svelte`, rendered by `Fretboard.svelte` only for
`variant === 'interactive'` (thumbnails/previews stay without it, as today, test line ~100).
Layout: a flex row (wrap) with **Describe this view** then **Legend**, directly below the
scroller; below it the description `<p>` and the legend panel, each `hidden` when closed.
Constant label "Describe this view" (`fretboard_describe`), state only via `aria-expanded`;
`aria-controls` points at the panel. Toggle keeps focus (native button).

**Rationale**: FR-002, FR-012, design §7; `Fretboard.svelte` is already 1,427 lines, so the new
UI lives in its own component (code quality: small single-purpose modules).

**Alternatives considered**: Placing buttons in each tool's zone — rejected, three copies and
"directly below the fretboard" is a fretboard concern.

---

## R-07 Legend derivation (pure) from the display model

**Decision**: New pure module `src/lib/fretboard/legend.ts` with
`legendKinds(model: DisplayModel): readonly LegendKind[]` and
`legendGroups(model): readonly LegendGroup[]`. A kind is in use iff some marker at
`highlighted | normal | dimmed` emphasis (or a view-level field) draws it:

| Kind | Detection |
|---|---|
| `root` / `third` / `fifth` | `function` of a non-hidden marker without `layer` |
| `degree` | `function === 'degree'`, no `extra` |
| `neutral` | `function === 'neutral'` at `normal`/`dimmed` |
| `selected` | `function === 'neutral'` at `highlighted` |
| `octave` | any non-hidden marker with `tone` or `octaveBadge` (labelMode `octave`) |
| `arpeggio` | `layer === 'arpeggio'` |
| `triadLayer` | `layer === 'triad'` |
| `extra` | `extra === true` |
| `connection` | `ring === true` |
| `comparison` | `variant === 'comparison'` or any `arrows` |
| `wideStretch` | new `DisplayModel.wideStretch === true` (Triads isolated wide shape; full-neck tag with wide detail) |
| `alteredString` | `stringMarks` non-empty |

Order is the catalogue order above. Grouping: `DisplayModel` gains optional
`legendGroups?: readonly { label: string; kinds: readonly LegendKind[] }[]`, supplied only by
the CAGED model from its drawn layers (Chord → root/third/fifth; Arpeggio → arpeggio;
Pentatonic → degree (+extra when Scale is off); Scale → degree/extra; Triad → triadLayer;
Connections → connection; altered string ungrouped). Kinds not in use are dropped; empty
groups are dropped; a kind appears only in its first group. Without `legendGroups` the Legend
is one flat list.

**Rationale**: FR-013/FR-016 "iff drawn", "never inferred from control state". Pure function →
table tests per tool (C-IV). Two real uses for grouping exist? Only CAGED groups, so grouping
is data on the model (no new abstraction, C-X).

**Alternatives considered**: Deriving from control state (layers on/off) — rejected by spec.
Tool-specific Legend components — rejected, three copies and drift from the board.

---

## R-08 Legend samples and text

**Decision**: Extend `MarkerSample.svelte` props with `emphasis?: 'highlighted'` (selected
note), `tone?: OctaveTone`, `variant?: 'comparison'`, `ring?: boolean`; wide stretch and
altered string reuse their existing visible marks (`WideStretchMark` glyph text; the string
mark label) drawn as text samples. Each Legend `<li>` = `<MarkerSample aria-hidden>` +
`<span class="name">` + `<span class="meaning">` from catalog keys `legend_<kind>_name` /
`legend_<kind>_meaning` (e.g. "Root — filled rounded square: the chord's root."). The panel is
`<section aria-labelledby>` with heading "Legend" and `<ul>` (or one `<ul>` per group with an
`<h3>` group label). Empty → `<p>` "Nothing is marked on the fretboard." (`legend_empty`).
`reserved-colors.test.ts` already allows `MarkerSample.svelte` to use root/third/fifth tokens.

**Rationale**: FR-013 same geometry/tokens; samples are decorative, text is the accessible
content.

---

## R-09 Legend keyboard behaviour

**Decision**: Disclosure pattern (WAI-ARIA APG): button `aria-expanded` + `aria-controls`,
panel is a sibling region, not a dialog. `keydown` Escape on the panel (bubbling from any
descendant) closes it and calls `legendButton.focus()`. No focus trap; panel content contains
no interactive elements, so Tab moves to the next page control. Escape outside the panel does
nothing (avoids clashing with other Escape handlers such as the instrument panel).

**Alternatives considered**: `<details>/<summary>` — rejected; Escape-to-close and shared
styling with the description toggle are simpler with a button, and `summary` exposes
inconsistent roles across screen readers.

---

## R-10 Focus ring on positions: two-tone ring

**Finding (measured)**: the position focus ring uses `--color-focus-ring`, which equals
`--color-third` in light theme (`#0b5cad`). Contrast ring vs marker fill:

| Theme | wood | root | third | fifth | neutral | Notes highlight |
|---|---|---|---|---|---|---|
| light (`#0b5cad`) | 4.56 | 1.02 | **1.00** | 1.06 | 6.67 | 1.06 |
| dark (`#9cc8f7`) | 6.25 | 1.31 | 1.25 | 1.02 | 9.37 | 1.12 |

FR-021 fails against every coloured fill. No single colour reaches 3:1 against both the light
wood/white neutral fill and the mid-dark function fills.

**Decision**: Draw the position focus ring as two concentric strokes: an outer band in new
token `--color-focus-ring-outer` and an inner band in `--color-focus-ring-inner`, each
`--focus-ring-width`. Light: outer `#1a1d21`, inner `#ffffff`; dark: outer `#ffffff`, inner
`#101317`. Measured minimum of max(contrast(outer, x), contrast(inner, x)) over wood, root,
third, fifth, neutral, Notes highlight and every octave tone: **4.75 (light), 6.22 (dark)** ≥ 3.
`prefers-contrast: more` maps them to `CanvasText` / `Canvas`. The ring is drawn for hidden
positions as today (`inside` + `stop`). Token-level unit test computes these contrasts from
`tokens.css`; an e2e test asserts two ring rects exist on focus in both themes.

Separately, the generic `--color-focus-ring` / `--color-accent` equal the light `--color-third`
value (and dark `--color-accent` equals dark `--color-third`, `#7ab4f0`); that is a
pre-existing reuse of a reserved colour (C-VII). It is **fixed in this slice**:
`--color-focus-ring` takes the outer ring colour (light `#1a1d21`, dark `#ffffff`), and
`--color-accent` moves within the existing accent hue family (the octave-tone ramp) to a value
that is not equal to, and ΔE00 ≥ 10 from, root/third/fifth in the same theme (candidates light
`#13466a`, dark `#a8d2f0`; final values fixed by the test), keeping `--color-accent-text`
contrast ≥ 4.5:1. `reserved-colors.test.ts` gains a value check: no token other than
`--color-root|third|fifth` may equal a reserved value in light, dark or more-contrast blocks.
The audit record lists it as "fixed". A new accent hue is out of scope.

**Alternatives considered**: Thicker single ring — still 1:1 on third. Offset ring outside the
cell — cells abut each other, so neighbouring markers sit beneath it.

---

## R-11 Colour-blindness check

**Decision**: Unit test `tests/unit/a11y/palette-cvd.test.ts` with helper
`tests/unit/a11y/color.ts` (sRGB ↔ linear, Machado 2009 severity-1.0 matrices for protanopia,
deuteranopia, tritanopia, CIELAB D65, CIEDE2000). It reads `--color-root|third|fifth` from the
light `:root` and dark `@media (prefers-color-scheme: dark)` blocks of `tokens.css` and asserts
every pair ΔE00 ≥ 10 in every simulation and theme, and marker-label contrast ≥ 4.5:1 is kept.

**Finding (measured, current tokens)**:

| Theme | Sim | root/third | root/fifth | third/fifth |
|---|---|---|---|---|
| light | protan | 45.6 | **9.4** | 44.2 |
| light | deutan | 53.3 | 11.2 | 41.8 |
| light | tritan | 62.2 | 57.4 | 10.4 |
| dark | protan | 34.9 | 12.8 | 39.3 |
| dark | deutan | 42.7 | **6.3** | 36.9 |
| dark | tritan | 66.5 | 58.0 | **8.7** |

Three pairs fail → `--color-fifth` is adjusted in both themes (tokens only). Search over
green-dominant candidates nearest the current hue with min ΔE ≥ 12 and label contrast ≥ 4.5:
light `#188450` (white label 4.71:1, min ΔE 12.1), dark `#94ecbc` (dark label 13.3:1, min ΔE
12.2). Final values are confirmed by the test during implementation and recorded in
`docs/accessibility-audit.md`; affected screenshot baselines are regenerated (phone,
phone-touch, desktop, only snapshot tests that show a fifth).

Screenshot simulation: `e2e/a11y-colour.spec.ts` injects an SVG `feColorMatrix` filter with the
same matrices on `<html>` for the three tools in both themes, asserts (DOM) that root, third
and fifth glyph elements are `rect`, `circle`, `polygon` and carry labels, and saves
attachments (not baselines) for the manual review entry in the audit record.

**Alternatives considered**: Viénot/Brettel simulation — Machado is mandated by the spec.
Pixel diff on simulated screenshots — brittle and not what the pass criterion measures.

---

## R-12 Automated axe matrix

**Decision**: New `e2e/a11y-audit.spec.ts`, runs on the `desktop` project only
(`test.skip(testInfo.project.name !== 'desktop')`). Parameterised loops: 7 targets (`/`,
`/notes`, `/triads`, `/caged`, `/about`, `/does-not-exist`, a received share link from the
`open-link` fixtures) × 2 colour schemes (`page.emulateMedia({ colorScheme })`) × 3 languages
(prefs record seeded with `addInitScript`, as `e2e/languages.spec.ts` does). Per page load:
`runAxe` in default state, then with description open, Legend open (tools only), and
instrument panel open — 42 loads, 4 scans each on tool routes. Uses existing
`runAxe` (`wcag2a/aa, wcag21a/aa, wcag22aa`).

**Rationale**: SC-004 exactly; desktop-only keeps CI time bounded (phone already runs axe in
existing specs).

---

## R-13 Manual audit and record

**Decision**: `docs/accessibility-audit.md` with one row per WCAG 2.2 A and AA success
criterion (4.1.1 Parsing listed as obsolete in 2.2), columns: SC, screens checked,
method (axe / e2e spec / manual), result (pass / fixed / deferred), fix reference (commit or
spec), deferral reason + follow-up slice. Manual checks use the checklist in
[quickstart.md](./quickstart.md) §4. Keyboard-only flows (US4) are automated in
`e2e/a11y-keyboard.spec.ts`; reflow at 320 px and 200 % reuses `setTextScale` and
`expectNoTruncationOrOverlap` from `e2e/support/helpers.ts`.

---

## R-14 Everything heard is also seen

**Decision**: Inventory sound sources (`src/lib/audio`, `PlaybackHost`, `CagedListen`, Triads
listen, Notes position playback): each already draws a pulse (`pulses` prop) or step progress.
Add e2e assertions that each playback start shows the pulse/progress (audio log +
`.pulse` element) in `e2e/a11y-audit.spec.ts`; record per-source rows in the audit. No new
sound features.

---

## R-15 Bundle impact

**Baseline (T001, before any 024 code)**: initial JS gzip = **124.3 KB** of 128 KB
(`pnpm build:test` + `node scripts/check-bundle-size.mjs build`); headroom ≈ 3.7 KB.

**After US3 Legend (T043)**: initial JS gzip = **127.9 KB** of 128 KB (+3.6 KB vs baseline; within
budget, headroom ≈ 0.1 KB). Later phases (US5, US6) must add no more JS than they remove or trim.

**Final (T059, production `pnpm build`)**: initial JS gzip = **127.9 KB** of 128 KB; gate passes, no
trim or amendment needed. (`pnpm build:test` output measures 128.8 KB; the gate runs on `pnpm build`.)

**Finding**: 023 left ≈ 4 KB headroom under the 128 KB gzip cap. This slice adds the
announcer (< 0.5 KB), legend derivation + component (≈ 1.5 KB), and ≈ 35 catalog keys × 3
locales (≈ 1.5–2 KB gzip).

**Decision**: Estimate +3–4 KB; no amendment planned. `node scripts/check-bundle-size.mjs build`
is run after the Legend task; if over, first trim (short meaning strings, shared
`legend_<kind>` phrasing), and only then propose an amendment with Complexity Tracking entry.
Lazy loading is not possible under ADR 0002 (single bundle).

---

## R-16 Reduced motion, reflow, phone layout

**Decision**: Panels appear without animation (no transition at all, so reduced motion is
satisfied trivially). Both panels are in normal flow below the fretboard (never overlay, C-VII);
on phones they push content down. Text uses `overflow-wrap: anywhere`; the button row wraps.
All values from tokens (`--space-*`, `--radius-md`); the existing hard-coded `border-radius:
6px` and `var(--space-2, 0.5rem)` fallbacks in `.description-toggle` are replaced with tokens.
