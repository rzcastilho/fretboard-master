<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { CountInView, DotState } from '$lib/state/metronome-view';
  import { countInDot, statusParams } from '$lib/state/metronome-view';

  let {
    beat,
    beats,
    bpm,
    sub,
    dots,
    countIn = null
  }: {
    beat: number;
    beats: number;
    bpm: number;
    sub: number | null;
    dots: readonly DotState[];
    countIn?: CountInView | null;
  } = $props();

  const status = $derived(statusParams(beat, beats, sub, countIn));
</script>

<div class="status">
  <p class="position">
    {#if status.kind === 'count-in'}
      <span class="part"
        >{m.metronome_status_count_in({ click: status.click, count: status.total })}</span
      >
    {:else if status.kind === 'count-in-none'}
      <span class="part">{m.metronome_status_count_in_none({ count: status.total })}</span>
    {:else}
      <span class="part"
        >{#if status.kind === 'beat'}{m.metronome_status_beat({
            beat: status.beat,
            beats: status.beats
          })}{:else}{m.metronome_status_beat_none({ beats: status.beats })}{/if}</span
      >{#if status.sub !== null}<span class="sep">{m.summary_separator()}</span><span class="part"
          >{m.metronome_status_sub({ count: status.sub })}</span
        >{/if}
    {/if}
  </p>
  <p class="tempo">
    <span class="digits">{bpm}</span> <span class="unit">{m.metronome_bpm_unit()}</span>
  </p>
  {#if countIn}
    <ol class="dots count-in" aria-hidden="true">
      {#key countIn.click}
        <li class="dot pulse" data-state={countInDot(countIn.click)}></li>
      {/key}
    </ol>
  {:else}
    <ol class="dots" aria-hidden="true">
      {#each dots as state, i (i)}
        <li class="dot" data-state={state}></li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
  }

  p {
    margin: 0;
  }

  .position {
    font-variant-caps: all-small-caps;
    font-size: var(--font-size-lg);
  }

  .part {
    white-space: nowrap;
  }

  .digits {
    color: var(--color-accent);
    font-size: var(--metronome-tempo-size);
    font-weight: var(--font-weight-bold);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .unit {
    color: var(--color-text-muted, inherit);
  }

  .dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .dot {
    inline-size: var(--metronome-dot-size);
    block-size: var(--metronome-dot-size);
    border-radius: 50%;
    background: var(--color-border);
    transition: opacity var(--duration-fast);
  }

  .dot[data-state='lit'] {
    background: var(--color-accent);
  }

  .dot[data-state='played'] {
    background: var(--color-accent);
    opacity: var(--emph-dim-opacity);
  }

  .dot.pulse[data-state='lit'] {
    animation: count-in-pulse var(--duration-base) var(--ease-standard);
  }

  @keyframes count-in-pulse {
    50% {
      transform: scale(var(--metronome-pulse-scale));
    }
  }

  /* Forced colours repaint backgrounds: keep lit, played and idle dots apart by fill and outline. */
  @media (forced-colors: active) {
    .dot {
      forced-color-adjust: none;
      background: Canvas;
      border: calc(var(--border-width) * 2) solid CanvasText;
      box-sizing: border-box;
    }

    .dot[data-state='lit'] {
      background: Highlight;
      border-color: Highlight;
    }

    .dot[data-state='played'] {
      background: CanvasText;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }

    .dot.pulse[data-state='lit'] {
      animation: none;
    }
  }
</style>
