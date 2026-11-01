<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { PlainSettings } from '$lib/state/metronome-settings';
  import ValueRow from './ValueRow.svelte';

  let {
    settings,
    onswitch,
    oninitialset,
    oninitialstep,
    onrepeatset,
    onrepeatstep,
    repeat = true
  }: {
    settings: Readonly<PlainSettings & { repeatCountIn?: number }>;
    onswitch: (on: boolean) => void;
    oninitialset: (v: number) => void;
    oninitialstep: (dir: 1 | -1) => void;
    onrepeatset: (v: number) => void;
    onrepeatstep: (dir: 1 | -1) => void;
    repeat?: boolean;
  } = $props();
</script>

<div class="count-in">
  <button
    type="button"
    class="switch"
    role="switch"
    aria-checked={settings.countIn}
    onclick={() => onswitch(!settings.countIn)}
  >
    <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
    {m.metronome_count_in_label()}
    <span class="state" aria-hidden="true"
      >{settings.countIn ? m.metronome_switch_on() : m.metronome_switch_off()}</span
    >
  </button>
  {#if settings.countIn}
    <ValueRow
      id="metronome-initial-count-in"
      label={m.metronome_initial_count_in_label()}
      min={0}
      max={8}
      value={settings.initialCountIn}
      valuetext={String(settings.initialCountIn)}
      decreaseLabel={m.metronome_initial_count_in_decrease()}
      increaseLabel={m.metronome_initial_count_in_increase()}
      onset={oninitialset}
      onstep={oninitialstep}
    />
    {#if repeat}
      <ValueRow
        id="metronome-repeat-count-in"
        label={m.metronome_repeat_count_in_label()}
        min={0}
        max={8}
        value={settings.repeatCountIn ?? 0}
        valuetext={String(settings.repeatCountIn ?? 0)}
        decreaseLabel={m.metronome_repeat_count_in_decrease()}
        increaseLabel={m.metronome_repeat_count_in_increase()}
        onset={onrepeatset}
        onstep={onrepeatstep}
      />
    {/if}
  {/if}
</div>

<style>
  .count-in {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .switch {
    align-self: flex-start;
    text-align: start;
    flex-wrap: wrap;
  }
</style>
