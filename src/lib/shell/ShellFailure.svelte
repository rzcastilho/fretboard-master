<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';

  let { reset }: { reset?: () => void } = $props();

  async function goHome(event: MouseEvent) {
    event.preventDefault();
    reset?.();
    try {
      await goto(resolve('/'));
    } catch {
      location.assign('/');
    }
  }
</script>

<section class="failure">
  <p>{m.failure_message()}</p>
  <a class="home link-button" href={resolve('/')} onclick={goHome}>{m.failure_go_home()}</a>
</section>

<style>
  .failure {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-notice-surface);
    color: var(--color-notice-text);
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
  }
</style>
