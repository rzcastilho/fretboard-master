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
    <button type="button" class="btn" aria-describedby="notes-detected-triad" onclick={onview}>
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
    font-weight: var(--font-weight-medium);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
</style>
