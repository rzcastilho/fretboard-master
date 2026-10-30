<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { currentSnapshot, share } from '$lib/state/share.svelte';
  import { shareTitle } from './share-title';
  import type { FretboardToolId } from './tools';
  import BarIcon from './BarIcon.svelte';

  let { tool }: { tool: FretboardToolId } = $props();

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
  class="share-button link-button"
  data-print="omit"
  aria-busy={share.busy ? 'true' : undefined}
  onclick={activate}
  ><BarIcon name="share" /><span class="bar-label">{m.share_button()}</span></button
>
