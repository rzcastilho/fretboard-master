# Implementation Plan: Modern Minimalist UI Refinement

**Branch**: `feature/029-act-as-a-ui-ux` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/029-act-as-a-ui-ux/spec.md`

## Summary

This slice refines only the chrome around the fretboard. The look becomes flatter and calmer,
and equivalent controls look identical in every tool. No control moves, the zones keep their
places, and the fretboard drawing does not change.

The technical approach (see [research.md](./research.md)):

1. **Tokens** (`tokens.css`): add a radius scale, a medium weight, a subtle border tone, a
   hover tone, one overlay shadow, switch dimensions, and same-value tokens for every
   remaining literal (including Fretboard strokes, so the board stays pixel-identical). No
   frozen token value changes.
2. **Control families** (`src/lib/styles/controls.css`, new and imported globally): `.btn`,
   `.option`, `.switch`, `.stepper` (a readout plus `.btn`) and `.link-button`. Each has one
   definition, attribute-driven states (ARIA true ⇒ accent fill + bold), and colour-only
   transitions over `--duration-fast`. About 30 components drop their copied button CSS and
   add a class instead.
3. **Zones**:
   - B and E lose their boxes;
   - D keeps a borderless raised surface;
   - C keeps its exact geometry with a subtle edge, so the fit-mode board width is unchanged
     and the frozen snapshots hold;
   - zone headings become small muted labels;
   - home cards get equal heights and a subtle edge.
4. **Guards**:
   - a new static lint `tests/unit/style-tokens.test.ts` (colour literals, unit literals,
     undefined tokens, weight tokens, no family redeclaration);
   - a new e2e `e2e/ui-refinement.spec.ts` (zone C dominance, zone B fully in view, no page
     scroll, computed-style equality across tools);
   - an intentional regeneration of the chrome screenshot baselines.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), Svelte 5 runes, SvelteKit with
`adapter-static`, plain CSS with custom-property tokens

**Primary Dependencies**: no additions. The work uses the existing SvelteKit, Paraglide JS,
Vitest, Playwright and @axe-core/playwright.

**Storage**: N/A. No preference key or share-link field changes.

**Testing**:
- Vitest in the node environment for the style lint and token tests;
- Playwright (`pnpm test:e2e:fast` locally, full matrix in CI) for geometry, computed-style
  equality, axe, and screenshots.

**Target Platform**: the last two major versions of the evergreen browsers, desktop and
mobile, from 320 to 2560 CSS px

**Project Type**: static single-page web app (SvelteKit prerendered)

**Performance Goals**: the Constitution VI budgets are unchanged. The change is CSS and markup
classes only. Initial JS stays at about 137 KB of the 150 KB gzip cap, and the Lighthouse
mobile score stays ≥ 90.

**Constraints**:
- `--fb-*`, `--marker-*`, `--emph-*`, `--minimap-*`, `--connection-*`, `--pulse-*` and
  `--print-*` values are frozen;
- the `all-markers-grayscale` and `accidental-glyphs` baselines must pass without an update;
- zone C geometry is frozen (R-04);
- no new text, dependency, font or icon set;
- touch targets ≥ 44 px.

**Scale/Scope**:
- 5 routes and about 66 Svelte components, of which about 35 have restyled controls;
- 3 tools × 3 viewports in the geometry tests;
- 5 control families.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passing.*

- [x] **I. Musical Correctness**: N/A. The slice does not touch `src/lib/theory`,
  `src/lib/notation`, audio or shape logic. Only CSS and class attributes change, so no
  note, spelling or pitch can change.
- [x] **II. On-Device, Static, Private**: pass. There are no network calls, trackers, fonts
  or remote assets, and preferences and storage are untouched.
- [x] **III. Pure Core, Thin Shell**: pass. No logic moves. Families are presentation-only
  global CSS, and the data flow and the renderer's ownership of handedness and orientation
  are unchanged.
- [x] **IV. Test-First / Tested Behavior**: pass. The style lint (with fixture self-test) is
  written red-first against today's ~80 offenders. Every acceptance scenario maps to an
  automated test:
  - US1-AS1 → G-1;
  - US1-AS2 → family equality;
  - US1-AS3 → G-2/G-3;
  - US2-AS1/AS2 → `navigation`, `a11y-keyboard` and selected-weight checks;
  - US2-AS3 → home card equal-height check;
  - US3 → `text-zoom`, `languages-layout`, `theme`, `motion`.

  The TM-9 fixtures are regenerated, not removed.
- [x] **V. Accessible (WCAG 2.2 AA)**: pass.
  - The selected state adds bold weight and ARIA to the colour fill (no colour-only state),
    and the focus ring is unchanged.
  - Targets stay ≥ `--target-min`.
  - The contrast-more tokens restore full borders, and transitions are 0s under reduced
    motion.
  - axe runs in `a11y-audit.spec.ts`.
  - `--color-border-subtle` is used only on decorative frames, never as a control's sole
    boundary.
- [x] **VI. Performance Budgets**: pass. There is no JS logic and no dependency. The
  bundle-size check and Lighthouse run in `pnpm verify` and CI, and the CSS net size is about
  neutral, because the copies are removed when `controls.css` is added.
- [x] **VII. Design System Fidelity**: pass, and this is the slice's purpose.
  - The fretboard stays the protagonist (G-1), and no control is moved behind a menu.
  - The marker code and the root, third and fifth colours are untouched, as
    `reserved-colors.test.ts` shows.
  - Every value comes from tokens, now lint-enforced.
  - Notices stay non-blocking and are never red.
  - No decoration, gradients or imagery are added.
  - 320 to 2560 px is covered by G-3.
  - Fretboard motion is unchanged.
- [x] **VIII. International**: pass. No new strings, so `no-raw-text.test.ts` still passes.
  The layout is verified in en, pt and es and at 200% zoom by the existing
  `languages-layout` and `text-zoom` suites. Note names are untouched.
- [x] **IX. Untrusted Input, Versioned Formats**: N/A. No parser, schema, link or preference
  format changes, and the link-compatibility fixtures run untouched.
- [x] **X. Simplicity**: pass.
  - Each family has two or more real uses. The stepper has one use, so it has no separate
    button style: it reuses `.btn` plus a readout class.
  - There is no wrapper component, and the lint is one test file with no new tool.
  - Failure views keep their fallbacks.
- [x] **Stack and workflow**: pass. Plain CSS tokens as mandated, Conventional Commits, and
  local runs follow the verification tiers (no local full matrix). An ADR records the
  global-family and style-lint decision:
  `docs/adr/0028-chrome-control-families-and-style-lint.md`.

No violations. The Complexity Tracking table below records deliberate interpretations, not
violations.

## Project Structure

### Documentation (this feature)

```text
specs/029-act-as-a-ui-ux/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0: R-01 … R-10
├── data-model.md        # Phase 1: tokens and control families
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── ui.md            # family classes, instance map, zone geometry, cards, overlays
│   └── style-lint.md    # rules of tests/unit/style-tokens.test.ts
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── styles/
│   │   ├── tokens.css          # + radius scale, medium weight, subtle/hover/shadow, switch, same-value fb tokens
│   │   ├── global.css          # zone-heading label style, card grid stretch; .sr-only stays here
│   │   └── controls.css        # NEW: .btn .option .switch .stepper .link-button
│   ├── shell/                  # ToolLayout, AppNav, ToolCard, HomeScreen, InstrumentPanel, FretStepper,
│   │                           # LanguagePanel, NotationToggle, Notice, ErasePreferences, SoundControl,
│   │                           # Instrument/Language/Share/Stop buttons, TuningBadge, InstrumentSummary,
│   │                           # ShareFallback, FailureView, ShellFailure: apply classes, drop copies
│   ├── tools/                  # ChoiceGroup, NoteSelector, FitToggle, ContextZone, SidePanels,
│   │   ├── notes/              # NotesActions, RegionFilter, StringFilter, PositionCard, DetectedTriad
│   │   ├── triads/             # TriadsSecondary, TriadsCompare, TriadsGuidance, CompositionPanel
│   │   └── caged/              # CagedTool (zones and switch), CagedLayerList, CagedListen, CagedTriadSets
│   └── fretboard/              # Fretboard, MarkerSample, Minimap, ViewAids, LegendPanel: literals → same-value tokens only
└── routes/
    ├── +layout.svelte          # import controls.css after global.css
    └── about/+page.svelte      # link and button classes

tests/unit/
├── style-tokens.test.ts        # NEW: contracts/style-lint.md
└── a11y/tokens.ts              # + helper returning all declared token names

e2e/
├── ui-refinement.spec.ts       # NEW: G-1, G-2, G-3, family equality, home cards
└── *-snapshots/                # chrome baselines regenerated (phone, phone-touch, desktop)

docs/adr/
└── 0028-chrome-control-families-and-style-lint.md   # NEW
```

**Structure Decision**: this is the existing single SvelteKit project. Work stays in
`src/lib/styles`, `src/lib/shell`, `src/lib/tools` (and its `notes/`, `triads/` and `caged/`
subfolders), `src/lib/fretboard` (token substitution only) and `src/routes`. Tests go in the
existing `tests/unit` and `e2e` folders, and the ADR in `docs/adr`. No new top-level
directory or package is created.

## Implementation Order (for /speckit-tasks)

1. **Guard first (red)**: write `tests/unit/style-tokens.test.ts` and its fixture self-test.
   It fails on today's offenders. Write `e2e/ui-refinement.spec.ts`: G-1 and G-3 may already
   pass, while G-2 at 320 px and family equality fail today.
2. **Tokens**: add the data-model tokens. Run the palette-contrast, theme-tokens and
   reserved-colors tests.
3. **Fretboard literal swap** (same values). Run the two frozen snapshots without update. They
   must pass.
4. **controls.css**, then migrate the components family by family (`.option` → `.btn` →
   `.switch` → stepper → `.link-button`). After each family, run the lint and the equality
   test.
5. **Zones, headings, home cards and overlays**. Run G-1, G-2 and G-3 and the regression list
   in `quickstart.md` §4.
6. Regenerate the changed chrome baselines (quickstart §5). Write the ADR. Run `pnpm verify`
   once.

User-story mapping:
- US1 (P1) = steps 1–5 on the tool screens;
- US2 (P2) = nav, home cards and panels in steps 4–5;
- US3 (P3) = regression suites and the contrast-more and reduced-motion token overrides.

## Complexity Tracking

There are no constitution violations. The table records the interpretations made without a
human to ask, with the rejected alternative for each.

| Decision / assumption | Why | Rejected alternative |
|---|---|---|
| Stepper "family" = `.btn` buttons + `.stepper-value` readout, not a separate button style | The stepper has one real use (FretStepper). Constitution X forbids an abstraction with one use, while FR-003 still holds because its buttons compute equal to every `.btn` | A distinct `.stepper-button` style, which would be speculative and could drift from `.btn` |
| Lint adds rule 4 (font-weight via tokens) and rule 5 (no family redeclaration) beyond the three clarified rules | Makes FR-004's "type from tokens" and FR-003's "MUST NOT redeclare" mechanically checkable | Code review only, which would not be enforced |
| Zone C geometry frozen, so only its border colour changes | Fit mode sizes the board from zone C's content box, and any px change would break the frozen element snapshots (SC-004) | Unboxing C like B and E, which would rescale the board |
| SC-005 at 320 px: tighten `.option` padding at the narrow arrangement. If a tool still overflows, `.controls-row` wraps at narrow instead of scrolling in its strip | Every zone-B control must be in the initial viewport. Wrapping is restyling, not a zone move | Measuring only "primary" controls, which contradicts the clarification |
| App-bar Instrument, Language and Share buttons, notice actions and Triads guidance actions use `.link-button` | Quiet text actions reduce visual weight in zone A and in notices. They keep 44 px targets and focus | Bordered `.btn` everywhere, which reads as heavier and adds boxes against FR-001 |
| Accent hue and lightness kept unless a contrast test demands otherwise | The clarification allows only lightness changes, and the current values already pass | A new accent colour, which is out of the clarified limits |
