<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { CagedTriadDisplay } from '$lib/state/caged-model';
  import ChoiceGroup from '../ChoiceGroup.svelte';

  /** Triad string-set selector and summary (018 US1); mounted only while a triad can be shown. */
  interface Props {
    triad: CagedTriadDisplay;
    onselect: (set: number) => void;
    onopen?: () => void;
  }
  let { triad, onselect, onopen }: Props = $props();

  const NOTE_ID = 'caged-triad-none';

  // Unavailable sets stay keyboard-reachable and point at the one visible note.
  const options = $derived(
    triad.sets.map((s) => ({
      value: String(s.id),
      label: s.available ? s.label : `${s.label} ✕`,
      ariaLabel: s.available ? undefined : s.ariaLabel,
      disabled: !s.available,
      describedby: s.available ? undefined : NOTE_ID
    }))
  );
</script>

<div class="triad-sets">
  <ChoiceGroup
    name={m.caged_triad_sets()}
    {options}
    current={triad.selected === null ? '' : String(triad.selected)}
    onchoose={(value) => onselect(Number(value))}
    reachDisabled
  />
  {#if triad.unavailableNote}
    <p id={NOTE_ID} class="note">{triad.unavailableNote}</p>
  {/if}
  {#if triad.summary}
    <p class="summary">{triad.summary}</p>
  {/if}
  {#if triad.handoff !== null && onopen}
    <button type="button" class="open-triads" onclick={onopen}>{m.caged_triad_open()}</button>
  {/if}
</div>

<style>
  .triad-sets {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-block-end: var(--space-3);
  }

  .note {
    margin: 0;
    color: var(--color-text);
  }

  .summary {
    margin: 0;
    font-weight: 600;
  }

  .open-triads {
    align-self: flex-start;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
  }
</style>
