<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { onMount } from 'svelte';
  import type { FretboardLayout } from './geometry';
  import { DRAG_THRESHOLD_PX } from './interaction';
  import { minimapKeyScroll, minimapTapScroll, minimapWindow, visibleFretRange } from './minimap';
  import { tokenDuration } from './motion';
  import { animateScroll, browserClock } from './scroll-animation';

  /** A highlighted position in layout space: x centre and row index (top to bottom). */
  export interface MinimapDot {
    x: number;
    row: number;
  }

  let {
    layout,
    scroller,
    dots = []
  }: {
    layout: FretboardLayout;
    scroller: HTMLElement | undefined;
    dots?: readonly MinimapDot[];
  } = $props();

  let el: HTMLElement | undefined = $state();
  let inline = $state(0);
  let block = $state(0);
  let scrollLeft = $state(0);
  let viewportWidth = $state(0);
  let cancelScroll: (() => void) | undefined;
  let down: { id: number; x: number; y: number } | null = null;

  const k = $derived(inline > 0 && layout.width > 0 ? inline / layout.width : 0);
  const viewport = $derived({ scrollLeft, width: viewportWidth });
  const range = $derived(visibleFretRange(layout, viewport));
  const win = $derived(minimapWindow(layout, viewport, k));
  const rowCount = $derived(layout.rows.length);
  const rowH = $derived(rowCount > 0 ? block / rowCount : 0);

  onMount(() => {
    const measure = () => {
      inline = el?.clientWidth ?? 0;
      block = el?.clientHeight ?? 0;
    };
    measure();
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    if (el) observer?.observe(el);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
      cancelScroll?.();
    };
  });

  // Window follows the scroller; rAF-throttled, `scrollLeft` is the only read in the handler.
  $effect(() => {
    const target = scroller;
    void layout;
    if (!target) return;
    scrollLeft = target.scrollLeft;
    viewportWidth = target.clientWidth;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scrollLeft = target.scrollLeft;
        viewportWidth = target.clientWidth;
      });
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  });

  function jump(to: number) {
    if (!scroller) return;
    cancelScroll?.();
    cancelScroll = animateScroll(scroller, to, tokenDuration(el), browserClock);
  }

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 || e.isPrimary === false) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  function onpointerup(e: PointerEvent) {
    const start = down;
    down = null;
    if (!start || start.id !== e.pointerId || !el || k === 0) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= DRAG_THRESHOLD_PX) return;
    const x = e.clientX - el.getBoundingClientRect().left;
    jump(minimapTapScroll(layout, x, k, viewportWidth));
  }

  function onkeydown(e: KeyboardEvent) {
    if (!scroller) return;
    const to = minimapKeyScroll(layout, e.key, {
      scrollLeft: scroller.scrollLeft,
      width: scroller.clientWidth
    });
    if (to === null) return;
    e.preventDefault();
    jump(to);
  }
</script>

<div
  class="minimap"
  data-print="omit"
  role="slider"
  tabindex="0"
  aria-label={m.minimap_label()}
  aria-orientation="horizontal"
  aria-valuemin={1}
  aria-valuemax={range.count}
  aria-valuenow={range.first}
  aria-valuetext={m.minimap_value({ first: range.first, last: range.last, count: range.count })}
  bind:this={el}
  {onpointerdown}
  {onpointerup}
  onpointercancel={() => (down = null)}
  {onkeydown}
>
  <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${inline} ${block}`}>
    <rect class="window" x={win.x} y="1" width={win.width} height={Math.max(0, block - 2)} rx="3" />
    {#each dots as d, i (i)}
      <rect
        class="dot"
        x={d.x * k - 3}
        y={(d.row + 0.5) * rowH - 3}
        width="6"
        height="6"
        transform={`rotate(45 ${d.x * k} ${(d.row + 0.5) * rowH})`}
      />
    {/each}
  </svg>
</div>

<style>
  .minimap {
    position: relative;
    inline-size: 100%;
    block-size: max(var(--target-min), calc(var(--minimap-row) * 8));
    cursor: pointer;
    touch-action: manipulation;
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-sm);
    box-sizing: border-box;
  }

  .minimap:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring-outer);
    outline-offset: var(--focus-ring-offset);
    box-shadow: 0 0 0 calc(var(--focus-ring-offset) + var(--unit-px)) var(--color-focus-ring-inner);
  }

  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  /* Window: outlined and unfilled; dots: filled diamonds. Shape and size differ, not colour only. */
  .window {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 2;
  }

  .dot {
    fill: var(--color-text);
  }
</style>
