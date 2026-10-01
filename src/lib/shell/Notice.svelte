<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';

  interface Props {
    message: string;
    ondismiss?: () => void;
  }

  let { message, ondismiss }: Props = $props();
  let visible = $state(true);

  function dismiss(event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    visible = false;
    ondismiss?.();
    // Respect a handler that already moved focus elsewhere; otherwise fall back to the heading.
    if (document.activeElement === button || document.activeElement === document.body) {
      document.querySelector<HTMLElement>('h1')?.focus();
    }
  }
</script>

{#if visible}
  <div class="notice" role="status" aria-live="polite">
    <p>{message}</p>
    {#if ondismiss}
      <button type="button" onclick={dismiss}>{m.notice_dismiss()}</button>
    {/if}
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
