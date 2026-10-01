<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  let visible = $state(true);

  function dismiss() {
    visible = false;
    document.querySelector<HTMLElement>('h1')?.focus();
  }
</script>

{#if visible}
  <div class="notice" role="status" aria-live="polite">
    <p>{m.notice_not_found()}</p>
    <button type="button" onclick={dismiss}>{m.notice_dismiss()}</button>
  </div>
{/if}

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-3);
    margin-block-end: var(--space-4);
    padding: var(--space-2) var(--space-3);
    background: var(--color-notice-surface);
    color: var(--color-notice-text);
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
  }

  p {
    margin: 0;
    line-height: 1.4;
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: inherit;
    background: transparent;
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
