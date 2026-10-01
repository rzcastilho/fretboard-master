<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import AppNav from '$lib/shell/AppNav.svelte';
  import SoundControl from '$lib/shell/SoundControl.svelte';
  import StopButton from '$lib/shell/StopButton.svelte';
  import { screenTitle } from '$lib/shell/screens';
</script>

<svelte:head>
  <title>{screenTitle('about')}</title>
</svelte:head>

<header aria-label={m.zone_app_bar()}>
  <AppNav current="about" />
  <StopButton />
  <SoundControl />
</header>

<main>
  <h1 tabindex="-1">{m.about_heading()}</h1>
  <p>{m.about_description()}</p>
  <p>{m.about_version({ version: __APP_VERSION__ })}</p>
</main>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-2) var(--space-4);
  }

  main {
    padding: var(--space-4);
    max-inline-size: 65ch;
  }

  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-xl);
  }
</style>
