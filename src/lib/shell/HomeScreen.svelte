<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import SoundControl from './SoundControl.svelte';
  import StopButton from './StopButton.svelte';
  import InstrumentSummary from './InstrumentSummary.svelte';
  import LanguageSelector from './LanguageSelector.svelte';
  import ThemeSelector from './ThemeSelector.svelte';
  import BarIcon from './BarIcon.svelte';
  import { screenTitle } from './screens';
  import { TOOLS } from './tools';
  import ToolCard from './ToolCard.svelte';
  import { preferences } from '$lib/state/preferences.svelte';

  let { notice }: { notice?: Snippet } = $props();
</script>

<svelte:head>
  <title>{screenTitle('home')}</title>
</svelte:head>

<header class="app-bar top">
  <h1 tabindex="-1">{m.app_name()}</h1>
  <div class="bar-tools">
    <StopButton />
    <SoundControl />
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /about route (typed by resolve) lands in US3 -->
    <a class="about link-button" data-print="omit" href="/about"
      ><BarIcon name="about" /><span class="bar-label">{m.nav_about()}</span></a
    >
  </div>
  <div class="prefs">
    <LanguageSelector />
    <ThemeSelector />
  </div>
</header>

<main>
  {#if notice}
    {@render notice()}
  {/if}
  <ul class="cards">
    {#each TOOLS as tool (tool.id)}
      <li><ToolCard {tool} continued={tool.id === preferences.lastTool} /></li>
    {/each}
  </ul>
</main>

<div class="bottom" data-zone="bottom"><InstrumentSummary /></div>

<style>
  .top {
    row-gap: var(--space-3);
    padding-block: var(--space-3);
  }

  h1 {
    margin: 0;
    font-size: var(--font-size-xl);
    letter-spacing: var(--letter-spacing-wordmark);
  }

  /* Language and theme stay one tap away on the first screen, as their own row of the bar. */
  .prefs {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--group-gap);
  }

  main {
    /* Inline padding is capped by the viewport so 200 % text zoom at 320 px keeps room for text. */
    padding: var(--space-4) min(var(--space-4), 5vw);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-min-inline)), 1fr));
    gap: var(--space-4);
    align-items: stretch;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cards > li {
    display: block;
    min-inline-size: 0;
  }

  .bottom {
    min-block-size: var(--space-6);
    padding: var(--space-4);
  }
</style>
