<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { instrument } from '$lib/state/instrument.svelte';
  import { rememberOpener } from './instrument-opener';
  import { isStandard } from '$lib/instrument/tunings';
  import { tuningLabel } from './tuning-names';

  const name = $derived(tuningLabel(instrument.active.tuning));

  function open(event: MouseEvent): void {
    rememberOpener(event.currentTarget as HTMLElement);
    instrument.open();
  }
</script>

{#if !isStandard(instrument.active.tuning)}
  <button
    type="button"
    class="tuning-badge"
    aria-label={m.instrument_badge_label({ name })}
    onclick={open}>{name}</button
  >
{/if}

<style>
  .tuning-badge {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
