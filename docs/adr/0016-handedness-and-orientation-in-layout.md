# ADR 0016: Handedness and orientation in layout

- **Status**: Accepted
- **Source**: spec 013-left-handed-and-orientation (research R-01, R-02, R-03, R-05, R-06, R-07, R-08, R-09, R-15)
- **Amends**: ADR 0005 (single SVG grid), ADR 0009 (tags edge, keyed auto-scroll) and ADR 0012 (instrument store contract)

## Context

A left-handed player wants the neck mirrored (nut on the right). Any player may want the lowest
string on top. Both are presentation: notes, positions, sound, descriptions and every tool's view
state must stay identical. Before this slice `screenOrder` was an identity mapping, and the
renderer assumed "label column at x = 0, nut on the left".

## Decision

- **Mirror in pure layout coordinates.** `layoutFretboard` computes the left-to-right layout,
  then, when `screenOrder(instrument).reversed`, maps every `x' = width − x` and swaps each
  column's `start`/`end`. `columns[f]` stays indexed by fret. Markers, fret lines, nut, inlays,
  fret numbers, tags, arrows, region band, focus ring and hit-testing all derive x from
  `layout.columns`, so one place mirrors them all. No SVG `scale(-1,1)` (it would mirror text)
  and no CSS `direction: rtl` (it would fork every scroll helper).
- **Orientation reorders rows.** `screenOrder` returns rows `[1…n]` or `[n…1]`; lookups use
  `rowOf(layout, string)`. String thickness stays keyed by string number. Orientation also
  decides the vertical edges: highest-top has tags above and fret numbers below; lowest-top the
  reverse. DOM order follows visual order.
- **Reading order is fret order.** Grid cells are always in nut → body order, so screen readers
  read from the nut in all four combinations. Descriptions and `aria-label`s are unchanged and
  never say "left" or "right".
- **Nut-anchored scroll offsets.** Scroll rules are expressed as a nut-relative offset
  `n = mirrored ? maxScroll − scrollLeft : scrollLeft` (`nutOffset`, `scrollForNutOffset` in
  `interaction.ts`). "Align the start" becomes "align the nut side". A handedness switch keeps
  the same frets in view, without animation.
- **Presentation travels in `Instrument`.** `Instrument` carries `handedness` and `orientation`;
  `InstrumentConfig` holds them next to string count, tuning and frets. Default presentation
  returns the existing memoized instrument unchanged; otherwise a frozen, memoized copy. Tools
  pass the instrument through and never read the fields; a boundary test enforces an allow-list.
- **Presentation-only confirm.** `confirmPanel` reports `musicalChanged`. A change of only
  handedness/orientation writes preferences and hands the new instrument to the tools, but does
  not stop playback and shows no adjustment notice (FR-017).
- **Record (add-only, ADR 0013).** `version` stays 1. Optional `handedness` and `orientation`,
  each with independent fallback. The writer omits defaults, so default users' records stay
  byte-identical to slice 012.

## Consequences

- One pure function is the single mirroring site; four combinations are table-testable without a DOM.
- Older bundles ignore the new fields and load right-handed, highest on top (ADR 0002 version skew).
- Thumbnails and the panel preview follow the confirmed or pending settings with no extra plumbing.
- `Fretboard.svelte` gains one anchor effect re-applying the nut offset on width or mirror changes.
- Initial JS grew ≈ 1.4 KB gzip (84.8 → 86.1 KB), past the 85 KB cap; constitution 1.4.0 raised the
  budget to 90 KB (ADR 0002).

## Alternatives considered

- **SVG transform flip** (R-01, R-02): mirrors text; hit-testing would need to undo it.
- **CSS `direction: rtl`** (R-01, R-06): negative `scrollLeft` forces a second code path everywhere.
- **CSS `column-reverse` for the tags/numbers edge** (R-03): visual and focus order diverge.
- **Separate presentation store read by the renderer** (R-07): the pure, prop-driven component
  would import app state; preview and thumbnails would need special plumbing.
- **Tools merge presentation at render** (R-08): every tool would touch presentation.
- **Always write both fields** (R-09): changes every existing user's stored bytes for no benefit.
