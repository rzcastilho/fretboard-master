<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { onMount, untrack } from 'svelte';
  import { defaultSpelling, intervalLabel, noteLabel, pitchLabel } from '../notation/notation';
  import { octaveOf, pitchClass } from '../theory/pitch';
  import {
    isValidPosition,
    positionKey,
    positionPitch,
    type Position
  } from '../instrument/instrument';
  import { describeView, positionName } from './description';
  import {
    DEFAULT_METRICS,
    DOUBLE_INLAY_FRETS,
    INLAY_FRETS,
    layoutFretboard,
    nearestPosition,
    type FretboardMetrics
  } from './geometry';
  import {
    autoScrollTarget,
    groupScrollTarget,
    moveFocus,
    reduceGesture,
    scrollIntoViewTarget
  } from './interaction';
  import { layoutTags } from './tags';
  import { applyPulses } from './pulse';
  import { readMetrics } from './metrics';
  import { animateScroll, browserClock } from './scroll-animation';
  import type {
    DrawnMarker,
    FretboardProps,
    GestureEffect,
    GestureEvent,
    GestureState
  } from './types';

  const NO_MARKERS = { markers: [], labelMode: 'none' } as const;

  let {
    instrument,
    model = NO_MARKERS,
    variant = 'interactive',
    onactivate,
    pulses = [],
    ontag
  }: FretboardProps = $props();

  const uid = $props.id();
  const thumb = $derived(variant === 'thumbnail');

  let metrics: FretboardMetrics = $state(DEFAULT_METRICS);
  let containerWidth = $state(0);
  let root: HTMLElement | undefined = $state();
  let scroller: HTMLElement | undefined = $state();

  onMount(() => {
    const refresh = () => {
      metrics = readMetrics(root);
      containerWidth = scroller?.clientWidth ?? 0;
    };
    refresh();
    window.addEventListener('resize', refresh);
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refresh);
    if (scroller) observer?.observe(scroller);
    return () => {
      window.removeEventListener('resize', refresh);
      observer?.disconnect();
    };
  });

  let cancelScroll: (() => void) | undefined;
  const stopAutoScroll = () => {
    cancelScroll?.();
    cancelScroll = undefined;
  };

  /** `--duration-short` in ms; 0 when missing or under reduced motion (tokens zero it out). */
  function scrollDuration(): number {
    if (!root) return 0;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
    const raw = getComputedStyle(root).getPropertyValue('--duration-short').trim();
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return 0;
    return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : 0;
  }

  const layout = $derived(layoutFretboard(instrument, metrics, containerWidth, variant));
  const lastFret = $derived(layout.columns.length - 1);

  const singleInlays = $derived(
    INLAY_FRETS.filter((f) => f <= lastFret).map((f) => layout.columns[f].center)
  );
  const doubleInlays = $derived(
    DOUBLE_INLAY_FRETS.filter((f) => f <= lastFret).map((f) => layout.columns[f].center)
  );
  const inlayY = $derived((layout.boardTop + layout.boardBottom) / 2);
  const doubleY = $derived([layout.rows[1].bottom, layout.rows[3].bottom]);
  const fretNumbers = $derived(layout.columns.filter((c) => c.fret >= 1));
  const numbersY = $derived(layout.boardBottom + metrics.numbersRow / 2);
  const inlayRadius = $derived(thumb ? metrics.thumbRow * 0.3 : metrics.row * 0.14);
  const nutWidth = $derived(thumb ? metrics.thumbRow / 3 : metrics.nutWidth);
  const stringsFrom = $derived(layout.columns[0].center);
  const viewBox = $derived(`0 0 ${layout.width} ${layout.height}`);

  /** Sorted "s:f" list of highlighted, valid positions; auto-scroll fires when it changes. */
  const highlightKey = $derived(
    model.markers
      .filter((mk) => mk.emphasis === 'highlighted' && isValidPosition(instrument, mk))
      .map((mk) => positionKey(mk))
      .sort()
      .join(',')
  );
  /** A model `autoScroll` replaces the highlighted-set trigger (R-06). */
  const scrollKey = $derived(model.autoScroll ? `auto:${model.autoScroll.key}` : highlightKey);
  let lastHighlightKey: string | undefined;

  $effect(() => {
    const key = scrollKey;
    if (!scroller || thumb) return;
    if (key === lastHighlightKey) return;
    lastHighlightKey = key;
    untrack(() => {
      if (!scroller || key === '') return;
      const viewport = { scrollLeft: scroller.scrollLeft, width: scroller.clientWidth };
      let target: number | null;
      if (model.autoScroll) {
        const groups = model.autoScroll.groups.map((g) =>
          g.filter((p) => isValidPosition(instrument, p))
        );
        target = groupScrollTarget(layout, groups, viewport);
      } else {
        const positions = key.split(',').map((k) => {
          const [string, fret] = k.split(':').map(Number);
          return { string, fret };
        });
        target = autoScrollTarget(layout, positions, viewport);
      }
      if (target === null) return;
      stopAutoScroll();
      cancelScroll = animateScroll(scroller, target, scrollDuration(), browserClock);
    });
  });

  // Shape tags (Full neck): measured widths feed the pure layout; absent tags reserve nothing.
  const TAG_GAP = 4;
  const tags = $derived(thumb ? [] : (model.tags ?? []));
  let tagEls: HTMLElement[] = $state([]);
  let tagWidths: number[] = $state([]);
  const tagMin = $derived(metrics.row);
  const placedTags = $derived.by(() => {
    const items = tags.map((t, i) => {
      const a = layout.columns[Math.min(Math.max(t.start, 0), lastFret)];
      const b = layout.columns[Math.min(Math.max(t.end, 0), lastFret)];
      return { center: (a.start + b.end) / 2, width: Math.max(tagWidths[i] ?? 0, tagMin) };
    });
    return layoutTags(items, layout.width, TAG_GAP);
  });
  const tagRows = $derived(placedTags.reduce((n, p) => Math.max(n, p.row + 1), 0));
  const tagsHeight = $derived(tagRows === 0 ? 0 : tagRows * tagMin + (tagRows - 1) * TAG_GAP);

  $effect(() => {
    const els = tagEls.slice(0, tags.length);
    if (els.length === 0) return;
    const measure = () => {
      const next = els.map((el) => el?.offsetWidth ?? 0);
      if (next.length !== tagWidths.length || next.some((w, i) => w !== tagWidths[i]))
        tagWidths = next;
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    for (const el of els) if (el) ro.observe(el);
    return () => ro.disconnect();
  });

  /** Region clamped to the board, or null when the model has none. */
  const band = $derived.by(() => {
    const r = model.region;
    if (!r || thumb || !Number.isFinite(r.start) || !Number.isFinite(r.end)) return null;
    const clamp = (v: number) => Math.min(lastFret, Math.max(0, Math.round(v)));
    const start = clamp(Math.min(r.start, r.end));
    const end = clamp(Math.max(r.start, r.end));
    return {
      start,
      end,
      x: layout.columns[start].start,
      width: layout.columns[end].end - layout.columns[start].start
    };
  });
  let lastRegionKey: string | undefined;

  $effect(() => {
    const key = band ? `${band.start}:${band.end}` : '';
    if (!scroller || thumb) return;
    const previous = lastRegionKey;
    lastRegionKey = key;
    if (previous === undefined || previous === key || band === null) return;
    untrack(() => {
      if (!scroller || band === null) return;
      const target = autoScrollTarget(
        layout,
        [
          { string: 1, fret: band.start },
          { string: 1, fret: band.end }
        ],
        { scrollLeft: scroller.scrollLeft, width: scroller.clientWidth }
      );
      if (target === null) return;
      stopAutoScroll();
      cancelScroll = animateScroll(scroller, target, scrollDuration(), browserClock);
    });
  });

  /** First marker per valid position wins; invalid positions are ignored. */
  function firstPerPosition(markers: readonly DrawnMarker[]): Record<string, DrawnMarker> {
    const map: Record<string, DrawnMarker> = Object.create(null);
    for (const mk of markers) {
      if (!isValidPosition(instrument, mk)) continue;
      const key = positionKey(mk);
      if (!(key in map)) map[key] = mk;
    }
    return map;
  }

  /** Model markers only: cell names and the description never include pulses. */
  const markerMap = $derived(firstPerPosition(model.markers));
  /** Model markers with sounding positions overlaid (drawing only). */
  const drawnMap = $derived(firstPerPosition(applyPulses(model.markers, pulses, instrument)));

  /** Label rule (contracts/fretboard-model.md §1): explicit `label` wins, else highlighted/normal. */
  function labelText(mk: DrawnMarker): string | null {
    if (model.labelMode === 'none') return null;
    const labeled = mk.label ?? (mk.emphasis === 'highlighted' || mk.emphasis === 'normal');
    if (!labeled) return null;
    if (model.labelMode === 'interval')
      return mk.interval === undefined ? null : intervalLabel(mk.interval);
    const pitch = positionPitch(instrument, mk);
    const spelling = mk.spelling ?? defaultSpelling(pitchClass(pitch));
    return model.labelMode === 'octave'
      ? pitchLabel(spelling, octaveOf(pitch))
      : noteLabel(spelling);
  }

  const drawn = $derived(
    Object.entries(drawnMap)
      .filter(([, mk]) => mk.emphasis !== 'hidden')
      .map(([key, mk]) => ({
        key,
        mk,
        x: layout.columns[mk.fret].center,
        y: layout.rows[mk.string - 1].center,
        label: labelText(mk),
        tone: mk.emphasis === 'highlighted' ? mk.tone : undefined,
        badge:
          mk.octaveBadge === true && model.labelMode === 'note'
            ? `${octaveOf(positionPitch(instrument, mk))}`
            : null
      }))
  );

  let gesture: GestureState = { kind: 'idle' };
  let activePointers = 0;
  let hovered: Position | null = $state(null);
  let svgEl: SVGSVGElement | undefined = $state();

  /** Client coordinates → layout coordinates; internal only, never exposed. */
  function toLayout(e: PointerEvent): { x: number; y: number } {
    const r = svgEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function runEffect(effect: GestureEffect) {
    if (effect.kind === 'hide-hover') hovered = null;
    else if (effect.kind === 'scroll' && scroller) {
      stopAutoScroll();
      scroller.scrollLeft -= effect.dx;
    } else if (effect.kind === 'activate') {
      const p = nearestPosition(layout, effect.x, effect.y);
      svgEl
        ?.querySelector<SVGElement>(`.cell[data-string="${p.string}"][data-fret="${p.fret}"]`)
        ?.focus();
      onactivate?.({ string: p.string, fret: p.fret });
    }
  }

  function dispatch(event: GestureEvent) {
    const r = reduceGesture(gesture, event);
    gesture = r.state;
    runEffect(r.effect);
  }

  function onPointerDown(e: PointerEvent) {
    activePointers++;
    const { x, y } = toLayout(e);
    dispatch({
      type: 'down',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      button: e.button,
      isPrimary: e.isPrimary,
      x,
      y
    });
    if (gesture.kind === 'pending' && e.pointerType === 'mouse') {
      try {
        svgEl?.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety (drag outside the svg) */
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    const { x, y } = toLayout(e);
    if (e.pointerType === 'mouse' && gesture.kind !== 'scrolling') {
      hovered = nearestPosition(layout, x, y);
    }
    const before = gesture;
    dispatch({ type: 'move', pointerId: e.pointerId, x, y });
    // The move that crosses the drag threshold starts the scroll; carry the distance already
    // travelled so a mouse drag does not lose its first 10 px.
    if (
      before.kind === 'pending' &&
      before.pointerType === 'mouse' &&
      gesture.kind === 'scrolling'
    ) {
      stopAutoScroll();
      if (scroller) scroller.scrollLeft -= x - before.originX;
    }
  }

  function onPointerEnd(e: PointerEvent) {
    activePointers = Math.max(0, activePointers - 1);
    if (gesture.kind === 'cancelled') {
      if (activePointers === 0) gesture = { kind: 'idle' };
      return;
    }
    if (e.type === 'pointercancel') {
      dispatch({ type: 'cancel', pointerId: e.pointerId });
    } else {
      const { x, y } = toLayout(e);
      dispatch({ type: 'up', pointerId: e.pointerId, x, y });
    }
  }

  const hoverHint = $derived.by(() => {
    if (!hovered || model.hoverHint === false) return null;
    const mk = markerMap[positionKey(hovered)];
    const text = noteLabel(
      mk?.spelling ?? defaultSpelling(pitchClass(positionPitch(instrument, hovered)))
    );
    const col = layout.columns[hovered.fret];
    const row = layout.rows[hovered.string - 1];
    const w = Math.max(metrics.markerSmall + 8, text.length * 12 + 12);
    const h = metrics.markerSmall;
    const above = row.top - h >= 0;
    return {
      text,
      w,
      h,
      x: Math.min(Math.max(col.center, w / 2), layout.width - w / 2),
      y: above ? row.top - h / 2 + 2 : row.bottom + h / 2 - 2
    };
  });

  /** Roving focus (US5): `stop` is the single tabindex=0 cell; `inside` drives the focus ring. */
  let stop: Position = $state({ string: 1, fret: 0 });
  let inside = $state(false);

  const cellAt = (p: Position) =>
    svgEl?.querySelector<SVGElement>(`.cell[data-string="${p.string}"][data-fret="${p.fret}"]`);

  /** Move focus to the cell for `p` (roving tabindex and scroll follow via focusin). */
  export function focusPosition(p: Position): void {
    if (!isValidPosition(instrument, p)) return;
    cellAt(p)?.focus({ preventScroll: true });
  }

  function onFocusIn(e: FocusEvent) {
    const t = e.target as Element | null;
    if (!t?.classList.contains('cell')) return;
    stop = {
      string: Number(t.getAttribute('data-string')),
      fret: Number(t.getAttribute('data-fret'))
    };
    inside = true;
    if (!scroller) return;
    const target = scrollIntoViewTarget(layout, stop, {
      scrollLeft: scroller.scrollLeft,
      width: scroller.clientWidth
    });
    if (target === null) return;
    stopAutoScroll();
    cancelScroll = animateScroll(scroller, target, scrollDuration(), browserClock);
  }

  function onFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (!next || !svgEl?.contains(next)) inside = false;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const result = moveFocus(instrument, stop, e.key);
    if (result === null) return;
    e.preventDefault();
    if (result === 'activate') {
      onactivate?.({ string: stop.string, fret: stop.fret });
    } else {
      cellAt(result)?.focus({ preventScroll: true });
    }
  }

  const description = $derived(model.description ?? describeView(instrument, model));
  let liveText = $state('');
  let lastDescription: string | undefined;
  let showDescription = $state(false);

  // Announce only after the first render and only when the description actually changes.
  $effect(() => {
    const d = description;
    if (lastDescription === undefined) {
      lastDescription = d;
      return;
    }
    if (d !== lastDescription) {
      lastDescription = d;
      liveText = d;
    }
  });

  const diamond = (half: number) => `0,${-half} ${half},0 0,${half} ${-half},0`;

  const openLabel = (string: number) =>
    noteLabel(
      instrument.openStrings[string - 1] ??
        defaultSpelling(pitchClass(positionPitch(instrument, { string, fret: 0 })))
    );
</script>

{#snippet drawing()}
  <rect
    class="wood"
    x={layout.columns[0].start}
    y="0"
    width={layout.width - layout.columns[0].start}
    height={layout.boardBottom}
  />
  {#if band}
    <rect
      class="region-band"
      aria-hidden="true"
      x={band.x}
      y="0"
      width={band.width}
      height={layout.boardBottom}
    />
  {/if}
  {#each singleInlays as cx (cx)}
    <circle class="inlay" {cx} cy={inlayY} r={inlayRadius} />
  {/each}
  {#each doubleInlays as cx (cx)}
    {#each doubleY as cy (cy)}
      <circle class="inlay" {cx} {cy} r={inlayRadius} />
    {/each}
  {/each}
  {#each layout.columns.slice(1) as c (c.fret)}
    <line class="fret-line" x1={c.end} x2={c.end} y1="0" y2={layout.boardBottom} />
  {/each}
  <rect
    class="nut"
    x={layout.nutX - nutWidth / 2}
    y="0"
    width={nutWidth}
    height={layout.boardBottom}
  />
  {#each layout.rows as row (row.string)}
    <line
      class="string string-{row.string}"
      x1={stringsFrom}
      x2={layout.width}
      y1={row.center}
      y2={row.center}
    />
  {/each}
{/snippet}

{#if thumb}
  <svg
    class="fretboard-thumbnail"
    aria-hidden="true"
    focusable="false"
    {viewBox}
    preserveAspectRatio="xMidYMid meet"
  >
    {@render drawing()}
  </svg>
{:else}
  <div class="fretboard" data-variant="interactive" bind:this={root}>
    <!-- svelte-ignore a11y_no_static_element_interactions (only cancels auto-scroll) -->
    <div
      class="scroller"
      bind:this={scroller}
      onpointerdown={stopAutoScroll}
      onwheel={stopAutoScroll}
    >
      {#if tags.length > 0}
        <div
          class="tags"
          role="group"
          aria-label={m.fretboard_tags_label()}
          style:inline-size={`${layout.width}px`}
          style:block-size={`${tagsHeight}px`}
        >
          {#each tags as t, i (t.id)}
            <button
              type="button"
              class="tag"
              class:pressed={t.pressed}
              aria-pressed={t.pressed}
              aria-label={t.name}
              bind:this={tagEls[i]}
              style:inset-inline-start={`${placedTags[i]?.x ?? 0}px`}
              style:inset-block-start={`${(placedTags[i]?.row ?? 0) * (tagMin + TAG_GAP)}px`}
              onclick={() => ontag?.(t.id)}
            >
              <span>{t.label}</span>
              {#if t.detail}<span class="detail">{t.detail}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
      <!-- svelte-ignore a11y_interactive_supports_focus (cells are the focusable stops) -->
      <svg
        role="grid"
        aria-label={m.fretboard_label()}
        width={layout.width}
        height={layout.height}
        {viewBox}
        bind:this={svgEl}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerEnd}
        onpointercancel={onPointerEnd}
        onpointerleave={() => (hovered = null)}
        onfocusin={onFocusIn}
        onfocusout={onFocusOut}
        onkeydown={onKeyDown}
      >
        <g aria-hidden="true" class="drawing">
          {@render drawing()}
          {#each layout.rows as row (row.string)}
            <text class="string-label" x={layout.columns[0].start / 2} y={row.center}
              >{row.string} {openLabel(row.string)}</text
            >
          {/each}
          {#each fretNumbers as c (c.fret)}
            <text
              class="fret-number"
              class:inlay-fret={INLAY_FRETS.includes(c.fret) || DOUBLE_INLAY_FRETS.includes(c.fret)}
              x={c.center}
              y={numbersY}>{c.fret}</text
            >
          {/each}
        </g>
        <g aria-hidden="true" class="markers">
          {#each drawn as d (d.mk.pulse?.id ?? d.key)}
            <g
              class="marker {d.mk.function} {d.mk.emphasis}{d.tone ? ` tone-${d.tone}` : ''}"
              class:pulse={d.mk.pulse !== undefined}
              style:--pulse-duration={d.mk.pulse ? `${d.mk.pulse.durationMs}ms` : undefined}
              data-key={d.key}
              transform="translate({d.x} {d.y})"
            >
              <g class="shape">
                {#if d.mk.function === 'root'}
                  <rect
                    class="glyph"
                    x={-metrics.markerRoot / 2}
                    y={-metrics.markerRoot / 2}
                    width={metrics.markerRoot}
                    height={metrics.markerRoot}
                    rx={metrics.markerRoot / 5}
                  />
                {:else if d.mk.function === 'fifth'}
                  <polygon class="glyph" points={diamond(metrics.markerMedium / 2 + 2)} />
                {:else if d.mk.function === 'degree'}
                  <circle class="glyph outline" r={metrics.markerSmall / 2} />
                {:else if d.mk.function === 'neutral'}
                  <circle class="glyph ring" r={metrics.markerMedium / 2} />
                {:else}
                  <circle class="glyph" r={metrics.markerMedium / 2} />
                {/if}
                {#if d.label}
                  <text class="marker-label" class:long={d.label.length > 1}>{d.label}</text>
                {/if}
                {#if d.badge}
                  <text
                    class="octave-badge"
                    x={metrics.markerMedium / 2}
                    y={-metrics.markerMedium / 2}>{d.badge}</text
                  >
                {/if}
              </g>
            </g>
          {/each}
        </g>
        {#if hoverHint}
          <g
            class="hover-hint"
            aria-hidden="true"
            transform="translate({hoverHint.x} {hoverHint.y})"
          >
            <rect
              x={-hoverHint.w / 2}
              y={-hoverHint.h / 2}
              width={hoverHint.w}
              height={hoverHint.h}
              rx="4"
            />
            <text>{hoverHint.text}</text>
          </g>
        {/if}
        {#if inside}
          <rect
            class="focus-ring"
            aria-hidden="true"
            x={layout.columns[stop.fret].start + 1.5}
            y={layout.rows[stop.string - 1].top + 1.5}
            width={layout.columns[stop.fret].end - layout.columns[stop.fret].start - 3}
            height={layout.rows[stop.string - 1].bottom - layout.rows[stop.string - 1].top - 3}
            rx="4"
          />
        {/if}
        {#each layout.rows as row (row.string)}
          <g role="row" data-string={row.string}>
            {#each layout.columns as c (c.fret)}
              <rect
                role="gridcell"
                class="cell"
                data-string={row.string}
                data-fret={c.fret}
                tabindex={row.string === stop.string && c.fret === stop.fret ? 0 : -1}
                aria-label={positionName(
                  instrument,
                  { string: row.string, fret: c.fret },
                  markerMap[`${row.string}:${c.fret}`]
                )}
                x={c.start}
                y={row.top}
                width={c.end - c.start}
                height={row.bottom - row.top}
              />
            {/each}
          </g>
        {/each}
      </svg>
    </div>
    <div class="sr-only" aria-live="polite" aria-atomic="true">{liveText}</div>
    <button
      type="button"
      class="description-toggle"
      aria-expanded={showDescription}
      aria-controls="{uid}-description"
      onclick={() => (showDescription = !showDescription)}
    >
      {showDescription ? m.fretboard_description_hide() : m.fretboard_description_show()}
    </button>
    <p class="description" id="{uid}-description" hidden={!showDescription}>{description}</p>
  </div>
{/if}

<style>
  .fretboard {
    inline-size: 100%;
    min-inline-size: 0;
  }

  .scroller {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    touch-action: auto;
  }

  .tags {
    position: relative;
  }

  .tag {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--target-min);
    min-block-size: var(--target-min);
    padding-inline: var(--space-2);
    font: inherit;
    font-size: var(--font-size-sm);
    line-height: 1.1;
    white-space: nowrap;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .tag.pressed {
    font-weight: 700;
    background: var(--color-surface);
    border-width: calc(var(--border-width) * 2);
    border-color: var(--color-text);
  }

  .tag .detail {
    font-size: var(--marker-label-min-size);
    font-weight: 400;
  }

  svg {
    display: block;
    touch-action: manipulation;
  }

  .hover-hint {
    pointer-events: none;
  }

  .hover-hint rect {
    fill: var(--color-hint-surface);
    stroke: var(--color-border);
  }

  .hover-hint text {
    fill: var(--color-hint-text);
    font-size: var(--marker-label-min-size);
    font-weight: 700;
  }

  .fretboard-thumbnail {
    inline-size: 100%;
    block-size: auto;
    pointer-events: none;
  }

  .wood {
    fill: var(--color-fretboard-wood);
  }

  .region-band {
    fill: var(--region-band);
  }

  .fret-line,
  .string {
    stroke: var(--color-fretboard-line);
  }

  .fret-line {
    stroke-width: 1px;
  }

  .string-1 {
    stroke-width: var(--fb-string-width-1);
  }
  .string-2 {
    stroke-width: var(--fb-string-width-2);
  }
  .string-3 {
    stroke-width: var(--fb-string-width-3);
  }
  .string-4 {
    stroke-width: var(--fb-string-width-4);
  }
  .string-5 {
    stroke-width: var(--fb-string-width-5);
  }
  .string-6 {
    stroke-width: var(--fb-string-width-6);
  }

  .nut {
    fill: var(--color-nut);
  }

  .inlay {
    fill: var(--color-inlay);
  }

  text {
    fill: var(--color-text-muted);
    font-family: var(--font-family-notes);
    font-variant-numeric: tabular-nums;
    text-anchor: middle;
    dominant-baseline: central;
    font-size: var(--font-size-sm);
  }

  .string-label {
    font-size: var(--marker-label-min-size);
  }

  .fret-number {
    font-weight: 400;
  }

  .fret-number.inlay-fret {
    font-weight: 700;
    fill: var(--color-text);
  }

  .cell {
    fill: transparent;
  }

  .cell:focus,
  .cell:focus-visible {
    outline: none;
  }

  .focus-ring {
    fill: none;
    stroke: var(--color-focus-ring);
    stroke-width: var(--focus-ring-width);
    pointer-events: none;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .description-toggle {
    min-block-size: 44px;
    min-inline-size: 44px;
    margin-block-start: var(--space-2, 0.5rem);
    padding-inline: var(--space-3, 0.75rem);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
  }

  .description {
    margin-block: var(--space-2, 0.5rem) 0;
    overflow-wrap: anywhere;
  }

  .marker {
    pointer-events: none;
  }

  .shape {
    transition: transform var(--duration-short);
  }

  .marker.highlighted .shape {
    transform: scale(var(--emph-highlight-scale));
    filter: drop-shadow(0 0 var(--marker-elevation-stroke) var(--color-text));
  }

  .marker.pulse .shape {
    animation: marker-pulse var(--pulse-duration) var(--ease-standard) 1 both;
  }

  @keyframes marker-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    15% {
      transform: scale(var(--pulse-scale));
      opacity: var(--pulse-opacity-peak);
    }
    100% {
      transform: scale(var(--emph-highlight-scale));
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .marker.pulse .shape {
      animation: none;
    }
  }

  .marker.dimmed {
    opacity: var(--emph-dim-opacity);
  }

  .marker.dimmed .shape {
    transform: scale(var(--emph-dim-scale));
  }

  .marker.root .glyph {
    fill: var(--color-root);
  }

  .marker.third .glyph {
    fill: var(--color-third);
  }

  .marker.fifth .glyph {
    fill: var(--color-fifth);
  }

  .glyph.ring {
    fill: var(--color-neutral-note);
    stroke: var(--color-neutral-note-stroke);
    stroke-width: var(--marker-neutral-stroke-width);
  }

  .marker.neutral.highlighted .glyph {
    fill: var(--color-note-highlight);
    stroke: var(--color-neutral-note-stroke);
  }

  .marker.neutral.highlighted.tone-1 .glyph {
    fill: var(--octave-tone-1);
  }
  .marker.neutral.highlighted.tone-2 .glyph {
    fill: var(--octave-tone-2);
  }
  .marker.neutral.highlighted.tone-3 .glyph {
    fill: var(--octave-tone-3);
  }
  .marker.neutral.highlighted.tone-4 .glyph {
    fill: var(--octave-tone-4);
  }
  .marker.neutral.highlighted.tone-5 .glyph {
    fill: var(--octave-tone-5);
  }
  .marker.neutral.highlighted.tone-6 .glyph {
    fill: var(--octave-tone-6);
  }
  .marker.neutral.highlighted.tone-7 .glyph {
    fill: var(--octave-tone-7);
  }

  .marker.neutral.highlighted text.marker-label {
    fill: var(--color-note-highlight-label);
  }

  .marker text.octave-badge {
    fill: var(--color-text);
    font-size: var(--marker-badge-size);
    font-weight: 700;
    text-anchor: start;
    paint-order: stroke;
    stroke: var(--color-surface-raised);
    stroke-width: 2px;
  }

  .glyph.outline {
    fill: none;
    stroke: var(--color-degree-stroke);
    stroke-width: var(--marker-stroke);
  }

  .marker text.marker-label {
    fill: var(--color-marker-label);
    font-size: var(--marker-label-size);
    font-weight: 700;
  }

  .marker.neutral text.marker-label,
  .marker.degree text.marker-label {
    fill: var(--color-neutral-note-stroke);
  }

  .marker text.marker-label.long {
    font-size: var(--marker-label-min-size);
  }
</style>
