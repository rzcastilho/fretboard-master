<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Region, RegionShortcut } from '$lib/state/notes-view';

  interface Props {
    fretCount: number;
    region: Region;
    onstart: (fret: number) => void;
    onend: (fret: number) => void;
    onshortcut: (key: RegionShortcut) => void;
  }

  let { fretCount, region, onstart, onend, onshortcut }: Props = $props();

  const shortcuts = $derived<
    readonly { key: RegionShortcut; label: string; start: number; end: number }[]
  >([
    { key: '0-4', label: m.notes_region_shortcut_0_4(), start: 0, end: Math.min(4, fretCount) },
    {
      key: '5-9',
      label: m.notes_region_shortcut_5_9(),
      start: Math.min(5, fretCount),
      end: Math.min(9, fretCount)
    },
    {
      key: '10-14',
      label: m.notes_region_shortcut_10_14(),
      start: Math.min(10, fretCount),
      end: Math.min(14, fretCount)
    },
    { key: 'whole', label: m.notes_region_whole(), start: 0, end: fretCount }
  ]);

  const STEP: Readonly<Record<string, number>> = {
    ArrowUp: 1,
    ArrowRight: 1,
    ArrowDown: -1,
    ArrowLeft: -1,
    PageUp: 5,
    PageDown: -5
  };

  function onkey(e: KeyboardEvent, value: number, set: (v: number) => void) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let next: number | undefined;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = fretCount;
    else if (e.key in STEP) next = value + STEP[e.key];
    if (next === undefined) return;
    e.preventDefault();
    set(Math.min(fretCount, Math.max(0, next)));
  }
</script>

{#snippet stepper(
  value: number,
  name: string,
  lower: string,
  raise: string,
  set: (v: number) => void
)}
  <div class="stepper">
    <button type="button" aria-label={lower} onclick={() => set(value - 1)}
      >{m.notes_region_minus_glyph()}</button
    >
    <div
      class="value"
      role="spinbutton"
      tabindex="0"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={fretCount}
      aria-valuenow={value}
      onkeydown={(e) => onkey(e, value, set)}
    >
      {value}
    </div>
    <button type="button" aria-label={raise} onclick={() => set(value + 1)}
      >{m.notes_region_plus_glyph()}</button
    >
  </div>
{/snippet}

<div class="region" role="group" aria-label={m.notes_region_group()}>
  <div class="steppers">
    {@render stepper(
      region.start,
      m.notes_region_start(),
      m.notes_region_start_lower(),
      m.notes_region_start_raise(),
      onstart
    )}
    {@render stepper(
      region.end,
      m.notes_region_end(),
      m.notes_region_end_lower(),
      m.notes_region_end_raise(),
      onend
    )}
  </div>
  <div class="shortcuts">
    {#each shortcuts as sc (sc.key)}
      <button
        type="button"
        aria-pressed={region.start === sc.start && region.end === sc.end}
        onclick={() => onshortcut(sc.key)}
      >
        {sc.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .region,
  .steppers,
  .shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .region {
    flex-direction: column;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .value {
    display: grid;
    place-items: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-2);
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
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

  .shortcuts button[aria-pressed='true'] {
    background: var(--color-accent);
    color: var(--color-accent-text);
  }
</style>
