<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { ANNOUNCE_DELAY_MS, createAnnouncer } from './announce';
  import LegendPanel from './LegendPanel.svelte';
  import type { LegendGroup } from './legend';

  interface Props {
    /** Locale-reactive text equivalent of the view (never empty). */
    description: string;
    /** Legend groups for the view as drawn (`legendGroups(model)`). */
    legend: readonly LegendGroup[];
    /** Print layout: description and legend are shown even when collapsed on screen. */
    printing?: boolean;
  }

  let { description, legend, printing = false }: Props = $props();

  const uid = $props.id();
  /** Component-local: closed on every mount, never persisted or shared. */
  let showDescription = $state(false);
  let legendOpen = $state(false);
  let legendButton: HTMLButtonElement | undefined = $state();
  /** Debounced polite announcement text; empty until the first settled change. */
  let liveText = $state('');

  const announcer = createAnnouncer({
    delayMs: ANNOUNCE_DELAY_MS,
    timer: {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
    },
    emit: (t) => (liveText = t)
  });

  $effect(() => {
    announcer.update(description);
  });

  onDestroy(() => announcer.dispose());

  /** Escape inside the panel closes it and returns focus to its button; no trap, Tab is untouched. */
  function onLegendKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    legendOpen = false;
    legendButton?.focus();
  }
</script>

<div class="view-aids">
  <div class="sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>
  <div class="buttons">
    <button
      type="button"
      class="btn"
      aria-expanded={showDescription}
      aria-controls="{uid}-description"
      onclick={() => (showDescription = !showDescription)}
    >
      {m.fretboard_describe()}
    </button>
    <button
      type="button"
      class="btn"
      bind:this={legendButton}
      aria-expanded={legendOpen}
      aria-controls="{uid}-legend"
      onclick={() => (legendOpen = !legendOpen)}
    >
      {m.fretboard_legend()}
    </button>
  </div>
  <p
    class="description"
    id="{uid}-description"
    data-print="show"
    hidden={!showDescription && !printing}
  >
    {description}
  </p>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    class="legend"
    id="{uid}-legend"
    aria-labelledby="{uid}-legend-heading"
    data-print="show"
    hidden={!legendOpen && !printing}
    onkeydown={onLegendKeydown}
  >
    <h2 id="{uid}-legend-heading">{m.fretboard_legend()}</h2>
    {#if legendOpen || printing}
      <LegendPanel groups={legend} />
    {/if}
  </section>
</div>

<style>
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-block-start: var(--space-2);
  }

  .legend {
    margin-block-start: var(--space-2);
  }

  .legend[hidden] {
    display: none;
  }

  .legend h2 {
    margin-block: 0 var(--space-2);
    font-size: inherit;
  }

  .description {
    margin-block: var(--space-2) 0;
    overflow-wrap: anywhere;
  }
</style>
