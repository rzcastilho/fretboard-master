/**
 * CAGED Listen planner (data-model §3–§4, research R-02…R-07). Pure: no Svelte, DOM, paraglide or
 * `audio/` import. Every function is total. Turns what CAGED draws into a playback plan.
 */
import type { Position } from '../instrument/instrument';
import type { CagedQuality, CagedShapeId, ShapeOccurrence } from '../theory/caged';
import { inLayer, type MelodicLayer, type ScaleDegree } from '../theory/caged-layers';
import type { ShapeTriad } from '../theory/caged-triad';
import type { Pitch } from '../theory/pitch';
import type { ResolvedPosition } from './caged-layers';
import type { CagedViewState } from './caged-view';
import {
  BLOCK_DELAY_MS,
  LISTEN_BPM,
  RING_MS,
  SHAPE_GAP_MS,
  STRUM_GAP_MS,
  TEMPO_BPM,
  type ListenStep,
  type Tempo
} from './listen';

export type ListenLayer = 'scale' | 'pentatonic' | 'arpeggio' | 'triad' | 'chord';

export type ListenSource =
  | { readonly kind: 'shape'; readonly layer: ListenLayer; readonly letter: CagedShapeId }
  | { readonly kind: 'all-chords' };

/** Widest first. Not `LAYER_PRIORITY`, which is drawing order. */
export const LISTEN_ORDER: readonly ListenLayer[] = [
  'scale',
  'pentatonic',
  'arpeggio',
  'triad',
  'chord'
];

export interface RegionNote {
  readonly string: number;
  readonly fret: number;
  readonly degree: ScaleDegree;
  readonly pitch: Pitch;
}

/** Structurally the audio layer's `TimedStep` (state may not import audio). */
export interface TimedStep {
  readonly positions: readonly Position[];
  readonly onsetMs: number;
  readonly durationMs: number;
}

export interface CagedListenInput {
  readonly view: CagedViewState;
  /** Drawn occurrences, sorted by start (nut → body). */
  readonly occurrences: readonly ShapeOccurrence[];
  readonly focusIndex: number | null;
  /** `display.positions`, low → high. */
  readonly positions: readonly ResolvedPosition[];
  /** The selected set's triad for the focused shape, else null. */
  readonly triad: ShapeTriad | null;
  /** Effective instrument, string 1 first. */
  readonly openPitches: readonly Pitch[];
  readonly tempo: Tempo;
}

export type CagedListenPlan =
  | {
      readonly kind: 'sequence';
      readonly steps: readonly ListenStep[];
      readonly bpm: number;
      readonly source: ListenSource;
    }
  | {
      readonly kind: 'timeline';
      readonly events: readonly TimedStep[];
      readonly source: ListenSource;
    }
  | { readonly kind: 'none' };

/** A chord tone to strum. */
export interface ChordPosition {
  readonly string: number;
  readonly fret: number;
  readonly pitch: Pitch;
}

const NONE: CagedListenPlan = { kind: 'none' };
const MELODIC: ReadonlySet<ListenLayer> = new Set(['scale', 'pentatonic', 'arpeggio']);

/** Pitch ascending; a unison goes to the thicker (higher-numbered) string first. */
const byPitch = (a: { pitch: Pitch; string: number }, b: { pitch: Pitch; string: number }) =>
  a.pitch - b.pitch || b.string - a.string;

const at = (p: { string: number; fret: number }): Position => ({ string: p.string, fret: p.fret });

/** What Listen plays: the widest layer on for the focused shape, or every chord with no focus. */
export function listenSource(
  input: Pick<CagedListenInput, 'view' | 'occurrences' | 'focusIndex' | 'triad'>
): ListenSource {
  const { view, occurrences, focusIndex, triad } = input;
  const occ = focusIndex === null ? undefined : occurrences?.[focusIndex];
  if (!occ) return { kind: 'all-chords' };
  const layer =
    LISTEN_ORDER.find((l) => {
      if (l === 'chord') return false;
      if (!view?.layers?.[l]) return false;
      return l !== 'triad' || triad !== null;
    }) ?? 'chord';
  return { kind: 'shape', layer, letter: occ.shape.id };
}

/** The highlighted positions of a melodic layer, as drawn (P-2). Low → high. */
export function listenRegion(
  positions: readonly ResolvedPosition[],
  layer: MelodicLayer,
  quality: CagedQuality
): readonly RegionNote[] {
  return (positions ?? [])
    .filter((p) => p.emphasis === 'highlighted' && inLayer(p.degree, layer, quality))
    .map(({ string, fret, degree, pitch }) => ({ string, fret, degree, pitch }));
}

/** One position per pitch, the thicker string's, ascending by pitch (P-3). */
export function dedupeUnisons(region: readonly RegionNote[]): readonly RegionNote[] {
  const out: RegionNote[] = [];
  for (const n of [...(region ?? [])].sort(byPitch)) {
    if (out.length === 0 || out[out.length - 1].pitch !== n.pitch) out.push(n);
  }
  return out;
}

/**
 * Up and back. Arpeggio: the whole region (P-1). Pentatonic and Scale: from the lowest root
 * (P-4; a region without a root starts at its lowest note).
 */
export function melodicSteps(
  region: readonly RegionNote[],
  layer: MelodicLayer
): readonly Position[] {
  const d = dedupeUnisons(region);
  const n = d.length;
  if (n === 0) return [];
  const start =
    layer === 'arpeggio'
      ? 0
      : Math.max(
          0,
          d.findIndex((p) => p.degree === 'R')
        );
  const up = d.slice(start);
  const down = d.slice(start, n - 1).reverse();
  return [...up, ...down].map(at);
}

/** The shape's chord tones, ascending: never string 7, never an altered string 6 (P-5). */
export function chordPositions(
  occ: ShapeOccurrence,
  openPitches: readonly Pitch[]
): readonly ChordPosition[] {
  const out: ChordPosition[] = [];
  for (const n of occ?.notes ?? []) {
    if (n.string > 6 || (occ.alteredString && n.string === 6)) continue;
    const open = openPitches?.[n.string - 1];
    if (!Number.isFinite(open)) continue;
    out.push({ string: n.string, fret: n.fret, pitch: open + n.fret });
  }
  return out.sort(byPitch);
}

/** A strum, one note per `STRUM_GAP_MS`, then the block `BLOCK_DELAY_MS` after the last strum. */
export function strumEvents(
  chord: readonly { string: number; fret: number }[],
  t0: number
): readonly TimedStep[] {
  const k = chord?.length ?? 0;
  if (k === 0) return [];
  const strums = chord.map((p, i) => ({
    positions: [at(p)],
    onsetMs: t0 + STRUM_GAP_MS * i,
    durationMs: RING_MS
  }));
  const block = {
    positions: chord.map(at),
    onsetMs: t0 + STRUM_GAP_MS * (k - 1) + BLOCK_DELAY_MS,
    durationMs: RING_MS
  };
  return [...strums, block];
}

/** Every drawn shape's chord, nut → body; each starts `SHAPE_GAP_MS` after the previous block. */
function allChords(input: CagedListenInput): readonly TimedStep[] {
  const events: TimedStep[] = [];
  let t0 = 0;
  for (const occ of input.occurrences) {
    const shape = strumEvents(chordPositions(occ, input.openPitches), t0);
    if (shape.length === 0) continue;
    events.push(...shape);
    t0 = shape[shape.length - 1].onsetMs + SHAPE_GAP_MS;
  }
  return events;
}

export function buildCagedListen(input: CagedListenInput): CagedListenPlan {
  if (!input || !Array.isArray(input.occurrences) || input.occurrences.length === 0) return NONE;
  const source = listenSource(input);
  if (source.kind === 'all-chords') {
    const events = allChords(input);
    return events.length === 0 ? NONE : { kind: 'timeline', events, source };
  }
  const occ = input.occurrences[input.focusIndex ?? -1];
  if (!occ) return NONE;

  if (source.layer === 'chord') {
    const events = strumEvents(chordPositions(occ, input.openPitches), 0);
    return events.length === 0 ? NONE : { kind: 'timeline', events, source };
  }
  if (source.layer === 'triad') {
    const t = input.triad;
    if (!t) return NONE;
    const [low, mid, high] = t.frets.map((fret, i) => ({ string: t.set - i, fret }));
    return {
      kind: 'sequence',
      steps: [low, mid, high, [low, mid, high]],
      bpm: LISTEN_BPM,
      source
    };
  }
  if (!MELODIC.has(source.layer)) return NONE;
  const layer = source.layer as MelodicLayer;
  const steps = melodicSteps(listenRegion(input.positions, layer, input.view.quality), layer);
  if (steps.length === 0) return NONE;
  return { kind: 'sequence', steps, bpm: TEMPO_BPM[input.tempo] ?? LISTEN_BPM, source };
}
