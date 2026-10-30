<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { MetronomeSettings } from '$lib/state/metronome-settings';
  import SubdivisionSelect from './SubdivisionSelect.svelte';

  let {
    settings,
    onswitch,
    onloop1,
    onloop2
  }: {
    settings: Readonly<MetronomeSettings>;
    onswitch: (on: boolean) => void;
    onloop1: (v: unknown) => void;
    onloop2: (v: unknown) => void;
  } = $props();
</script>

<div class="ratio">
  <div class="ratio-header">
    <h3 id="metronome-ratio-heading">{m.metronome_ratio_heading()}</h3>
    <button
      type="button"
      class="switch"
      role="switch"
      aria-checked={settings.ratio}
      aria-labelledby="metronome-ratio-heading"
      onclick={() => onswitch(!settings.ratio)}
    >
      <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
      <span class="state" aria-hidden="true"
        >{settings.ratio ? m.metronome_switch_on() : m.metronome_switch_off()}</span
      >
    </button>
  </div>
  <SubdivisionSelect
    id="metronome-subdivision"
    label={m.metronome_subdivision_label()}
    value={settings.subdivision}
    onchange={onloop1}
  />
  {#if settings.ratio}
    <SubdivisionSelect
      id="metronome-loop2"
      label={m.metronome_loop2_label()}
      value={settings.loop2}
      onchange={onloop2}
    />
  {/if}
</div>

<style>
  .ratio {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .ratio-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    font-variant-caps: all-small-caps;
  }
</style>
