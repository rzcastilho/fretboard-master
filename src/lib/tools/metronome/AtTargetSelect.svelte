<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { AtTarget } from '$lib/state/metronome-settings';

  let { value, onchange }: { value: AtTarget; onchange: (v: unknown) => void } = $props();

  const options: { id: AtTarget; label: () => string }[] = [
    { id: 'hold', label: () => m.metronome_at_target_hold() },
    { id: 'stop', label: () => m.metronome_at_target_stop() }
  ];
</script>

<fieldset class="field">
  <legend>{m.metronome_at_target_label()}</legend>
  <div class="options">
    {#each options as o (o.id)}
      <label class="choice" data-checked={value === o.id}>
        <input
          type="radio"
          name="metronome-at-target"
          value={o.id}
          checked={value === o.id}
          onchange={() => onchange(o.id)}
        />
        <svg class="check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {#if value === o.id}<path
              d="M5 12l5 5 9-10"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            />{/if}
        </svg>
        <span>{o.label()}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  .field {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }

  legend {
    padding: 0;
    margin-block-end: var(--space-1);
    font-weight: var(--font-weight-bold);
  }

  .options {
    display: flex;
    gap: var(--space-2);
  }

  .choice {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-block-size: var(--target-min);
    padding: var(--space-2) var(--space-3);
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .choice[data-checked='true'] {
    color: var(--color-accent-text);
    background: var(--color-accent);
    border-color: var(--color-accent);
    font-weight: var(--font-weight-bold);
  }

  input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .choice:has(input:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  .check {
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
  }

  @media (forced-colors: active) {
    .choice[data-checked='true'] {
      color: HighlightText;
      background: Highlight;
      border-color: Highlight;
    }
  }
</style>
