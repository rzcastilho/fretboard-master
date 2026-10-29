# ADR 0023: Fit mode and adaptive arrangement

- **Status**: Partially superseded by 0029 (landscape arrangement, pinch)
- **Source**: spec 025-minimap-fit-and-landscape (research R-01, R-02, R-03, R-09, R-10)

## Context

A long neck (24 frets, 7 strings) does not fit a phone screen at a comfortable size, and the
fixed `@media (min-width)` grid wastes space on wide screens and in phone landscape. Two
decisions follow. Who decides that the neck fits, and how does that choice reach the rest of the
page? And what decides how zones B to E are arranged, given that the right answer depends on
fret count and text zoom, which CSS cannot read?

## Decision

- **Fit mode is a session store, driven by an event from the fretboard.** `src/lib/state/fit.svelte.ts`
  holds `mode: 'comfortable' | 'whole'`, `available` and the small-fret notice. It is neither a
  preference nor part of a link, so the choice lasts for the session and resets on reload, with
  no storage or link format change. The interactive `Fretboard` measures its own comfortable
  natural width against the scroller width and reports `onfit({ kind: 'overflow' | 'request' |
'small-tap' })`. It never imports the store, so thumbnails and previews cannot report. The
  effective mode is `available ? mode : 'comfortable'`: the choice is kept while the neck fits
  and reapplies when it stops fitting. (R-01, R-02)
- **Whole mode narrows columns in the pure layout.** `layoutFretboard(..., fit)` computes a
  `scale < 1` for `'whole'` when the neck overflows. Rows keep their height, markers shrink with
  the narrowest column, and comfortable mode is unchanged byte for byte. (R-03)
- **The arrangement is computed in JS and written as `data-arrangement`.**
  `src/lib/shell/layout.ts` `arrangementFor({ width, height, neckWidth, chrome })` returns
  `narrow | medium | wide-side | wide-stacked | landscape`. Inputs come from
  `viewport.svelte.ts`, which tracks the window size and the root font size, so text zoom and
  fret count count. `ToolLayout` sets the attribute on `.grid`, and `tokens.css` maps each value
  to the grid areas. `neckWidth` is the comfortable width, never the fit mode or rendered size,
  so there is no feedback loop. (R-09)
- **The `@media (min-width)` rules stay as the fallback.** Before mount, with JS off and during
  prerender, the media queries give narrow, medium and wide-stacked. The first paint is the
  right one for the default neck below 2,000 px, and `e2e/nojs.spec.ts` keeps passing.
- **Zones E and D move without remounting.** `SidePanels.svelte` wraps them. Outside landscape
  it is `display: contents`. In landscape it becomes a non-modal sliding panel, so tool state,
  selection and focus survive rotation. (R-10)

## Consequences

- Availability is measured once, where the real width is known. No CSS mirror formula can drift
  by 1 to 2 px and show a scrolling board without a minimap.
- The arrangement is testable with tables (1440/24, 1440/12, 2560/24, 1024/24, 844×390,
  1024×768, 390×844). Before hydration it can differ from the final one only above the media
  fallback's reach, for example wide-side.
- Two sources of layout truth exist, JS and the media fallback. They agree on narrow, medium and
  wide-stacked by construction, and e2e covers both.

## Alternatives considered

- **Fit mode as a preference or in `sessionStorage`**: the spec says each session starts
  comfortable, and a preference needs a schema bump.
- **CSS `transform: scale()` for whole mode**: scales row height and text, and breaks the
  hit-testing math.
- **Container queries or measuring the rendered grid for the arrangement**: neither can depend on
  fret count, and measuring loops when the arrangement changes the zone width.
- **Rendering E and D twice, or a portal, for the landscape panel**: duplicate IDs, double state
  or remount and focus loss.
