<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import LanguageButton from './LanguageButton.svelte';
  import LanguageSelector from './LanguageSelector.svelte';

  const uid = $props.id();
  const panelId = `language-panel-${uid}`;

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();

  async function close(): Promise<void> {
    open = false;
    await tick();
    trigger?.focus();
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    void close();
  }
</script>

<!-- Non-modal disclosure: button plus a region in header flow; no trap, backdrop or history entry. -->
<div class="language">
  <LanguageButton
    {open}
    controls={panelId}
    onclick={() => (open ? close() : (open = true))}
    bind:element={trigger}
  />
  {#if open}
    <!-- Escape inside the region closes the disclosure (contracts/language-ui.md §2). -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div id={panelId} class="panel" role="region" aria-label={m.language_panel_label()} {onkeydown}>
      <LanguageSelector />
      <button type="button" class="close" onclick={close}>{m.language_close()}</button>
    </div>
  {/if}
</div>

<style>
  .language {
    display: contents;
  }

  .panel {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    min-inline-size: 0;
    padding: var(--space-2) 0;
  }

  .close {
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
