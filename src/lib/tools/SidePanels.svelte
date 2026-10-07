<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { viewport } from '$lib/state/viewport.svelte';

  interface Props {
    /** Zone E: actions. */
    actions: Snippet;
    /** Zone D: details. */
    details: Snippet;
  }

  let { actions, details }: Props = $props();

  const landscape = $derived(viewport.arrangement === 'landscape');

  let open = $state(false);
  let opener: HTMLButtonElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  async function show(): Promise<void> {
    open = true;
    await tick();
    closeButton?.focus();
  }

  async function close(): Promise<void> {
    open = false;
    await tick();
    opener?.focus();
  }

  function toggle(): void {
    void (open ? close() : show());
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !landscape || !open) return;
    event.stopPropagation();
    void close();
  }

  // Entering landscape starts closed. Leaving it while open closes the panel; if focus was
  // inside, it moves to the first focusable control of zone E (the content returns to the grid).
  // The pre-effect runs before the DOM update removes the close button, so focus is still known.
  let wasLandscape = false;
  $effect.pre(() => {
    const now = landscape;
    if (now === wasLandscape) return;
    wasLandscape = now;
    const focusWasInside = !now && panel !== undefined && panel.contains(document.activeElement);
    open = false;
    if (!focusWasInside) return;
    void tick().then(() => {
      for (const child of Array.from(panel?.children ?? [])) {
        const target = child.matches(FOCUSABLE) ? child : child.querySelector(FOCUSABLE);
        if (target instanceof HTMLElement) {
          target.focus();
          break;
        }
      }
    });
  });
</script>

<!--
  Outside landscape the wrapper adds no box (`display: contents`): zone E then zone D take their
  grid areas directly and the opener is hidden. In landscape the wrapper is a non-modal panel on
  the trailing edge: no backdrop, no `inert`, no focus trap.
-->
<button
  bind:this={opener}
  type="button"
  class="panels-opener"
  data-print="omit"
  aria-expanded={landscape && open ? 'true' : 'false'}
  aria-controls="tool-panels"
  hidden={!landscape}
  onclick={toggle}>{m.panels_open()}</button
>
<div
  bind:this={panel}
  id="tool-panels"
  class="panels"
  class:landscape
  data-print={landscape ? 'omit' : undefined}
  role={landscape ? 'region' : undefined}
  aria-label={landscape ? m.panels_region() : undefined}
  hidden={landscape && !open}
  {onkeydown}
>
  {#if landscape}
    <button
      bind:this={closeButton}
      type="button"
      class="panels-close"
      data-print="omit"
      onclick={() => void close()}>{m.panels_close()}</button
    >
  {/if}
  {@render actions()}
  {@render details()}
</div>

<style>
  .panels {
    display: contents;
  }

  .panels.landscape {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    position: fixed;
    inset-block: var(--landscape-bar-height, 3.5rem) 0;
    inset-inline-end: 0;
    inline-size: min(var(--side-panel-max), 50vw);
    box-sizing: border-box;
    padding: var(--space-4);
    overflow-y: auto;
    background: var(--color-surface);
    border-inline-start: var(--border-width) solid var(--color-border);
    z-index: 2;
    animation: panels-slide var(--duration-short) ease-out;
  }

  .panels.landscape[hidden] {
    display: none;
  }

  .panels-close {
    align-self: flex-end;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .panels-opener {
    grid-area: p;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .panels-opener[hidden] {
    display: none;
  }

  @keyframes panels-slide {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
