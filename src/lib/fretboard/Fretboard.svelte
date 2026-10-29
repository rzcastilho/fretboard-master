<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { onMount, tick, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import {
    defaultSpelling,
    intervalLabel,
    markerSpellings,
    noteLabel,
    pitchLabel,
    singleSpelling,
    stringSpelling
  } from '../notation/notation';
  import { fitMarkerLabel, type FittedLabel, type MarkerSize } from './label-fit';
  import { octaveOf, pitchClass } from '../theory/pitch';
  import {
    isValidPosition,
    positionKey,
    positionPitch,
    type Position
  } from '../instrument/instrument';
  import { describeView, positionName } from './description';
  import Minimap, { type MinimapDot } from './Minimap.svelte';
  import ViewAids from './ViewAids.svelte';
  import { legendGroups } from './legend';
  import {
    DEFAULT_METRICS,
    DOUBLE_INLAY_FRETS,
    INLAY_FRETS,
    layoutFretboard,
    nearestPosition,
    rowOf,
    type FretboardLayout,
    type FretboardMetrics,
    trailingEdgeScroll
  } from './geometry';
  import {
    autoScrollTarget,
    centerScrollTarget,
    groupScrollTarget,
    moveFocus,
    nutOffset,
    reduceGesture,
    scrollForNutOffset,
    scrollIntoViewTarget
  } from './interaction';
  import { layoutTags } from './tags';
  import { applyPulses } from './pulse';
  import { readMetrics } from './metrics';
  import { animateScroll, browserClock } from './scroll-animation';
  import { tokenDuration } from './motion';
  import { printInlinePx } from './print-layout';
  import { adoptKeys, reconcileMarkers, type KeyedMarker, type MotionKind } from './transition';
  import type {
    DrawnMarker,
    FretboardProps,
    GestureEffect,
    GestureEvent,
    GestureState
  } from './types';

  /** Vertical gap (px) between a marked string's label and its text mark. */
  const STRING_MARK_OFFSET = 9;
  const NO_MARKERS = { markers: [], labelMode: 'none' } as const;
  /** Whole mode: marker labels are omitted below this glyph scale (shape still carries function). */
  const LABEL_MIN_SCALE = 0.75;
  /** `--target-min`: a column narrower than this is too small to tap reliably in whole mode. */
  const TARGET_MIN_PX = 44;

  let {
    instrument,
    model = NO_MARKERS,
    variant = 'interactive',
    onactivate,
    pulses = [],
    ontag,
    fit = 'comfortable',
    onfit,
    printing: printRequested = false,
    takeAnchor
  }: FretboardProps = $props();

  const thumb = $derived(variant === 'thumbnail');
  const preview = $derived(variant === 'preview');
  /** Decorative variants: no markers, tags, band, arrows, scrolling or handlers. */
  const compact = $derived(thumb || preview);

  let metrics: FretboardMetrics = $state(DEFAULT_METRICS);
  /** Inner radius of the connection ring: clears the largest glyph. */
  const ringBase = $derived(Math.max(metrics.markerRoot, metrics.markerMedium + 4) / 2);
  let containerWidth = $state(0);
  let root: HTMLElement | undefined = $state();
  let scroller: HTMLElement | undefined = $state();
  /**
   * Markers are placed with the SVG `transform` attribute, which prerenders under the
   * `style-src 'self'` CSP. Once mounted, an inline `transform` style (set through the CSSOM,
   * which the CSP allows) takes over so position changes run the CSS transition (R-07).
   */
  let mounted = $state(false);

  onMount(() => {
    mounted = true;
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
  const scrollDuration = () => tokenDuration(root);

  /** How the model that is on screen arrived (026): set once per model update, before the patch. */
  let activeKind: MotionKind = 'none';
  /** Kinds in which a removed marker fades out; every other removal is immediate. */
  const FADES_OUT: readonly MotionKind[] = ['slide', 'by-role', 'cross-fade', 'reveal'];

  /**
   * Intro (026 data-model §7). `fade`: opacity over `--duration-short`. `reveal` (a layer
   * switched on): starts after `appear × (short − fast)` and fades and scales in over
   * `--duration-fast`, so the whole sequence fits in `--duration-short`. A marker with `from`
   * (comparison) also slides from there to its own cell. `instant`: nothing. Reduced motion
   * zeroes every duration. Never 0 ms: see `markerOut`.
   */
  function markerIn(
    node: Element,
    mk: { enter: KeyedMarker['enter']; appear?: number; slideFrom?: { x: number; y: number } }
  ) {
    if (mk.slideFrom && mounted) startSlideFrom(node as SVGGElement, mk.slideFrom);
    if (mk.enter === 'reveal' && mk.appear !== undefined) {
      const short = tokenDuration(root);
      const fast = tokenDuration(root, '--duration-fast');
      const shape = node.querySelector<SVGGElement>('.shape');
      return {
        ...fade(node, {
          duration: Math.max(1, fast),
          delay: Math.max(0, mk.appear * (short - fast))
        }),
        tick: (t: number) => {
          if (shape) shape.style.transform = t < 1 ? `scale(${0.6 + 0.4 * t})` : '';
        }
      };
    }
    // Never 0: Svelte 5 keyed-each groups never finish when some items' transitions complete
    // synchronously (duration 0) and others asynchronously. 1 ms is visually instant.
    return fade(node, { duration: Math.max(1, mk.enter === 'instant' ? 0 : tokenDuration(root)) });
  }
  /** Outro: fades in the moving kinds; every other removal is immediate and never staggered. */
  function markerOut(node: Element) {
    return fade(node, {
      duration: Math.max(1, FADES_OUT.includes(activeKind) ? tokenDuration(root) : 0)
    });
  }
  /**
   * Comparison enter: write the base marker's transform without a transition, then target the
   * marker's own cell on the next frame, so it slides out of the base marker (same CSSOM
   * technique as `mounted`).
   */
  function startSlideFrom(node: SVGGElement, from: { x: number; y: number }) {
    const target = node.style.transform;
    node.style.transition = 'none';
    node.style.transform = `translate(${from.x}px, ${from.y}px)`;
    requestAnimationFrame(() => {
      node.style.transition = '';
      node.style.transform = target;
    });
  }
  function arrowFade(node: Element, direction: { in: boolean }) {
    const d = tokenDuration(root);
    return fade(node, { duration: d, delay: direction.in ? d : 0 });
  }

  /** Marks for strings the instrument has; the interactive variant only. */
  const stringMarks = $derived(
    compact
      ? []
      : (model.stringMarks ?? []).filter(
          (mk) => instrument.openStrings.length >= mk.string && mk.string >= 1
        )
  );
  const markByString = $derived(new Map(stringMarks.map((mk) => [mk.string, mk.label])));
  /** A boolean, so a marker-only model change does not re-derive the layout. */
  const hasStringMarks = $derived(stringMarks.length > 0);
  /**
   * Print layout (R-11): the whole neck at the nominal print width, whatever the screen's fit,
   * container width, scroll or arrangement, so every print of a view is the same.
   */
  const printing = $derived(printRequested && !compact);
  const layoutWidth = $derived(printing ? printInlinePx(root) : containerWidth);
  const layoutFit = $derived(printing ? 'whole' : fit);
  const layout = $derived(
    layoutFretboard(instrument, metrics, layoutWidth, variant, hasStringMarks, layoutFit)
  );
  const lastFret = $derived(layout.columns.length - 1);

  /**
   * Fit availability (025): the interactive neck overflows its container at comfortable size.
   * Reported once measured and on every change; never by thumbnail/preview.
   */
  const overflows = $derived(containerWidth > 0 && layout.naturalWidth > containerWidth);
  let lastOverflow: boolean | undefined;
  $effect(() => {
    const value = overflows;
    if (!mounted || compact || containerWidth === 0) return;
    if (value === lastOverflow) return;
    lastOverflow = value;
    untrack(() => onfit?.({ kind: 'overflow', value }));
  });

  /** Highlighted valid positions in layout space for the minimap. */
  const minimapDots = $derived.by((): MinimapDot[] => {
    if (compact || !layout.scrolls) return [];
    const rowIndex = new Map(layout.rows.map((r, i) => [r.string, i]));
    const dots: MinimapDot[] = [];
    for (const mk of model.markers) {
      if (mk.emphasis !== 'highlighted' || !isValidPosition(instrument, mk)) continue;
      const row = rowIndex.get(mk.string);
      const col = layout.columns[mk.fret];
      if (row === undefined || !col) continue;
      dots.push({ x: col.center, row });
    }
    return dots;
  });

  const singleInlays = $derived(
    INLAY_FRETS.filter((f) => f <= lastFret).map((f) => layout.columns[f].center)
  );
  const doubleInlays = $derived(
    DOUBLE_INLAY_FRETS.filter((f) => f <= lastFret).map((f) => layout.columns[f].center)
  );
  const inlayY = $derived((layout.boardTop + layout.boardBottom) / 2);
  const doubleY = $derived(layout.doubleInlayY);
  const fretNumbers = $derived(layout.columns.filter((c) => c.fret >= 1));
  const numbersY = $derived(
    layout.numbersEdge === 'top'
      ? layout.boardTop - metrics.numbersRow / 2
      : layout.boardBottom + metrics.numbersRow / 2
  );
  const inlayRadius = $derived(compact ? metrics.thumbRow * 0.3 : metrics.row * 0.14);
  const nutWidth = $derived(compact ? metrics.thumbRow / 3 : metrics.nutWidth);
  const viewBox = $derived(`0 0 ${layout.width} ${layout.height}`);

  /**
   * Fret-count change (R-11): the browser clamps `scrollLeft` instantly when the board shrinks.
   * Record the old position and width before the DOM updates; afterwards, if the old offset is
   * past the new maximum, hold the content at its old width for one animation and glide to the
   * trailing edge. Reduced motion (`0s` token) applies no hold. Never raises a notice (FR-014).
   */
  let seenFretCount = untrack(() => instrument.fretCount);
  let pendingScroll: { left: number; width: number } | null = null;
  let holdWidth: number | null = $state(null);
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  $effect.pre(() => {
    const n = instrument.fretCount;
    if (n === seenFretCount) return;
    seenFretCount = n;
    untrack(() => {
      if (!scroller || compact) return;
      pendingScroll = { left: scroller.scrollLeft, width: scroller.scrollWidth };
    });
  });

  $effect(() => {
    const current = layout;
    const el = scroller;
    if (!el || compact || pendingScroll === null) return;
    const pending = pendingScroll;
    pendingScroll = null;
    // Mirrored: the shrink happens at the far (left) end, so the nut-offset anchor below keeps
    // the visible frets without a clamp and there is nothing to glide.
    if (current.mirrored) return;
    untrack(() => {
      const viewport = el.clientWidth;
      if (pending.left <= Math.max(0, current.width - viewport)) return;
      const target = trailingEdgeScroll(current, viewport);
      const duration = scrollDuration();
      stopAutoScroll();
      clearTimeout(holdTimer);
      if (duration <= 0) {
        holdWidth = null;
        el.scrollLeft = target;
        return;
      }
      holdWidth = pending.width;
      void tick().then(() => {
        el.scrollLeft = pending.left;
        cancelScroll = animateScroll(el, target, duration, browserClock);
        holdTimer = setTimeout(() => (holdWidth = null), duration + 50);
      });
    });
  });

  /**
   * Scroll anchor (US1): keep the same nut offset when the layout width or handedness changes,
   * so a handedness switch shows the same frets and an unscrolled left-handed board starts at
   * `maxScroll` (nut visible). Instant, no animation. Skipped while a fret-count shrink glide
   * owns the scroll position, and before the container is measured.
   */
  let anchored: FretboardLayout | null = null;
  let scrollBefore = 0;

  // Runs before the DOM patch, so `scrollLeft` is still the one the old layout produced.
  $effect.pre(() => {
    void layout;
    untrack(() => {
      scrollBefore = scroller?.scrollLeft ?? 0;
    });
  });

  $effect(() => {
    const current = layout;
    const el = scroller;
    if (!el || compact || containerWidth === 0) return;
    untrack(() => {
      const prev = anchored;
      anchored = current;
      // Pure checks first: reading `clientWidth` forces a synchronous reflow.
      if (prev === null) {
        if (current.mirrored) el.scrollLeft = scrollForNutOffset(current, 0, el.clientWidth);
        return;
      }
      if (prev.width === current.width && prev.mirrored === current.mirrored) return;
      if (!prev.mirrored && !current.mirrored) return; // right-handed keeps the browser's own scroll
      if (holdWidth !== null) return;
      const viewport = el.clientWidth;
      const offset = nutOffset(prev, scrollBefore, viewport);
      stopAutoScroll();
      el.scrollLeft = scrollForNutOffset(current, offset, viewport);
    });
  });

  /**
   * Scroll anchor on a fit switch (FR-013): after whole ↔ comfortable keep the highlighted (or
   * CAGED-focus) groups visible, else the nut offset the layout already preserved. An accepted
   * small-fret notice centres the tapped position instead (clamped). Instant, no animation.
   */
  let lastFit = untrack(() => fit);
  $effect(() => {
    const mode = fit;
    const current = layout;
    const el = scroller;
    if (!el || compact || containerWidth === 0 || mode === lastFit) return;
    lastFit = mode;
    untrack(() => {
      const width = el.clientWidth;
      const maxScroll = Math.max(0, current.width - width);
      const accepted = mode === 'comfortable' ? (takeAnchor?.() ?? null) : null;
      let target: number | null;
      if (accepted && isValidPosition(instrument, accepted)) {
        target = Math.min(
          Math.max(current.columns[accepted.fret].center - width / 2, 0),
          maxScroll
        );
      } else if (model.autoScroll) {
        const groups = model.autoScroll.groups.map((g) =>
          g.filter((p) => isValidPosition(instrument, p))
        );
        target = groupScrollTarget(current, groups, { scrollLeft: el.scrollLeft, width });
      } else {
        const positions = model.markers.filter(
          (mk) => mk.emphasis === 'highlighted' && isValidPosition(instrument, mk)
        );
        target = autoScrollTarget(current, positions, { scrollLeft: el.scrollLeft, width });
      }
      if (target === null) return;
      stopAutoScroll();
      el.scrollLeft = target;
    });
  });

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
    let frame = 0;
    untrack(() => {
      // A board that fits has nothing to scroll.
      const el = scroller;
      if (!el || key === '' || !layout.scrolls) return;
      const run = () => {
        const viewport = { scrollLeft: el.scrollLeft, width: el.clientWidth };
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
        cancelScroll = animateScroll(el, target, duration, browserClock);
      };
      const duration = scrollDuration();
      if (duration <= 0) return run();
      // Animated: measure in the next frame, still before it paints. Reading the scroll
      // geometry here would force a synchronous reflow of the board just patched, inside the
      // control → board budget (≤ 100 ms).
      frame = requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(frame);
  });

  // Shape tags (Full neck): measured widths feed the pure layout; absent tags reserve nothing.
  const TAG_GAP = 4;
  const tags = $derived(compact ? [] : (model.tags ?? []));
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
    if (!r || compact || !Number.isFinite(r.start) || !Number.isFinite(r.end)) return null;
    const clamp = (v: number) => Math.min(lastFret, Math.max(0, Math.round(v)));
    const start = clamp(Math.min(r.start, r.end));
    const end = clamp(Math.max(r.start, r.end));
    const left = Math.min(layout.columns[start].start, layout.columns[end].start);
    const right = Math.max(layout.columns[start].end, layout.columns[end].end);
    return { start, end, x: left, width: right - left };
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
      const viewport = { scrollLeft: scroller.scrollLeft, width: scroller.clientWidth };
      const centered = model.region?.align === 'center';
      const target = centered
        ? centerScrollTarget(layout, band.start, band.end, viewport)
        : autoScrollTarget(
            layout,
            [
              { string: 1, fret: band.start },
              { string: 1, fret: band.end }
            ],
            viewport
          );
      if (target === null) return;
      stopAutoScroll();
      const duration = centered ? tokenDuration(root, '--duration-medium') : scrollDuration();
      cancelScroll = animateScroll(scroller, target, duration, browserClock);
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
  function labelLines(mk: DrawnMarker): readonly string[] | null {
    if (model.labelMode === 'none') return null;
    const labeled = mk.label ?? (mk.emphasis === 'highlighted' || mk.emphasis === 'normal');
    if (!labeled) return null;
    if (model.labelMode === 'interval')
      return mk.interval === undefined ? null : [intervalLabel(mk.interval)];
    const pitch = positionPitch(instrument, mk);
    if (mk.spelling === undefined && model.spellingPolicy === 'preference') {
      const octave = octaveOf(pitch);
      return markerSpellings(pitchClass(pitch)).map((sp) =>
        model.labelMode === 'octave' ? pitchLabel(sp, octave) : noteLabel(sp)
      );
    }
    const spelling = mk.spelling ?? defaultSpelling(pitchClass(pitch));
    return [
      model.labelMode === 'octave' ? pitchLabel(spelling, octaveOf(pitch)) : noteLabel(spelling)
    ];
  }

  /** Marker size class used by the label-fit rule (data-model §11). */
  function markerSizeOf(mk: DrawnMarker): MarkerSize {
    if (mk.function === 'root') return 'root';
    return mk.function === 'degree' ? 'small' : 'medium';
  }

  function labelFit(mk: DrawnMarker): FittedLabel | null {
    const lines = labelLines(mk);
    return lines === null ? null : fitMarkerLabel(lines, markerSizeOf(mk));
  }

  /**
   * Arrows (F9, F10, F14). A `move` arrow is a line between two cell centres shortened by the
   * marker radius, arrowhead at `toFret`. An `off-board` arrow runs from the `fromFret` marker
   * to the outer edge of the first (`nut`) or last (`end`) column, arrowhead at that edge. All x
   * come from `layout.columns`, so orientation and handedness follow the layout alone (F11).
   * Invalid arrows are dropped; the thumbnail draws none (F15).
   */
  const drawnArrows = $derived.by(() => {
    if (compact) return [];
    const head = metrics.arrowHead;
    const inset = metrics.markerMedium / 2 + 2;
    const validFret = (f: number) => Number.isInteger(f) && f >= 0 && f <= instrument.fretCount;
    const last = layout.columns.length - 1;
    // Outer edge x of the nut-side and end-side columns, whichever way the layout runs.
    const outward = (end: 'nut' | 'end'): { x: number; dir: number } => {
      const first = layout.columns[0];
      const second = layout.columns[1] ?? first;
      const tail = layout.columns[last];
      if (end === 'nut') {
        const dir = Math.sign(first.center - second.center) || -1;
        return { x: dir < 0 ? first.start : first.end, dir };
      }
      const prev = layout.columns[last - 1] ?? tail;
      const dir = Math.sign(tail.center - prev.center) || 1;
      return { x: dir > 0 ? tail.end : tail.start, dir };
    };
    return (model.arrows ?? []).flatMap((a) => {
      if (!Number.isInteger(a.string) || a.string < 1 || a.string > instrument.stringCount)
        return [];
      if (!validFret(a.fromFret)) return [];
      const row = rowOf(layout, a.string);
      const from = layout.columns[a.fromFret].center;
      let tip: number;
      let dir: number;
      if (a.kind === 'move') {
        if (!validFret(a.toFret) || a.fromFret === a.toFret) return [];
        const to = layout.columns[a.toFret].center;
        dir = Math.sign(to - from);
        tip = to - dir * inset;
      } else if (a.edge === 'nut' || a.edge === 'end') {
        const o = outward(a.edge);
        dir = o.dir;
        tip = o.x;
      } else return [];
      const x1 = from + dir * inset;
      // Short runs (the edge is closer than a marker radius plus the head) keep the head only.
      const base = dir > 0 ? Math.max(x1, tip - head) : Math.min(x1, tip + head);
      return [
        {
          id: a.id,
          label: a.label,
          x1,
          x2: base,
          y: row.center,
          head: `${tip},${row.center} ${base},${row.center - head / 2} ${base},${row.center + head / 2}`,
          labelX: (x1 + tip) / 2,
          labelY: row.top + 2
        }
      ];
    });
  });

  /**
   * Keys of the markers last drawn, with the model they were drawn for. Plain variables: the
   * list is rebuilt inside `keyed`, which runs once per model, pulse or instrument change.
   */
  /** The model the board mounted with never animates in; later models carry their own kind. */
  const mountModel = untrack(() => model);
  const motionAttr = $derived<MotionKind>(model === mountModel ? 'none' : (model.motion ?? 'none'));
  let drawnBefore: readonly KeyedMarker[] = [];
  let drawnFor: object | undefined;
  let generation = 0;

  /** A new model reconciles by its `motion`; any other change (pulse, instrument) keeps keys. */
  const keyed = $derived.by((): readonly KeyedMarker[] => {
    const list = Object.values(drawnMap).filter((mk) => mk.emphasis !== 'hidden');
    const modelChanged = drawnFor !== undefined && model !== drawnFor;
    const first = drawnFor === undefined;
    drawnFor = model;
    if (modelChanged) generation++;
    const kind: MotionKind = modelChanged ? (model.motion ?? 'none') : 'none';
    const prev = drawnBefore;
    let out = reconcileMarkers(prev, list, kind, generation);
    if (!modelChanged && !first) out = adoptKeys(prev, out);
    if (modelChanged || first) activeKind = kind;
    drawnBefore = out;
    return out;
  });

  const drawn = $derived(
    keyed.map(({ key: id, mk, enter, from }) => {
      const base = from && isValidPosition(instrument, from) ? from : null;
      return {
        id,
        enter,
        key: positionKey(mk),
        mk,
        x: layout.columns[mk.fret].center,
        y: rowOf(layout, mk.string).center,
        slideFrom: base
          ? { x: layout.columns[base.fret].center, y: rowOf(layout, base.string).center }
          : undefined,
        label: layout.markerScale < LABEL_MIN_SCALE && !printing ? null : labelFit(mk),
        tone: mk.emphasis === 'highlighted' ? mk.tone : undefined,
        badge:
          mk.octaveBadge === true && model.labelMode === 'note'
            ? `${octaveOf(positionPitch(instrument, mk))}`
            : null
      };
    })
  );

  const narrowestColumn = $derived(
    layout.columns.reduce((min, c) => Math.min(min, c.end - c.start), Infinity)
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
      const position = { string: p.string, fret: p.fret };
      onactivate?.(position);
      if (fit === 'whole' && narrowestColumn < TARGET_MIN_PX) {
        onfit?.({ kind: 'small-tap', position });
      }
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
    const hoveredPc = pitchClass(positionPitch(instrument, hovered));
    const text = noteLabel(
      mk?.spelling ??
        (model.spellingPolicy === 'preference'
          ? singleSpelling(hoveredPc)
          : defaultSpelling(hoveredPc))
    );
    const col = layout.columns[hovered.fret];
    const row = rowOf(layout, hovered.string);
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

  const diamond = (half: number) => `0,${-half} ${half},0 0,${half} ${-half},0`;

  const openLabel = (string: number) => {
    const open =
      instrument.openStrings[string - 1] ??
      defaultSpelling(pitchClass(positionPitch(instrument, { string, fret: 0 })));
    return noteLabel(
      model.spellingPolicy === 'preference' ? stringSpelling(open, instrument.fixedSpelling) : open
    );
  };
</script>

{#snippet drawing()}
  <rect
    class="wood"
    x={layout.board.start}
    y={layout.boardTop}
    width={layout.board.end - layout.board.start}
    height={layout.boardBottom - layout.boardTop}
  />
  {#if band}
    <rect
      class="region-band"
      aria-hidden="true"
      x={band.x}
      y={layout.boardTop}
      width={band.width}
      height={layout.boardBottom - layout.boardTop}
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
    {@const fx = layout.mirrored ? c.start : c.end}
    <line class="fret-line" x1={fx} x2={fx} y1={layout.boardTop} y2={layout.boardBottom} />
  {/each}
  <rect
    class="nut"
    x={layout.nutX - nutWidth / 2}
    y={layout.boardTop}
    width={nutWidth}
    height={layout.boardBottom - layout.boardTop}
  />
  {#each layout.rows as row (row.string)}
    <line
      class="string string-{row.string}"
      x1={layout.strings.from}
      x2={layout.strings.to}
      y1={row.center}
      y2={row.center}
    />
  {/each}
{/snippet}

{#snippet tagStrip()}
  {#if tags.length > 0}
    <div
      class="tags"
      role="group"
      aria-label={m.fretboard_tags_label()}
      style:inline-size={`${layout.width}px`}
      style:block-size={`${tagsHeight}px`}
    >
      {#each tags as t, i (t.id)}
        {#if model.tagsInteractive === false}
          <span
            class="tag static"
            bind:this={tagEls[i]}
            style:inset-inline-start={`${placedTags[i]?.x ?? 0}px`}
            style:inset-block-start={`${(placedTags[i]?.row ?? 0) * (tagMin + TAG_GAP)}px`}
          >
            <span>{t.label}</span>
            {#if t.detail}<span class="detail">{t.detail}</span>{/if}
          </span>
        {:else}
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
        {/if}
      {/each}
    </div>
  {/if}
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
    {#each layout.rows as row (row.string)}
      <text class="string-label" x={layout.labelCenter} y={row.center}>{openLabel(row.string)}</text
      >
    {/each}
  </svg>
{:else if preview}
  <svg
    class="fretboard-preview"
    aria-hidden="true"
    focusable="false"
    {viewBox}
    preserveAspectRatio="xMinYMid meet"
  >
    {@render drawing()}
    {#each layout.rows as row (row.string)}
      <text class="string-label" x={layout.labelCenter} y={row.center}>{openLabel(row.string)}</text
      >
    {/each}
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
      {#if layout.numbersEdge === 'bottom'}
        {@render tagStrip()}
      {/if}
      <!-- svelte-ignore a11y_interactive_supports_focus (cells are the focusable stops) -->
      <svg
        role="grid"
        aria-label={m.fretboard_label()}
        width={layout.width}
        height={layout.height}
        {viewBox}
        bind:this={svgEl}
        data-motion={motionAttr}
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
            {@const mark = markByString.get(row.string)}
            <text
              class="string-label"
              x={layout.labelCenter}
              y={mark === undefined ? row.center : row.center - STRING_MARK_OFFSET}
              >{row.string} {openLabel(row.string)}</text
            >
            {#if mark !== undefined}
              <text
                class="string-mark"
                x={layout.labelCenter}
                y={row.center + STRING_MARK_OFFSET}
                aria-hidden="true">{mark}</text
              >
            {/if}
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
        <g
          aria-hidden="true"
          class="markers"
          data-marker-scale={layout.markerScale}
          style:--marker-scale={printing ? layout.markerScale : undefined}
        >
          {#each drawn as d (d.id)}
            <g
              class="marker {d.mk.function} {d.mk.emphasis}{d.tone ? ` tone-${d.tone}` : ''}"
              class:comparison={d.mk.variant === 'comparison'}
              class:layer-arpeggio={d.mk.layer === 'arpeggio'}
              class:layer-triad={d.mk.layer === 'triad'}
              class:pulse={d.mk.pulse !== undefined}
              data-variant={d.mk.variant}
              style:--pulse-duration={d.mk.pulse ? `${d.mk.pulse.durationMs}ms` : undefined}
              data-key={d.key}
              transform="translate({d.x} {d.y})"
              style:transform={mounted ? `translate(${d.x}px, ${d.y}px)` : undefined}
              in:markerIn={{ enter: d.enter, appear: d.mk.appear, slideFrom: d.slideFrom }}
              out:markerOut
            >
              <g class="shape">
                <g
                  class="glyph-scale"
                  transform={layout.markerScale < 1 ? `scale(${layout.markerScale})` : undefined}
                >
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
                  {#if d.mk.extra && d.mk.function === 'degree'}
                    <circle class="extra-dot" aria-hidden="true" cy={metrics.markerSmall / 2 + 3} />
                  {/if}
                  {#if d.mk.ring}
                    <circle
                      class="connection-ring"
                      aria-hidden="true"
                      style:--ring-base={ringBase}
                    />
                  {/if}
                  {#if d.label}
                    <text
                      class="marker-label"
                      class:normal={d.label.size === 'normal'}
                      class:min={d.label.size === 'min'}
                      aria-hidden="true"
                      >{#if d.label.lines.length === 2}<tspan x="0" dy="-0.55em"
                          >{d.label.lines[0]}</tspan
                        ><tspan x="0" dy="1.1em">{d.label.lines[1]}</tspan>{:else}{d.label
                          .lines[0]}{/if}</text
                    >
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
            </g>
          {/each}
        </g>
        <g aria-hidden="true" class="arrows">
          {#each drawnArrows as a (a.id)}
            <g
              class="arrow"
              data-id={a.id}
              in:arrowFade={{ in: true }}
              out:arrowFade={{ in: false }}
            >
              <line class="arrow-line" x1={a.x1} y1={a.y} x2={a.x2} y2={a.y} />
              <polygon class="arrowhead" points={a.head} />
              <text class="arrow-label" x={a.labelX} y={a.labelY}>{a.label}</text>
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
          {#each ['focus-ring-outer', 'focus-ring-inner'] as ring (ring)}
            <rect
              class="focus-ring {ring}"
              aria-hidden="true"
              x={layout.columns[stop.fret].start + 1.5}
              y={rowOf(layout, stop.string).top + 1.5}
              width={layout.columns[stop.fret].end - layout.columns[stop.fret].start - 3}
              height={rowOf(layout, stop.string).bottom - rowOf(layout, stop.string).top - 3}
              rx="4"
            />
          {/each}
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
                  markerMap[`${row.string}:${c.fret}`],
                  model.spellingPolicy
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
      {#if layout.numbersEdge === 'top'}
        {@render tagStrip()}
      {/if}
      {#if holdWidth !== null}
        <div class="hold" aria-hidden="true" style:inline-size={`${holdWidth}px`}></div>
      {/if}
    </div>
    {#if layout.scrolls && !printing}
      <Minimap {layout} {scroller} dots={minimapDots} />
    {/if}
    <ViewAids {description} legend={legendGroups(model)} {printing} />
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
    touch-action: pan-x pan-y;
  }

  .tags {
    position: relative;
  }

  /* Keeps the old scroll extent for one animation after the board shrinks (R-11). */
  .hold {
    block-size: 0;
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

  .tag.static {
    cursor: default;
    user-select: none;
  }

  .tag.pressed {
    font-weight: var(--font-weight-bold);
    background: var(--color-surface);
    border-width: calc(var(--border-width) * 2);
    border-color: var(--color-text);
  }

  .tag .detail {
    font-size: var(--marker-label-min-size);
    font-weight: var(--font-weight-normal);
  }

  svg {
    display: block;
    /* Board paint never inherits the surface text colour: identical in both themes. */
    color: var(--fb-color-number);
    touch-action: manipulation;
  }

  .hover-hint {
    pointer-events: none;
  }

  .hover-hint rect {
    fill: var(--fb-color-neutral);
    stroke: var(--fb-color-neutral-stroke);
  }

  .hover-hint text {
    fill: var(--fb-color-label-on-neutral);
    font-size: var(--marker-label-min-size);
    font-weight: var(--font-weight-bold);
  }

  .fretboard-preview {
    display: block;
    inline-size: 100%;
    block-size: auto;
    pointer-events: none;
  }

  .fretboard-thumbnail {
    inline-size: 100%;
    block-size: auto;
    pointer-events: none;
  }

  .wood {
    fill: var(--fb-color-wood);
    stroke: var(--fb-color-edge);
    stroke-width: var(--fb-edge-width);
  }

  .region-band {
    fill: var(--fb-region-band);
  }

  .fret-line,
  .string {
    stroke: var(--fb-color-line);
  }

  .fret-line {
    stroke-width: var(--fb-stroke-hairline);
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
  .string-7 {
    stroke-width: var(--fb-string-width-7);
  }

  .nut {
    fill: var(--fb-color-nut);
  }

  .inlay {
    fill: var(--fb-color-inlay);
  }

  text {
    fill: var(--fb-color-number);
    font-family: var(--font-family-notes);
    font-variant-numeric: tabular-nums;
    text-anchor: middle;
    dominant-baseline: central;
    font-size: var(--font-size-sm);
  }

  .string-label {
    font-size: var(--marker-label-min-size);
  }

  .string-mark {
    font-size: var(--marker-label-min-size);
    font-style: italic;
  }

  .fret-number {
    font-weight: var(--font-weight-normal);
  }

  .fret-number.inlay-fret {
    font-weight: var(--font-weight-bold);
    fill: var(--fb-color-number-strong);
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
    pointer-events: none;
  }

  /* Two-tone ring: wide outer stroke under a narrow inner stroke, visible on any fill. */
  .focus-ring-outer {
    stroke: var(--color-focus-ring-outer);
    stroke-width: var(--focus-ring-width);
  }

  .focus-ring-inner {
    stroke: var(--color-focus-ring-inner);
    stroke-width: calc(var(--focus-ring-width) / 3);
  }

  /* Only the six change situations animate (026): every other model change is instant. */
  [data-motion='none'] .marker,
  [data-motion='none'] .shape {
    transition: none;
  }

  .marker {
    pointer-events: none;
    transition:
      transform var(--duration-short) var(--ease-standard),
      opacity var(--duration-short) var(--ease-standard);
  }

  .shape {
    transition: transform var(--duration-short);
  }

  /* Focus dims and restores emphasis over `--duration-medium`; every other kind stays short. */
  [data-motion='focus'] .marker {
    transition:
      transform var(--duration-short) var(--ease-standard),
      opacity var(--duration-medium) var(--ease-standard);
  }

  [data-motion='focus'] .shape {
    transition: transform var(--duration-medium);
  }

  .marker.highlighted .shape {
    transform: scale(var(--emph-highlight-scale));
    filter: drop-shadow(0 0 var(--marker-elevation-stroke) var(--fb-color-elevation));
  }

  /* Arpeggio layer: smaller and slightly translucent; shape still carries the function. */
  .marker.layer-arpeggio .shape {
    transform: scale(var(--marker-layer-scale));
    opacity: var(--marker-layer-opacity);
  }

  .marker.layer-arpeggio.highlighted .shape {
    transform: scale(calc(var(--marker-layer-scale) * var(--emph-highlight-scale)));
  }

  /* Triad layer: larger with a heavier outline so it reads over every other layer. */
  .marker.layer-triad .shape {
    transform: scale(var(--marker-triad-scale));
  }

  .marker.layer-triad .glyph {
    stroke: var(--fb-color-outline);
    stroke-width: var(--marker-triad-stroke);
  }

  .marker.layer-triad.highlighted .shape {
    transform: scale(calc(var(--marker-triad-scale) * var(--emph-highlight-scale)));
  }

  .marker .extra-dot {
    fill: var(--fb-color-outline);
    r: var(--marker-extra-dot);
  }
  .marker .connection-ring {
    fill: none;
    stroke: var(--fb-color-outline);
    stroke-width: var(--connection-ring-width);
    r: calc(var(--ring-base) * var(--unit-px) + var(--connection-ring-gap));
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

  .marker.comparison .glyph {
    stroke: var(--fb-color-outline);
    stroke-width: var(--marker-stroke);
    stroke-dasharray: var(--marker-dash) var(--marker-dash-gap);
  }

  .arrows {
    pointer-events: none;
  }

  .arrow-line {
    stroke: var(--fb-color-outline);
    stroke-width: var(--marker-stroke);
  }

  .arrowhead {
    fill: var(--fb-color-outline);
    stroke: none;
  }

  .arrows text.arrow-label {
    fill: var(--fb-color-outline);
    font-size: var(--marker-label-min-size);
    font-weight: var(--font-weight-bold);
    paint-order: stroke;
    stroke: var(--fb-color-arrow-halo);
    stroke-width: var(--fb-label-halo-width);
  }

  .marker.dimmed {
    opacity: var(--emph-dim-opacity);
  }

  .marker.dimmed .shape {
    transform: scale(var(--emph-dim-scale));
  }

  .marker.root .glyph {
    fill: var(--fb-color-root);
  }

  .marker.third .glyph {
    fill: var(--fb-color-third);
  }

  .marker.fifth .glyph {
    fill: var(--fb-color-fifth);
  }

  .glyph.ring {
    fill: var(--fb-color-neutral);
    stroke: var(--fb-color-neutral-stroke);
    stroke-width: var(--marker-neutral-stroke-width);
  }

  .marker.neutral.highlighted .glyph {
    fill: var(--fb-color-note-highlight);
    stroke: var(--fb-color-neutral-stroke);
  }

  .marker.neutral.highlighted.tone-1 .glyph {
    fill: var(--fb-octave-tone-1);
  }
  .marker.neutral.highlighted.tone-2 .glyph {
    fill: var(--fb-octave-tone-2);
  }
  .marker.neutral.highlighted.tone-3 .glyph {
    fill: var(--fb-octave-tone-3);
  }
  .marker.neutral.highlighted.tone-4 .glyph {
    fill: var(--fb-octave-tone-4);
  }
  .marker.neutral.highlighted.tone-5 .glyph {
    fill: var(--fb-octave-tone-5);
  }
  .marker.neutral.highlighted.tone-6 .glyph {
    fill: var(--fb-octave-tone-6);
  }
  .marker.neutral.highlighted.tone-7 .glyph {
    fill: var(--fb-octave-tone-7);
  }

  .marker.neutral.highlighted text.marker-label {
    fill: var(--fb-color-note-highlight-label);
  }

  .marker text.octave-badge {
    fill: var(--fb-color-number-strong);
    font-size: var(--marker-badge-size);
    font-weight: var(--font-weight-bold);
    text-anchor: start;
    paint-order: stroke;
    stroke: var(--fb-color-arrow-halo);
    stroke-width: var(--fb-glyph-halo-width);
  }

  .glyph.outline {
    fill: none;
    stroke: var(--fb-color-degree-stroke);
    stroke-width: var(--marker-stroke);
  }

  .marker text.marker-label {
    fill: var(--fb-color-label);
    font-size: var(--marker-label-size);
    font-weight: var(--font-weight-bold);
  }

  .marker.neutral text.marker-label,
  .marker.degree text.marker-label {
    fill: var(--fb-color-label-on-neutral);
  }

  .marker text.marker-label.min {
    font-size: var(--marker-label-min-size);
  }

  @media print {
    .scroller {
      overflow: visible;
    }

    svg[role='grid'] {
      inline-size: 100%;
      block-size: auto;
      max-block-size: var(--print-board-max-block);
      break-inside: avoid;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .fret-number,
    .string-label {
      font-size: max(var(--font-size-sm), var(--print-text-min));
    }

    /* Markers are scaled by --marker-scale: raise the label so it still prints at >= 7 pt. */
    .marker text.marker-label,
    .marker text.marker-label.min {
      font-size: max(
        var(--marker-label-min-size),
        calc(var(--print-text-min) / var(--marker-scale, 1))
      );
    }
  }
</style>
