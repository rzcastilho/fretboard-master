<script lang="ts">
  import { resolve } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';

  let { reset }: { reset: () => void } = $props();
</script>

<section class="failure" aria-label={m.failure_region()}>
  <p>{m.failure_message()}</p>
  <div class="actions">
    <button type="button" onclick={() => reset()}>{m.failure_reset_tool()}</button>
    <a href={resolve('/')}>{m.failure_go_home()}</a>
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

  button,
  a {
    display: inline-flex;
    align-items: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: inherit;
  }

  button {
    background: transparent;
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
