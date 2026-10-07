<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import { shortcuts } from '$lib/state/shortcuts.svelte';
  import type { ListenState } from '$lib/state/notes-model';
  import type { Background, LabelType } from '$lib/state/notes-view';

  interface Props {
    background: Background;
    labelType: LabelType;
    onbackground: (b: Background) => void;
    onlabeltype: (t: LabelType) => void;
    hideNames: boolean;
    listen: ListenState;
    onhidenames: (on: boolean) => void;
    onlisten: () => void;
    onclear: () => void;
    onreset: () => void;
  }

  let {
    background,
    labelType,
    onbackground,
    onlabeltype,
    hideNames,
    listen,
    onhidenames,
    onlisten,
    onclear,
    onreset
  }: Props = $props();

  const listenReason = $derived(
    listen.enabled
      ? null
      : listen.reason === 'none'
        ? m.notes_listen_reason_none()
        : listen.reason === 'too-many'
          ? m.notes_listen_reason_too_many()
          : m.notes_listen_reason_no_positions()
  );

  const shows = $derived<readonly { value: Background; label: string }[]>([
    { value: 'naturals', label: m.notes_show_naturals() },
    { value: 'all', label: m.notes_show_all() },
    { value: 'none', label: m.notes_show_none() }
  ]);
  const labels = $derived<readonly { value: LabelType; label: string }[]>([
    { value: 'name', label: m.notes_label_name() },
    { value: 'octave', label: m.notes_label_octave() },
    { value: 'none', label: m.notes_label_none() }
  ]);
</script>

<div class="actions">
  <ChoiceGroup
    name={m.notes_show_group()}
    options={shows}
    current={background}
    onchoose={onbackground}
  />
  <ChoiceGroup
    name={m.notes_label_group()}
    options={labels}
    current={labelType}
    onchoose={onlabeltype}
    keyshortcuts={shortcuts.enabled ? 'L' : undefined}
  />
  <div class="group">
    <button type="button" aria-pressed={hideNames} onclick={() => onhidenames(!hideNames)}>
      {m.notes_hide_names()}
    </button>
    <!-- aria-disabled (not disabled) keeps Listen focusable so the reason can be read. -->
    <button
      type="button"
      aria-disabled={!listen.enabled}
      aria-keyshortcuts={shortcuts.enabled ? 'P' : undefined}
      aria-describedby={listenReason === null ? undefined : 'notes-listen-reason'}
      onclick={() => {
        if (listen.enabled) onlisten();
      }}
    >
      {m.notes_listen()}
    </button>
    {#if listenReason !== null}
      <span id="notes-listen-reason" class="reason">{listenReason}</span>
    {/if}
    <button type="button" onclick={onclear}>{m.notes_clear()}</button>
    <button type="button" onclick={onreset}>{m.notes_reset()}</button>
  </div>
</div>

<style>
  .actions,
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button[aria-disabled='true'] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reason {
    flex-basis: 100%;
    font-size: var(--font-size-sm, 0.875em);
    color: var(--color-text);
  }

  button[aria-pressed='true'] {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }
</style>
