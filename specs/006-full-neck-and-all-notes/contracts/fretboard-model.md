# Contract delta: Fretboard display model — tags and keyed auto-scroll

**Feature**: `006-full-neck-and-all-notes` | Base: [005 fretboard-model](../../005-triads-isolated-view/contracts/fretboard-model.md) | Data model: [§5](../data-model.md) | Research: R-05, R-06

Backwards-compatible additions (Notes and Isolated pass neither field → unchanged behaviour).

```ts
export interface FretboardTag { id; start; end; label; name; pressed; detail? }   // see data model §5
DisplayModel.tags?: readonly FretboardTag[];
DisplayModel.autoScroll?: { key: string; groups: readonly (readonly Position[])[] };
FretboardProps.ontag?: (id: string) => void;
```

## Rendering

- Tags render only in the `interactive` variant, as a `<div class="tags" role="group" aria-label={m.fretboard_tags_label()}>`
  inside `.scroller`, **before** the SVG, width = `layout.width`, height = rows × `--target-min`
  (+ `--space-1` gaps). Absent or empty `tags` → no strip, no reserved height.
- Each tag: `<button type="button" aria-pressed={pressed} aria-label={name}>` with `label` and
  optional `detail` text; `min-inline-size` / `min-block-size: var(--target-min)`; pressed state
  shown by fill + border weight + `aria-pressed` (not colour alone); focus ring from global
  styles. DOM order = `tags` order. Click/Enter/Space → `ontag(id)`; never changes scroll.
- Position: `layoutTags(items, layout.width, gap)` (`src/lib/fretboard/tags.ts`); centre from
  `layout.columns[start].start … layout.columns[end].end`; width from a `ResizeObserver` on the
  buttons (fallback `--target-min`). Tags sit above the board edge opposite the fret numbers
  (design §"Fret numbers" / "Shape and inversion tags").
- Tags are not grid cells and are excluded from `describeView`.

## Auto-scroll

- `autoScroll` absent → existing highlighted-set trigger (005 R-09).
- `autoScroll` present → effect re-runs only when `key` changes;
  `groupScrollTarget(layout, groups, viewport)` (`interaction.ts`, pure): `null` when `groups` is
  empty or any group is fully visible; else the `spanTarget` move for `groups[0]`. Duration from
  `--duration-short` (0 under reduced motion).

## Tests

- `tests/unit/fretboard/tags.test.ts`: `layoutTags` — no overlap per row, later tag moves down,
  clamping at both edges, chain order preserved, 1-item and 0-item cases; property test (random
  centres/widths) for the no-overlap and clamp invariants.
- `tests/unit/fretboard/interaction.test.ts`: `groupScrollTarget` cases (visible group → null;
  none visible → lowest group; empty → null).
- `tests/unit/fretboard/fretboard.test.ts`: renders tag buttons with `aria-pressed`/names in
  order; `ontag` on click and keyboard; tag click does not change `scrollLeft`; no strip without
  tags; unchanged key → no scroll.
