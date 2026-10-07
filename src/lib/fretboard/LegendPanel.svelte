<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import MarkerSample from './MarkerSample.svelte';
  import type { LegendGroup, LegendKind } from './legend';
  import type { NoteFunction, OctaveTone } from './types';

  interface Props {
    /** Groups from `legendGroups(model)`; empty → the empty-state paragraph. */
    groups: readonly LegendGroup[];
  }

  let { groups }: Props = $props();

  interface Sample {
    fn: NoteFunction;
    layer?: 'arpeggio' | 'triad';
    extra?: boolean;
    emphasis?: 'highlighted';
    tone?: OctaveTone;
    variant?: 'comparison';
    ring?: boolean;
  }

  /** Marker sample per kind; `null` → text-only entry (no glyph of its own). */
  const SAMPLES: Record<LegendKind, Sample | null> = {
    root: { fn: 'root' },
    third: { fn: 'third' },
    fifth: { fn: 'fifth' },
    degree: { fn: 'degree' },
    neutral: { fn: 'neutral' },
    selected: { fn: 'neutral', emphasis: 'highlighted' },
    octave: { fn: 'neutral', emphasis: 'highlighted', tone: 3 },
    arpeggio: { fn: 'root', layer: 'arpeggio' },
    triadLayer: { fn: 'root', layer: 'triad' },
    extra: { fn: 'degree', extra: true },
    connection: { fn: 'root', ring: true },
    comparison: { fn: 'third', variant: 'comparison' },
    wideStretch: null,
    alteredString: null
  };

  const NAMES: Record<LegendKind, () => string> = {
    root: m.legend_root_name,
    third: m.legend_third_name,
    fifth: m.legend_fifth_name,
    degree: m.legend_degree_name,
    neutral: m.legend_neutral_name,
    selected: m.legend_selected_name,
    octave: m.legend_octave_name,
    arpeggio: m.legend_arpeggio_name,
    triadLayer: m.legend_triadLayer_name,
    extra: m.legend_extra_name,
    connection: m.legend_connection_name,
    comparison: m.legend_comparison_name,
    wideStretch: m.legend_wideStretch_name,
    alteredString: m.legend_alteredString_name
  };

  const MEANINGS: Record<LegendKind, () => string> = {
    root: m.legend_root_meaning,
    third: m.legend_third_meaning,
    fifth: m.legend_fifth_meaning,
    degree: m.legend_degree_meaning,
    neutral: m.legend_neutral_meaning,
    selected: m.legend_selected_meaning,
    octave: m.legend_octave_meaning,
    arpeggio: m.legend_arpeggio_meaning,
    triadLayer: m.legend_triadLayer_meaning,
    extra: m.legend_extra_meaning,
    connection: m.legend_connection_meaning,
    comparison: m.legend_comparison_meaning,
    wideStretch: m.legend_wideStretch_meaning,
    alteredString: m.legend_alteredString_meaning
  };
</script>

{#snippet entries(kinds: readonly LegendKind[])}
  <ul>
    {#each kinds as kind (kind)}
      {@const sample = SAMPLES[kind]}
      <li>
        {#if sample}
          <MarkerSample {...sample} />
        {/if}
        <span class="name">{NAMES[kind]()}</span>
        <span class="meaning">{MEANINGS[kind]()}</span>
      </li>
    {/each}
  </ul>
{/snippet}

{#if groups.length === 0}
  <p>{m.legend_empty()}</p>
{:else}
  {#each groups as group, i (i)}
    {#if group.label}
      <h3>{group.label}</h3>
    {/if}
    {@render entries(group.kinds)}
  {/each}
{/if}

<style>
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    font-weight: 600;
  }

  .meaning {
    flex: 1 1 12rem;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  h3 {
    margin-block: var(--space-3) var(--space-2);
    font-size: inherit;
  }
</style>
