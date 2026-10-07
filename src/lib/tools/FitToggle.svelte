<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { fit } from '$lib/state/fit.svelte';
</script>

{#if fit.available}
  <button
    type="button"
    class="fit-toggle"
    aria-pressed={fit.effective === 'whole'}
    onclick={() => fit.toggle()}>{m.fit_to_screen()}</button
  >
{/if}

<style>
  .fit-toggle {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .fit-toggle[aria-pressed='true'] {
    background: var(--color-note-highlight);
    color: var(--color-note-highlight-label);
  }
</style>
