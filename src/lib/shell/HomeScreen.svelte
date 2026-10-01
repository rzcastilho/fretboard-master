<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { screenTitle } from './screens';
  import { TOOLS } from './tools';
  import ToolCard from './ToolCard.svelte';

  let { notice }: { notice?: Snippet } = $props();
</script>

<svelte:head>
  <title>{screenTitle('home')}</title>
</svelte:head>

<header class="top">
  <h1 tabindex="-1">{m.app_name()}</h1>
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- /about route (typed by resolve) lands in US3 -->
  <a class="about" href="/about">{m.nav_about()}</a>
</header>

<main>
  {#if notice}
    {@render notice()}
  {/if}
  <ul class="cards">
    {#each TOOLS as tool (tool.id)}
      <li><ToolCard {tool} /></li>
    {/each}
  </ul>
</main>

<div class="bottom" data-zone="bottom"></div>

<style>
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  h1 {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  .about {
    display: inline-flex;
    align-items: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    color: var(--color-accent);
  }

  main {
    padding: var(--space-4);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-min-inline)), 1fr));
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cards > li {
    min-inline-size: 0;
  }

  .bottom {
    min-block-size: var(--space-6);
  }
</style>
