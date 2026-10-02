<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { ShapeView } from '$lib/state/triads-model';

  interface Props {
    shape: ShapeView;
    /** Nearest string set on which the triad closes, or null. */
    anotherSet: number | null;
    onanotherset: () => void;
  }

  let { shape, anotherSet, onanotherset }: Props = $props();
</script>

{#if shape.kind !== 'shown'}
  <div class="guidance">
    <p>
      {shape.kind === 'beyond'
        ? m.triads_beyond_fret({ fret: shape.fretCount })
        : m.triads_does_not_close()}
    </p>
    {#if shape.kind === 'does-not-close' && anotherSet !== null}
      <button type="button" onclick={onanotherset}>{m.triads_another_set()}</button>
    {/if}
  </div>
{/if}

<style>
  .guidance {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-block-start: var(--space-2);
    color: var(--color-text);
  }

  p {
    margin: 0;
    max-inline-size: 60ch;
  }
</style>
