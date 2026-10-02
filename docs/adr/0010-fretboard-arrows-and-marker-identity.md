# ADR 0010: Fretboard arrows and marker identity

- **Status**: Accepted
- **Source**: research R-07, R-08, R-09 (spec 007-quality-comparison)

## Context

The Triads quality comparison shows a triad and the same shape in another quality at once. Notes
that change move by one or two frets; the learner must see which notes moved, in which direction,
and by how much, without relying on colour alone (Principle V). Only the renderer may draw on the
fretboard and orient it for handedness (Principle III, ADR 0005). Only the changing note may
animate when the quality changes (FR-013, C15), but markers keyed by position are re-created when
a note moves.

## Decision

- **`DisplayModel.arrows`.** An optional `arrows?: readonly FretboardArrow[]` layer. A
  `kind: 'move'` arrow runs between two cells on one string (`fromFret` to `toFret`, with a
  label); a `kind: 'off-board'` arrow runs from a marker to the edge of the string (`nut` or
  `end`). The renderer draws the layer as an `aria-hidden` group between the markers and the focus
  ring, from the layout columns, so handedness and orientation come from the existing geometry.
  The thumbnail variant ignores arrows. The Notes tool never sets the field.
- **`Marker.id` as motion identity.** An optional stable `id`, built by the tool as
  `${scope}:${role}:${function}@${shapeKey}`. `shapeKey` does not depend on quality, so a quality
  change keeps the id. The keyed `{#each}` keys on `mk.pulse?.id ?? mk.id ?? key`, and the marker
  moves with a CSS transform transition (`style:transform`, `--duration-short`,
  `--ease-standard`) instead of the SVG `transform` attribute. A marker whose identity survives
  but whose fret changed slides; unchanged markers do not move.
- **`Marker.variant = 'comparison'`.** The renderer adds a `comparison` class: same glyph shape
  and function fill, outline drawn with `stroke-dasharray` from the `--marker-dash` and
  `--marker-dash-gap` tokens, with a heavier stroke under `prefers-contrast`. The dashed outline
  plus the arrow carry the meaning without colour.
- New design tokens: `--marker-dash`, `--marker-dash-gap`, `--arrow-head-size`,
  `--panel-column-min`. No literal values in components (FR-020).

## Consequences

- Arrow placement, handedness and orientation live in one place, the renderer.
- A later tool reuses arrows, identity and the comparison variant without touching the renderer.
- Existing models are unaffected: every addition is optional. Marker position moves from an SVG
  attribute to a CSS transform, which the renderer tests must cover.

## Alternatives considered

- Arrows drawn by the tool: needs screen coordinates and breaks the Principle III boundary.
- Arrows encoded as markers: a marker cannot express a line between two cells.
- Svelte `animate:flip`: does not apply to SVG transforms.
- A JavaScript tween for marker motion: more code for the same result as a CSS transition.
- Markers keyed by position: a moved note is re-created and cannot slide, and unchanged markers
  would risk animating.
