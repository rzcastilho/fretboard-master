<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { qualityName, type CompareDisplay, type Quality } from '$lib/state/triads-model';
  import ChoiceGroup from '../ChoiceGroup.svelte';

  interface Props {
    compare: CompareDisplay;
    onsetcompare: (on: boolean) => void;
    oncomparequality: (q: Quality) => void;
  }

  let { compare, onsetcompare, oncomparequality }: Props = $props();

  let toggle: HTMLButtonElement | undefined = $state();
  let listEl: HTMLElement | undefined = $state();
  /** Whether focus was inside the list when it went away (so it can return to the toggle). */
  let focusInList = false;

  const options = $derived(compare.options.map((q) => ({ value: q, label: qualityName(q) })));
  const showList = $derived(compare.on && compare.quality !== null);

  $effect(() => {
    if (showList) return;
    if (focusInList) {
      focusInList = false;
      toggle?.focus();
    }
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    onsetcompare(false);
  }
</script>

{#if compare.offered}
  <div class="compare">
    <button
      type="button"
      class="toggle"
      aria-pressed={compare.on}
      bind:this={toggle}
      onclick={() => onsetcompare(!compare.on)}
    >
      {m.triads_compare_toggle()}
    </button>
    {#if showList && compare.quality !== null}
      <!-- svelte-ignore a11y_no_static_element_interactions (Escape shortcut for the radios) -->
      <div
        class="list"
        bind:this={listEl}
        onfocusin={() => (focusInList = true)}
        onfocusout={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && listEl?.contains(next)) return;
          // Focus left to another element: only a vanishing list should pull it back.
          if (next) focusInList = false;
        }}
        {onkeydown}
      >
        <ChoiceGroup
          name={m.triads_compare_group()}
          {options}
          current={compare.quality}
          onchoose={oncomparequality}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .compare {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }

  .toggle {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .toggle[aria-pressed='true'] {
    background: var(--color-surface);
    border-width: calc(var(--border-width) * 2);
    border-color: var(--color-text);
  }

  .toggle:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset, 2px);
  }

  .list {
    min-inline-size: 0;
  }
</style>
