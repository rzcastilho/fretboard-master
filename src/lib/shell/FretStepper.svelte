<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { MAX_FRETS, MIN_FRETS } from '$lib/instrument/tunings';
  import { instrument } from '$lib/state/instrument.svelte';

  const uid = $props.id();
  const value = $derived(instrument.panel.open ? instrument.panel.pending.fretCount : null);

  function onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        instrument.stepFrets(1);
        break;
      case 'ArrowDown':
        instrument.stepFrets(-1);
        break;
      case 'Home':
        instrument.setFrets(MIN_FRETS);
        break;
      case 'End':
        instrument.setFrets(MAX_FRETS);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<div class="stepper">
  <span class="label" id="{uid}-label">{m.instrument_frets_label()}</span>
  <div class="controls">
    <button
      type="button"
      aria-label={m.instrument_frets_decrease()}
      disabled={value === MIN_FRETS}
      class="step minus"
      onclick={() => instrument.stepFrets(-1)}
    ></button>
    <div
      class="value"
      role="spinbutton"
      tabindex="0"
      aria-labelledby="{uid}-label"
      aria-valuemin={MIN_FRETS}
      aria-valuemax={MAX_FRETS}
      aria-valuenow={value ?? undefined}
      onkeydown={onKeyDown}
    >
      {value}
    </div>
    <button
      type="button"
      aria-label={m.instrument_frets_increase()}
      disabled={value === MAX_FRETS}
      class="step plus"
      onclick={() => instrument.stepFrets(1)}
    ></button>
  </div>
</div>

<style>
  .stepper {
    display: grid;
    gap: var(--space-2);
  }

  .label {
    font-weight: var(--font-weight-bold);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  button,
  .value {
    display: grid;
    place-items: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: var(--color-text);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
  }

  button {
    background: transparent;
    cursor: pointer;
  }

  /* Decorative glyphs live in CSS; the accessible name comes from aria-label. */
  .minus::before {
    content: '\2212';
  }

  .plus::before {
    content: '+';
  }

  button:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .value {
    background: var(--color-surface-raised);
    font-weight: var(--font-weight-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
