import { isValidPosition, positionKey, STANDARD_GUITAR } from '../instrument/instrument';
import type { DrawnMarker, Marker, Pulse } from './types';

/**
 * Overlay sounding positions on markers (data-model §6). Pure.
 * A marked position keeps its function/spelling and is drawn highlighted with the pulse;
 * an unmarked one gets a transient neutral highlighted marker.
 */
export function applyPulses(
  markers: readonly Marker[],
  pulses: readonly Pulse[],
  instrument = STANDARD_GUITAR
): readonly DrawnMarker[] {
  if (pulses.length === 0) return markers;
  const byKey = new Map<string, Pulse>();
  for (const p of pulses) {
    if (!isValidPosition(instrument, p.position)) continue;
    byKey.set(positionKey(p.position), p);
  }
  if (byKey.size === 0) return markers;
  const seen = new Set<string>();
  const out: DrawnMarker[] = markers.map((mk) => {
    const key = positionKey(mk);
    const pulse = byKey.get(key);
    if (!pulse || seen.has(key)) return mk;
    seen.add(key);
    return {
      ...mk,
      emphasis: 'highlighted',
      pulse: { id: pulse.id, durationMs: pulse.durationMs }
    };
  });
  for (const [key, pulse] of byKey) {
    if (seen.has(key)) continue;
    out.push({
      string: pulse.position.string,
      fret: pulse.position.fret,
      function: 'neutral',
      emphasis: 'highlighted',
      pulse: { id: pulse.id, durationMs: pulse.durationMs }
    });
  }
  return out;
}
