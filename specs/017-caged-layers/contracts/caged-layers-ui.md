# Contract: CAGED layers — user interface

This is the observable contract for users and assistive technology. Playwright and component
tests assert against it. Strings refer to new `messages/en.json` keys (Principle VIII). The
English text is given for reference only.

## Zone D — Layers list (legend)

- **Structure**: a `<fieldset>` with `<legend>` `caged_layers_heading` ("Layers"). Above the
  existing **Show connections** switch and **Reset tool** button, it holds four rows in this
  order: Chord, Arpeggio, Pentatonic, Scale.
- **Row content**: each row is one `<button type="button" role="switch">` containing:
  - `MarkerSample` (`aria-hidden`):
    - Chord: a root square;
    - Arpeggio: a scaled root square (`layer-arpeggio`);
    - Pentatonic: an outlined circle;
    - Scale: an outlined circle, plus a second sample with the extra dot, shown only while
      Pentatonic and Scale are both on.
  - The visible layer name, which is also the accessible name:
    - `caged_layer_chord` "Chord";
    - `caged_layer_arpeggio` "Arpeggio";
    - `caged_layer_pentatonic` "Pentatonic";
    - `caged_layer_scale` "Scale".
  - The visible state, `caged_switch_on` or `caged_switch_off`, which already exist and are
    `aria-hidden`.
- **ARIA**: `aria-checked` follows the layer's on state.
- **Disabled switch**: `aria-disabled="true"` and `aria-describedby` pointing to a visually
  hidden reason. The switch stays focusable and in the tab order, and activating it does
  nothing. The reasons are:
  - `last-layer` → `caged_layer_last` "At least one layer stays on.";
  - `no-shapes` → `caged_layer_no_shapes` "Layers need a CAGED shape on the fretboard."
- **Size**: every switch is at least 44×44 CSS px (`--target-min`), with a visible focus ring
  (`:focus-visible` token outline).
- **Initial state**: Chord on and disabled (`last-layer`); the others off and enabled.
- **Sample fidelity** (US2-3): the computed `transform` and `opacity` of the sample's
  `.shape` equal those of a board marker of the same layer. A component test checks this.
- **Wrapping**: the list wraps and does not truncate at 320 px, in pt and es lengths, and at
  200% text zoom.

## Zone E — Label control

- A `ChoiceGroup` labelled `caged_group_labels` "Labels", with the options
  `caged_label_intervals` "Intervals" (default) and `caged_label_note_names` "Note names". It
  is placed before the Previous/Next shape buttons.
- The choice applies to chord and layer markers alike. It persists across reloads
  (`labels.caged`), and **Reset tool** keeps it.

## Zone C — Fretboard

- **Marker classes**:
  - chord: `.marker.root|third|fifth` with no `layer-arpeggio`;
  - arpeggio: `.marker.root|third|fifth.layer-arpeggio`;
  - pentatonic and scale: `.marker.degree`, with the extra mark as `.marker.degree`
    containing `circle.extra-dot`.
- **One marker per position**: there is at most one `.marker` per `data-key="s:f"` (FR-009).
- **Labels**:
  - Interval mode shows the `intervalLabel(degree)` glyphs: `R 2 3 4 5 6 7` (major) and
    `R 2 ♭3 4 5 ♭6 ♭7` (minor).
  - Name mode shows `noteLabel(spellScale(root)[degree])`.
  - Dimmed markers stay unlabeled (the existing rule).
- **Appearance**: markers added by turning a layer on fade and scale in, in ascending pitch
  order, and all of them are visible within 300 ms. Under `prefers-reduced-motion: reduce`
  they are all present in the first frame. Markers removed by turning a layer off disappear
  without stagger.
- **Seven strings**: string 7 carries `.marker.degree` or `.layer-arpeggio` markers only,
  never chord markers.
- **Altered string 6**: string 6 carries layer markers for every shape inside the focused
  region. The "altered" string mark is unchanged.

## Announcements (existing polite description region)

The description leads with the change sentence, when there is one, followed by:

- `caged_layer_now_on` "{layer} layer on." or `caged_layer_now_off` "{layer} layer off.";
- after an auto-focus: the existing `caged_focus_status` sentence;
- after the automatic Chord restore: "Chord layer on.";
- `caged_layers_on` "Layers on: {list}." The list uses `Intl.ListFormat`, as the existing
  helpers do;
- `caged_layer_counts` "{count} {layer} notes" per drawn layer, joined, after
  `caged_layers_in_region` "In this region:" (with focus) or `caged_layers_on_neck`
  "Across the neck:" (without focus);
- `caged_layer_waiting` "{layer} is on and shows when a shape is in focus." for each layer
  that is on but not drawable;
- `caged_extra_mark` "Extra mark: {notes}." when the extra mark is shown. The notes are spoken
  names, such as "F, B" or "F sharp".

## Keyboard and touch

- Tab reaches the four switches in list order. Space or Enter toggles one.
- When turning on Pentatonic or Scale moves focus to a shape (FR-012), keyboard focus stays on
  the switch. The board scrolls and centres the focused shape, as in slice 016.
- There are no traps, and switches never cover the fretboard (Principle VII).

## Persistence

| Action | Layers | Label |
|---|---|---|
| Navigate to another tool and back | kept | kept |
| Reload | Chord only | restored from `labels.caged` |
| Reset tool | Chord only | the preferred label, kept |
| Inspect `localStorage` | no layer data | `labels.caged` present only when it is "name" |

## TM-9 screenshot fixtures (`e2e/caged-tm9.spec.ts`)

| View | Setup | File |
|---|---|---|
| 16 | A minor, Em shape in focus, Chord + Pentatonic, AF-1, 6 strings | `tm9-caged-16-am-em-pentatonic.png` |
| 17 | G major, E shape in focus, Chord + Arpeggio + Scale, AF-1 | `tm9-caged-17-g-e-arp-scale.png` |
| 20 | D major, C shape in focus, Scale (with Chord), AF-21, 7 strings | `tm9-caged-20-d-c-scale-7.png` |

Each is captured on the phone, phone-touch and desktop projects.
