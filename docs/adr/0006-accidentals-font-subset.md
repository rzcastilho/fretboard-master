# ADR 0006: Accidentals font subset

- **Status**: Accepted
- **Source**: research R-15 (spec 002-interactive-fretboard); constitution 1.2.0 "Fonts" row

## Context

System UI fonts do not reliably include ♯ ♭ and almost never 𝄪 𝄫. Note labels must render these
glyphs consistently without costing the home screen performance budget.

## Decision

- Self-host a subset of Noto Music (SIL OFL 1.1) containing only U+266D, U+266E, U+266F, U+1D12A,
  U+1D12B, committed as `static/fonts/fm-accidentals.woff2` with `static/fonts/OFL.txt`.
- Declare it in `global.css` as `'FM Accidentals'` with `unicode-range: U+266D-266F, U+1D12A,
U+1D12B` and `font-display: swap`, so the file loads only when an accidental is drawn.
- `--font-family-notes` puts `'FM Accidentals'` first and falls back to the system UI stack;
  letters and digits keep the system face, numerals use `font-variant-numeric: tabular-nums`.
- Generate the file with `scripts/subset-accidentals-font.mjs` using the dev dependencies
  `subset-font` and `@fontsource/noto-music`; neither ships at runtime.
- `static/_headers` serves `/fonts/*` with immutable long-term caching.

## Consequences

- No font request on the home screen or on a plain standard-tuning fretboard.
- Same-origin font keeps the CSP unchanged.
- The constitution's "Fonts" row is amended (MINOR, 1.2.0) to match.

## Alternatives considered

- Self-hosting a full UI family: tens of KB per weight on every page, and it still lacks 𝄪 𝄫.
- Drawing accidentals as SVG paths: works inside the board but not in HTML text; two render paths.
