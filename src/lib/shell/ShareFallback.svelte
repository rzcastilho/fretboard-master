<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { share } from '$lib/state/share.svelte';

  let { href }: { href: string } = $props();

  const uid = $props.id();
  const regionId = `share-fallback-region-${uid}`;
  const labelId = `share-fallback-label-${uid}`;
  const inputId = `share-fallback-input-${uid}`;

  let input = $state<HTMLInputElement | null>(null);

  // Focus and select the whole address so one copy gesture is enough.
  $effect(() => {
    if (input === null) return;
    input.focus();
    input.select();
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    share.closeFallback();
  }
</script>

<!-- Escape is handled on the section; the field and Dismiss are the focusable controls. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="share-fallback" aria-labelledby={regionId} {onkeydown}>
  <span id={regionId} class="sr-only">{m.share_fallback_region()}</span>
  <label id={labelId} for={inputId}>{m.share_fallback_label()}</label>
  <input id={inputId} bind:this={input} type="text" readonly value={href} />
  <button type="button" class="link-button" onclick={() => share.closeFallback()}
    >{m.notice_dismiss()}</button
  >
</section>

<style>
  .share-fallback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-block-end: var(--space-4);
    padding: var(--space-2) min(var(--space-3), 3vw);
    background: var(--color-notice-surface);
    color: var(--color-notice-text);
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
  }

  label {
    line-height: 1.4;
  }

  input {
    flex: 1 1 var(--item-min-inline);
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-notice-border);
    border-radius: var(--radius-md);
  }
</style>
