<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { TriadsLabelType } from '$lib/state/triads-view';
  import ChoiceGroup from '../ChoiceGroup.svelte';

  interface Props {
    labelType: TriadsLabelType;
    onlabeltype: (t: TriadsLabelType) => void;
    octave: { readonly up: boolean; readonly down: boolean };
    onoctaveup: () => void;
    onoctavedown: () => void;
    listen: { readonly enabled: boolean };
    onlisten: () => void;
  }

  let { labelType, onlabeltype, octave, onoctaveup, onoctavedown, listen, onlisten }: Props =
    $props();

  const labels = $derived<readonly { value: TriadsLabelType; label: string }[]>([
    { value: 'interval', label: m.triads_label_intervals() },
    { value: 'name', label: m.triads_label_note_names() }
  ]);
</script>

<div class="secondary">
  <ChoiceGroup
    name={m.triads_group_labels()}
    options={labels}
    current={labelType}
    onchoose={onlabeltype}
  />
  <!-- aria-disabled (not disabled) keeps the commands focusable and visible at the ends. -->
  <button
    type="button"
    aria-disabled={!octave.down}
    onclick={() => {
      if (octave.down) onoctavedown();
    }}
  >
    {m.triads_octave_down()}
  </button>
  <button
    type="button"
    aria-disabled={!octave.up}
    onclick={() => {
      if (octave.up) onoctaveup();
    }}
  >
    {m.triads_octave_up()}
  </button>
  <button
    type="button"
    aria-disabled={!listen.enabled}
    onclick={() => {
      if (listen.enabled) onlisten();
    }}
  >
    {m.triads_listen()}
  </button>
</div>

<style>
  .secondary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  button {
    min-block-size: var(--touch-target-min, 44px);
    padding: var(--space-2) var(--space-3);
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    font: inherit;
    cursor: pointer;
  }

  button[aria-disabled='true'] {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
