<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { DetectedTriad } from '$lib/state/notes-model';

  interface Props {
    detected: DetectedTriad | null;
    onview: () => void;
  }

  let { detected, onview }: Props = $props();
</script>

{#if detected}
  <div class="detected">
    <p id="notes-detected-triad">
      <span aria-hidden="true">{detected.name}</span>
      <span class="sr-only">{detected.spokenName}</span>
    </p>
    <button type="button" aria-describedby="notes-detected-triad" onclick={onview}>
      {m.notes_view_as_triad()}
    </button>
  </div>
{/if}

<style>
  .detected {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-block-start: var(--space-3);
  }

  p {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 600;
    min-inline-size: 0;
    overflow-wrap: anywhere;
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
    border: 0;
  }

  button {
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
</style>
