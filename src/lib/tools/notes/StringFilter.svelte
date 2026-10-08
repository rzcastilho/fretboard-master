<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Instrument } from '$lib/instrument/instrument';
  import { noteLabel, stringSpelling } from '$lib/notation/notation';

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
      const note = noteLabel(stringSpelling(instrument.openStrings[k], instrument.fixedSpelling));
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
      class="option"
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
</style>
