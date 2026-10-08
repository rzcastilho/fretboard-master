<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { preferences } from '$lib/state/preferences.svelte';

  let confirming = $state(false);
  let opener = $state<HTMLButtonElement>();
  let cancel = $state<HTMLButtonElement>();

  async function open() {
    confirming = true;
    await tick();
    cancel?.focus();
  }

  async function close() {
    confirming = false;
    await tick();
    opener?.focus();
  }

  async function confirmErase() {
    preferences.erase();
    confirming = false;
    try {
      await goto(resolve('/'));
    } catch {
      location.assign('/');
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (confirming && event.key === 'Escape') {
      event.preventDefault();
      void close();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="erase" data-print="omit">
  {#if confirming}
    <p>{m.about_erase_question()}</p>
    <div class="actions">
      <button type="button" class="btn" onclick={confirmErase}>{m.about_erase_confirm()}</button>
      <button type="button" class="btn" bind:this={cancel} onclick={close}
        >{m.about_erase_cancel()}</button
      >
    </div>
  {:else}
    <button type="button" class="btn" bind:this={opener} onclick={open}>{m.about_erase()}</button>
  {/if}
</div>

<style>
  .erase {
    margin-block-start: var(--space-4);
  }

  p {
    margin: 0 0 var(--space-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
