<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { noteLabel } from '$lib/notation/notation';
  import { CAGED_QUALITIES, type CagedViewState } from '$lib/state/caged-view';
  import type { CagedDisplay } from '$lib/state/caged-model';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import NoteSelector from '../NoteSelector.svelte';

  interface Props {
    state: CagedViewState;
    /** The other spelling of an altered root, or null (display model `switchTo`). */
    switchTo: CagedDisplay['switchTo'];
    onroot: (pc: CagedViewState['rootPc']) => void;
    onquality: (q: CagedViewState['quality']) => void;
    onswitch: () => void;
  }

  let { state: view, switchTo, onroot, onquality, onswitch }: Props = $props();

  const qualities = CAGED_QUALITIES.map((value) => ({
    value,
    label: value === 'major' ? m.caged_quality_major() : m.caged_quality_minor()
  }));
</script>

<div class="controls">
  <NoteSelector selected={[view.rootPc]} ontoggle={onroot} label={m.caged_group_key()} />
  <ChoiceGroup
    name={m.caged_group_quality()}
    options={qualities}
    current={view.quality}
    onchoose={onquality}
  />
  {#if switchTo}
    <button type="button" class="switch" onclick={onswitch}>
      {m.caged_switch_spelling({ root: noteLabel(switchTo) })}
    </button>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .switch {
    align-self: start;
    min-block-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
