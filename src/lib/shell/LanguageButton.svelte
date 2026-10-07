<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import BarIcon from './BarIcon.svelte';

  let {
    open,
    controls,
    onclick,
    element = $bindable()
  }: {
    open: boolean;
    controls: string;
    onclick: () => void;
    element?: HTMLButtonElement;
  } = $props();
</script>

<button
  type="button"
  class="language-button"
  data-print="omit"
  aria-expanded={open}
  aria-controls={controls}
  bind:this={element}
  {onclick}><BarIcon name="language" /><span class="bar-label">{m.language_open()}</span></button
>

<style>
  .language-button {
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
