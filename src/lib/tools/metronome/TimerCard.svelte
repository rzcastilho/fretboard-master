<script lang="ts">
  import { TIMER_PRESETS } from '$lib/state/timer-model';
  import { m } from '$lib/paraglide/messages.js';
  import { timer } from '$lib/state/timer.svelte';

  /** Unlit seven-segment ghost behind the digits (decorative, aria-hidden). */
  const GHOST = '88:88';
  const running = $derived(timer.status === 'running');
</script>

<section
  class="timer"
  aria-labelledby="timer-heading"
  data-status={timer.status}
  data-flash={timer.flashing ? '' : undefined}
  data-print="omit"
>
  <h2 id="timer-heading">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 14V10M9 3h6M12 3v4" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
    {m.timer_heading()}
  </h2>
  <div class="face">
    <div class="readout" role="timer" aria-label={m.timer_readout_label()}>
      <span class="ghost" aria-hidden="true">{GHOST}</span><span class="time">{timer.readout}</span>
    </div>
    <button
      type="button"
      class="play"
      aria-label={running ? m.timer_pause() : m.timer_start()}
      onclick={timer.toggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {#if running}
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
        {:else}
          <path d="M8 5v14l11-7z" fill="currentColor" />
        {/if}
      </svg>
    </button>
  </div>
  <div class="presets" role="group" aria-label={m.timer_presets_label()}>
    {#each TIMER_PRESETS as n (n)}
      <button
        type="button"
        class="pill"
        aria-pressed={n === timer.preset}
        onclick={() => timer.selectPreset(n)}
      >
        {m.timer_preset({ minutes: n })}
      </button>
    {/each}
  </div>
  <div class="sr-only" role="status" aria-live="polite">{timer.announcement}</div>
</section>

<style>
  .timer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-inline-size: var(--metronome-panel-max);
    margin: 0 auto var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-md);
  }

  h2 svg {
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
  }

  .face {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .readout {
    position: relative;
    display: inline-block;
    font-size: var(--timer-readout-size);
    font-variant-numeric: tabular-nums;
    font-weight: var(--font-weight-bold);
    line-height: 1.1;
    color: var(--color-text);
  }

  .ghost {
    position: absolute;
    inset: 0;
    opacity: var(--timer-ghost-opacity);
    user-select: none;
  }

  .time {
    position: relative;
  }

  .play {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--timer-play-size);
    block-size: var(--timer-play-size);
    padding: 0;
    color: var(--color-accent-text);
    background: var(--color-accent);
    border: var(--border-width) solid var(--color-accent);
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .play svg {
    inline-size: 50%;
    block-size: 50%;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .pill {
    min-inline-size: var(--target-min);
    min-block-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-pill);
    cursor: pointer;
  }

  .pill[aria-pressed='true'] {
    font-weight: var(--font-weight-bold);
    border: calc(var(--border-width) * 2) solid var(--color-accent-secondary);
    outline: var(--border-width) solid var(--color-accent-secondary);
  }

  /* Finished: a static highlight that stays after the flash ends. */
  .timer[data-status='finished'] .time {
    color: var(--color-accent-secondary);
  }

  .timer[data-flash] .time {
    animation: timer-flash var(--timer-flash-period) steps(2) infinite;
  }

  @keyframes timer-flash {
    50% {
      opacity: var(--timer-flash-dim);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .timer[data-flash] .time {
      animation: none;
      text-decoration: underline;
    }
  }
</style>
