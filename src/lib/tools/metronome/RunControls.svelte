<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { RunPhase } from '$lib/state/metronome.svelte';

  let {
    phase,
    ontoggle,
    onreset,
    main = $bindable()
  }: {
    phase: RunPhase;
    ontoggle: () => void;
    onreset: () => void;
    main?: HTMLButtonElement;
  } = $props();

  const paused = $derived(phase === 'paused');
</script>

<div class="controls">
  <button type="button" class="btn main" class:resume={paused} bind:this={main} onclick={ontoggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {#if paused}
        <path d="M7 4l13 8-13 8z" />
      {:else}
        <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
      {/if}
    </svg>
    {paused ? m.metronome_resume() : m.metronome_pause()}
  </button>
  <span class="reset-wrap">
    <button
      type="button"
      class="btn reset"
      aria-label={m.metronome_reset()}
      title={m.metronome_reset()}
      onclick={onreset}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
        ><path d="M4 12a8 8 0 108-8H7M7 1l-3 3 3 3" /></svg
      >
    </button>
    <span class="tip" aria-hidden="true">{m.metronome_reset()}</span>
  </span>
</div>

<style>
  .controls {
    display: flex;
    align-items: stretch;
    gap: var(--space-3);
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .main {
    flex: 1;
    padding: var(--space-2) var(--space-4);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
  }

  .main.resume {
    color: var(--color-accent-text);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .main svg,
  .reset svg {
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
  }

  .main svg {
    fill: currentColor;
  }

  .reset svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .reset-wrap {
    position: relative;
    display: flex;
  }

  .reset {
    inline-size: var(--target-min);
    padding: 0;
    color: var(--color-danger-text);
    background: var(--color-danger);
    border: var(--border-width) solid var(--color-danger);
  }

  .tip {
    position: absolute;
    inset-block-end: 100%;
    inset-inline-end: 0;
    padding: var(--space-1) var(--space-2);
    margin-block-end: var(--space-1);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    visibility: hidden;
    pointer-events: none;
  }

  .reset:focus-visible + .tip {
    visibility: visible;
  }
</style>
