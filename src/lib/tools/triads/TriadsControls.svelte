<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { setLabel, stringSets, type StringSetId } from '$lib/instrument/string-sets';
  import type { Instrument } from '$lib/instrument/instrument';
  import {
    INVERSIONS,
    QUALITIES,
    inversionName,
    qualityName,
    type Inversion,
    type PitchClass,
    type Quality
  } from '$lib/state/triads-model';
  import type { TriadsViewState } from '$lib/state/triads-view';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import NoteSelector from '../NoteSelector.svelte';

  interface Props {
    state: TriadsViewState;
    instrument: Instrument;
    onroot: (pc: PitchClass) => void;
    onquality: (q: Quality) => void;
    oninversion: (inv: Inversion) => void;
    onstringset: (id: StringSetId) => void;
  }

  let { state: view, instrument, onroot, onquality, oninversion, onstringset }: Props = $props();

  const qualities = $derived(QUALITIES.map((q) => ({ value: q, label: qualityName(q) })));
  const inversions = $derived(INVERSIONS.map((v) => ({ value: v, label: inversionName(v) })));
  // ChoiceGroup values are strings; the set id is the lowest string number.
  const sets = $derived(
    stringSets(instrument).map((id) => ({ value: String(id), label: setLabel(id) }))
  );
</script>

<div class="controls">
  <NoteSelector selected={[view.rootPc]} ontoggle={onroot} label={m.triads_group_root()} />
  <ChoiceGroup
    name={m.triads_group_quality()}
    options={qualities}
    current={view.quality}
    onchoose={onquality}
  />
  <ChoiceGroup
    name={m.triads_group_inversion()}
    options={inversions}
    current={view.inversion}
    onchoose={oninversion}
  />
  <ChoiceGroup
    name={m.triads_group_string_set()}
    options={sets}
    current={String(view.stringSet)}
    onchoose={(v) => onstringset(Number(v))}
  />
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Narrow (design §5.1): each option group is one row; what does not fit scrolls as a strip,
     so the fretboard stays the largest zone (FR-005 of 001). */
  @media (max-width: 599px) {
    .controls :global([role='radiogroup']) {
      flex-wrap: nowrap;
      overflow-x: auto;
      white-space: nowrap;
    }

    .controls :global([role='radiogroup'] > *) {
      flex: none;
    }

    /* The group name stays put while its options scroll beneath it. */
    .controls :global([role='radiogroup'] > .name) {
      position: sticky;
      inset-inline-start: 0;
      z-index: 1;
      align-self: stretch;
      display: flex;
      align-items: center;
      padding-inline-end: var(--space-2);
      background: var(--color-surface-raised);
    }
  }
</style>
