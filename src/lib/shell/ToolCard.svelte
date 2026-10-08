<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import type { Tool } from './tools';

  let { tool, continued = false }: { tool: Tool; continued?: boolean } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- /notes, /triads routes (typed by resolve) land in US2 -->
<a
  class="card"
  href={tool.path}
  aria-label={continued
    ? m.card_label_continue({ name: tool.name(), question: tool.question() })
    : m.card_label({ name: tool.name(), question: tool.question() })}
>
  {#if continued}<span class="continue">{m.home_continue()}</span>{/if}
  <span class="name">{tool.name()}</span>
  <span class="question">{tool.question()}</span>
  <span class="thumb"><Fretboard variant="thumbnail" instrument={instrument.current} /></span>
</a>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    block-size: 100%;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-4);
    box-sizing: border-box;
    background: var(--color-surface-raised);
    color: var(--color-text);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    text-decoration: none;
    overflow-wrap: anywhere;
    transition: background-color var(--duration-fast) var(--ease-standard);
  }

  @media (hover: hover) {
    .card:hover {
      background: var(--color-surface-hover);
    }
  }

  .name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }

  .continue {
    align-self: flex-start;
    color: var(--color-accent);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .thumb {
    display: block;
    margin-block-start: auto;
    pointer-events: none;
  }

  .question {
    font-size: var(--font-size-md);
    color: var(--color-text-muted);
  }
</style>
