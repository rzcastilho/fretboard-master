# Contract: View aids UI (Describe this view + Legend)

Component: `src/lib/fretboard/ViewAids.svelte`, rendered by `Fretboard.svelte` when
`variant === 'interactive'`. Replaces the existing "Show/Hide text description" toggle.

## DOM / ARIA contract

```html
<div class="view-aids">
  <div class="sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>
  <div class="view-aids-buttons">
    <button type="button" aria-expanded="false" aria-controls="{uid}-description">
      Describe this view
    </button>
    <button type="button" aria-expanded="false" aria-controls="{uid}-legend">
      Legend
    </button>
  </div>
  <p class="description" id="{uid}-description" hidden>{description}</p>
  <section class="legend" id="{uid}-legend" aria-labelledby="{uid}-legend-heading" hidden>
    <h2 id="{uid}-legend-heading">Legend</h2>
    <!-- flat: one <ul>; grouped: per group <h3>{label}</h3><ul>…</ul> -->
    <ul>
      <li>
        <svg aria-hidden="true" class="marker-sample …">…</svg>
        <span class="name">Root</span>
        <span class="meaning">filled rounded square: the chord's root</span>
      </li>
    </ul>
    <!-- or, when no kind is in use: -->
    <p>Nothing is marked on the fretboard.</p>
  </section>
</div>
```

Heading level follows the surrounding tool layout (`h2` under the tool `h1`); the exact level
is set so axe `heading-order` passes.

## Behaviour

| Trigger | Result | Focus |
|---|---|---|
| Activate **Describe this view** | toggles `hidden` on description; `aria-expanded` flips; label unchanged | stays on button |
| Activate **Legend** | toggles legend panel; `aria-expanded` flips | stays on button |
| Escape with focus inside legend panel | legend closes | moves to Legend button |
| Tab inside/after panels | normal order; no trap | — |
| `description` changes | panel text updates at once; live region updated after 500 ms quiet (announcer) | unchanged |
| First render | live region stays empty | — |
| Focus moves across positions | nothing announced (description unchanged) | — |
| Language/notation/accidental change | panel + legend re-render; one announcement in new language | unchanged |
| Tool switch / reload | both panels closed (not persisted, not in share links) | — |

## Layout

- Directly below the fretboard scroller, in normal flow; never overlays the board (C-VII).
- Button row wraps; buttons ≥ 44×44 CSS px; tokens only (`--space-*`, `--radius-md`,
  `--color-*`, `--border-width`).
- 320 px and 200 % text zoom: no truncation, overlap, or page-level horizontal scroll.
- No animation on open/close.

## Messages (en / pt-BR / es) — new or changed keys

| Key | en |
|---|---|
| `fretboard_describe` | Describe this view |
| `fretboard_legend` | Legend |
| `fretboard_description_empty` | Nothing is displayed. |
| `legend_empty` | Nothing is marked on the fretboard. |
| `legend_<kind>_name` × 14 | Root, Third, Fifth, Scale degree, Note, Selected note, Octave colour, Arpeggio note, Triad note, Extra mark, Connection, Comparison, Wide stretch, Altered string |
| `legend_<kind>_meaning` × 14 | shape + meaning sentence, e.g. "filled circle: the chord's third" |
| `legend_group_*` | reuse `caged_layer_chord`, `caged_layer_arpeggio`, `caged_layer_pentatonic`, `caged_layer_scale`, `caged_layer_triad` |
| `list_and_two`, `list_and_many` | "{a} and {b}", "{head}, and {last}" |
| `triads_desc_shape` (changed) | "{chord}, {inversion}, strings {strings}: {entries}." |
| `triads_desc_inversion_{root,first,second}` | root position / first inversion / second inversion |
| `caged_description_note[_open]` (changed) | "string {string}, fret {fret}, {note}, {interval}" / "string {string}, open, {note}, {interval}" |
| `notes_desc_empty` | No notes selected. Pick a note in the note selector. |

`fretboard_description_show` / `_hide` are removed (no dead keys).
