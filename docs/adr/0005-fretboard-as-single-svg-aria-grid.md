# ADR 0005: Fretboard as a single SVG ARIA grid

- **Status**: Accepted
- **Source**: research R-04 (spec 002-interactive-fretboard)

## Context

The fretboard must be drawn precisely, scroll horizontally on a phone, take pointer and keyboard
input, and be usable with a screen reader. The site's CSP (`style-src 'self'`, hash mode, no
`unsafe-inline`) blocks inline `style` attributes, including on prerendered pages.

## Decision

- One inline `<svg>` per fretboard. Drawing layers (wood, inlays, frets, nut, strings, string
  labels, fret numbers, markers) are `aria-hidden` groups.
- The interactive layer is an ARIA grid built from SVG elements: the `<svg>` has `role="grid"` and
  the catalog label "Fretboard"; each string is a `<g role="row">`; each position is a transparent
  `<rect role="gridcell">` covering its hit cell, with an `aria-label`.
- Exactly one cell has `tabindex="0"` (roving tab stop); arrows move focus, Enter/Space activate.
- All geometry is set through SVG attributes (`x`, `y`, `width`, `cx`, `d`), which the CSP allows.
- Fallback if axe flags `role="grid"` on `<svg>` in some engine: wrap in `<div role="grid">`, set
  `role="none"` on the `<svg>`, keep rows and cells unchanged. No API change either way.

## Consequences

- Screen readers enter focus mode inside the board, so arrow keys reach our handler (APG grid).
- Handedness and orientation stay one coordinate transform inside the renderer; tools never see it.
- 138 gridcells in the DOM; acceptable for the 4x CPU throttle budget (SC-009).

## Alternatives considered

- Canvas: no DOM focus targets or accessible names.
- HTML/CSS grid of buttons: needs inline styles (CSP) and two layout systems kept in sync.
- One SVG per string: row alignment drift and more DOM.
