<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { ScreenId } from './screens';
  import { TOOLS } from './tools';

  let { current }: { current: ScreenId } = $props();

  const items = $derived([
    { id: 'home' as const, path: '/', label: m.nav_home() },
    ...TOOLS.map((t) => ({ id: t.id, path: t.path as string, label: t.name() })),
    { id: 'about' as const, path: '/about', label: m.nav_about() }
  ]);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static internal paths; app is not deployed under a base path -->
<nav aria-label={m.nav_label()}>
  <ul>
    {#each items as item (item.id)}
      {@const isCurrent = item.id === current}
      <li>
        <a
          href={item.path}
          class:current={isCurrent}
          aria-current={isCurrent ? 'page' : undefined}
          data-sveltekit-replacestate={isCurrent ? '' : undefined}>{item.label}</a
        >
      </li>
    {/each}
  </ul>
</nav>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    display: inline-flex;
    align-items: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-2);
    box-sizing: border-box;
    color: var(--color-accent);
    border-block-end: var(--indicator-width) solid transparent;
  }

  a.current {
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    border-block-end-color: var(--color-text);
  }
</style>
