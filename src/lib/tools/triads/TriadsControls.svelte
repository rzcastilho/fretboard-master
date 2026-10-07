<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { setLabel, stringSets, type StringSetId } from '$lib/instrument/string-sets';
  import type { Instrument } from '$lib/instrument/instrument';
  import {
    INVERSIONS,
    QUALITIES,
    TRIADS_VIEWS,
    inversionName,
    qualityName,
    type Inversion,
    type PitchClass,
    type Quality,
    type TriadsView
  } from '$lib/state/triads-model';
  import type { TriadsViewState } from '$lib/state/triads-view';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import NoteSelector from '../NoteSelector.svelte';
  import { overflow } from '../overflow';

  interface Props {
    state: TriadsViewState;
    instrument: Instrument;
    /** Enabled flags from the display model (FR-010). */
    controls: { readonly inversion: boolean; readonly stringSet: boolean };
    onview: (v: TriadsView) => void;
    onroot: (pc: PitchClass) => void;
    onquality: (q: Quality) => void;
    oninversion: (inv: Inversion) => void;
    onstringset: (id: StringSetId) => void;
  }

  let {
    state: view,
    instrument,
    controls,
    onview,
    onroot,
    onquality,
    oninversion,
    onstringset
  }: Props = $props();

  const viewName = (v: TriadsView): string =>
    v === 'isolated'
      ? m.triads_view_isolated()
      : v === 'full-neck'
        ? m.triads_view_full_neck()
        : m.triads_view_all_notes();
  const views = $derived(TRIADS_VIEWS.map((v) => ({ value: v, label: viewName(v) })));

  const HINT_ID = 'triads-hint-all-notes';
  const anyDisabled = $derived(!controls.inversion || !controls.stringSet);

  const qualities = $derived(QUALITIES.map((q) => ({ value: q, label: qualityName(q) })));
  const inversions = $derived(INVERSIONS.map((v) => ({ value: v, label: inversionName(v) })));
  // ChoiceGroup values are strings; the set id is the lowest string number.
  const sets = $derived(
    stringSets(instrument).map((id) => ({ value: String(id), label: setLabel(id) }))
  );
</script>

<div class="controls">
  <NoteSelector
    selected={[view.rootPc]}
    ontoggle={onroot}
    label={m.triads_group_root()}
    layout="single"
  />
  <div class="controls-row" use:overflow>
    <ChoiceGroup
      name={m.triads_view_label()}
      options={views}
      current={view.view}
      onchoose={onview}
    />
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
      disabled={!controls.inversion}
      describedby={HINT_ID}
    />
    <ChoiceGroup
      name={m.triads_group_string_set()}
      options={sets}
      current={String(view.stringSet)}
      onchoose={(v) => onstringset(Number(v))}
      disabled={!controls.stringSet}
      describedby={HINT_ID}
    />
  </div>
  {#if anyDisabled}
    <p id={HINT_ID} class="hint">{m.triads_hint_all_notes()}</p>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .hint {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
