<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import InstrumentPanel from '$lib/shell/InstrumentPanel.svelte';
  import { SCREENS } from '$lib/shell/screens';
  import PlaybackHost from '$lib/shell/PlaybackHost.svelte';
  import PrefsNotice from '$lib/shell/PrefsNotice.svelte';
  import { cancelAddress } from '$lib/state/address.svelte';
  import { caged } from '$lib/state/caged.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import { preferences } from '$lib/state/preferences.svelte';
  import { TOOLS } from '$lib/shell/tools';
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
    cancelAddress();
    playback.stop('navigate');
    instrument.screenChanged();
    caged.screenChanged();
    preferences.screenChanged();
  });

  // R-07: after any in-app navigation, move focus to the screen heading (not on initial load).
  afterNavigate(({ type, from, to }) => {
    // FR-014: remember the last tool opened by any route; Home, About and 404 never match.
    const tool = TOOLS.find((t) => t.path === page.url.pathname);
    if (tool && !(from && to && from.url.pathname === to.url.pathname && type !== 'enter')) {
      preferences.toolOpened(tool.id);
    }
    if (type === 'enter') return;
    if (from && to && from.url.pathname === to.url.pathname) return;
    document.querySelector<HTMLElement>('h1')?.focus();
  });
</script>

<PlaybackHost />
<InstrumentPanel {screen} />
<svelte:boundary onerror={(error) => recordFailure(null, error)}>
  <PrefsNotice />
  {@render children()}
  {#snippet failed(_error, reset)}
    <main>
      <ShellFailure {reset} />
    </main>
  {/snippet}
</svelte:boundary>
