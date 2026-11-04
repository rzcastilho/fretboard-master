# ADR 0032: Timer readout digit font

- **Status**: Accepted
- **Source**: spec 042 (digital time display); constitution 2.3.0 "Fonts" row; extends ADR 0006

## Context

The practice timer readout (`MM:SS`) sits over an unlit `88:88` ghost that imitates a
seven-segment display. System fonts draw those digits as ordinary text, so the ghost does not
line up with the lit digits and the width shifts between states.

## Decision

- Self-host a subset of DSEG7 Classic Bold (SIL OFL 1.1) containing only `0`–`9` and `:`,
  committed as `static/fonts/fm-timer-digits.woff2` (under 1 KB) with
  `static/fonts/OFL-DSEG.txt`.
- Declare it in `global.css` as `'FM Timer Digits'` (weight 700, `font-display: swap`).
  `--font-family-timer` puts it first and falls back to the system UI stack.
- Only the timer readout uses the token. `TimerCard.svelte` preloads the file from
  `<svelte:head>`, so it is requested on `/metronome` and no other page. The service worker
  precaches it with the other `static/` files.
- Generate the file with `scripts/subset-timer-digits-font.mjs` (`pnpm fonts:timer-digits`)
  using the dev dependencies `subset-font` and `dseg`; neither ships at runtime.

## Consequences

- One extra same-origin request on `/metronome`; CSP is unchanged.
- The seven-segment face is monospaced, so the readout width stays constant.
- The constitution's "Fonts" row is amended (MINOR, 2.3.0).

## Alternatives considered

- CSS-drawn or SVG segments: more code and a second render path for text.
- A system monospace font: no seven-segment look and the ghost still would not match.
