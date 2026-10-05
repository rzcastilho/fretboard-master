import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  MAX_RAW_LENGTH,
  PREFS_VERSION,
  TOOL_IDS,
  parsePreferences,
  serializePreferences,
  tuningOfPreferences,
  type Preferences
} from '../../../src/lib/prefs/schema';
import { OFFSET_MAX, OFFSET_MIN, type Offsets } from '../../../src/lib/instrument/custom-tuning';
import { TOOLS } from '../../../src/lib/shell/tools';
import { TUNING_PRESETS, tuningFromOffsets } from '../../../src/lib/instrument/tunings';
import { FIXTURES } from './fixtures';

const rec = (o: unknown): string => JSON.stringify(o);

describe('constants and defaults (FR-018)', () => {
  it('exposes version, limit and frozen defaults', () => {
    expect(PREFS_VERSION).toBe(1);
    expect(MAX_RAW_LENGTH).toBe(16_384);
    expect(Object.isFrozen(DEFAULT_PREFERENCES)).toBe(true);
    expect(DEFAULT_PREFERENCES).toEqual({
      stringCount: 6,
      tuningId: 'AF-1',
      customTuning: null,
      fretCount: 22,
      muted: false,
      volume: 80,
      lastTool: null,
      labels: { notes: 'name', triads: 'interval', caged: 'interval' },
      handedness: 'right',
      orientation: 'highest-top',
      rotateHintShown: false
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
  it.each(FIXTURES.map((f) => [f.name, f] as const))('%s loads as the expected tuning', (_n, f) => {
    expect(tuningOfPreferences(parsePreferences(f.raw))).toEqual(f.tuning);
  });
});

describe('customTuning (011, FR-017)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  it('records without customTuning load with null', () => {
    expect(p({ tuning: 'AF-3' }).customTuning).toBeNull();
    expect(tuningOfPreferences(p({ tuning: 'AF-3' }))).toEqual({ kind: 'preset', id: 'AF-3' });
  });
  it.each([
    'x',
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5],
    [0, 0, 0, 0, 0, -8],
    [0, 0, 0.5, 0, 0, 0],
    [0, 0, '0', 0, 0, 0],
    [0, 0, null, 0, 0, 0],
    {}
  ])('invalid %j is ignored and keeps other fields', (bad) => {
    const r = p({ tuning: 'AF-2', customTuning: bad, frets: 18 });
    expect(r.customTuning).toBeNull();
    expect(r.tuningId).toBe('AF-2');
    expect(r.fretCount).toBe(18);
  });
  it('limits are accepted', () => {
    expect(p({ customTuning: [-7, -7, -7, -7, -7, -7] }).customTuning).toEqual([
      -7, -7, -7, -7, -7, -7
    ]);
    expect(p({ customTuning: [4, 4, 4, 4, 4, 4] }).customTuning).toEqual([4, 4, 4, 4, 4, 4]);
  });
  it('valid customTuning wins over tuning', () => {
    const r = p({ tuning: 'AF-3', customTuning: [-2, 0, 0, -1, 0, 0] });
    expect(tuningOfPreferences(r)).toEqual({ kind: 'custom', offsets: [-2, 0, 0, -1, 0, 0] });
  });
});

describe('per-field fallback (US2 scenario 6)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  it('volume out of range → 80', () => expect(p({ volume: 3 }).volume).toBe(80));
  it('frets out of range → 22', () => expect(p({ frets: 99 }).fretCount).toBe(22));
  it('frets non-integer → 22', () => expect(p({ frets: 13.5 }).fretCount).toBe(22));
  it('unknown tuning → AF-1', () => expect(p({ tuning: 'AF-99' }).tuningId).toBe('AF-1'));
  it('muted wrong type → false', () => expect(p({ muted: 'true' }).muted).toBe(false));
  it.each(['home', 'scales'])('lastTool %s → null', (v) =>
    expect(p({ lastTool: v }).lastTool).toBeNull()
  );
  it('lastTool caged → caged', () => expect(p({ lastTool: 'caged' }).lastTool).toBe('caged'));
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
  it('writes customTuning after tuning when present, in contract order', () => {
    const p: Preferences = {
      ...DEFAULT_PREFERENCES,
      customTuning: [-2, 0, 0, -1, 0, 0],
      lastTool: 'notes'
    };
    expect(serializePreferences(p)).toBe(
      '{"version":1,"tuning":"AF-1","customTuning":[-2,0,0,-1,0,0],"frets":22,"muted":false,"volume":0.8,"lastTool":"notes","labels":{"notes":"name","triads":"interval"}}'
    );
  });
  it('omits customTuning when null', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('customTuning');
  });
  it('writes exact key order and volume / 100', () => {
    const p: Preferences = {
      stringCount: 6,
      tuningId: 'AF-3',
      customTuning: null,
      fretCount: 24,
      muted: true,
      volume: 35,
      lastTool: 'triads',
      labels: { notes: 'octave', triads: 'name', caged: 'interval' },
      handedness: 'right',
      orientation: 'highest-top',
      rotateHintShown: false
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

describe('seven strings: writer rules 1–4 (012)', () => {
  it('rule 1: 6 strings writes no strings key, byte-identical to slice 011', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('strings');
  });
  it('rule 2: 7 strings + preset writes strings then tuning, no customTuning', () => {
    const p: Preferences = { ...DEFAULT_PREFERENCES, stringCount: 7, tuningId: 'AF-23' };
    expect(serializePreferences(p)).toBe(
      '{"version":1,"strings":7,"tuning":"AF-23","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });
  it('rule 3: 7 strings + unmatched custom writes AF-21 placeholder and 7 offsets', () => {
    const p: Preferences = {
      ...DEFAULT_PREFERENCES,
      stringCount: 7,
      tuningId: 'AF-21',
      customTuning: [-3, 0, 0, 0, 0, 0, 0]
    };
    expect(serializePreferences(p)).toBe(
      '{"version":1,"strings":7,"tuning":"AF-21","customTuning":[-3,0,0,0,0,0,0],"frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });
  it('field order is version, strings, tuning, customTuning, frets, muted, volume, lastTool, labels', () => {
    const p: Preferences = {
      stringCount: 7,
      tuningId: 'AF-21',
      customTuning: [-3, 0, 0, 0, 0, 0, 0],
      fretCount: 24,
      muted: true,
      volume: 35,
      lastTool: 'triads',
      labels: { notes: 'octave', triads: 'name', caged: 'interval' },
      handedness: 'right',
      orientation: 'highest-top',
      rotateHintShown: false
    };
    expect(Object.keys(JSON.parse(serializePreferences(p)))).toEqual([
      'version',
      'strings',
      'tuning',
      'customTuning',
      'frets',
      'muted',
      'volume',
      'lastTool',
      'labels'
    ]);
  });
  it('rule 4: erase is unchanged (no strings in defaults)', () => {
    expect(parsePreferences(null).stringCount).toBe(6);
  });
});

describe('seven strings: reader rules 10–14 (012)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  it.each([8, 6.5, '7', null, true, [], 0, -7])('rule 10: strings %j → 6', (bad) => {
    expect(p({ strings: bad, tuning: 'AF-4' }).stringCount).toBe(6);
  });
  it('rule 11: 7 normalizes AF-1/AF-2; 6 normalizes AF-21/22/23 to AF-1', () => {
    expect(p({ strings: 7, tuning: 'AF-1' }).tuningId).toBe('AF-21');
    expect(p({ strings: 7, tuning: 'AF-2' }).tuningId).toBe('AF-22');
    expect(p({ strings: 6, tuning: 'AF-22' }).tuningId).toBe('AF-1');
    expect(p({ tuning: 'AF-23' }).tuningId).toBe('AF-1');
    expect(p({ strings: 7, tuning: 'nope' }).tuningId).toBe('AF-21');
  });
  it('rule 12: customTuning valid only when length equals the read count', () => {
    expect(p({ strings: 7, customTuning: [0, 0, 0, 0, 0, 0] }).customTuning).toBeNull();
    expect(p({ customTuning: [0, 0, 0, 0, 0, 0, 0] }).customTuning).toBeNull();
    expect(p({ strings: 7, customTuning: [0, 0, 0, 0, 0, 0, 5] }).customTuning).toBeNull();
  });
  it('rule 13: a valid customTuning is canonicalized against the count presets', () => {
    expect(
      tuningOfPreferences(p({ strings: 7, tuning: 'AF-21', customTuning: [-2, 0, 0, 0, 0, 0, 0] }))
    ).toEqual({ kind: 'preset', id: 'AF-23' });
    expect(
      tuningOfPreferences(p({ strings: 7, customTuning: [-1, -1, -1, -1, -1, -1, -1] }))
    ).toEqual({ kind: 'preset', id: 'AF-22' });
  });
  it('rule 14: records without strings load as 6 strings', () => {
    expect(p({ tuning: 'AF-3', frets: 20 }).stringCount).toBe(6);
  });
});

describe('left-handed and orientation (013): reader rules 19–22, writer rules 15–18', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  const canonical = (name: string) => FIXTURES.find((f) => f.name === name)?.raw ?? '';

  it('rule 15: defaults write neither key, byte-identical to slice 012', () => {
    const raw = serializePreferences(DEFAULT_PREFERENCES);
    expect(raw).not.toContain('handedness');
    expect(raw).not.toContain('orientation');
    expect(raw).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });
  it('rule 16: each key is written only when non-default, after labels', () => {
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, handedness: 'left' })).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"handedness":"left"}'
    );
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, orientation: 'lowest-top' })).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"orientation":"lowest-top"}'
    );
  });
  it('left-lowest-full re-serializes byte-identical', () => {
    const raw = canonical('left-lowest-full');
    expect(serializePreferences(parsePreferences(raw))).toBe(raw);
  });
  it.each(['LEFT', 1, null, true, [], 'Right'])('rule 19: handedness %j → right', (bad) => {
    expect(p({ handedness: bad }).handedness).toBe('right');
  });
  it.each(['lowest', 'LOWEST-TOP', 0, null, {}])('rule 20: orientation %j → highest-top', (bad) => {
    expect(p({ orientation: bad }).orientation).toBe('highest-top');
  });
  it('rule 21: an invalid one never discards the other or other fields', () => {
    const a = p({ handedness: 'x', orientation: 'lowest-top', frets: 18, tuning: 'AF-3' });
    expect([a.handedness, a.orientation, a.fretCount, a.tuningId]).toEqual([
      'right',
      'lowest-top',
      18,
      'AF-3'
    ]);
    const b = p({ handedness: 'left', orientation: 'x', frets: 18 });
    expect([b.handedness, b.orientation, b.fretCount]).toEqual(['left', 'highest-top', 18]);
  });
  it('rule 22: records without either key load right / highest-top', () => {
    const r = p({ tuning: 'AF-3', frets: 20 });
    expect([r.handedness, r.orientation]).toEqual(['right', 'highest-top']);
  });
  it('future version: unchanged handling (fields read as before, fixture covers it)', () => {
    const raw = FIXTURES.find((f) => f.name === 'future')?.raw ?? '';
    expect(JSON.parse(raw).version).toBe(7);
    expect(parsePreferences(raw).tuningId).toBe('AF-5');
  });
  it('every pre-013 fixture loads right / highest-top', () => {
    const pre = FIXTURES.filter(
      (f) =>
        ![
          'future',
          'left-only',
          'lowest-only',
          'bad-handed',
          'left-lowest-full',
          'bad-orientation'
        ].includes(f.name)
    );
    expect(pre.length).toBeGreaterThan(20);
    for (const f of pre) {
      expect([f.expected.handedness, f.expected.orientation]).toEqual(['right', 'highest-top']);
    }
  });
  it('round-trips both fields; defaults serialize with neither key', () => {
    fc.assert(
      fc.property(arbPrefs, (x) => {
        const raw = serializePreferences(x);
        expect(parsePreferences(raw)).toEqual(x);
        expect(raw.includes('"handedness"')).toBe(x.handedness === 'left');
        expect(raw.includes('"orientation"')).toBe(x.orientation === 'lowest-top');
      })
    );
  });
});

describe('rotate hint (016 US4)', () => {
  const p = (extra: Record<string, unknown>) =>
    parsePreferences(JSON.stringify({ version: 1, ...extra }));

  it('a record without rotateHint parses to false', () => {
    expect(p({}).rotateHintShown).toBe(false);
  });
  it('parses a stored true', () => {
    expect(p({ rotateHint: true }).rotateHintShown).toBe(true);
  });
  it.each(['yes', 1, null, {}, []])('invalid rotateHint %j → false, other fields kept', (bad) => {
    const r = p({ rotateHint: bad, frets: 18, muted: true });
    expect(r.rotateHintShown).toBe(false);
    expect([r.fretCount, r.muted]).toEqual([18, true]);
  });
  it('writes rotateHint only when true; version stays 1', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('rotateHint');
    const raw = serializePreferences({ ...DEFAULT_PREFERENCES, rotateHintShown: true });
    expect(raw).toContain('"rotateHint":true');
    expect(JSON.parse(raw).version).toBe(1);
  });
  it('existing fixtures serialize byte-identical', () => {
    for (const f of FIXTURES) {
      if (f.raw === null || f.raw.length > 16_384) continue;
      const parsed = parsePreferences(f.raw);
      expect(parsed.rotateHintShown).toBe(false);
      expect(serializePreferences(parsed)).not.toContain('rotateHint');
    }
  });
});

describe('labels.caged (017)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  it('absent → interval', () => expect(p({}).labels.caged).toBe('interval'));
  it('name and interval parse', () => {
    expect(p({ labels: { caged: 'name' } }).labels.caged).toBe('name');
    expect(p({ labels: { caged: 'interval' } }).labels.caged).toBe('interval');
  });
  it.each(['octave', 'none', 1, null, {}])('invalid %j → interval, others kept', (bad) => {
    const r = p({ labels: { notes: 'octave', triads: 'name', caged: bad }, frets: 18 });
    expect(r.labels).toEqual({ notes: 'octave', triads: 'name', caged: 'interval' });
    expect(r.fretCount).toBe(18);
  });
  it('defaults to interval', () => expect(DEFAULT_PREFERENCES.labels.caged).toBe('interval'));
  it('serialize writes caged only when name, after triads', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('caged');
    const raw = serializePreferences({
      ...DEFAULT_PREFERENCES,
      labels: { ...DEFAULT_PREFERENCES.labels, caged: 'name' }
    });
    expect(raw).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval","caged":"name"}}'
    );
    expect(Object.keys(JSON.parse(raw).labels)).toEqual(['notes', 'triads', 'caged']);
  });
  it('labels-caged-name fixture round-trips byte-identical', () => {
    const raw = FIXTURES.find((f) => f.name === 'labels-caged-name')?.raw ?? '';
    expect(serializePreferences(parsePreferences(raw))).toBe(raw);
  });
  it('existing fixtures serialize without caged unless they hold name', () => {
    for (const f of FIXTURES) {
      if (f.name === 'labels-caged-name' || f.raw.length > 16_384) continue;
      expect(
        JSON.parse(serializePreferences(parsePreferences(f.raw))).labels.caged
      ).toBeUndefined();
    }
  });
});

const arbOffsetsOf = (n: 6 | 7): fc.Arbitrary<Offsets> =>
  fc
    .tuple(...Array.from({ length: n }, () => fc.integer({ min: OFFSET_MIN, max: OFFSET_MAX })))
    .map((a) => a as unknown as Offsets);

const arbOffsets: fc.Arbitrary<Offsets> = arbOffsetsOf(6);

const arbPrefs: fc.Arbitrary<Preferences> = fc.record({
  stringCount: fc.constant(6 as const),
  tuningId: fc.constantFrom(
    ...TUNING_PRESETS.map((t) => t.id).filter(
      (id) => id !== 'AF-21' && id !== 'AF-22' && id !== 'AF-23'
    )
  ),
  customTuning: fc.option(arbOffsets, { nil: null }),
  fretCount: fc.integer({ min: 12, max: 24 }),
  muted: fc.boolean(),
  volume: fc.integer({ min: 0, max: 20 }).map((n) => n * 5),
  lastTool: fc.constantFrom(...TOOL_IDS, null),
  labels: fc.record({
    notes: fc.constantFrom('name', 'octave', 'none'),
    triads: fc.constantFrom('interval', 'name'),
    caged: fc.constantFrom('interval', 'name')
  }),
  handedness: fc.constantFrom('right', 'left'),
  orientation: fc.constantFrom('highest-top', 'lowest-top'),
  rotateHintShown: fc.boolean()
});

function isValid(p: Preferences): boolean {
  return (
    (p.stringCount === 6 || p.stringCount === 7) &&
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
  it('serialize → parse round-trips the Tuning of every valid Offsets', () => {
    fc.assert(
      fc.property(arbOffsets, (o) => {
        const t = tuningFromOffsets(o);
        const prefs: Preferences =
          t.kind === 'preset'
            ? { ...DEFAULT_PREFERENCES, tuningId: t.id }
            : { ...DEFAULT_PREFERENCES, customTuning: t.offsets };
        expect(tuningOfPreferences(parsePreferences(serializePreferences(prefs)))).toEqual(t);
      })
    );
  });
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
  it.each([6, 7] as const)(
    'serialize → parse round-trips the count and Tuning of every valid %i-string Offsets',
    (count) => {
      fc.assert(
        fc.property(arbOffsetsOf(count), (o) => {
          const t = tuningFromOffsets(o);
          const prefs: Preferences =
            t.kind === 'preset'
              ? { ...DEFAULT_PREFERENCES, stringCount: count, tuningId: t.id }
              : {
                  ...DEFAULT_PREFERENCES,
                  stringCount: count,
                  tuningId: count === 7 ? 'AF-21' : 'AF-1',
                  customTuning: t.offsets
                };
          const raw = serializePreferences(prefs);
          if (count === 6) expect(raw).not.toContain('"strings"');
          else expect(raw).toContain('"strings":7');
          const back = parsePreferences(raw);
          expect(back.stringCount).toBe(count);
          expect(tuningOfPreferences(back)).toEqual(t);
        })
      );
    }
  );
  it('round-trips every valid Preferences', () => {
    fc.assert(
      fc.property(arbPrefs, (p) => {
        expect(parsePreferences(serializePreferences(p))).toEqual(p);
      })
    );
  });
});
