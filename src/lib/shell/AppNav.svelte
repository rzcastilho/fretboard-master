<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { ScreenId } from './screens';
  import { linkTools, type LinkedTool } from '$lib/state/links.svelte';
  import { TOOLS } from './tools';
  import BarIcon, { type BarIconName } from './BarIcon.svelte';

  let { current }: { current: ScreenId } = $props();

  const items = $derived([
    { id: 'home' as const, path: '/', label: m.nav_home(), icon: 'home' as BarIconName },
    ...TOOLS.map((t) => ({
      id: t.id,
      path: t.path as string,
      label: t.name(),
      icon: t.id as BarIconName
    })),
    { id: 'about' as const, path: '/about', label: m.nav_about(), icon: 'about' as BarIconName }
  ]);

  const toolIds: readonly ScreenId[] = TOOLS.map((t) => t.id);

  /** Carry applies at activation, only for a plain primary click to a different tool (ADR 0011). */
  function carry(e: MouseEvent, id: ScreenId): void {
    if (
      e.button !== 0 ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey ||
      e.defaultPrevented ||
      id === current ||
      !toolIds.includes(id)
    )
      return;
    linkTools(current, id as LinkedTool);
  }
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- static internal paths; app is not deployed under a base path -->
<nav aria-label={m.nav_label()} data-print="omit">
  <ul>
    {#each items as item (item.id)}
      {@const isCurrent = item.id === current}
      <li>
        <a
          href={item.path}
          onclick={(e) => carry(e, item.id)}
          class:current={isCurrent}
          aria-current={isCurrent ? 'page' : undefined}
          data-sveltekit-replacestate={isCurrent ? '' : undefined}
          ><BarIcon name={item.icon} /><span class="bar-label">{item.label}</span></a
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

  @media (hover: hover) {
    a:not(.current):hover {
      text-decoration: underline;
    }
  }
</style>
