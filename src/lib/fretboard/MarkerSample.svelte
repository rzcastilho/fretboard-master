<script lang="ts">
  import type { NoteFunction } from './types';

  /**
   * Legend sample of a board marker (aria-hidden). Same glyph geometry as `Fretboard.svelte`,
   * and the same token-driven layer classes, so the legend matches the board (R-09).
   */
  interface Props {
    fn: NoteFunction;
    layer?: 'arpeggio';
    /** Extra dot on a Pentatonic/Scale note outside the pentatonic. */
    extra?: boolean;
  }
  let { fn, layer, extra = false }: Props = $props();

  const SIZE = 44;
  const ROOT = 28;
  const MEDIUM = 26;
  const SMALL = 20;
  const diamond = (half: number) => `0,${-half} ${half},0 0,${half} ${-half},0`;
</script>

<svg
  class="marker-sample marker {fn}"
  class:layer-arpeggio={layer === 'arpeggio'}
  aria-hidden="true"
  focusable="false"
  width={SIZE}
  height={SIZE}
  viewBox="{-SIZE / 2} {-SIZE / 2} {SIZE} {SIZE}"
>
  <g
    class="shape"
    style:transform={layer === 'arpeggio' ? 'scale(var(--marker-layer-scale))' : undefined}
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
  .extra-dot {
    fill: var(--color-text);
    r: var(--marker-extra-dot);
  }
</style>
