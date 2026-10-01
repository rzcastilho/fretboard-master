/** Pure request planning. Never throws. */
import {
  isValidPosition,
  positionKey,
  positionPitch,
  type Instrument,
  type Position
} from '../instrument/instrument';
import type { PlannedStep, PlaybackRequest, Plan, TimeMark } from './types';

export const NOTE_MS = 1500;
export const MIN_BPM = 30;
export const MAX_BPM = 300;

/** NaN → 30, +∞ → 300, −∞ → 30. */
export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}

function validUnique(instrument: Instrument, positions: readonly Position[]): Position[] {
  const seen = new Set<string>();
  const out: Position[] = [];
  for (const p of positions) {
    if (!isValidPosition(instrument, p)) continue;
    const key = positionKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function buildStep(
  instrument: Instrument,
  positions: readonly Position[],
  onsetMs: number,
  durationMs: number
): { step: PlannedStep; marks: TimeMark[] } | null {
  const valid = validUnique(instrument, positions);
  if (valid.length === 0) return null;
  return {
    step: {
      onsetMs,
      durationMs,
      pitches: valid.map((p) => positionPitch(instrument, p)),
      positions: valid
    },
    marks: valid.map((position) => ({ position, onsetMs, endMs: onsetMs + durationMs }))
  };
}

export function planRequest(request: PlaybackRequest, instrument: Instrument): Plan {
  const steps: PlannedStep[] = [];
  const marks: TimeMark[] = [];
  const add = (r: ReturnType<typeof buildStep>): void => {
    if (!r) return;
    steps.push(r.step);
    marks.push(...r.marks);
  };

  if (request.kind === 'note') {
    add(buildStep(instrument, [request.position], 0, NOTE_MS));
  } else if (request.kind === 'chord') {
    add(buildStep(instrument, request.positions, 0, NOTE_MS));
  } else {
    const beat = 60000 / clampBpm(request.bpm);
    request.steps.forEach((s, i) => {
      const positions = Array.isArray(s) ? (s as readonly Position[]) : [s as Position];
      add(buildStep(instrument, positions, i * beat, beat));
    });
  }
  return { steps, marks, kind: request.kind };
}
