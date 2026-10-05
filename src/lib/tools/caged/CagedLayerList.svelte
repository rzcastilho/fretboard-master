<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import MarkerSample from '$lib/fretboard/MarkerSample.svelte';
  import type { NoteFunction } from '$lib/fretboard/types';
  import type { CagedLayer, SwitchState } from '$lib/state/caged-layers';

  /** Zone D: the layer switches double as the marker legend (US2). */
  interface Props {
    switches: Readonly<Record<CagedLayer, SwitchState>>;
    /** Second Scale sample with the extra dot; only with Pentatonic and Scale both on. */
    extraSampleShown: boolean;
    ontoggle: (layer: CagedLayer) => void;
  }
  let { switches, extraSampleShown, ontoggle }: Props = $props();

  const uid = $props.id();

  interface Row {
    layer: CagedLayer;
    fn: NoteFunction;
    sample?: 'arpeggio' | 'triad';
  }
  const ROWS: readonly Row[] = [
    { layer: 'chord', fn: 'root' },
    { layer: 'arpeggio', fn: 'root', sample: 'arpeggio' },
    { layer: 'pentatonic', fn: 'degree' },
    { layer: 'scale', fn: 'degree' },
    { layer: 'triad', fn: 'root', sample: 'triad' }
  ];

  const name = (layer: CagedLayer): string => {
    switch (layer) {
      case 'triad':
        return m.caged_layer_triad();
      case 'chord':
        return m.caged_layer_chord();
      case 'arpeggio':
        return m.caged_layer_arpeggio();
      case 'pentatonic':
        return m.caged_layer_pentatonic();
      default:
        return m.caged_layer_scale();
    }
  };

  const reason = (s: SwitchState): string | null =>
    s.disabled === 'last-layer'
      ? m.caged_layer_last()
      : s.disabled === 'no-shapes'
        ? m.caged_layer_no_shapes()
        : null;
</script>

<fieldset class="layers">
  <legend>{m.caged_layers_heading()}</legend>
  <div class="rows">
    {#each ROWS as row (row.layer)}
      {@const s = switches[row.layer]}
      {@const why = reason(s)}
      <button
        type="button"
        class="layer"
        role="switch"
        aria-checked={s.on}
        aria-disabled={s.disabled ? 'true' : undefined}
        aria-describedby={why ? `${uid}-${row.layer}-why` : undefined}
        onclick={() => {
          if (!s.disabled) ontoggle(row.layer);
        }}
      >
        <MarkerSample fn={row.fn} layer={row.sample} />
        {#if row.layer === 'scale' && extraSampleShown}
          <MarkerSample fn="degree" extra />
        {/if}
        <span class="name">{name(row.layer)}</span>
        <span class="state" aria-hidden="true"
          >{s.on ? m.caged_switch_on() : m.caged_switch_off()}</span
        >
      </button>
      {#if why}
        <span class="sr-only" id="{uid}-{row.layer}-why">{why}</span>
      {/if}
    {/each}
  </div>
</fieldset>

<style>
  .layers {
    margin: 0 0 var(--space-3);
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }

  legend {
    padding: 0;
    margin-block-end: var(--space-2);
    font-weight: 600;
  }

  .rows {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .layer {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    text-align: start;
    overflow-wrap: anywhere;
  }

  .layer:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .layer[aria-checked='true'] {
    border-color: var(--color-text);
    font-weight: 600;
  }

  .layer[aria-disabled='true'] {
    color: var(--color-disabled-text);
    border-color: var(--color-disabled-border);
    cursor: not-allowed;
  }

  .state {
    font-weight: 600;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
