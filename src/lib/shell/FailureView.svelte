<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';

  let { reset }: { reset: () => void } = $props();
</script>

<section class="failure" aria-label={m.failure_region()}>
  <p>{m.failure_message()}</p>
  <div class="actions">
    <button type="button" class="btn" onclick={() => reset()}>{m.failure_reset_tool()}</button>
    <a class="link-button" href={resolve('/')}>{m.failure_go_home()}</a>
  </div>
</section>

<style>
  .failure {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-notice-surface);
    color: var(--color-notice-text);
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
  }

  p {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>
