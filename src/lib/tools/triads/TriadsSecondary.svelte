<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { TriadsLabelType } from '$lib/state/triads-view';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import { shortcuts } from '$lib/state/shortcuts.svelte';

  interface Props {
    labelType: TriadsLabelType;
    onlabeltype: (t: TriadsLabelType) => void;
    octave: { readonly up: boolean; readonly down: boolean; readonly applies: boolean };
    onoctaveup: () => void;
    onoctavedown: () => void;
    listen: { readonly enabled: boolean };
    onlisten: () => void;
    viewInCaged?: { readonly enabled: boolean };
    onviewincaged?: () => void;
    compareOn?: boolean;
    listenComparison?: { readonly enabled: boolean };
    onlistencomparison?: () => void;
    onreset: () => void;
  }

  let {
    labelType,
    onlabeltype,
    octave,
    onoctaveup,
    onoctavedown,
    listen,
    onlisten,
    viewInCaged = { enabled: true },
    onviewincaged = () => {},
    compareOn = false,
    listenComparison = { enabled: false },
    onlistencomparison = () => {},
    onreset
  }: Props = $props();

  const labels = $derived<readonly { value: TriadsLabelType; label: string }[]>([
    { value: 'interval', label: m.triads_label_intervals() },
    { value: 'name', label: m.triads_label_note_names() }
  ]);

  const HINT_ID = 'triads-hint-octave';
  const CAGED_NOTE_ID = 'triads-view-in-caged-unavailable';
  const canDown = $derived(octave.applies && octave.down);
  const canUp = $derived(octave.applies && octave.up);
</script>

<div class="secondary">
  <ChoiceGroup
    name={m.triads_group_labels()}
    options={labels}
    current={labelType}
    onchoose={onlabeltype}
    keyshortcuts={shortcuts.enabled ? 'L' : undefined}
  />
  <!-- aria-disabled (not disabled) keeps the commands focusable and visible at the ends. -->
  <button
    type="button"
    aria-disabled={!canDown}
    aria-describedby={octave.applies ? undefined : HINT_ID}
    onclick={() => {
      if (canDown) onoctavedown();
    }}
  >
    {m.triads_octave_down()}
  </button>
  <button
    type="button"
    aria-disabled={!canUp}
    aria-describedby={octave.applies ? undefined : HINT_ID}
    onclick={() => {
      if (canUp) onoctaveup();
    }}
  >
    {m.triads_octave_up()}
  </button>
  {#if !octave.applies}
    <span id={HINT_ID} class="hint">{m.triads_hint_octave_isolated()}</span>
  {/if}
  <button
    type="button"
    aria-disabled={!listen.enabled}
    aria-keyshortcuts={shortcuts.enabled ? 'P' : undefined}
    onclick={() => {
      if (listen.enabled) onlisten();
    }}
  >
    {m.triads_listen()}
  </button>
  <button
    type="button"
    aria-disabled={!viewInCaged.enabled}
    aria-describedby={viewInCaged.enabled ? undefined : CAGED_NOTE_ID}
    onclick={() => {
      if (viewInCaged.enabled) onviewincaged();
    }}
  >
    {m.triads_view_in_caged()}
  </button>
  {#if !viewInCaged.enabled}
    <span id={CAGED_NOTE_ID} class="hint">{m.triads_view_in_caged_unavailable()}</span>
  {/if}
  {#if compareOn}
    <button
      type="button"
      aria-disabled={!listenComparison.enabled}
      onclick={() => {
        if (listenComparison.enabled) onlistencomparison();
      }}
    >
      {m.triads_compare_listen()}
    </button>
  {/if}
  <button type="button" onclick={() => onreset()}>{m.triads_reset()}</button>
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

  .hint {
    color: var(--color-text-muted);
  }

  button[aria-disabled='true'] {
    color: var(--color-disabled-text);
    border-color: var(--color-disabled-border);
    opacity: var(--disabled-opacity);
    cursor: not-allowed;
  }
</style>
