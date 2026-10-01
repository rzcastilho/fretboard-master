<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import AppNav from './AppNav.svelte';
  import FailureView from './FailureView.svelte';
  import { recordFailure } from './failure';
  import NotesTool from '$lib/tools/notes/NotesTool.svelte';
  import { screenTitle } from './screens';
  import SoundControl from './SoundControl.svelte';
  import StopButton from './StopButton.svelte';
  import ToolPlaceholder from './ToolPlaceholder.svelte';
  import { TOOLS, type ToolId } from './tools';

  let { tool }: { tool: ToolId } = $props();

  const name = $derived(TOOLS.find((t) => t.id === tool)?.name() ?? '');
</script>

<svelte:head>
  <title>{screenTitle(tool)}</title>
</svelte:head>

<header aria-label={m.zone_app_bar()}>
  <AppNav current={tool} />
  <StopButton />
  <SoundControl />
</header>

<main>
  <h1 tabindex="-1">{name}</h1>
  <div class="grid">
    <svelte:boundary onerror={(e) => recordFailure(tool, e)}>
      {#if tool === 'notes'}
        <NotesTool />
      {:else}
        <ToolPlaceholder {tool} />
      {/if}
      {#snippet failed(_error, reset)}
        <FailureView {reset} />
      {/snippet}
    </svelte:boundary>
  </div>
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
  }

  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-xl);
  }

  .grid {
    display: grid;
    grid-template-areas: var(--tool-grid-areas);
    grid-template-columns: var(--tool-grid-columns);
    grid-template-rows: var(--tool-grid-rows);
    gap: var(--space-4);
  }
</style>
