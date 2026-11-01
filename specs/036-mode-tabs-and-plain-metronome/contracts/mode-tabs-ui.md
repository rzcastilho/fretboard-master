# Contract: Mode tab bar and plain settings view (UI, 036)

## 1. DOM structure inside the metronome card

```html
<section class="panel" data-phase="settings|starting|running|paused" data-mode="plain|ratios" data-print="omit">
  <div role="tablist" aria-label="{metronome_modes_label}" class="mode-tabs">
    <button type="button" role="tab" id="metronome-tab-plain"
            aria-selected="false" aria-controls="metronome-mode-panel" tabindex="-1">
      <svg aria-hidden="true" focusable="false" class="tab-icon">…♩…</svg>
      <span>{metronome_mode_plain}</span>
    </button>
    <button type="button" role="tab" id="metronome-tab-ratios"
            aria-selected="true" aria-controls="metronome-mode-panel" tabindex="0">
      <svg aria-hidden="true" focusable="false" class="tab-icon">…+…</svg>
      <span>{metronome_mode_ratios}</span>
    </button>
  </div>
  <div role="tabpanel" id="metronome-mode-panel" aria-labelledby="metronome-tab-{mode}">
    <!-- settings view of the mode, or StatusBox + RunControls -->
  </div>
  <div role="status" aria-live="polite" class="sr-only">…</div>
  <!-- Notice when sound is unavailable -->
</section>
```

- The tab bar is the first row and is rendered in every phase (FR-012).
- The `<h2 id="panel-heading">` is removed.
- `ModeTabs.svelte` props: `{ mode: MetronomeMode; onselect: (m: MetronomeMode) => void }`.
  The tab order comes from `METRONOME_MODES`. Speed Training (009/002) will add an entry there
  and a label key. It is not added in this slice.

## 2. Keyboard (manual activation, FR-012)

| Key on a focused tab | Result |
|---|---|
| Tab / Shift+Tab | enters/leaves the tablist on the selected tab only |
| ArrowRight / ArrowLeft | focus the next / previous tab, wrapping; no selection, no stop |
| Home / End | focus the first / last tab |
| Enter / Space | select the focused tab (native button click → `onselect`). Space does **not** toggle Start/Pause |
| Escape | unchanged global rule: resets a running or paused session |

`matchMetronomeKey` does not change. A `<button role="tab">` is a native activator, so the
page-level Space handler returns null for it.

## 3. Visuals (tokens only, FR-002/FR-003)

| Aspect | Rule |
|---|---|
| Widths | equal columns (`grid-auto-columns: 1fr`) across the card |
| Active | `color: var(--color-accent)`; `border-block-end: var(--metronome-tab-underline) solid var(--color-accent)` |
| Inactive | `color: var(--color-text-muted)`; transparent bottom border of the same width |
| Target | `min-block-size: var(--target-min)` |
| Focus | `outline: var(--focus-ring-width) solid var(--color-focus-ring)` on `:focus-visible` |
| ≤ 30rem | `.tab-icon { display: none }` |
| Forced colours | active border `Highlight` |
| Wrap | labels may wrap; never truncated or ellipsised |

New token: `--metronome-tab-underline: 2px` in `src/lib/styles/tokens.css`.

## 4. Plain settings view (FR-007)

In order: the BPM `ValueRow`, the # of Beats `ValueRow`, then `CountInSettings` with
`repeat={false}` (a new optional prop, default `true`, that hides the Repeat Count In row),
then the Start button labelled `metronome_start_plain`. `RatioSettings` is not rendered.
The element ids stay the same as in Ratios (`metronome-bpm`, …), because only one view
is mounted at a time.

## 5. Running view (FR-010/FR-011)

`StatusBox` gets `sub={metronome.sub}` (`null` in plain), `beats={metronome.current.beats}`,
`bpm={metronome.current.bpm}`. With `sub === null` the position line is
`BEAT n/N` or `BEAT –/N` only. `RunControls` is unchanged.

## 6. Test hooks

- The e2e tests locate the card content with `getByRole('tabpanel', { name: 'Ratios Training' })`
  or `{ name: 'Metronome' }`.
- The tabs are found with `getByRole('tab', { name: 'Metronome' })` and
  `{ name: 'Ratios Training' }`. Exact-name matching passes at both widths because the icons
  are `aria-hidden`.
