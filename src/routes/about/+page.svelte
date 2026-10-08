<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import MarkerSample from '$lib/fretboard/MarkerSample.svelte';
  import AppNav from '$lib/shell/AppNav.svelte';
  import ErasePreferences from '$lib/shell/ErasePreferences.svelte';
  import LanguagePanel from '$lib/shell/LanguagePanel.svelte';
  import PrivacyPolicy from '$lib/shell/PrivacyPolicy.svelte';
  import ShortcutList from '$lib/shell/ShortcutList.svelte';
  import SoundControl from '$lib/shell/SoundControl.svelte';
  import StopButton from '$lib/shell/StopButton.svelte';
  import { screenTitle } from '$lib/shell/screens';
  import { viewport } from '$lib/state/viewport.svelte';

  const compact = $derived(
    viewport.arrangement !== undefined && !viewport.arrangement.startsWith('wide')
  );

  const LEGEND = [
    { fn: 'root', name: m.legend_root_name, meaning: m.legend_root_meaning },
    { fn: 'third', name: m.legend_third_name, meaning: m.legend_third_meaning },
    { fn: 'fifth', name: m.legend_fifth_name, meaning: m.legend_fifth_meaning }
  ] as const;
</script>

<svelte:head>
  <title>{screenTitle('about')}</title>
</svelte:head>

<header class="app-bar" aria-label={m.zone_app_bar()} data-compact={compact ? '' : undefined}>
  <AppNav current="about" />
  <div class="bar-tools">
    <StopButton />
    <SoundControl />
    <LanguagePanel />
  </div>
</header>

<main>
  <h1 tabindex="-1">{m.about_heading()}</h1>

  <section aria-labelledby="about-intro">
    <h2 id="about-intro">{m.about_intro_heading()}</h2>
    <p>{m.about_description()}</p>
  </section>

  <section aria-labelledby="about-legend">
    <h2 id="about-legend">{m.about_legend_heading()}</h2>
    <ul class="legend">
      {#each LEGEND as entry (entry.fn)}
        <li>
          <span aria-hidden="true"><MarkerSample fn={entry.fn} /></span>
          <span class="name">{entry.name()}</span>
          <span class="meaning">{entry.meaning()}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="about-shortcuts">
    <h2 id="about-shortcuts">{m.shortcuts_heading()}</h2>
    <ShortcutList />
  </section>

  <section id="privacy" aria-labelledby="about-privacy">
    <h2 id="about-privacy" tabindex="-1">{m.about_privacy_heading()}</h2>
    <PrivacyPolicy />
    <ErasePreferences />
  </section>

  <section aria-labelledby="about-version">
    <h2 id="about-version">{m.about_version_heading()}</h2>
    <p>{m.about_version({ version: __APP_VERSION__ })}</p>
  </section>
</main>

<style>
  main {
    padding: var(--space-4);
    max-inline-size: 65ch;
  }

  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-xl);
  }

  section {
    margin-block-end: var(--space-5);
    scroll-margin-block-start: var(--space-4);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-lg);
  }

  p {
    margin: 0;
  }

  .legend {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .name {
    font-weight: var(--font-weight-medium);
  }
</style>
