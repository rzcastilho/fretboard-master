<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Instrument } from '$lib/instrument/instrument';
  import { noteLabel } from '$lib/notation/notation';

  interface Props {
    instrument: Instrument;
    /** Active strings, ascending. */
    active: readonly number[];
    ontoggle: (string: number) => void;
  }

  let { instrument, active, ontoggle }: Props = $props();

  const strings = $derived(
    Array.from({ length: instrument.stringCount }, (_, k) => {
      const string = k + 1;
      const note = noteLabel(instrument.openStrings[k]);
      return { string, note };
    })
  );
  const lastOnly = $derived(active.length === 1 ? active[0] : null);
</script>

<div class="strings" role="group" aria-label={m.notes_strings_group()}>
  {#each strings as s (s.string)}
    {@const locked = lastOnly === s.string}
    <button
      type="button"
      aria-pressed={active.includes(s.string)}
      aria-disabled={locked ? 'true' : undefined}
      aria-describedby={locked ? 'notes-strings-last' : undefined}
      aria-label={m.notes_strings_name({ string: s.string, note: s.note })}
      onclick={() => {
        if (!locked) ontoggle(s.string);
      }}
    >
      {m.notes_strings_label({ string: s.string, note: s.note })}
    </button>
  {/each}
  <span id="notes-strings-last" class="sr-only">{m.notes_strings_last()}</span>
</div>

<style>
  .strings {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1) var(--space-2);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) dashed var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--color-note-highlight);
    color: var(--color-note-highlight-label);
    border-style: solid;
  }

  button[aria-disabled='true'] {
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
