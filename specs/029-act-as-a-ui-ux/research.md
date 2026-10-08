# Research: Modern Minimalist UI Refinement (029)

Phase 0 for `plan.md`. Each section records one decision. The format is Decision, Rationale,
and Alternatives considered. The facts come from reading the current `src/` on 2026-10-07.

## Baseline audit (what exists today)

- **Tokens**: `src/lib/styles/tokens.css` defines the colour, spacing (`--space-1..6`), type,
  `--radius-md`, motion and fretboard tokens. It has no radius scale, no medium weight, no
  subtle-border or hover tone and no shadow token.
- **Undefined tokens referenced from components**: `--radius-sm` (Minimap, with a `4px`
  fallback), `--touch-target-min` (TriadsSecondary, `44px` fallback). Literal fallbacks are on
  defined tokens too: `--landscape-bar-height` (SidePanels, `3.5rem`), and `--font-size-sm`,
  `--font-size-lg`, `--space-4`, `--border-width`, `--radius-md` and `--focus-ring-offset`
  (CompositionPanel, CagedListen, NotesActions, TriadsCompare).
- **Literals in component `<style>` blocks**: about 80 hits. They include:
  - `font-weight: 600` in 20+ places, plus `700`, `800` and `400`;
  - the CAGED switch track and thumb (`2.25rem`, `1.25rem`, `999px`, `2px`, `4px`);
  - `44px` in ViewAids;
  - `1px` visually-hidden rules copied into DetectedTriad, StringFilter, CagedLayerList,
    ViewAids and ShareFallback;
  - `flex: 1 1 12rem` in ContextZone, LegendPanel and ShareFallback;
  - `1px` borders and outline offsets in NotationToggle and Minimap;
  - Fretboard `stroke-width: 1px|2px|3px` and `calc(var(--ring-base) * 1px …)` in Fretboard
    and MarkerSample.
- **Duplicated control styles**: the segmented-option rule (`min-block-size: --target-min`,
  `padding: --space-1 --space-3`, `font-weight: 600`, `border: --border-width solid
  --color-text`, accent fill when selected) is copied into ChoiceGroup, FitToggle,
  NoteSelector, RegionFilter, StringFilter, NotesActions, TriadsCompare and NotationToggle.
  The copies differ slightly:
  - border colour is `--color-text` in some copies and `--color-border` in others;
  - border width is `1px` or `--border-width`;
  - the selected state carries bold weight in some copies but not in others.

  Action buttons (CAGED `.actions button`, `.step`, PositionCard, InstrumentPanel,
  ErasePreferences, ShareButton, StopButton) set padding and border in different ways. Some of
  them rely on the browser's default button styling.
- **Zone frames**: zone B, C, D and E sections each draw a raised surface, a full
  `--color-border` (mid-grey) border and `--radius-md`, so a tool screen shows four nested
  boxes plus the boxed controls inside them.

## R-01 Where the shared control families live

**Decision**: New file `src/lib/styles/controls.css`, imported from `src/routes/+layout.svelte`
right after `global.css`. It defines five global class families: `.btn`, `.option`, `.switch`,
`.stepper` and `.link-button` (see `contracts/ui.md` §1). Components apply the class in markup
and keep only layout rules (grid-area, gap, margin, flex) in their own `<style>`.

**Rationale**: the spec requires one definition in the global stylesheet (FR-003). Every family
already has two or more real uses (Constitution X). A separate file keeps `global.css` focused
on resets, the zone-B row and landscape and print rules. A Svelte component's scoped selector
(`button.svelte-xyz`) has higher specificity than a global class, so any per-component copy
would silently win. That is why redeclaring a family property is forbidden and lint-checked
(R-03).

**Alternatives considered**:
- A shared Svelte `<Button>` component. Rejected because the families sit on very different
  markup (`role="radio"` in ChoiceGroup, `aria-pressed` toggles, links, `role="switch"`).
  Wrapping them would change DOM and ARIA, which existing unit and e2e tests assert. A class
  changes styling only.
- Adding the rules to `global.css`. Rejected only because it is less readable. It would also
  work.
- `:global()` blocks inside one component. Rejected because the rules would be hidden in an
  arbitrary component and loaded with it.

## R-02 State model for every family

**Decision**: state selectors are attribute-driven and shared:
- **selected/pressed**: `[aria-pressed='true'], [aria-checked='true'], [aria-selected='true'],
  [aria-current]`. These get `--color-accent` background, `--color-accent-text` and
  `--font-weight-bold`.
- **default weight**: `--font-weight-medium`.
- **hover**: `@media (hover: hover)`, background `--color-surface-raised`, or
  `--color-surface-hover` when the resting surface is already raised.
- **disabled**: `:disabled, [aria-disabled='true']` use `--color-disabled-text` and
  `--color-disabled-border` with `cursor: not-allowed`. They stay focusable where the
  component uses `aria-disabled`, as today.
- **focus**: the global two-tone ring is unchanged.
- **transitions**: `background-color`, `color` and `border-color` only, over `--duration-fast`
  with `--ease-standard`. Under reduced motion the token is already `0s`.

**Rationale**: FR-005 requires the selected state to combine fill, weight and ARIA. Today
selected and unselected options are both `600`, so only colour separates them. Medium
(600) → bold (700) makes the difference non-colour and testable. Hover only on hover-capable
pointers avoids sticky hover on touch.

**Alternatives**: a check-mark glyph for the selected state. Rejected because it adds width,
which breaks zone-B one-row strips at 320 px, and it is a new decorative element. An outline
weight change. Rejected because it collides with the focus ring and the contrast-more border
width.

## R-03 Token-literal lint (FR-004, SC-002)

**Decision**: new unit test `tests/unit/style-tokens.test.ts` (node environment). It extracts
every `<style>` block from `src/**/*.svelte`, strips comments and splits declarations. It fails
with file, line and offending text on:
1. colour literals: hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`, named colours other than
   `transparent`, `currentColor`, `inherit`, `Canvas`, `CanvasText` and `GrayText`;
2. dimension literals with `px|rem|em|ms|s` other than `0`, including inside a `var()`
   fallback;
3. `var(--name)` where `--name` is not declared in `tokens.css` (parsed with the existing
   `tests/unit/a11y/tokens.ts` `parseTokenSheet`, extended to collect every declared name),
   and not a component-local property set in the same block (for example `--ring-base` set
   from markup);
4. `font-weight` whose value is not a `var(--font-weight-*)` token;
5. family-owned properties (`min-block-size`, `min-inline-size`, `padding*`, `border*`,
   `border-radius`, `font-size`, `font-weight`, `background*`, `color`) declared in a rule
   whose selector names `.btn`, `.option`, `.switch`, `.stepper`, `.link-button` or a bare
   `button` element. Layout properties stay allowed.

Percentages, unitless numbers, keywords and `calc()` built only from tokens pass. Rule 4 goes
beyond the clarified list. It makes the "type from tokens" part of FR-004 checkable, and all
current values map one-to-one to tokens (400, 600, 700; the single `800` becomes bold).
Rule 5 makes "MUST NOT redeclare" (FR-003) checkable.

**Rationale**: the test is a cheap static guard with no dependency. It follows the
established pattern of `reserved-colors.test.ts` and `no-raw-text.test.ts`.

**Alternatives**: Stylelint with `declaration-property-value-disallowed-list`. Rejected
because it adds a dev dependency and config for the job of one regex test, and it does not
resolve tokens against `tokens.css`. An ESLint plugin for Svelte styles. Rejected for the same
reason.

## R-04 Keeping the fretboard pixel-identical

**Decision**: every Fretboard, MarkerSample and Minimap literal becomes a token with the same
computed value:
- `--fb-stroke-hairline: 1px`;
- `--fb-label-halo-width: 3px` and `--fb-glyph-halo-width: 2px`, for the two `stroke-width`
  halos;
- `--font-weight-normal` and `--font-weight-bold`;
- `--unit-px: 1px`, the unit multiplier for SVG-number-to-length `calc()`;
- `--radius-sm: 0.25rem`, which equals the current `4px` fallback;
- the Minimap frame `1px` becomes `--border-width`.

Zone C keeps its padding, border width and gutters exactly, so the board's fit-mode width is
unchanged. Only zone C's border colour may change. The frozen snapshots `all-markers-grayscale`
(grid element) and `accidental-glyphs` (marker element) are run without
`--update-snapshots` as a gate.

**Rationale**: fit mode scales the SVG to zone C's content box. A 2 px change in zone C's
border would rescale the grid and break the frozen element snapshots (SC-004).
`--border-width` becomes 2px under contrast-more. The Minimap frame already followed the
1px/2px intent elsewhere, but it is minimap chrome, not minimap content, and the frozen
snapshots do not include it.

**Alternatives**: allow-listing Fretboard.svelte in the lint. Rejected because the
clarification explicitly requires same-value tokens.

## R-05 Minimalist zone treatment

**Decision**:
- Zone B (controls) and zone E (context) lose their box: transparent background, no border,
  no padding change on the inline axis beyond `0`. They are separated from C by the grid gap
  only.
- Zone D (side and secondary information) keeps a raised surface with `--radius-lg` and
  **no** border in standard mode.
- Zone C keeps its geometry (R-04) and gets the subtle edge `--color-border-subtle`.
- Under `prefers-contrast: more` and forced colours, `--color-border-subtle` resolves to
  `var(--color-text)`, so every edge returns at full contrast.
- Headings: zone `h2` uses `--font-size-sm`, `--font-weight-medium` and
  `--color-text-muted`, so it reads as a label rather than a title. The page `h1` keeps
  `--font-size-xl`.

**Rationale**: "fewer boxes and borders" (FR-001) without moving any control. Decorative zone
frames are not UI components, so WCAG 1.4.11 non-text contrast does not apply to them.
Interactive control borders keep `--color-border` (≥ 3:1). Landscape and print rules in
`global.css` already neutralise zone frames, so they keep working.

**Alternatives**: removing every frame including D and C. Rejected because on wide screens D
then floats without grouping, and C's frame width is frozen anyway (R-04). Hairline
dividers between zones. Rejected because they are extra decoration with no grouping gain over
the gap.

## R-06 Token additions and limits

**Decision**: add to `:root` (values in `data-model.md`):
- `--radius-sm`, `--radius-lg` and `--radius-pill`;
- `--font-weight-medium`;
- `--color-border-subtle` and `--color-surface-hover`, both `light-dark()`, both overridden in
  the contrast-more block;
- `--color-shadow` (`light-dark()`, `none`-equivalent under contrast-more through a
  transparent value) and `--shadow-overlay`;
- `--switch-track-inline`, `--switch-track-block` and `--switch-thumb-inset`;
- `--item-min-inline: 12rem`;
- the R-04 fretboard-equivalent tokens.

The accent hue stays the same (`#13466a` / `#c2e0f8`) and keeps its contrast. Lightness is
changed only if the palette-contrast test demands it. No `--fb-*`, `--marker-*`, `--emph-*`,
`--minimap-*`, `--connection-*`, `--pulse-*` or `--print-*` **values** change. The new
`--fb-*` names hold values already in use.

**Rationale**: these are the smallest additions that remove every literal and support the
flatter look. `--color-backdrop` already exists for the sheet scrim. The shadow is used only
by the bottom sheet and side panel (clarification).

**Alternatives**: a full new palette (neutral greys, a new accent). Rejected because the
clarification keeps the blue accent family. It would also force contrast re-validation of
every pairing for no functional gain.

## R-07 Verifying SC-001 and SC-005 (zone geometry)

**Decision**: new e2e spec `e2e/ui-refinement.spec.ts`. For each tool (`/notes`, `/triads`,
`/caged`) at 320×568, 768×1024 and 1440×900 it does the following:
- measures the `boundingBox()` of zone A (`header`), B (`section.b`), C (`section.c`),
  D (`.d`) and E (`section.e`);
- asserts that C's area is greater than each other zone's area, taken one at a time;
- asserts that C's top is less than the viewport height;
- asserts that every focusable control in `section.b` has a box fully inside
  `[0, 0, vw, vh]` with no scroll and no panel opened.

Zones the arrangement hides (for example D folded at narrow width) are skipped when they have
no box.

**Risk found while planning**: at 320×568 the zone-B one-row strips scroll horizontally on
their own. SC-005 requires every zone B control to be inside the viewport, so a strip with
overflow would fail. The refinement therefore has to fit every default-state zone-B control
of each tool at 320 px through tighter `.option` padding (`--space-1 --space-2` at the narrow
arrangement) and the shorter zone heading. If one tool still cannot fit, the rows wrap at the
narrow arrangement (`.controls-row` `flex-wrap: wrap`). Wrapping is a styling change, not a
zone move, and the fallback is recorded in `plan.md` Complexity Tracking. The overflow-scroll
behaviour and edge fade stay available for non-default states with more controls.

**Outcome (implementation)**: tighter padding was not enough, so the rows wrap at the narrow
arrangement. Wrapped, Triads and CAGED zone B is 443–557 px tall below a 268 px header, so at
320×568 the first-screen rules cannot hold. The owner relaxed SC-001 and SC-005 at 320×568
(see spec Clarifications): zone C keeps the largest area, and zone B controls stay within the
viewport width and are reached by vertical scroll. Wrapped Triads zone B also outgrows C in
area, so at 320×568 C is compared only with A, D and E. 768×1024 and 1440×900 stay strict.

**Alternatives**: measuring only the "primary" control. Rejected because the clarification
says every zone-B control.

## R-08 Verifying FR-003 / SC-002 (computed-style equality)

**Decision**: in the same e2e spec, for each family, take the first instance in Notes, Triads
and CAGED (and in the instrument or language panel where the family exists). Read
`getComputedStyle` for `min-block-size`, `padding`, `border-radius`, `border-width`,
`font-size` and `font-weight` in default state. Then select an instance (or read an
already-selected one) and repeat. Values must be equal across tools for each state. In each
family the selected `font-weight` and background must differ from the default.

The family instance map is in `contracts/ui.md` §2. If a family is missing from a tool (for
example there is no stepper in Triads), that cell is skipped and recorded in the contract.

**Alternatives**: a jsdom unit test. Rejected because jsdom does not compute cascaded styles
from imported CSS.

## R-09 Screenshots and regression gates

**Decision**: regenerate the changed full-page and chrome baselines on purpose for `phone`,
`phone-touch` and `desktop`, filtered with `-g`. This covers the TM-9 views, `arrangement-*`,
`theme-dark-*` and `sound-control-*`. The darwin baselines are made locally, and linux
baselines are produced by CI per the repo's existing practice. `all-markers-grayscale` and
`accidental-glyphs` are run without update and must pass. The other suites must pass
unchanged: `print.spec.ts`, `text-zoom.spec.ts`, `languages-layout.spec.ts`, `theme.spec.ts`,
`a11y-audit.spec.ts`, `a11y-colour.spec.ts`, `responsive-layout.spec.ts`,
`landscape.spec.ts`, the link-compatibility fixtures and `perf.spec.ts`.

## R-10 Performance and dependencies

**Decision**: CSS only. There is no JS change apart from adding class names in markup, so the
initial JS stays at about 137 KB of 150 KB. `controls.css` adds about 3 KB uncompressed to
the CSS bundle. Removing the duplicated rules from components roughly offsets it. No font,
icon set or package is added.
