<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { Tool } from './tools';

  let { tool }: { tool: Tool } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- /notes, /triads routes (typed by resolve) land in US2 -->
<a
  class="card"
  href={tool.path}
  aria-label={m.card_label({ name: tool.name(), question: tool.question() })}
>
  <span class="name">{tool.name()}</span>
  <span class="question">{tool.question()}</span>
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
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  .name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }

  .question {
    font-size: var(--font-size-md);
    color: var(--color-text-muted);
  }
</style>
