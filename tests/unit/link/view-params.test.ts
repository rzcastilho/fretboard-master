import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, tuningFromOffsets } from '$lib/instrument/tunings';
import { PARAM_ORDER } from '$lib/link/format';
import { decodeLink, encodeLink, viewParams, type ShareSnapshot } from '$lib/link';

const ORIGIN = 'https://fretboard.example';
const STD = { stringCount: 6, tuning: STANDARD_TUNING, fretCount: 22 } as const;
const INSTRUMENT_KEYS = ['v', 'sc', 'tu', 'fr'];

function snapshots(instrument: ShareSnapshot['instrument'] = STD): ShareSnapshot[] {
  const base = (tool: 'notes' | 'triads' | 'caged') => {
    const r = decodeLink(new URL(`${ORIGIN}/${tool}?v=1`));
    if (r.kind !== 'ok') throw new Error('fixture');
    return { ...r.snapshot, instrument } as ShareSnapshot;
  };
  return [base('notes'), base('triads'), base('caged')];
}

describe('viewParams', () => {
  it.each(snapshots())('$tool returns only its view tokens', (snapshot) => {
    const out = viewParams(snapshot);
    const expected = PARAM_ORDER[snapshot.tool].filter((k) => !INSTRUMENT_KEYS.includes(k));
    expect(Object.keys(out).sort()).toEqual([...expected].sort());
    for (const k of INSTRUMENT_KEYS) expect(k in out).toBe(false);
  });

  it.each(snapshots())('$tool values match the encoded link', (snapshot) => {
    const out = viewParams(snapshot);
    const url = new URL(encodeLink(snapshot, ORIGIN));
    for (const [k, val] of Object.entries(out)) expect(url.searchParams.get(k)).toBe(val);
  });

  it.each(snapshots())('$tool carries no origin or path', (snapshot) => {
    const text = JSON.stringify(viewParams(snapshot));
    expect(text).not.toContain('http');
    expect(text).not.toContain(ORIGIN);
    expect(text).not.toContain('/');
  });

  it('a custom tuning snapshot yields no tu', () => {
    const custom = tuningFromOffsets([1, 0, 0, 0, 0, 0]);
    for (const s of snapshots({ ...STD, tuning: custom })) {
      const out = viewParams(s);
      expect('tu' in out).toBe(false);
      expect(JSON.stringify(out)).not.toContain('c.');
    }
  });
});
