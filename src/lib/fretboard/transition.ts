/**
 * Marker reconciliation for model-change motion (026, data-model §7).
 *
 * Pure: no DOM, Svelte or timers. Given the last drawn list and the next one, it decides which
 * markers keep an identity (so the renderer can move them) and how new and removed markers
 * enter and exit. It never changes what is drawn: the output markers are exactly `next`, in
 * order.
 */
import { positionKey, type Position } from '../instrument/instrument';
import type { DrawnMarker } from './types';

export type MotionKind = 'slide' | 'by-role' | 'cross-fade' | 'focus' | 'reveal' | 'none';

export interface KeyedMarker {
  readonly key: string;
  readonly mk: DrawnMarker;
  readonly enter: 'instant' | 'fade' | 'reveal';
  readonly exit: 'instant' | 'fade';
  /** Comparison marker: starts at this position, then slides to its own. */
  readonly from?: Position;
}

/** Identity of a marker apart from motion: pulse id, then `id`, then its position. */
function baseKey(mk: DrawnMarker): string {
  if (mk.pulse) return `pulse:${mk.pulse.id}`;
  return mk.id ?? positionKey(mk);
}

/** Make keys unique in output order; a repeated key gets a numeric suffix. */
function uniqueKeys(items: readonly KeyedMarker[]): readonly KeyedMarker[] {
  const seen = new Set<string>();
  return items.map((item) => {
    let key = item.key;
    for (let n = 2; seen.has(key); n++) key = `${item.key}#${n}`;
    seen.add(key);
    return key === item.key ? item : { ...item, key };
  });
}

const pulsed = (mk: DrawnMarker): KeyedMarker => ({
  key: baseKey(mk),
  mk,
  enter: 'instant',
  exit: 'instant'
});

/** Unpulsed items grouped by string, each group in fret order. */
function byString<T>(items: readonly T[], mkOf: (item: T) => DrawnMarker): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const mk = mkOf(item);
    if (mk.pulse) continue;
    const list = groups.get(mk.string) ?? [];
    list.push(item);
    groups.set(mk.string, list);
  }
  for (const list of groups.values()) list.sort((a, b) => mkOf(a).fret - mkOf(b).fret);
  return groups;
}

function slide(
  prev: readonly KeyedMarker[],
  next: readonly DrawnMarker[],
  generation: number
): KeyedMarker[] {
  const prevByString = byString(prev, (p) => p.mk);
  const paired = new Map<DrawnMarker, string>();
  for (const [string, list] of byString(next, (mk) => mk)) {
    const old = prevByString.get(string) ?? [];
    list.forEach((mk, i) => {
      if (i < old.length) paired.set(mk, old[i].key);
    });
  }

  return next.map((mk): KeyedMarker => {
    if (mk.pulse) return pulsed(mk);
    const key = paired.get(mk);
    if (key !== undefined) return { key, mk, enter: 'instant', exit: 'fade' };
    return { key: `${generation}:${baseKey(mk)}`, mk, enter: 'fade', exit: 'fade' };
  });
}

function byRole(
  prev: readonly KeyedMarker[],
  next: readonly DrawnMarker[],
  generation: number
): KeyedMarker[] {
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  const bases = new Map<string, DrawnMarker>();
  for (const mk of next) {
    if (mk.variant !== 'comparison' && !bases.has(mk.function)) bases.set(mk.function, mk);
  }
  return next.map((mk): KeyedMarker => {
    if (mk.pulse) return pulsed(mk);
    const key = baseKey(mk);
    const old = prevByKey.get(key);
    if (old && old.mk.string !== mk.string) {
      return { key: `${generation}:${key}`, mk, enter: 'fade', exit: 'fade' };
    }
    if (old) return { key, mk, enter: 'instant', exit: 'fade' };
    const base = mk.variant === 'comparison' ? bases.get(mk.function) : undefined;
    if (base) {
      return {
        key,
        mk,
        enter: 'instant',
        exit: 'fade',
        from: { string: base.string, fret: base.fret }
      };
    }
    return { key, mk, enter: 'fade', exit: 'fade' };
  });
}

/**
 * @param prev last drawn list (with the keys it was drawn with)
 * @param next markers after `applyPulses`
 * @param kind how the model changed
 * @param generation incremented per model update; keeps fresh keys distinct from older ones
 */
export function reconcileMarkers(
  prev: readonly KeyedMarker[],
  next: readonly DrawnMarker[],
  kind: MotionKind,
  generation: number
): readonly KeyedMarker[] {
  if (kind === 'slide') return uniqueKeys(slide(prev, next, generation));
  if (kind === 'by-role') return uniqueKeys(byRole(prev, next, generation));
  const known = new Set(prev.map((p) => p.key));
  return uniqueKeys(
    next.map((mk): KeyedMarker => {
      if (kind === 'focus' || kind === 'none') {
        return { key: baseKey(mk), mk, enter: 'instant', exit: 'instant' };
      }
      if (mk.pulse) return pulsed(mk);
      if (kind === 'cross-fade') {
        return { key: `${generation}:${baseKey(mk)}`, mk, enter: 'fade', exit: 'fade' };
      }
      // reveal
      const key = baseKey(mk);
      return { key, mk, enter: known.has(key) ? 'instant' : 'reveal', exit: 'fade' };
    })
  );
}

/**
 * Same model drawn again (a pulse, a different instrument): every marker keeps the key of the
 * marker that sat on its position, so nothing re-enters. Pulsed markers keep their own key.
 */
export function adoptKeys(
  prev: readonly KeyedMarker[],
  next: readonly KeyedMarker[]
): readonly KeyedMarker[] {
  const byPosition = new Map(
    prev.filter((p) => !p.mk.pulse).map((p) => [positionKey(p.mk), p.key] as const)
  );
  const used = new Set(next.filter((k) => !byPosition.has(positionKey(k.mk))).map((k) => k.key));
  return next.map((k) => {
    const key = k.mk.pulse ? undefined : byPosition.get(positionKey(k.mk));
    if (key === undefined || used.has(key)) return k;
    used.add(key);
    return { ...k, key, enter: 'instant' as const };
  });
}
