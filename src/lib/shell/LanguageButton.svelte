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
  class="language-button link-button"
  data-print="omit"
  aria-expanded={open}
  aria-controls={controls}
  bind:this={element}
  {onclick}><BarIcon name="language" /><span class="bar-label">{m.language_open()}</span></button
>
