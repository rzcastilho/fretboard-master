/**
 * CAGED layer rules (data-model §4, contracts/caged-layers-api §4).
 * Pure: imports only `../theory/*` and `./caged-view` types. No Svelte, DOM or paraglide.
 * Every function is total; a no-op returns the same object.
 */
import type { ShapeOccurrence } from '../theory/caged';
import {
  LAYER_PRIORITY,
  inLayer,
  isExtraMarked,
  layerNotes,
  type CagedLayer,
  type LayerNote,
  type MelodicLayer,
  type ScaleDegree
} from '../theory/caged-layers';
import type { CagedQuality } from '../theory/caged';
import type { Pitch, PitchClass } from '../theory/pitch';
import type { CagedFocus, LayersOn } from './caged-view';

export type { CagedLayer };

/** Chord layer only: the initial and reset state. */
export const CHORD_ONLY: LayersOn = Object.freeze({
  chord: true,
  arpeggio: false,
  pentatonic: false,
  scale: false
});

export interface SwitchState {
  readonly on: boolean;
  readonly disabled: null | 'last-layer' | 'no-shapes';
}

/** On, and (for Pentatonic and Scale) a shape is in focus. */
export function isDrawable(l: LayersOn, layer: CagedLayer, hasFocus: boolean): boolean {
  if (!l?.[layer]) return false;
  return layer === 'chord' || layer === 'arpeggio' || hasFocus;
}

export function drawableCount(l: LayersOn, hasFocus: boolean): number {
  return LAYER_PRIORITY.filter((layer) => isDrawable(l, layer, hasFocus)).length;
}

function disabledReason(
  l: LayersOn,
  layer: CagedLayer,
  hasFocus: boolean,
  hasOccurrences: boolean
): SwitchState['disabled'] {
  if (!hasOccurrences) return 'no-shapes';
  if (isDrawable(l, layer, hasFocus) && drawableCount(l, hasFocus) === 1) return 'last-layer';
  return null;
}

export function switchStates(
  l: LayersOn,
  hasFocus: boolean,
  hasOccurrences: boolean
): Readonly<Record<CagedLayer, SwitchState>> {
  const state = (layer: CagedLayer): SwitchState => ({
    on: !!l?.[layer],
    disabled: disabledReason(l, layer, hasFocus, hasOccurrences)
  });
  return {
    chord: state('chord'),
    arpeggio: state('arpeggio'),
    pentatonic: state('pentatonic'),
    scale: state('scale')
  };
}

/** Flips one layer. The same reference when the switch is disabled or the layer is unknown. */
export function toggleLayer(
  l: LayersOn,
  layer: CagedLayer,
  hasFocus: boolean,
  hasOccurrences: boolean
): LayersOn {
  if (!l || !LAYER_PRIORITY.includes(layer)) return l;
  // Turning a layer on is never blocked by `last-layer`.
  const blocked = l[layer]
    ? disabledReason(l, layer, hasFocus, hasOccurrences) !== null
    : !hasOccurrences;
  return blocked ? l : { ...l, [layer]: !l[layer] };
}

/** Pentatonic or Scale goes from off to on with nothing in focus (FR-012). */
export function needsAutoFocus(l: LayersOn, layer: CagedLayer, focus: CagedFocus | null): boolean {
  return (layer === 'pentatonic' || layer === 'scale') && !l?.[layer] && focus === null;
}

/** When nothing is drawable, Chord comes back on (FR-002); the other flags are kept. */
export function ensureDrawable(
  l: LayersOn,
  hasFocus: boolean
): { readonly layers: LayersOn; readonly restoredChord: boolean } {
  if (drawableCount(l, hasFocus) > 0) return { layers: l, restoredChord: false };
  return { layers: { ...l, chord: true }, restoredChord: true };
}

export interface ResolvedPosition {
  readonly string: number;
  readonly fret: number;
  readonly degree: ScaleDegree;
  readonly layer: CagedLayer;
  readonly emphasis: 'highlighted' | 'normal' | 'dimmed';
  readonly extra: boolean;
  readonly pitch: Pitch;
}

export interface ResolveInput {
  /** Drawn occurrences, sorted by start. */
  readonly occurrences: readonly ShapeOccurrence[];
  readonly focusIndex: number | null;
  readonly layers: LayersOn;
  readonly rootPc: PitchClass;
  readonly quality: CagedQuality;
  /** String 1 first; length 6 or 7. */
  readonly openPitches: readonly Pitch[];
  readonly fretCount: number;
}

const MELODIC: readonly MelodicLayer[] = ['arpeggio', 'pentatonic', 'scale'];
const keyOf = (string: number, fret: number): string => `${string}:${fret}`;
const byPitch = (a: { pitch: Pitch; string: number }, b: { pitch: Pitch; string: number }) =>
  a.pitch - b.pitch || b.string - a.string;

/**
 * One entry per `string:fret` (FR-009). Priority chord > arpeggio > pentatonic > scale; the
 * focused region claims its positions first and is highlighted (FR-018). Sorted low → high.
 */
export function resolveCagedPositions(input: ResolveInput): readonly ResolvedPosition[] {
  if (!input) return [];
  const { occurrences, focusIndex, layers, rootPc, quality, openPitches, fretCount } = input;
  if (!Array.isArray(occurrences) || !Array.isArray(openPitches) || !layers) return [];
  const focus =
    focusIndex !== null && focusIndex !== undefined && occurrences[focusIndex] ? focusIndex : null;
  const both = layers.pentatonic && layers.scale;
  const claimed = new Map<string, ResolvedPosition>();

  const claim = (
    string: number,
    fret: number,
    degree: ScaleDegree,
    layer: CagedLayer,
    emphasis: ResolvedPosition['emphasis']
  ): void => {
    const key = keyOf(string, fret);
    if (claimed.has(key)) return;
    const open = openPitches[string - 1];
    if (!Number.isFinite(open)) return;
    claimed.set(key, {
      string,
      fret,
      degree,
      layer,
      emphasis,
      extra:
        both && (layer === 'pentatonic' || layer === 'scale') && isExtraMarked(degree, quality),
      pitch: open + fret
    });
  };

  /** Highest-priority enabled layer for a scale note of the focused occurrence. */
  const melodicLayerOf = (degree: ScaleDegree): MelodicLayer | null =>
    MELODIC.find((l) => layers[l] && inLayer(degree, l, quality)) ?? null;

  const drawChord = (occ: ShapeOccurrence, emphasis: ResolvedPosition['emphasis']): void => {
    for (const n of occ.notes)
      if (n.string <= 6) claim(n.string, n.fret, n.degree, 'chord', emphasis);
  };

  if (focus !== null) {
    const occ: ShapeOccurrence = occurrences[focus];
    // Focused occurrence first: its chord notes, then every scale note of its region.
    const chordKeys = new Set(occ.notes.map((n) => keyOf(n.string, n.fret)));
    if (layers.chord) drawChord(occ, 'highlighted');
    const scaleNotes: readonly LayerNote[] = layerNotes(
      occ,
      openPitches,
      rootPc,
      quality,
      fretCount
    );
    for (const n of scaleNotes) {
      const isChord = layers.chord && chordKeys.has(keyOf(n.string, n.fret)) && n.string <= 6;
      if (isChord) continue;
      const layer = melodicLayerOf(n.degree);
      if (layer !== null) claim(n.string, n.fret, n.degree, layer, 'highlighted');
    }
    // Other shapes: dimmed chord markers only.
    if (layers.chord)
      occurrences.forEach((o, i) => {
        if (i !== focus) drawChord(o, 'dimmed');
      });
  } else {
    if (layers.chord) for (const occ of occurrences) drawChord(occ, 'normal');
    if (layers.arpeggio)
      for (const occ of occurrences)
        for (const n of layerNotes(occ, openPitches, rootPc, quality, fretCount))
          if (inLayer(n.degree, 'arpeggio', quality))
            claim(n.string, n.fret, n.degree, 'arpeggio', 'normal');
  }
  return [...claimed.values()].sort(byPitch);
}

export function layerCounts(p: readonly ResolvedPosition[]): Readonly<Record<CagedLayer, number>> {
  const out: Record<CagedLayer, number> = { chord: 0, arpeggio: 0, pentatonic: 0, scale: 0 };
  for (const r of p ?? []) out[r.layer] += 1;
  return out;
}

/** Keys of `next` not in `prev`, by pitch ascending, ties → higher string number first. */
export function revealOrder(
  prev: readonly ResolvedPosition[],
  next: readonly ResolvedPosition[]
): readonly string[] {
  const seen = new Set((prev ?? []).map((p) => keyOf(p.string, p.fret)));
  return (next ?? [])
    .filter((p) => !seen.has(keyOf(p.string, p.fret)))
    .sort(byPitch)
    .map((p) => keyOf(p.string, p.fret));
}
