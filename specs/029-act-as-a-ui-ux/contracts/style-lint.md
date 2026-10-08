# Contract: Component Style Lint (029, FR-004 / FR-003 / SC-002)

The lint lives in `tests/unit/style-tokens.test.ts`. It runs in the node environment and
needs no docblock. It reads every `src/**/*.svelte` file, extracts each `<style>` block,
strips `/* … */` comments, and checks every declaration.

## Input

- Component style blocks: `src/**/*.svelte`.
- The set of declared token names is the union of every `--name:` declaration in
  `src/lib/styles/tokens.css`, across all blocks. It is collected by a helper added to
  `tests/unit/a11y/tokens.ts`.
- Component-local custom properties are allowed: `--x` that is set in the same file, either in
  the style block or through `style:--x=` / `style="--x: …"` in markup (for example
  `--ring-base`).

## Rules (each failure reports `file:line  rule  text`)

| # | Rejects | Allowed |
|---|---|---|
| 1 | Colour literals: `#rgb[a]`, `#rrggbb[aa]`, `rgb()`, `rgba()`, `hsl()`, `hsla()`, CSS named colours | `transparent`, `currentColor`, `inherit`, `Canvas`, `CanvasText`, `GrayText`, `var(--color-*)`, `var(--fb-color-*)` |
| 2 | A number with `px`, `rem`, `em`, `ms` or `s` other than `0`, anywhere in the value, including `var(--x, 4px)` fallbacks | `%`, unitless numbers, `fr`, `ch`, `vw`/`vh`/`dvh` inside `min()`/`clamp()` with a token operand, `calc()` of tokens |
| 3 | `var(--name)` where `--name` is neither declared in `tokens.css` nor component-local | — |
| 4 | `font-weight` not equal to `var(--font-weight-normal \| --font-weight-medium \| --font-weight-bold)` | `inherit` |
| 5 | Any family-owned property in a rule whose selector contains `.btn`, `.option`, `.switch`, `.stepper`, `.link-button`, or a bare `button` type selector. Family-owned properties: `min-block-size`, `min-inline-size`, `padding*`, `border*`, `border-radius`, `font`, `font-size`, `font-weight`, `background*`, `color` | Layout properties: `margin*`, `flex*`, `grid*`, `order`, `align-self`, `justify-self`, `inline-size`, `max-inline-size` |

`ch` in rule 2 (`max-inline-size: 60ch` in TriadsGuidance) is a measure of text length and
is not a spacing value. It is allowed because the spec's unit list is `px|rem|em|ms|s`.

## Output

- Pass: zero findings. This is SC-002, second sentence.
- Fail: the assertion message lists every finding, so one run shows all offenders.

## Self-test

The test file also runs each rule against inline fixture strings: one offending and one
passing case per rule. A regex regression therefore cannot turn the lint into a no-op.
