<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { fit } from '$lib/state/fit.svelte';
</script>

{#if fit.available}
  <button
    type="button"
    class="option"
    aria-pressed={fit.effective === 'whole'}
    onclick={() => fit.toggle()}>{m.fit_to_screen()}</button
  >
{/if}
