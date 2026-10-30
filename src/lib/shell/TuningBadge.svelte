<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { caged } from '$lib/state/caged.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { rememberOpener } from './instrument-opener';
  import { isStandard } from '$lib/instrument/tunings';
  import { tuningLabel } from './tuning-names';
  import type { FretboardToolId } from './tools';

  let { tool }: { tool: FretboardToolId } = $props();

  // The tool's own tuning: the received link's while an override is active (023 §2).
  const tuning = $derived(instrument.effectiveFor(tool).tuning);
  const name = $derived(tuningLabel(tuning));
  const temporaryName = $derived(caged.temporaryName);

  function open(event: MouseEvent): void {
    rememberOpener(event.currentTarget as HTMLElement);
    instrument.open();
  }
</script>

{#if temporaryName !== null}
  <button
    type="button"
    class="tuning-badge btn"
    aria-label={m.caged_temporary_badge_label({ name: temporaryName })}
    onclick={open}>{m.caged_temporary_badge({ name: temporaryName })}</button
  >
{:else if !isStandard(tuning)}
  <button
    type="button"
    class="tuning-badge btn"
    aria-label={m.instrument_badge_label({ name })}
    onclick={open}>{name}</button
  >
{/if}
