<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { instrument } from '$lib/state/instrument.svelte';
  import { rememberOpener } from './instrument-opener';
  import { isStandard } from '$lib/instrument/tunings';
  import { tuningLabel } from './tuning-names';

  const handedness = $derived(
    instrument.active.handedness === 'left'
      ? m.instrument_handedness_left()
      : m.instrument_handedness_right()
  );
  const text = $derived(
    isStandard(instrument.active.tuning)
      ? m.instrument_summary_standard({ count: instrument.active.stringCount, handedness })
      : m.instrument_summary_preset({
          count: instrument.active.stringCount,
          name: tuningLabel(instrument.active.tuning),
          handedness
        })
  );

  function open(event: MouseEvent): void {
    rememberOpener(event.currentTarget as HTMLElement);
    instrument.open();
  }
</script>

<button type="button" class="instrument-summary" onclick={open}>{text}</button>

<style>
  .instrument-summary {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-2) var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    overflow-wrap: anywhere;
    text-align: start;
  }
</style>
