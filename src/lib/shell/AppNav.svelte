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

  // The Metronome is not a linked tool: nothing carries to or from it.
  const toolIds: readonly ScreenId[] = TOOLS.filter((t) => t.id !== 'metronome').map((t) => t.id);

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
      !toolIds.includes(current) ||
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
      <li class:home={item.id === 'home'} class:about={item.id === 'about'}>
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
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    gap: var(--space-1);
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    box-sizing: border-box;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    border-radius: var(--radius-md);
    /* The indicator is drawn inside the box so the current tab keeps the row's height. */
    box-shadow: inset 0 calc(-1 * var(--tab-indicator-width)) 0 transparent;
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }

  a.current {
    color: var(--color-text);
    font-weight: var(--font-weight-bold);
    background: var(--color-surface);
    box-shadow: inset 0 calc(-1 * var(--tab-indicator-width)) 0 var(--color-accent);
  }

  /* Home and About frame the tool tabs: a gap on each side sets them apart. */
  .home {
    margin-inline-end: var(--space-2);
  }

  .about {
    margin-inline-start: var(--space-2);
  }

  @media (hover: hover) {
    a:not(.current):hover {
      color: var(--color-text);
      background: var(--color-surface-hover);
    }
  }
</style>
