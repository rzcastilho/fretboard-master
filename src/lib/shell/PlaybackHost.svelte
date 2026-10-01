<script lang="ts">
  import { onMount } from 'svelte';
  import { playback } from '$lib/state/playback.svelte';

  // FR-017 / SC-007: warm the synth after the page is interactive. Never creates an AudioContext.
  onMount(() => {
    const run = () => playback.preload();
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run);
      return () => {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
      };
    }
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
  });

  // FR-013: a hidden page stops playback and never resumes it on return.
  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') playback.stop('hidden');
  }
  function onPageHide(): void {
    playback.stop('hidden');
  }
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />
<svelte:window onpagehide={onPageHide} />
