<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import InstrumentPanel from '$lib/shell/InstrumentPanel.svelte';
  import { SCREENS } from '$lib/shell/screens';
  import PlaybackHost from '$lib/shell/PlaybackHost.svelte';
  import PrefsNotice from '$lib/shell/PrefsNotice.svelte';
  import { cancelAddress } from '$lib/state/address.svelte';
  import { caged } from '$lib/state/caged.svelte';
  import { metronome } from '$lib/state/metronome.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { opening } from '$lib/state/opening.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import { print } from '$lib/state/print.svelte';
  import { startViewport } from '$lib/state/viewport.svelte';
  import { onMount } from 'svelte';
  import { preferences } from '$lib/state/preferences.svelte';
  import { matchShortcut, toShortcutEvent } from '$lib/state/shortcuts';
  import { runShortcut, shortcuts } from '$lib/state/shortcuts.svelte';
  import { TOOLS } from '$lib/shell/tools';
  import ShellFailure from '$lib/shell/ShellFailure.svelte';
  import { recordFailure } from '$lib/shell/failure';
  import '$lib/styles/tokens.css';
  import '$lib/styles/global.css';
  import '$lib/styles/controls.css';

  let { children } = $props();

  onMount(() => print.start());
  // 025: track the window so `data-arrangement` and the bar's `data-compact` follow it. Absent at
  // prerender (media-query fallback in tokens.css), written once mounted.
  onMount(() => startViewport());

  const screen = $derived(SCREENS.find((s) => s.path === page.url.pathname)?.id ?? 'home');

  // FR-013: leaving a screen stops playback.
  // Shallow pops (instrument panel Back) keep the same path and are not screen changes.
  beforeNavigate(({ from, to }) => {
    if (from && to && from.url.pathname === to.url.pathname) return;
    cancelAddress();
    playback.stop('navigate');
    instrument.screenChanged();
    opening.screenChanged();
    caged.screenChanged();
    metronome.screenChanged();
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
    // R-15: a hash link (About#privacy) focuses its section heading instead of the h1.
    const hash = to?.url.hash.slice(1);
    const target = hash ? document.getElementById(hash) : null;
    const heading = target?.querySelector<HTMLElement>('h2') ?? null;
    if (heading) {
      // SvelteKit resets the focus start point in a `setTimeout` for deep links; run after it.
      setTimeout(() => heading.focus({ preventScroll: true }));
      return;
    }
    document.querySelector<HTMLElement>('h1')?.focus();
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (!shortcuts.enabled) return;
    const action = matchShortcut(toShortcutEvent(e));
    if (action && runShortcut(action, screen)) e.preventDefault();
  }}
/>
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
