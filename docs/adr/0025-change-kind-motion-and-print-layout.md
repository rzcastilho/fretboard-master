# ADR 0025: Change-kind motion and print layout

- **Status**: Accepted
- **Source**: spec 026-themes-motion-and-print (research R-08, R-10, R-11)

## Context

Motion should explain what changed, and only that, without tools drawing anything themselves
(Principle III) and without a tween engine. Printing should give the whole neck on one page with
readable labels, whatever the screen's fit mode or container width.

## Decision

- **Each tool classifies its change.** A pure `motionKind(prev, next)` in `notes-view.ts`,
  `triads-view.ts` and `caged-view.ts` returns `slide | by-role | cross-fade | focus | reveal |
none`. It returns `none` when the instrument, labels, notation, language or fit changed, or
  when the view is newly opened. The tool stores attach it as `DisplayModel.motion`. (R-08)
- **One reconciliation point.** The pure `reconcileMarkers(prevKeyed, nextMarkers, kind)` in
  `src/lib/fretboard/transition.ts` returns the keyed list that `Fretboard.svelte` iterates plus
  an enter/exit mode per marker:
  - `slide` pairs old and new markers per string by fret order, so a marker inherits its
    partner's key and the CSS transform transition slides it along the string.
  - `by-role` keys by role id: an unchanged role does not animate, a role that moved string
    fades out and in.
  - `cross-fade` gives every new marker a fresh key, so the old set fades out while the new one
    fades in.
  - `reveal` keeps the existing staggered appearance, ending within `--duration-short`.
  - `focus` changes emphasis through the opacity transition and the scroll uses
    `--duration-medium`.
  - `none` sets `data-motion="none"` on the SVG, which disables marker transitions.
    Only `transform` and `opacity` animate. State (model, description, focus, share link) updates
    synchronously, and CSS transitions retarget from the drawn value, so an interrupting change
    starts from the current position with no jump. Reduced motion zeroes the duration tokens. (R-08)
- **Print is a layout branch, not a second board.** A `print` store (`matchMedia('print')`,
  `beforeprint`, `afterprint`) holds `active`. While active, `Fretboard.svelte` lays out with
  `layoutFretboard(…, PRINT_INLINE_PX, …, 'whole')`, ignoring screen fit, container width and
  scroll. `PRINT_INLINE_PX` comes from the token `--print-board-inline` (190 mm, the narrowest
  printable width, A4 portrait). The SVG prints at full inline size with a maximum block size and
  `break-inside: avoid`, so the render scale is at least 1 and labels use
  `max(<screen size>, var(--print-text-min))` with 7 pt. (R-11)
- **Print content is declarative.** `@media print` in `tokens.css` is last, so it beats the
  contrast and forced-colours blocks: light surfaces, a darker print palette for `--fb-color-*`,
  and `print-color-adjust: exact`. Chrome carries `data-print="omit"`; the description and legend
  carry `data-print="show"`. No dialog and no export. (R-10)

## Consequences

- Adding a tool means writing its `motionKind` classifier, not new drawing code.
- Print output depends on the print store being flushed synchronously before the snapshot.
- Rejected: per-tool marker ids encoding pairing, a JS tween engine, the Web Animations API,
  CSS-only scaling for print, and a second always-in-DOM print board.
