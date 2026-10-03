<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import InstrumentPanel from '$lib/shell/InstrumentPanel.svelte';
  import { SCREENS } from '$lib/shell/screens';
  import PlaybackHost from '$lib/shell/PlaybackHost.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import ShellFailure from '$lib/shell/ShellFailure.svelte';
  import { recordFailure } from '$lib/shell/failure';
  import '$lib/styles/tokens.css';
  import '$lib/styles/global.css';

  let { children } = $props();

  const screen = $derived(SCREENS.find((s) => s.path === page.url.pathname)?.id ?? 'home');

  // FR-013: leaving a screen stops playback.
  // Shallow pops (instrument panel Back) keep the same path and are not screen changes.
  beforeNavigate(({ from, to }) => {
    if (from && to && from.url.pathname === to.url.pathname) return;
    playback.stop('navigate');
    instrument.screenChanged();
  });

  // R-07: after any in-app navigation, move focus to the screen heading (not on initial load).
  afterNavigate(({ type, from, to }) => {
    if (type === 'enter') return;
    if (from && to && from.url.pathname === to.url.pathname) return;
    document.querySelector<HTMLElement>('h1')?.focus();
  });
</script>

<PlaybackHost />
<InstrumentPanel {screen} />
<svelte:boundary onerror={(error) => recordFailure(null, error)}>
  {@render children()}
  {#snippet failed(_error, reset)}
    <main>
      <ShellFailure {reset} />
    </main>
  {/snippet}
</svelte:boundary>
