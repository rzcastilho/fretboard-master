<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { currentSnapshot, share } from '$lib/state/share.svelte';
  import { shareTitle } from './share-title';
  import type { ToolId } from './tools';

  let { tool }: { tool: ToolId } = $props();

  let button = $state<HTMLButtonElement | null>(null);

  // The fallback panel returns focus here when it closes.
  $effect(() => {
    share.registerOpener(button);
    return () => share.registerOpener(null);
  });

  function activate(): void {
    void share.share(tool, shareTitle(currentSnapshot(tool)));
  }
</script>

<button
  bind:this={button}
  type="button"
  class="share-button"
  aria-busy={share.busy ? 'true' : undefined}
  onclick={activate}>{m.share_button()}</button
>

<style>
  .share-button {
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
</style>
