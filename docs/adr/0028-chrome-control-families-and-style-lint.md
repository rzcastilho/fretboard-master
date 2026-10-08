# ADR 0028: Chrome control families and the style lint

- **Status**: Accepted
- **Source**: spec 029-act-as-a-ui-ux (research R-01, R-03, R-04)

## Context

Buttons, option toggles, switches, steppers and link-buttons were styled separately in many
components, with raw literals and slightly different values. A Svelte scoped selector
(`button.svelte-xyz`) beats a global class, so any per-component copy silently wins.

## Decision

- **Five global families in `src/lib/styles/controls.css`**, imported from
  `src/routes/+layout.svelte` after `global.css`: `.btn`, `.option`, `.switch`, `.stepper` and
  `.link-button`. Components add the class in markup and keep only layout rules (grid-area,
  gap, margin, flex, inline-size) in their own `<style>`. Values come from `tokens.css` only.
- **No shared Svelte `<Button>` component.** The families sit on varied markup (`role="radio"`,
  `aria-pressed`, `role="switch"`, links), and a wrapper would change DOM and ARIA that tests
  assert. A class changes styling only.
- **Same-value fretboard tokens.** Literals in Fretboard, MarkerSample and Minimap become
  tokens with identical computed values (`--fb-stroke-hairline`, `--fb-label-halo-width`,
  `--fb-glyph-halo-width`, `--font-weight-normal`, `--font-weight-bold`, `--unit-px`,
  `--radius-sm`), so the board drawing is pixel-identical. The frozen snapshots
  `all-markers-grayscale` and `accidental-glyphs` are never updated.
- **Style lint as a unit test** (`tests/unit/style-tokens.test.ts`, node environment). It scans
  every `<style>` block in `src/**/*.svelte` and fails on colour literals, dimension literals,
  undeclared `var(--x)`, non-token `font-weight`, and family-owned properties redeclared on
  family selectors or a bare `button`. It runs with no new dependency.

## Alternatives considered

- Stylelint or an ESLint Svelte plugin: more config and a dev dependency for one check, and no
  resolution of tokens against `tokens.css`.
- Allow-listing Fretboard.svelte in the lint: rejected; same-value tokens keep the lint total.

## Consequences

- A new control reuses a family class instead of adding CSS; lint blocks drift.
- Changing a family changes every use, so chrome screenshot baselines are regenerated
  deliberately, one test at a time.
