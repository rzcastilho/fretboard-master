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

<div class="field">
  <span class="label" id="{uid}-label">{m.instrument_frets_label()}</span>
  <div class="stepper">
    <button
      type="button"
      aria-label={m.instrument_frets_decrease()}
      disabled={value === MIN_FRETS}
      class="btn minus"
      onclick={() => instrument.stepFrets(-1)}
    ></button>
    <div
      class="value stepper-value"
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
      class="btn plus"
      onclick={() => instrument.stepFrets(1)}
    ></button>
  </div>
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2);
  }

  .label {
    font-weight: var(--font-weight-bold);
  }

  button,
  .value {
    display: grid;
    place-items: center;
  }

  /* Decorative glyphs live in CSS; the accessible name comes from aria-label. */
  .minus::before {
    content: '\2212';
  }

  .plus::before {
    content: '+';
  }
</style>
