<script lang="ts">
  import type { NoteFunction, OctaveTone } from './types';

  /**
   * Legend sample of a board marker (aria-hidden). Same glyph geometry as `Fretboard.svelte`,
   * and the same token-driven layer classes, so the legend matches the board (R-09).
   */
  interface Props {
    fn: NoteFunction;
    layer?: 'arpeggio' | 'triad';
    /** Extra dot on a Pentatonic/Scale note outside the pentatonic. */
    extra?: boolean;
    /** Selected note (Notes): the highlighted neutral glyph. */
    emphasis?: 'highlighted';
    /** Same-octave colour sample (with `emphasis: 'highlighted'`). */
    tone?: OctaveTone;
    /** Comparison triad note: dashed outline. */
    variant?: 'comparison';
    /** Connection ring around the glyph. */
    ring?: boolean;
  }
  let { fn, layer, extra = false, emphasis, tone, variant, ring = false }: Props = $props();

  const SIZE = 44;
  const ROOT = 28;
  const MEDIUM = 26;
  const SMALL = 20;
  const RING = Math.max(ROOT, MEDIUM + 4) / 2;
  const diamond = (half: number) => `0,${-half} ${half},0 0,${half} ${-half},0`;
</script>

<svg
  class="marker-sample marker {fn}{emphasis ? ` ${emphasis}` : ''}{tone ? ` tone-${tone}` : ''}"
  class:comparison={variant === 'comparison'}
  class:layer-arpeggio={layer === 'arpeggio'}
  class:layer-triad={layer === 'triad'}
  aria-hidden="true"
  focusable="false"
  width={SIZE}
  height={SIZE}
  viewBox="{-SIZE / 2} {-SIZE / 2} {SIZE} {SIZE}"
>
  <g
    class="shape"
    style:transform={layer === 'arpeggio'
      ? 'scale(var(--marker-layer-scale))'
      : layer === 'triad'
        ? 'scale(var(--marker-triad-scale))'
        : undefined}
    style:opacity={layer === 'arpeggio' ? 'var(--marker-layer-opacity)' : undefined}
  >
    {#if fn === 'root'}
      <rect class="glyph" x={-ROOT / 2} y={-ROOT / 2} width={ROOT} height={ROOT} rx={ROOT / 5} />
    {:else if fn === 'fifth'}
      <polygon class="glyph" points={diamond(MEDIUM / 2 + 2)} />
    {:else if fn === 'degree'}
      <circle class="glyph outline" r={SMALL / 2} />
    {:else if fn === 'neutral'}
      <circle class="glyph ring" r={MEDIUM / 2} />
    {:else}
      <circle class="glyph" r={MEDIUM / 2} />
    {/if}
    {#if extra}
      <circle class="extra-dot" cy={SMALL / 2 + 3} />
    {/if}
    {#if ring}
      <circle class="connection-ring" style:--ring-base={RING} />
    {/if}
  </g>
</svg>

<style>
  .marker-sample {
    flex: none;
    overflow: visible;
  }
  .shape {
    transform-box: fill-box;
    transform-origin: center;
  }
  .root .glyph {
    fill: var(--color-root);
  }
  .third .glyph {
    fill: var(--color-third);
  }
  .fifth .glyph {
    fill: var(--color-fifth);
  }
  .glyph.ring {
    fill: var(--color-neutral-note);
    stroke: var(--color-neutral-note-stroke);
    stroke-width: var(--marker-neutral-stroke-width);
  }
  .glyph.outline {
    fill: none;
    stroke: var(--color-degree-stroke);
    stroke-width: var(--marker-stroke);
  }
  .neutral.highlighted .glyph {
    fill: var(--color-note-highlight);
  }
  .tone-1 .glyph {
    fill: var(--octave-tone-1);
  }
  .tone-2 .glyph {
    fill: var(--octave-tone-2);
  }
  .tone-3 .glyph {
    fill: var(--octave-tone-3);
  }
  .tone-4 .glyph {
    fill: var(--octave-tone-4);
  }
  .tone-5 .glyph {
    fill: var(--octave-tone-5);
  }
  .tone-6 .glyph {
    fill: var(--octave-tone-6);
  }
  .tone-7 .glyph {
    fill: var(--octave-tone-7);
  }
  .comparison .glyph {
    stroke: var(--color-text);
    stroke-width: var(--marker-stroke);
    stroke-dasharray: var(--marker-dash) var(--marker-dash-gap);
  }
  @media (prefers-contrast: more) {
    .comparison .glyph {
      stroke: CanvasText;
    }
  }
  .connection-ring {
    fill: none;
    stroke: var(--connection-ring);
    stroke-width: var(--connection-ring-width);
    r: calc(var(--ring-base) * 1px + var(--connection-ring-gap));
  }
  .layer-triad .glyph {
    stroke: var(--color-text);
    stroke-width: var(--marker-triad-stroke);
  }
  .extra-dot {
    fill: var(--color-text);
    r: var(--marker-extra-dot);
  }
</style>
