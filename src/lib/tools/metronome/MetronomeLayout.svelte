<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import AppNav from '$lib/shell/AppNav.svelte';
  import FailureView from '$lib/shell/FailureView.svelte';
  import LanguagePanel from '$lib/shell/LanguagePanel.svelte';
  import SoundControl from '$lib/shell/SoundControl.svelte';
  import { recordFailure } from '$lib/shell/failure';
  import { screenTitle } from '$lib/shell/screens';
  import { TOOLS } from '$lib/shell/tools';
  import { metronome } from '$lib/state/metronome.svelte';
  import MetronomePanel from './MetronomePanel.svelte';

  const name = TOOLS.find((t) => t.id === 'metronome')?.name() ?? '';

  onDestroy(() => metronome.screenChanged());
</script>

<svelte:head>
  <title>{screenTitle('metronome')}</title>
</svelte:head>

<header class="app-bar" aria-label={m.zone_app_bar()}>
  <AppNav current="metronome" />
  <div class="bar-tools">
    <SoundControl />
    <LanguagePanel />
  </div>
</header>

<main>
  <h1 tabindex="-1" data-print="show">{name}</h1>
  <svelte:boundary onerror={(e) => recordFailure(null, e)}>
    <MetronomePanel />
    {#snippet failed(_error, boundaryReset)}
      <FailureView
        reset={() => {
          metronome.screenChanged();
          boundaryReset();
        }}
      />
    {/snippet}
  </svelte:boundary>
</main>

<style>
  main {
    padding: var(--space-4);
  }

  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-xl);
  }
</style>
