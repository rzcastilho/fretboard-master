<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { contextPanel } from '$lib/state/context-panel.svelte';
  import { print } from '$lib/state/print.svelte';
  import { viewport } from '$lib/state/viewport.svelte';

  interface Props {
    /** One-line summary of the tool's current view (`display.summary`). */
    summary: string;
    children: Snippet;
  }

  let { summary, children }: Props = $props();

  const uid = $props.id();
  const contentId = $derived(`${uid}-content`);

  // Only the reflow arrangement collapses. Before mount there is no arrangement, so the
  // content stays visible (the no-JS and prerender fallback).
  const reflow = $derived(viewport.arrangement === 'reflow');
  const expanded = $derived(contextPanel.expanded);
</script>

{#if reflow}
  <div class="summary-row" data-print="omit">
    <p class="summary">{summary}</p>
    <button
      type="button"
      class="btn"
      aria-expanded={expanded}
      aria-controls={contentId}
      onclick={() => contextPanel.toggle()}
    >
      {expanded ? m.context_hide() : m.context_show()}
    </button>
  </div>
{/if}
<div id={contentId} class="content" data-print="show" hidden={reflow && !expanded && !print.active}>
  {@render children()}
</div>

<style>
  .summary-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    margin-block-end: var(--space-3);
  }

  /* Wraps instead of truncating, so it stays whole at 200% text. */
  .summary {
    flex: 1 1 var(--item-min-inline);
    margin: 0;
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  /* The wrapper adds no box: the children keep the zone's own flex or block layout. */
  .content {
    display: contents;
  }

  .content[hidden] {
    display: none;
  }
</style>
