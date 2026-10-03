import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  MAX_RAW_LENGTH,
  PREFS_VERSION,
  TOOL_IDS,
  parsePreferences,
  serializePreferences,
  type Preferences
} from '../../../src/lib/prefs/schema';
import { TOOLS } from '../../../src/lib/shell/tools';
import { TUNING_PRESETS } from '../../../src/lib/instrument/tunings';
import { FIXTURES } from './fixtures';

const rec = (o: unknown): string => JSON.stringify(o);

describe('constants and defaults (FR-018)', () => {
  it('exposes version, limit and frozen defaults', () => {
    expect(PREFS_VERSION).toBe(1);
    expect(MAX_RAW_LENGTH).toBe(16_384);
    expect(Object.isFrozen(DEFAULT_PREFERENCES)).toBe(true);
    expect(DEFAULT_PREFERENCES).toEqual({
      tuningId: 'AF-1',
      fretCount: 22,
      muted: false,
      volume: 80,
      lastTool: null,
      labels: { notes: 'name', triads: 'interval' }
    });
  });

  it('null raw gives defaults', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it('ToolId picklist equals the ids in TOOLS', () => {
    expect([...TOOL_IDS].sort()).toEqual(TOOLS.map((t) => t.id).sort());
  });
});

describe('fixture table', () => {
  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s', (_n, f) => {
    expect(parsePreferences(f.raw)).toEqual(f.expected);
  });
});

describe('per-field fallback (US2 scenario 6)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  it('volume out of range → 80', () => expect(p({ volume: 3 }).volume).toBe(80));
  it('frets out of range → 22', () => expect(p({ frets: 99 }).fretCount).toBe(22));
  it('frets non-integer → 22', () => expect(p({ frets: 13.5 }).fretCount).toBe(22));
  it('unknown tuning → AF-1', () => expect(p({ tuning: 'AF-99' }).tuningId).toBe('AF-1'));
  it('muted wrong type → false', () => expect(p({ muted: 'true' }).muted).toBe(false));
  it.each(['caged', 'home'])('lastTool %s → null', (v) =>
    expect(p({ lastTool: v }).lastTool).toBeNull()
  );
  it('labels.triads octave → interval', () =>
    expect(p({ labels: { triads: 'octave' } }).labels.triads).toBe('interval'));
  it('custom-tuning object keeps frets', () => {
    const r = p({ tuning: { strings: [] }, frets: 24 });
    expect(r.tuningId).toBe('AF-1');
    expect(r.fretCount).toBe(24);
  });
  it('valid tuning with invalid frets keeps tuning, and reverse', () => {
    const a = p({ tuning: 'AF-4', frets: 'x' });
    expect([a.tuningId, a.fretCount]).toEqual(['AF-4', 22]);
    const b = p({ tuning: 'nope', frets: 15 });
    expect([b.tuningId, b.fretCount]).toEqual(['AF-1', 15]);
  });
  it('volume maps round(x*20)*5', () => {
    expect(p({ volume: 0.35 }).volume).toBe(35);
    expect(p({ volume: 0.36 }).volume).toBe(35);
    expect(p({ volume: 0.38 }).volume).toBe(40);
    expect(p({ volume: 0 }).volume).toBe(0);
    expect(p({ volume: 1 }).volume).toBe(100);
    expect(p({ volume: -0.1 }).volume).toBe(80);
    expect(p({ volume: '0.5' }).volume).toBe(80);
  });
  it('non-finite volume → 80', () => {
    expect(parsePreferences('{"volume":1e999}').volume).toBe(80);
  });
});

describe('raw handling', () => {
  it('does not parse raw longer than the limit', () => {
    const pad = ' '.repeat(MAX_RAW_LENGTH);
    expect(parsePreferences(`{"tuning":"AF-3"}${pad}`)).toEqual(DEFAULT_PREFERENCES);
    const ok = `{"tuning":"AF-3"}${' '.repeat(MAX_RAW_LENGTH - 17)}`;
    expect(ok.length).toBe(MAX_RAW_LENGTH);
    expect(parsePreferences(ok).tuningId).toBe('AF-3');
  });
  it.each(['null', '1', '"s"', 'true', '[]', '{'])('non-record %s → defaults', (raw) => {
    expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('serializePreferences', () => {
  it('writes exact key order and volume / 100', () => {
    const p: Preferences = {
      tuningId: 'AF-3',
      fretCount: 24,
      muted: true,
      volume: 35,
      lastTool: 'triads',
      labels: { notes: 'octave', triads: 'name' }
    };
    expect(serializePreferences(p)).toBe(
      '{"version":1,"tuning":"AF-3","frets":24,"muted":true,"volume":0.35,"lastTool":"triads","labels":{"notes":"octave","triads":"name"}}'
    );
  });
  it('omits lastTool when null', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });
});

const arbPrefs: fc.Arbitrary<Preferences> = fc.record({
  tuningId: fc.constantFrom(...TUNING_PRESETS.map((t) => t.id)),
  fretCount: fc.integer({ min: 12, max: 24 }),
  muted: fc.boolean(),
  volume: fc.integer({ min: 0, max: 20 }).map((n) => n * 5),
  lastTool: fc.constantFrom(...TOOL_IDS, null),
  labels: fc.record({
    notes: fc.constantFrom('name', 'octave', 'none'),
    triads: fc.constantFrom('interval', 'name')
  })
});

function isValid(p: Preferences): boolean {
  return (
    TUNING_PRESETS.some((t) => t.id === p.tuningId) &&
    Number.isInteger(p.fretCount) &&
    p.fretCount >= 12 &&
    p.fretCount <= 24 &&
    typeof p.muted === 'boolean' &&
    p.volume >= 0 &&
    p.volume <= 100 &&
    p.volume % 5 === 0 &&
    (p.lastTool === null || (TOOL_IDS as readonly string[]).includes(p.lastTool))
  );
}

describe('properties', () => {
  it('parsePreferences is total and valid for every string', () => {
    fc.assert(
      fc.property(fc.string(), (x) => {
        expect(isValid(parsePreferences(x))).toBe(true);
      })
    );
  });
  it('is total and valid for arbitrary JSON values', () => {
    fc.assert(
      fc.property(fc.json(), (x) => {
        expect(isValid(parsePreferences(x))).toBe(true);
      })
    );
  });
  it('round-trips every valid Preferences', () => {
    fc.assert(
      fc.property(arbPrefs, (p) => {
        expect(parsePreferences(serializePreferences(p))).toEqual(p);
      })
    );
  });
});
