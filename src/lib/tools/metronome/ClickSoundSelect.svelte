<script lang="ts">
  import { CLICK_SOUNDS, type ClickSound } from '$lib/audio/click';
  import { m } from '$lib/paraglide/messages.js';
  import { metronome } from '$lib/state/metronome.svelte';

  const names: Record<ClickSound, () => string> = {
    click: () => m.metronome_sound_click(),
    wood: () => m.metronome_sound_wood(),
    beep: () => m.metronome_sound_beep(),
    rim: () => m.metronome_sound_rim(),
    cowbell: () => m.metronome_sound_cowbell()
  };
</script>

<div class="field">
  <label for="metronome-sound">{m.metronome_sound_label()}</label>
  <div class="control">
    <select
      id="metronome-sound"
      value={metronome.sound}
      onchange={(e) => metronome.setSound(e.currentTarget.value)}
    >
      {#each CLICK_SOUNDS as sound (sound)}
        <option value={sound} selected={sound === metronome.sound}>{names[sound]()}</option>
      {/each}
    </select>
    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  </div>
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  label {
    font-weight: var(--font-weight-bold);
  }

  .control {
    position: relative;
    display: flex;
    align-items: center;
  }

  select {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--target-min);
    padding: var(--space-2) var(--space-6) var(--space-2) var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    appearance: none;
  }

  .chevron {
    position: absolute;
    inset-inline-end: var(--space-2);
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
    color: var(--color-text);
    pointer-events: none;
  }

  @media (forced-colors: active) {
    select {
      appearance: auto;
    }

    .chevron {
      display: none;
    }
  }
</style>
