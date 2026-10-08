<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { playback } from '$lib/state/playback.svelte';

  function stop(event: Event): void {
    const hadFocus = document.activeElement === event.currentTarget;
    playback.stop('stop');
    // The button is about to disappear: keep focus inside the app bar, never on body.
    if (hadFocus) document.querySelector<HTMLElement>('.sound .mute')?.focus();
  }
</script>

{#if playback.sequencePlaying}
  <button type="button" class="stop btn" data-print="omit" onclick={stop}>
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
    <span>{m.playback_stop()}</span>
  </button>
{/if}

<style>
  .stop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .icon {
    inline-size: var(--icon-size);
    block-size: var(--icon-size);
  }
</style>
