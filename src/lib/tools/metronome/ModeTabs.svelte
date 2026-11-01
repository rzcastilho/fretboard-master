<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { METRONOME_MODES, type MetronomeMode } from '$lib/state/metronome-settings';

  let { mode, onselect }: { mode: MetronomeMode; onselect: (m: MetronomeMode) => void } = $props();

  const label = (id: MetronomeMode): string =>
    id === 'plain'
      ? m.metronome_mode_plain()
      : id === 'speed'
        ? m.metronome_mode_speed()
        : m.metronome_mode_ratios();

  let tabs: Partial<Record<MetronomeMode, HTMLButtonElement>> = $state({});

  /** Manual activation: arrows and Home/End only move focus (FR-012). */
  function onkeydown(event: KeyboardEvent): void {
    const from = METRONOME_MODES.findIndex((id) => tabs[id] === document.activeElement);
    if (from < 0) return;
    const last = METRONOME_MODES.length - 1;
    let to: number;
    if (event.key === 'ArrowRight') to = from === last ? 0 : from + 1;
    else if (event.key === 'ArrowLeft') to = from === 0 ? last : from - 1;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = last;
    else return;
    event.preventDefault();
    tabs[METRONOME_MODES[to]]?.focus();
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="mode-tabs" role="tablist" aria-label={m.metronome_modes_label()} {onkeydown}>
  {#each METRONOME_MODES as id (id)}
    <button
      type="button"
      role="tab"
      id="metronome-tab-{id}"
      class="tab"
      aria-selected={mode === id}
      aria-controls="metronome-mode-panel"
      tabindex={mode === id ? 0 : -1}
      bind:this={tabs[id]}
      onclick={() => onselect(id)}
    >
      <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {#if id === 'plain'}
          <!-- ♩ quarter note -->
          <path d="M14 3v11.3A3.5 3.5 0 1 0 16 17.5V7h3V3z" />
        {:else if id === 'speed'}
          <!-- ⚡ lightning bolt -->
          <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
        {:else}
          <!-- + -->
          <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
        {/if}
      </svg>
      <span>{label(id)}</span>
    </button>
  {/each}
</div>

<style>
  .mode-tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }

  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-inline-size: 0;
    min-block-size: var(--target-min);
    padding: var(--space-2) var(--space-3);
    font: inherit;
    font-weight: var(--font-weight-bold);
    text-align: center;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-block-end: var(--metronome-tab-underline) solid transparent;
    cursor: pointer;
  }

  .tab[aria-selected='true'] {
    color: var(--color-accent);
    border-block-end-color: var(--color-accent);
  }

  .tab:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(-1 * var(--focus-ring-width));
  }

  .tab-icon {
    flex: none;
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
    fill: currentColor;
  }

  @media (max-width: 30rem) {
    .tab-icon {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .tab[aria-selected='true'] {
      border-block-end-color: Highlight;
    }
  }
</style>
