<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { labelPair, spellingPair, spokenPair } from '$lib/notation/notation';
  import { overflow } from './overflow';

  interface Props {
    /** Selected pitch classes (0–11, C = 0). */
    selected: readonly number[];
    ontoggle: (pc: number) => void;
    /** Group name; defaults to the Notes label. */
    label?: string;
    /**
     * `split` (default): two `.controls-row` groups of six. `single`: one row of twelve, for
     * tools whose zone B needs the second row for other controls.
     */
    layout?: 'split' | 'single';
  }

  let { selected, ontoggle, label, layout = 'split' }: Props = $props();

  // Derived so a notation or accidental change relabels the keys in place (N-1).
  const notes = $derived(
    Array.from({ length: 12 }, (_, pc) => ({
      pc,
      altered: spellingPair(pc).length > 1,
      // Preferred spelling first, joined with " / " (naturals alone).
      label: labelPair(pc),
      name: spokenPair(pc)
    }))
  );

  const SEPARATOR = ' / ';

  const rows = $derived(layout === 'split' ? [notes.slice(0, 6), notes.slice(6)] : [notes]);
</script>

<div class="selector" role="group" aria-label={label ?? m.notes_selector_label()}>
  {#each rows as row, r (r)}
    <div class="controls-row segment keys" use:overflow>
      {#each row as n (n.pc)}
        <button
          type="button"
          class="option"
          class:natural={!n.altered}
          class:altered={n.altered}
          aria-pressed={selected.includes(n.pc)}
          aria-label={n.name}
          onclick={() => ontoggle(n.pc)}
        >
          {#each n.label.split(SEPARATOR) as part, i (i)}{#if i > 0}<span class="slash"
                >{SEPARATOR}</span
              >{/if}<span class="part">{part}</span>{/each}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  /* Two groups of six share one line where there is room; on the reflow arrangement they
     stack as two rows. */
  .selector {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .selector > .controls-row {
    flex: 1 1 auto;
    gap: 0;
  }

  :global(:is([data-arrangement='reflow'] .grid, .grid[data-arrangement='reflow']))
    .selector
    > .controls-row {
    gap: var(--space-1);
  }

  :global(:is([data-arrangement='reflow'] .grid, .grid[data-arrangement='reflow'])) .selector {
    flex-direction: column;
    flex-wrap: nowrap;
  }

  /* Keys share the row's width; the floor keeps each a full touch target, so a row that cannot
     fit scrolls on its own (reflow) or wraps (elsewhere) instead of shrinking them. */
  .keys {
    align-items: stretch;
  }

  .keys button {
    flex: 1 0 var(--target-min);
  }

  /* On the reflow arrangement the two spellings of a key stack instead of wrapping unevenly. */
  :global(:is([data-arrangement='reflow'] .grid, .grid[data-arrangement='reflow'])) .keys .slash {
    display: none;
  }

  :global(:is([data-arrangement='reflow'] .grid, .grid[data-arrangement='reflow'])) .keys .part {
    display: block;
  }
</style>
