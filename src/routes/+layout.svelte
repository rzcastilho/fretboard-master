<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import ShellFailure from '$lib/shell/ShellFailure.svelte';
  import { recordFailure } from '$lib/shell/failure';
  import '$lib/styles/tokens.css';
  import '$lib/styles/global.css';

  let { children } = $props();

  // R-07: after any in-app navigation, move focus to the screen heading (not on initial load).
  afterNavigate(({ type }) => {
    if (type === 'enter') return;
    document.querySelector<HTMLElement>('h1')?.focus();
  });
</script>

<svelte:boundary onerror={(error) => recordFailure(null, error)}>
  {@render children()}
  {#snippet failed(_error, reset)}
    <main>
      <ShellFailure {reset} />
    </main>
  {/snippet}
</svelte:boundary>
