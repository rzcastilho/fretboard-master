<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { instrument } from '$lib/state/instrument.svelte';
  import { rememberOpener } from './instrument-opener';
  import BarIcon from './BarIcon.svelte';

  function open(event: MouseEvent): void {
    rememberOpener(event.currentTarget as HTMLElement);
    instrument.open();
  }
</script>

<button type="button" class="instrument-button link-button" data-print="omit" onclick={open}
  ><BarIcon name="instrument" /><span class="bar-label">{m.instrument_button()}</span></button
>
