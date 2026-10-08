<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { noteLabel } from '$lib/notation/notation';
  import { CAGED_QUALITIES, type CagedViewState } from '$lib/state/caged-view';
  import type { CagedDisplay } from '$lib/state/caged-model';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import type { Snippet } from 'svelte';
  import NoteSelector from '../NoteSelector.svelte';
  import { overflow } from '../overflow';

  interface Props {
    state: CagedViewState;
    /** The other spelling of an altered root, or null (display model `switchTo`). */
    switchTo: CagedDisplay['switchTo'];
    onroot: (pc: CagedViewState['rootPc']) => void;
    onquality: (q: CagedViewState['quality']) => void;
    onswitch: () => void;
    /** Further controls for the second row (the shape choice). */
    more?: Snippet;
  }

  let { state: view, switchTo, onroot, onquality, onswitch, more }: Props = $props();

  const qualities = CAGED_QUALITIES.map((value) => ({
    value,
    label: value === 'major' ? m.caged_quality_major() : m.caged_quality_minor()
  }));
</script>

<div class="controls">
  <NoteSelector
    selected={[view.rootPc]}
    ontoggle={onroot}
    label={m.caged_group_key()}
    layout="single"
  />
  <div class="controls-row" use:overflow>
    <ChoiceGroup
      name={m.caged_group_quality()}
      options={qualities}
      current={view.quality}
      onchoose={onquality}
    />
    {#if switchTo}
      <button type="button" class="btn" onclick={onswitch}>
        {m.caged_switch_spelling({ root: noteLabel(switchTo) })}
      </button>
    {/if}
    {@render more?.()}
  </div>
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
