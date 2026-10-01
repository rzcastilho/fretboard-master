<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
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

  const NEXT: Readonly<Record<string, number>> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1
  };

  // Roving tabindex: arrows move focus and select (wrapping); Tab is left alone.
  function onkey<T extends string>(
    e: KeyboardEvent,
    options: readonly { value: T }[],
    current: T,
    choose: (v: T) => void
  ) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const index = options.findIndex((o) => o.value === current);
    let next: number;
    if (e.key in NEXT) next = (index + NEXT[e.key] + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    choose(options[next].value);
    const radios = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="radio"]'
    );
    radios?.[next]?.focus();
  }
</script>

{#snippet group<T extends string>(
  name: string,
  options: readonly { value: T; label: string }[],
  current: T,
  choose: (v: T) => void
)}
  <div class="group" role="radiogroup" aria-label={name}>
    <span class="name" aria-hidden="true">{name}</span>
    {#each options as o (o.value)}
      <button
        type="button"
        role="radio"
        aria-checked={current === o.value}
        tabindex={current === o.value ? 0 : -1}
        onclick={() => choose(o.value)}
        onkeydown={(e) => onkey(e, options, current, choose)}
      >
        {o.label}
      </button>
    {/each}
  </div>
{/snippet}

<div class="actions">
  {@render group(m.notes_show_group(), shows, background, onbackground)}
  {@render group(m.notes_label_group(), labels, labelType, onlabeltype)}
  <div class="group">
    <button type="button" aria-pressed={hideNames} onclick={() => onhidenames(!hideNames)}>
      {m.notes_hide_names()}
    </button>
    <!-- aria-disabled (not disabled) keeps Listen focusable so the reason can be read. -->
    <button
      type="button"
      aria-disabled={!listen.enabled}
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

  .name {
    font-weight: 600;
    color: var(--color-text);
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

  button[aria-checked='true'],
  button[aria-pressed='true'] {
    background: var(--color-note-highlight);
    color: var(--color-note-highlight-label);
  }
</style>
