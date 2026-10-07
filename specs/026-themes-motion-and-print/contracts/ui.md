# Contract: UI, CSS and Print Behaviour

Observable DOM, ARIA, CSS and print contracts. Playwright and component tests assert them.
Every user-facing string comes from the catalog (en, pt-BR, es).

## 1. Theme selector (`src/lib/shell/ThemeSelector.svelte`)

```html
<fieldset class="theme" data-print="omit">
  <legend>{m.theme_label()}</legend>
  <label><input type="radio" name="theme-{uid}" value="device" checked> {m.theme_device()}</label>
  <label><input type="radio" name="theme-{uid}" value="light"> {m.theme_light()}</label>
  <label><input type="radio" name="theme-{uid}" value="dark"> {m.theme_dark()}</label>
</fieldset>
```

- Accessible: `getByRole('radiogroup' | 'group', { name: Theme })` contains three radios named
  in the interface language, and exactly one is checked (`theme.choice`). Arrow keys move and
  select (native). Each label is ≥ 44×44 CSS px. There is no focus trap.
- Selecting a radio calls `theme.choose(value)`. The change is visible on the next frame, with
  no transition on any colour.
- Placement:
  - **Tool screens and About**: inside the zone-A disclosure region (`LanguagePanel`), after
    the notation selector. The disclosure button and region are named "Language and
    appearance". It takes two activations: the button, then the radio.
  - **Home**: in `header.top`, beside `LanguageSelector`. It takes one activation.
- 320 px width and 200% text: wraps without truncation or overlap in en, pt-BR and es.

## 2. Theme on the document

| Situation | `<html data-theme>` | Computed `color-scheme` | Surfaces |
|---|---|---|---|
| No pin, device light | absent | `light dark` → used light | Light |
| No pin, device dark | absent | used dark | Dark |
| No pin, device has no setting | absent | used light | Light |
| Pin light (any device) | `light` | `light` | Light |
| Pin dark (any device) | `dark` | `dark` | Dark |
| JavaScript off | absent | follows device | Follows device |
| `@media print` | any | `light` | Light (print palette) |

- **First frame**: with a stored pin, the attribute is present before the first paint. The
  e2e test reads it in `page.on('domcontentloaded')` and asserts the body background via
  `getComputedStyle` in the first `requestAnimationFrame` callback registered by an init
  script.
- **Live device change**: with no pin, `emulateMedia({ colorScheme })` flips surfaces without
  reload. With a pin, nothing changes.
- **Share links**: opening `/triads?…` with a pin keeps the pin, and the URL has no theme
  parameter.
- **Theme switch during playback or a transition**: sound continues, the marker set is
  unchanged, and no fade or slide replays (`data-motion` is untouched by a theme change).

## 3. Fretboard colours

- No rule inside `Fretboard.svelte`'s board SVG references `--color-*` surface tokens. Only
  `--fb-*` tokens are used. Exception: the focus ring keeps `--color-focus-ring-*`, because it
  is chrome and not an on-board colour.
- `.wood` gets `stroke: var(--fb-color-edge)` and `stroke-width: var(--fb-edge-width)` (the
  board boundary). No literal stroke width is written in the component.
- Role tokens `--fb-color-root|third|fifth` are referenced only by:
  - `.marker.root|third|fifth .glyph` in `Fretboard.svelte`;
  - the glyph fill in `MarkerSample.svelte`.
- Dimmed markers: opacity `--emph-dim-opacity` (< 1) and scale `--emph-dim-scale` (< 1) in every
  palette.
- `prefers-contrast: more` no longer maps the board or lines to `Canvas` / `CanvasText`. Only
  `forced-colors: active` does.

## 4. Motion behaviour (renderer)

| Kind | Observable within the limit | Reduced motion |
|---|---|---|
| `slide` | Paired markers translate along their row only (y constant) over ≤ `--duration-short`. Unpaired markers fade | Final transform on the next frame |
| `by-role` | Unchanged roles have an identical transform at t=0 and t=end, with no opacity change. A changed role translates. Comparison markers start at the base position, and outlines and arrows fade in | Instant |
| `cross-fade` | At t ≈ 150 ms, old and new markers both have opacity strictly in (0, 1). All done ≤ 300 ms | Instant, no fade |
| `focus` | Other shapes reach the dimmed opacity and the scroller reaches the region within ≤ `--duration-medium`. If the region is already fully visible, `scrollLeft` is unchanged | Instant dim, with the scroll jump still done |
| `reveal` | New layer markers start in ascending pitch order, and the last one reaches opacity 1 by ≤ 300 ms. Layer off: all fade together ≤ 300 ms | Instant |
| `none` | `svg[data-motion="none"]`, and markers have `transition: none` | Same |
| Pulse | One `marker-pulse` animation for the note duration | No animation, with the `highlighted` class while sounding, also when muted |

- **State first**: at t=0 of any transition, the description text, `aria-activedescendant` or
  focus, and `location.href` already show the final state.
- **Interruption**: a second change at t ≈ 150 ms starts from the currently computed transform
  (no jump greater than one frame's travel) and settles on the latest state.

## 5. Print (`@media print`)

**Contains**, as visible text or graphics:

- the screen `<h1>`;
- the fretboard over its full fret range, with string and fret numbering;
- every visible marker with its shape, label and emphasis;
- comparison dashes and arrows, and connection rings;
- the tuning badge text;
- the context description (`data-print="show"`, visible, not `.sr-only`);
- the legend (rendered while `print.active` even if closed or collapsed on screen).

**Omits** (`data-print="omit"`, `display: none`):

- the navigation bar;
- the share, instrument, sound, stop and notation buttons;
- the language and appearance disclosure, including the theme selector;
- zone-B controls;
- every notice;
- the minimap;
- the instrument and sound panels;
- the landscape sliding panel.

**Layout**:

- The page is white, and the board is light with a dark edge line.
- The SVG `inline-size` is 100% of the printable area, at most `--print-board-max-block`
  tall, with `break-inside: avoid`, all on one page.
- The scroller overflow is visible, so nothing is cropped.
- No `@page { size }` rule is set.
- The layout is the same whatever the screen's fit mode, scroll position, arrangement, theme,
  contrast or zoom (compared through the print-emulated DOM).
- Text floor: marker labels and numbering print at ≥ 7 pt for 7 strings and 24 frets on A4 and
  Letter, portrait and landscape. The e2e test computes it as
  `font-size(viewBox units) × svg.clientWidth / viewBox.width`, converted to pt, at the
  printable widths 718 px and 739 px (portrait) and 1047 px and 979 px (landscape).
- Background graphics off: board and markers are SVG fills, so they remain. The e2e test checks
  `page.pdf({ printBackground: false })` renders, and the DOM check runs under
  `emulateMedia({ media: 'print' })`.

**Home and About**: these print light with no navigation.

## 6. Headers and CSP

- `static/_headers` gains `/theme-boot.js` with `Cache-Control: no-cache`, asserted by
  `tests/unit/headers.test.ts`.
- `svelte.config.js` CSP is unchanged. `src/app.html` gains exactly one
  `<script src="/theme-boot.js"></script>` in `<head>`, and there is no inline script.
