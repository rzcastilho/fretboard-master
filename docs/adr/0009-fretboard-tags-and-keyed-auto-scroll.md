# ADR 0009: Fretboard tags and keyed auto-scroll

- **Status**: Accepted
- **Source**: research R-05, R-06 (spec 006-full-neck-and-all-notes)

## Context

The Triads Full neck view shows every inversion shape along a string set and labels each with a
tappable tag ("Root position", "1st", "2nd"). Tags must scroll with the board, be reachable by
keyboard and screen reader, and never move the board when tapped (C15). The wave-005 auto-scroll
re-centres the board whenever the highlighted set changes, so tapping a tag, which changes the
highlight, would scroll the board under the learner's finger. Constitution Principle III forbids
tools drawing on the fretboard themselves; ADR 0005 keeps the board a single SVG ARIA grid.

## Decision

- **Shared tag strip.** `DisplayModel.tags?: readonly FretboardTag[]` and `FretboardProps.ontag`
  are added to the shared fretboard. The interactive variant renders a
  `<div class="tags" role="group">` of native `<button type="button" aria-pressed>` elements
  inside the `.scroller`, before the SVG, so tags scroll with the board. A pure
  `layoutTags(items, boardWidth, gap)` in `src/lib/fretboard/tags.ts` places each tag at its
  shape's fret-column centre, clamps it to the board and moves overlapping tags to the next row.
  Widths are measured with `ResizeObserver` (fallback `--target-min`). Tags are excluded from
  the text description.
- **Keyed auto-scroll.** `DisplayModel.autoScroll?: { key, groups }` replaces the highlight
  trigger when present. The board scrolls only when `key` changes, towards the first group that
  is not already fully visible (`groupScrollTarget`), using `--duration-short` (instant under
  reduced motion). The model builds the key from the state that should re-centre the board
  (view, string set, root, quality, fret count) and leaves the inversion out, so a tag tap
  never scrolls. A model without `autoScroll` keeps the wave-005 behaviour.

## Consequences

- Tags are real buttons: Tab order follows chain order, Enter and Space work, `aria-pressed`
  conveys selection.
- The display model decides when the board moves, as a pure function of state. Notes keeps its
  behaviour unchanged.
- A later tool (CAGED shape tags in wave 004) reuses both fields without touching the renderer.

## Alternatives considered

- Tool-side overlay synced to `scrollLeft`: duplicates fret geometry in a tool and jitters
  while scrolling.
- Tags as SVG elements inside the grid: breaks the ARIA grid structure (ADR 0005) and gives
  buttons no native keyboard behaviour.
- A store-set "suppress scroll" flag on tag taps: makes the display model depend on how a state
  was reached rather than on the state itself.
- Always re-centring on highlight change: moves the board under the finger on every tag tap
  (violates C15).
