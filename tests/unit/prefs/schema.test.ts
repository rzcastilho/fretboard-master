import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  MAX_RAW_LENGTH,
  METRONOME_LIMITS,
  METRONOME_MODES,
  METRONOME_PLAIN_DEFAULTS,
  METRONOME_RATIOS_DEFAULTS,
  METRONOME_SPEED_DEFAULTS,
  PREFS_VERSION,
  PRIVACY_CATEGORIES,
  TOOL_IDS,
  parsePreferences,
  serializePreferences,
  tuningOfPreferences,
  type Preferences
} from '../../../src/lib/prefs/schema';
import { OFFSET_MAX, OFFSET_MIN, type Offsets } from '../../../src/lib/instrument/custom-tuning';
import { TOOLS } from '../../../src/lib/shell/tools';
import { TUNING_PRESETS, tuningFromOffsets } from '../../../src/lib/instrument/tunings';
import { DEFAULT_TEMPO, TEMPOS } from '../../../src/lib/state/listen';
import { MAX_BPM, MIN_BPM } from '../../../src/lib/audio/schedule';
import {
  DEFAULT_PLAIN_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_SETTINGS,
  MAX_BEATS,
  METRONOME_MODES as STATE_MODES,
  MAX_COUNT_IN,
  MIN_BEATS,
  MIN_COUNT_IN,
  SUBDIVISIONS,
  type MetronomeSettings,
  type PlainSettings,
  type SpeedSettings,
  type Subdivision
} from '../../../src/lib/state/metronome-settings';
import { FIXTURES, FIXTURE_BY_NAME } from './fixtures';

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
      tempo: 'medium',
      language: null,
      notation: null,
      accidentals: 'sharps',
      cagedNoteShown: false,
      theme: null,
      shortcuts: true,
      metronome: {
        ratios: DEFAULT_SETTINGS,
        plain: DEFAULT_PLAIN_SETTINGS,
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'ratios'
      }
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
  it('lastTool metronome → metronome', () =>
    expect(p({ lastTool: 'metronome' }).lastTool).toBe('metronome'));
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

describe('language (020)', () => {
  it('parses valid tags from fixtures', () => {
    expect(parsePreferences(FIXTURE_BY_NAME['language-pt'].raw).language).toBe('pt-BR');
    expect(parsePreferences(FIXTURE_BY_NAME['language-es'].raw).language).toBe('es');
  });

  it('invalid language falls back to null and keeps other fields', () => {
    for (const name of ['bad-language', 'language-number']) {
      const p = parsePreferences(FIXTURE_BY_NAME[name].raw);
      expect(p.language).toBeNull();
      expect(p.tuningId).toBe('AF-3');
      expect(p.fretCount).toBe(20);
      expect(p.muted).toBe(true);
    }
  });

  it('record without language serializes byte-identically to slice 019', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, tempo: 'fast' })).not.toContain(
      'language'
    );
  });

  it('serializes language after tempo only when non-null', () => {
    const raw = serializePreferences({ ...DEFAULT_PREFERENCES, tempo: 'fast', language: 'es' });
    expect(raw).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"tempo":"fast","language":"es"}'
    );
    expect(serializePreferences(parsePreferences(FIXTURE_BY_NAME['language-pt'].raw))).toBe(
      FIXTURE_BY_NAME['language-pt'].raw
    );
  });
});

describe('notation, accidentals and CAGED note (021 P-1, P-2)', () => {
  const p = (o: unknown) => parsePreferences(rec({ version: 1, ...(o as object) }));

  it('parses each fixture', () => {
    expect(parsePreferences(FIXTURE_BY_NAME['notation-solfege'].raw).notation).toBe('solfege');
    expect(parsePreferences(FIXTURE_BY_NAME['notation-letters'].raw).notation).toBe('letters');
    expect(parsePreferences(FIXTURE_BY_NAME['accidentals-flats'].raw).accidentals).toBe('flats');
    expect(parsePreferences(FIXTURE_BY_NAME['accidentals-both'].raw).accidentals).toBe('both');
    expect(parsePreferences(FIXTURE_BY_NAME['caged-note'].raw).cagedNoteShown).toBe(true);
  });

  it('absent fields give null, sharps and false', () => {
    const r = p({});
    expect(r.notation).toBeNull();
    expect(r.accidentals).toBe('sharps');
    expect(r.cagedNoteShown).toBe(false);
  });

  it.each(['hindi', 1, true, [], {}, ''])('invalid notation %j → null, others kept', (bad) => {
    const r = p({ notation: bad, accidentals: 'flats', cagedNote: true, frets: 18 });
    expect(r.notation).toBeNull();
    expect(r.accidentals).toBe('flats');
    expect(r.cagedNoteShown).toBe(true);
    expect(r.fretCount).toBe(18);
  });

  it.each(['quarter', 1, null, [], {}, ''])(
    'invalid accidentals %j → sharps, others kept',
    (bad) => {
      const r = p({ notation: 'solfege', accidentals: bad, cagedNote: true, frets: 18 });
      expect(r.accidentals).toBe('sharps');
      expect(r.notation).toBe('solfege');
      expect(r.cagedNoteShown).toBe(true);
      expect(r.fretCount).toBe(18);
    }
  );

  it.each(['yes', 1, null, [], {}])('invalid cagedNote %j → false, others kept', (bad) => {
    const r = p({ notation: 'solfege', accidentals: 'both', cagedNote: bad });
    expect(r.cagedNoteShown).toBe(false);
    expect(r.notation).toBe('solfege');
    expect(r.accidentals).toBe('both');
  });

  it('bad fixtures fall back to defaults and keep other fields', () => {
    for (const name of ['bad-notation', 'bad-accidentals']) {
      const r = parsePreferences(FIXTURE_BY_NAME[name].raw);
      expect(r.notation).toBeNull();
      expect(r.accidentals).toBe('sharps');
      expect(r.tuningId).toBe('AF-3');
      expect(r.fretCount).toBe(20);
      expect(r.muted).toBe(true);
      expect(serializePreferences(r)).not.toMatch(/notation|accidentals/);
    }
  });

  it('writes no field at its default', () => {
    const raw = serializePreferences(DEFAULT_PREFERENCES);
    expect(raw).not.toMatch(/notation|accidentals|cagedNote/);
  });

  it('writes the fields after language, in order notation, accidentals, cagedNote', () => {
    const raw = serializePreferences({
      ...DEFAULT_PREFERENCES,
      language: 'es',
      notation: 'letters',
      accidentals: 'both',
      cagedNoteShown: true
    });
    expect(Object.keys(JSON.parse(raw)).slice(-4)).toEqual([
      'language',
      'notation',
      'accidentals',
      'cagedNote'
    ]);
    expect(raw).toContain('"cagedNote":true');
  });

  it('writes notation even when it equals the language default (explicit pick)', () => {
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, notation: 'letters' })).toContain(
      '"notation":"letters"'
    );
  });

  it('new fixtures round-trip byte-identically', () => {
    for (const name of [
      'notation-solfege',
      'notation-letters',
      'accidentals-flats',
      'accidentals-both',
      'caged-note'
    ]) {
      const f = FIXTURE_BY_NAME[name];
      expect(serializePreferences(parsePreferences(f.raw))).toBe(f.raw);
    }
  });

  it('every pre-existing fixture re-serializes without the new keys', () => {
    const added = [
      'notation-solfege',
      'notation-letters',
      'accidentals-flats',
      'accidentals-both',
      'bad-notation',
      'bad-accidentals',
      'caged-note'
    ];
    for (const f of FIXTURES) {
      if (added.includes(f.name) || f.raw.length > MAX_RAW_LENGTH) continue;
      expect(serializePreferences(parsePreferences(f.raw))).not.toMatch(
        /notation|accidentals|cagedNote/
      );
    }
  });

  it('never throws on arbitrary values', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.anything(), (a, b, c) => {
        expect(() =>
          parsePreferences(JSON.stringify({ notation: a, accidentals: b, cagedNote: c }))
        ).not.toThrow();
      })
    );
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
      tempo: 'medium',
      language: null,
      notation: null,
      accidentals: 'sharps',
      cagedNoteShown: false,
      theme: null,
      shortcuts: true,
      metronome: {
        ratios: DEFAULT_SETTINGS,
        plain: DEFAULT_PLAIN_SETTINGS,
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'ratios'
      }
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
      tempo: 'medium',
      language: null,
      notation: null,
      accidentals: 'sharps',
      cagedNoteShown: false,
      theme: null,
      shortcuts: true,
      metronome: {
        ratios: DEFAULT_SETTINGS,
        plain: DEFAULT_PLAIN_SETTINGS,
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'ratios'
      }
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

describe('legacy rotateHint (030 US4)', () => {
  const p = (extra: Record<string, unknown>) =>
    parsePreferences(JSON.stringify({ version: 1, ...extra }));

  it.each([true, false, 'yes', 1, null, {}, []])(
    'a stored rotateHint %j never throws and changes no other field',
    (v) => {
      const base = p({ frets: 18, muted: true });
      const withHint = p({ rotateHint: v, frets: 18, muted: true });
      expect(withHint).toEqual(base);
      expect('rotateHintShown' in withHint).toBe(false);
    }
  );
  it('serialization omits rotateHint for every input', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('rotateHint');
    for (const f of FIXTURES) {
      if (f.raw === null || f.raw.length > 16_384) continue;
      expect(serializePreferences(parsePreferences(f.raw))).not.toContain('rotateHint');
    }
  });
  it('hints privacy category is only cagedNoteShown', () => {
    expect(PRIVACY_CATEGORIES.hints).toEqual(['cagedNoteShown']);
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

describe('tempo (019 US2)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));
  const raw = (name: string) => FIXTURES.find((f) => f.name === name)?.raw ?? '';

  it('PREFS_VERSION stays 1', () => expect(PREFS_VERSION).toBe(1));
  it('defaults to medium', () => expect(DEFAULT_PREFERENCES.tempo).toBe('medium'));
  it('absent → medium', () => expect(p({}).tempo).toBe('medium'));
  it.each(['slow', 'medium', 'fast'] as const)('%s parses', (t) =>
    expect(p({ tempo: t }).tempo).toBe(t)
  );
  it.each(['allegro', 'FAST', 1, null, true, {}, []])(
    'invalid %j → medium, other fields kept',
    (bad) => {
      const r = p({ tempo: bad, frets: 18, muted: true, tuning: 'AF-3' });
      expect(r.tempo).toBe('medium');
      expect([r.fretCount, r.muted, r.tuningId]).toEqual([18, true, 'AF-3']);
    }
  );
  it('writes tempo only when not medium, after orientation', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('tempo');
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, tempo: 'slow' })).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"tempo":"slow"}'
    );
    const keys = Object.keys(
      JSON.parse(serializePreferences({ ...DEFAULT_PREFERENCES, tempo: 'fast' }))
    );
    expect(keys.slice(-1)).toEqual(['tempo']);
  });
  it('tempo-fast round-trips byte-identical', () => {
    const r = raw('tempo-fast');
    expect(parsePreferences(r).tempo).toBe('fast');
    expect(serializePreferences(parsePreferences(r))).toBe(r);
  });
  it('bad-tempo gives medium and re-serializes without tempo', () => {
    const parsed = parsePreferences(raw('bad-tempo'));
    expect(parsed.tempo).toBe('medium');
    expect(serializePreferences(parsed)).not.toContain('tempo');
  });
  it('every existing fixture re-serializes without a tempo key', () => {
    for (const f of FIXTURES) {
      if (['tempo-fast', 'bad-tempo', 'future'].includes(f.name) || f.raw.length > 16_384) continue;
      expect(parsePreferences(f.raw).tempo).toBe('medium');
      expect(serializePreferences(parsePreferences(f.raw))).not.toContain('tempo');
    }
  });
});

const arbOffsetsOf = (n: 6 | 7): fc.Arbitrary<Offsets> =>
  fc
    .tuple(...Array.from({ length: n }, () => fc.integer({ min: OFFSET_MIN, max: OFFSET_MAX })))
    .map((a) => a as unknown as Offsets);

const arbOffsets: fc.Arbitrary<Offsets> = arbOffsetsOf(6);

const arbSub = fc.constantFrom<Subdivision>(1, 2, 3, 4, 5, 6, 7, 8);
const arbRatios: fc.Arbitrary<MetronomeSettings> = fc.record({
  bpm: fc.integer({ min: 30, max: 300 }),
  beats: fc.integer({ min: 1, max: 16 }),
  subdivision: arbSub,
  countIn: fc.boolean(),
  initialCountIn: fc.integer({ min: 0, max: 8 }),
  repeatCountIn: fc.integer({ min: 0, max: 8 }),
  ratio: fc.boolean(),
  loop2: arbSub
});

const arbPlain: fc.Arbitrary<PlainSettings> = fc.record({
  bpm: fc.integer({ min: 30, max: 300 }),
  beats: fc.integer({ min: 1, max: 16 }),
  countIn: fc.boolean(),
  initialCountIn: fc.integer({ min: 0, max: 8 }),
  subdivision: fc.constantFrom(1, 2, 3, 4)
});

const arbSpeed: fc.Arbitrary<SpeedSettings> = fc
  .record({
    startBpm: fc.integer({ min: 30, max: 300 }),
    targetBpm: fc.integer({ min: 30, max: 300 }),
    increment: fc.integer({ min: 1, max: 20 }),
    loops: fc.integer({ min: 1, max: 16 }),
    beats: fc.integer({ min: 1, max: 16 }),
    countIn: fc.boolean(),
    initialCountIn: fc.integer({ min: 0, max: 8 }),
    repeatCountIn: fc.integer({ min: 0, max: 8 }),
    atTarget: fc.constantFrom<'hold' | 'stop'>('hold', 'stop')
  })
  .map((x) => ({ ...x, targetBpm: Math.max(x.startBpm, x.targetBpm) }));

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
  tempo: fc.constantFrom('slow', 'medium', 'fast'),
  language: fc.constantFrom(null, 'en', 'pt-BR', 'es'),
  notation: fc.constantFrom(null, 'letters', 'solfege'),
  accidentals: fc.constantFrom('sharps', 'flats', 'both'),
  cagedNoteShown: fc.boolean(),
  theme: fc.constantFrom(null, 'light', 'dark'),
  shortcuts: fc.boolean(),
  metronome: fc.record({
    ratios: arbRatios,
    plain: arbPlain,
    speed: arbSpeed,
    mode: fc.constantFrom('plain', 'speed', 'ratios')
  })
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

describe('tempo picklist parity (019)', () => {
  it('accepts exactly the TEMPOS of the Listen module', () => {
    for (const t of TEMPOS) expect(parsePreferences(rec({ tempo: t })).tempo).toBe(t);
    expect(DEFAULT_PREFERENCES.tempo).toBe(DEFAULT_TEMPO);
  });
});

describe('theme (026)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));

  it('absent → null', () => expect(p({}).theme).toBeNull());
  it.each(['dark', 'light'] as const)('%s is kept', (t) => expect(p({ theme: t }).theme).toBe(t));
  it.each(['system', 'Dark', 1, {}, null])('invalid theme %j → null, others unchanged', (bad) => {
    const r = p({ theme: bad, frets: 18, muted: true });
    expect(r.theme).toBeNull();
    expect([r.fretCount, r.muted]).toEqual([18, true]);
  });
  it('defaults serialize without a theme key, byte-identical to slice 025', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });
  it('serializes theme last, after cagedNote', () => {
    const raw = serializePreferences({
      ...DEFAULT_PREFERENCES,
      cagedNoteShown: true,
      theme: 'dark'
    });
    expect(raw.endsWith(',"cagedNote":true,"theme":"dark"}')).toBe(true);
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark' })).toMatch(
      /,"theme":"dark"\}$/
    );
  });
  it('version stays 1 and round-trips every field including theme', () => {
    expect(PREFS_VERSION).toBe(1);
    fc.assert(
      fc.property(arbPrefs, (x) => {
        expect(parsePreferences(serializePreferences(x))).toEqual(x);
      })
    );
  });
});

describe('shortcuts (027)', () => {
  const p = (o: Record<string, unknown>) => parsePreferences(rec({ version: 1, ...o }));

  it('absent → true', () => expect(p({}).shortcuts).toBe(true));
  it('true is kept', () => expect(p({ shortcuts: true }).shortcuts).toBe(true));
  it('false is kept', () => expect(p({ shortcuts: false }).shortcuts).toBe(false));
  it.each(['no', 0, null])('invalid shortcuts %j → true, others unchanged', (bad) => {
    const r = p({ shortcuts: bad, frets: 18, muted: true, theme: 'dark' });
    expect(r.shortcuts).toBe(true);
    expect([r.fretCount, r.muted, r.theme]).toEqual([18, true, 'dark']);
  });
  it('true omits the key, byte-identical to slice 026', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).not.toContain('shortcuts');
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark' })).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"},"theme":"dark"}'
    );
  });
  it('false is appended last, after theme', () => {
    const raw = serializePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', shortcuts: false });
    expect(raw.endsWith(',"theme":"dark","shortcuts":false}')).toBe(true);
    expect(serializePreferences({ ...DEFAULT_PREFERENCES, shortcuts: false })).toMatch(
      /,"shortcuts":false\}$/
    );
  });
  it('version stays 1 and the shortcuts-off fixture round-trips', () => {
    expect(PREFS_VERSION).toBe(1);
    const f = FIXTURE_BY_NAME['shortcuts-off'];
    expect(parsePreferences(f.raw).shortcuts).toBe(false);
    expect(serializePreferences(parsePreferences(f.raw))).toBe(f.raw);
  });
});

describe('stored keys (027 FR-019(e))', () => {
  const KNOWN = [
    'version',
    'strings',
    'tuning',
    'customTuning',
    'frets',
    'muted',
    'volume',
    'lastTool',
    'labels',
    'handedness',
    'orientation',
    'tempo',
    'language',
    'notation',
    'accidentals',
    'cagedNote',
    'theme',
    'shortcuts',
    'metronome'
  ];
  const everything: Preferences = {
    stringCount: 7,
    tuningId: 'AF-21',
    customTuning: [-3, 0, 0, 0, 0, 0, 0],
    fretCount: 24,
    muted: true,
    volume: 35,
    lastTool: 'triads',
    labels: { notes: 'octave', triads: 'name', caged: 'name' },
    handedness: 'left',
    orientation: 'lowest-top',
    tempo: 'fast',
    language: 'es',
    notation: 'letters',
    accidentals: 'flats',
    cagedNoteShown: true,
    theme: 'dark',
    shortcuts: false,
    metronome: {
      ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
      plain: DEFAULT_PLAIN_SETTINGS,
      speed: DEFAULT_SPEED_SETTINGS,
      mode: 'ratios'
    }
  };

  it('writes only known keys, none that identify or time-stamp the visitor', () => {
    const keys = Object.keys(JSON.parse(serializePreferences(everything)));
    expect(keys.length).toBe(KNOWN.length);
    for (const key of keys) {
      expect(KNOWN).toContain(key);
      // Per camelCase word: a bare substring match would flag "accidentals".
      for (const word of key.split(/(?=[A-Z])/)) {
        expect(word).not.toMatch(/^(id|uuid|time|date|stamp|session|user)/i);
      }
    }
  });
});

describe('metronome.ratios (035)', () => {
  const ORDER = [
    'bpm',
    'beats',
    'countIn',
    'initialCountIn',
    'repeatCountIn',
    'ratio',
    'loop1',
    'loop2'
  ];
  const nonDefault: MetronomeSettings = {
    bpm: 140,
    beats: 6,
    subdivision: 2,
    countIn: false,
    initialCountIn: 2,
    repeatCountIn: 1,
    ratio: false,
    loop2: 4
  };
  const withRatios = (ratios: unknown): string => rec({ version: 1, metronome: { ratios } });
  const ratiosOf = (raw: string): MetronomeSettings => parsePreferences(raw).metronome.ratios;
  const nonMetronome = (p: Preferences): Omit<Preferences, 'metronome'> => {
    const rest: Record<string, unknown> = { ...p };
    delete rest.metronome;
    return rest as Omit<Preferences, 'metronome'>;
  };

  it('C1: a default record is byte-identical to 034 (no metronome key)', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });

  it('W1: omitted when all eight are default, written when any differs', () => {
    expect(
      serializePreferences({
        ...DEFAULT_PREFERENCES,
        metronome: {
          ratios: { ...DEFAULT_SETTINGS },
          plain: DEFAULT_PLAIN_SETTINGS,
          speed: DEFAULT_SPEED_SETTINGS,
          mode: 'ratios'
        }
      })
    ).not.toContain('metronome');
    for (const k of ORDER) {
      const key = k === 'loop1' ? 'subdivision' : k;
      const other = {
        ...DEFAULT_SETTINGS,
        [key]:
          key === 'bpm'
            ? 86
            : typeof DEFAULT_SETTINGS[key as keyof MetronomeSettings] === 'boolean'
              ? false
              : 1
      } as MetronomeSettings;
      expect(
        serializePreferences({
          ...DEFAULT_PREFERENCES,
          metronome: {
            ratios: other,
            plain: DEFAULT_PLAIN_SETTINGS,
            speed: DEFAULT_SPEED_SETTINGS,
            mode: 'ratios'
          }
        })
      ).toContain('"metronome"');
    }
  });

  it('W2/W3: all eight in fixed order, metronome last after shortcuts, Loop 1 stored as loop1', () => {
    const raw = serializePreferences({
      ...DEFAULT_PREFERENCES,
      shortcuts: false,
      metronome: {
        ratios: nonDefault,
        plain: DEFAULT_PLAIN_SETTINGS,
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'ratios'
      }
    });
    const o = JSON.parse(raw) as Record<string, Record<string, Record<string, number | boolean>>>;
    const keys = Object.keys(o);
    expect(keys[keys.length - 1]).toBe('metronome');
    expect(keys[keys.length - 2]).toBe('shortcuts');
    expect(Object.keys(o.metronome)).toEqual(['ratios']);
    expect(Object.keys(o.metronome.ratios)).toEqual(ORDER);
    expect(o.metronome.ratios.loop1).toBe(2);
    expect(o.metronome.ratios).not.toHaveProperty('subdivision');
  });

  it('C2: round-trips every valid set of the eight fields', () => {
    fc.assert(
      fc.property(arbRatios, (ratios) => {
        const back = parsePreferences(
          serializePreferences({
            ...DEFAULT_PREFERENCES,
            metronome: {
              ratios,
              plain: DEFAULT_PLAIN_SETTINGS,
              speed: DEFAULT_SPEED_SETTINGS,
              mode: 'ratios'
            }
          })
        );
        expect(back.metronome.ratios).toEqual(ratios);
      })
    );
  });

  it('C3: every existing fixture without a metronome entry has the default ratios', () => {
    for (const f of FIXTURES.filter((x) => !x.name.startsWith('metronome-'))) {
      expect(parsePreferences(f.raw).metronome.ratios).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('C3: a stored record is read as written', () => {
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-full'].raw)).toEqual(nonDefault);
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-ratios'].raw)).toEqual({
      ...DEFAULT_SETTINGS,
      bpm: 120,
      beats: 2,
      loop2: 5
    });
  });

  const INVALID: Record<string, unknown[]> = {
    bpm: [29, 301, 900, 85.5, '120', null, true, {}, []],
    beats: [0, 17, 2.5, '4', null, false],
    countIn: [1, 'yes', null, 0, []],
    initialCountIn: [-1, 9, 2.5, '3', null],
    repeatCountIn: [-1, 9, 1.5, '2', null],
    ratio: ['yes', 0, null, []],
    loop1: [0, 9, 2.5, '2', null, false],
    loop2: [0, 9, 2.5, '6', null, {}]
  };
  const FIELD_OF: Record<string, keyof MetronomeSettings> = {
    loop1: 'subdivision'
  };
  for (const [field, bads] of Object.entries(INVALID)) {
    it(`C4: an invalid ${field} resets only that field`, () => {
      for (const bad of bads) {
        const stored = {
          bpm: 140,
          beats: 6,
          countIn: false,
          initialCountIn: 2,
          repeatCountIn: 1,
          ratio: false,
          loop1: 2,
          loop2: 4,
          [field]: bad
        };
        const p = parsePreferences(
          rec({ version: 1, volume: 0.35, metronome: { ratios: stored } })
        );
        const key = FIELD_OF[field] ?? (field as keyof MetronomeSettings);
        expect(p.metronome.ratios[key]).toBe(DEFAULT_SETTINGS[key]);
        expect(p.metronome.ratios).toEqual({ ...nonDefault, [key]: DEFAULT_SETTINGS[key] });
        expect(nonMetronome(p)).toEqual({ ...nonMetronome(DEFAULT_PREFERENCES), volume: 35 });
      }
    });
  }

  it('C4: out-of-range values are reset, never clamped (900 → 85)', () => {
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-bad-bpm'].raw).bpm).toBe(85);
    expect(ratiosOf(withRatios({ bpm: 29 })).bpm).toBe(85);
  });

  it('C4: wrong types in every field give the defaults', () => {
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-wrong-types'].raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('C5: a non-object metronome or ratios gives all defaults without throwing', () => {
    for (const bad of [null, [], 'x', 5, true]) {
      expect(
        parsePreferences(rec({ version: 1, volume: 0.35, metronome: bad })).metronome.ratios
      ).toEqual(DEFAULT_SETTINGS);
      const p = parsePreferences(rec({ version: 1, volume: 0.35, metronome: { ratios: bad } }));
      expect(p.metronome.ratios).toEqual(DEFAULT_SETTINGS);
      expect(p.volume).toBe(35);
    }
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-array'].raw)).toEqual(DEFAULT_SETTINGS);
    expect(ratiosOf(FIXTURE_BY_NAME['metronome-null-ratios'].raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('C6: other modes are ignored and dropped on re-serialize', () => {
    const p = parsePreferences(FIXTURE_BY_NAME['metronome-other-mode'].raw);
    expect(p.metronome.ratios).toEqual({ ...DEFAULT_SETTINGS, bpm: 120, beats: 2, loop2: 5 });
    expect(serializePreferences(p)).not.toContain('speed');
  });

  it('C7: the schema mirrors match the metronome modules', () => {
    expect(METRONOME_RATIOS_DEFAULTS).toEqual(DEFAULT_SETTINGS);
    expect(METRONOME_LIMITS.bpm).toEqual([MIN_BPM, MAX_BPM]);
    expect(METRONOME_LIMITS.beats).toEqual([MIN_BEATS, MAX_BEATS]);
    expect(METRONOME_LIMITS.count).toEqual([MIN_COUNT_IN, MAX_COUNT_IN]);
    expect(METRONOME_LIMITS.loop).toEqual([SUBDIVISIONS[0], SUBDIVISIONS[SUBDIVISIONS.length - 1]]);
  });

  it('C8: the metronome field has a privacy category', () => {
    expect(PRIVACY_CATEGORIES.metronome).toEqual(['metronome']);
  });

  it('R5: a record over 16,384 characters gives every preference its default, metronome included', () => {
    const big = `${rec({ version: 1, volume: 0.35, metronome: { ratios: { bpm: 120 } } })}${' '.repeat(MAX_RAW_LENGTH)}`;
    expect(big.length).toBeGreaterThan(MAX_RAW_LENGTH);
    const p = parsePreferences(big);
    expect(p).toEqual(DEFAULT_PREFERENCES);
    expect(p.metronome.ratios).toEqual(DEFAULT_SETTINGS);
  });

  it('R6 / FR-009: metronome and other preferences never alter each other', () => {
    const withBad = parsePreferences(
      rec({ version: 1, volume: 0.35, metronome: { ratios: { bpm: 900, beats: 2 } } })
    );
    expect(nonMetronome(withBad)).toEqual({ ...nonMetronome(DEFAULT_PREFERENCES), volume: 35 });
    const written = serializePreferences({
      ...DEFAULT_PREFERENCES,
      volume: 20,
      muted: true,
      metronome: {
        ratios: nonDefault,
        plain: DEFAULT_PLAIN_SETTINGS,
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'ratios'
      }
    });
    const back = parsePreferences(written);
    expect(back.metronome.ratios).toEqual(nonDefault);
    expect(back.volume).toBe(20);
    expect(back.muted).toBe(true);
  });
});

describe('metronome.plain and metronome.mode (036)', () => {
  const PLAIN_ORDER = ['bpm', 'beats', 'countIn', 'initialCountIn'];
  const storedPlain = { bpm: 100, beats: 3, countIn: false, initialCountIn: 2, subdivision: 1 };
  const withMetronome = (metronome: unknown): string =>
    rec({ version: 1, volume: 0.35, metronome });
  const metOf = (raw: string) => parsePreferences(raw).metronome;
  const prefs = (metronome: Preferences['metronome']): Preferences => ({
    ...DEFAULT_PREFERENCES,
    metronome
  });
  const base = {
    ratios: DEFAULT_SETTINGS,
    plain: DEFAULT_PLAIN_SETTINGS,
    speed: DEFAULT_SPEED_SETTINGS,
    mode: 'ratios'
  } as const;

  it('C1: the default record is byte-identical to 035', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });

  it('C6: an unknown key inside speed is dropped', () => {
    const p = parsePreferences(
      withMetronome({
        ratios: { bpm: 120 },
        speed: { bpm: 100 },
        plain: { ...storedPlain, speed: 1 }
      })
    );
    expect(serializePreferences(p)).not.toContain('speed');
  });

  it('C9: every existing fixture re-serializes to the same bytes', () => {
    for (const f of FIXTURES) {
      const once = serializePreferences(parsePreferences(f.raw));
      expect(serializePreferences(parsePreferences(once))).toBe(once);
    }
    for (const name of ['metronome-full', 'metronome-plain', 'v1-full']) {
      const raw = FIXTURE_BY_NAME[name].raw;
      expect(serializePreferences(parsePreferences(raw))).toBe(raw);
    }
  });

  it('C10: round-trips the eight Ratios fields, the four plain fields and the mode', () => {
    fc.assert(
      fc.property(arbPrefs, (p) => {
        expect(parsePreferences(serializePreferences(p)).metronome).toEqual(p.metronome);
      })
    );
  });

  it('W5-W8: order ratios, plain, mode; plain whole; mode only when plain; omitted when default', () => {
    const raw = serializePreferences(
      prefs({
        ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
        plain: { ...DEFAULT_PLAIN_SETTINGS, beats: 3 },
        speed: DEFAULT_SPEED_SETTINGS,
        mode: 'plain'
      })
    );
    const o = JSON.parse(raw).metronome as Record<string, Record<string, unknown> | string>;
    expect(Object.keys(o)).toEqual(['ratios', 'plain', 'mode']);
    expect(Object.keys(o.plain as object)).toEqual(PLAIN_ORDER);
    expect(o.mode).toBe('plain');
    const onlyPlain = JSON.parse(
      serializePreferences(prefs({ ...base, plain: { ...DEFAULT_PLAIN_SETTINGS, bpm: 100 } }))
    ).metronome;
    expect(Object.keys(onlyPlain)).toEqual(['plain']);
    expect(
      Object.keys(JSON.parse(serializePreferences(prefs({ ...base, mode: 'plain' }))).metronome)
    ).toEqual(['mode']);
    expect(serializePreferences(prefs(base))).not.toContain('metronome');
  });

  const INVALID: Record<string, unknown[]> = {
    bpm: [29, 301, 999, 85.5, '100', null, true, {}, []],
    beats: [0, 17, 2.5, '3', null, false],
    countIn: [1, 'yes', null, 0, []],
    initialCountIn: [-1, 9, 2.5, '2', null]
  };
  for (const [field, bads] of Object.entries(INVALID)) {
    it(`C11: an invalid plain.${field} resets only itself`, () => {
      for (const bad of bads) {
        const m = metOf(
          withMetronome({
            ratios: { bpm: 120 },
            plain: { ...storedPlain, [field]: bad },
            speed: DEFAULT_SPEED_SETTINGS,
            mode: 'plain'
          })
        );
        const key = field as keyof PlainSettings;
        expect(m.plain).toEqual({ ...storedPlain, [key]: DEFAULT_PLAIN_SETTINGS[key] });
        expect(m.ratios.bpm).toBe(120);
        expect(m.mode).toBe('plain');
      }
    });
  }

  it('C11: an invalid ratios field leaves plain and mode untouched', () => {
    const m = metOf(
      withMetronome({ ratios: { bpm: 900, beats: 2 }, plain: storedPlain, mode: 'plain' })
    );
    expect(m.ratios.bpm).toBe(DEFAULT_SETTINGS.bpm);
    expect(m.ratios.beats).toBe(2);
    expect(m.plain).toEqual(storedPlain);
    expect(m.mode).toBe('plain');
  });

  it('C12: a non-object plain gives the plain defaults; a bad mode gives ratios', () => {
    for (const bad of [null, [], 'x', 5]) {
      const m = metOf(withMetronome({ ratios: { bpm: 120 }, plain: bad, mode: 'plain' }));
      expect(m.plain).toEqual(DEFAULT_PLAIN_SETTINGS);
      expect(m.ratios.bpm).toBe(120);
      expect(m.mode).toBe('plain');
    }
    for (const bad of ['SPEED', 'PLAIN', 1, null, {}]) {
      const m = metOf(withMetronome({ plain: storedPlain, mode: bad }));
      expect(m.mode).toBe('ratios');
      expect(m.plain).toEqual(storedPlain);
    }
    expect(metOf(FIXTURE_BY_NAME['metronome-plain-array'].raw).plain).toEqual(
      DEFAULT_PLAIN_SETTINGS
    );
    expect(metOf(FIXTURE_BY_NAME['metronome-bad-mode'].raw).mode).toBe('speed');
  });

  it('C13: only mode "ratios" re-serializes with no metronome key', () => {
    expect(serializePreferences(parsePreferences(withMetronome({ mode: 'ratios' })))).not.toContain(
      'metronome'
    );
  });

  it('C14: the mirrors match the state module', () => {
    expect(METRONOME_PLAIN_DEFAULTS).toEqual(DEFAULT_PLAIN_SETTINGS);
    expect([...METRONOME_MODES]).toEqual([...STATE_MODES]);
  });

  it('reads the acceptance record', () => {
    const m = metOf(FIXTURE_BY_NAME['metronome-plain'].raw);
    expect(m).toEqual({
      ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
      plain: { bpm: 100, beats: 3, countIn: true, initialCountIn: 4, subdivision: 1 },
      speed: DEFAULT_SPEED_SETTINGS,
      mode: 'plain'
    });
  });
});

describe('metronome.speed (037)', () => {
  const SPEED_ORDER = [
    'startBpm',
    'targetBpm',
    'increment',
    'loops',
    'beats',
    'countIn',
    'initialCountIn',
    'repeatCountIn',
    'atTarget'
  ];
  const stored: SpeedSettings = {
    startBpm: 80,
    targetBpm: 120,
    increment: 10,
    loops: 3,
    beats: 3,
    countIn: false,
    initialCountIn: 2,
    repeatCountIn: 1,
    atTarget: 'stop'
  };
  const withMetronome = (metronome: unknown): string =>
    rec({ version: 1, volume: 0.35, metronome });
  const metOf = (raw: string) => parsePreferences(raw).metronome;
  const prefs = (metronome: Partial<Preferences['metronome']>): Preferences => ({
    ...DEFAULT_PREFERENCES,
    metronome: { ...DEFAULT_PREFERENCES.metronome, ...metronome }
  });

  it('C1: the default record is byte-identical to 036', () => {
    expect(serializePreferences(DEFAULT_PREFERENCES)).toBe(
      '{"version":1,"tuning":"AF-1","frets":22,"muted":false,"volume":0.8,"labels":{"notes":"name","triads":"interval"}}'
    );
  });

  it('C9: the new and changed fixtures read as expected and round-trip', () => {
    for (const name of [
      'metronome-speed',
      'metronome-mode-speed',
      'metronome-all-modes',
      'metronome-bad-mode'
    ]) {
      const raw = FIXTURE_BY_NAME[name].raw;
      expect(serializePreferences(parsePreferences(raw)), name).toBe(raw);
    }
    // the speed object holding only an unknown key is omitted (R-12)
    expect(
      serializePreferences(parsePreferences(FIXTURE_BY_NAME['metronome-other-mode'].raw))
    ).not.toContain('speed');
    expect(metOf(FIXTURE_BY_NAME['metronome-other-mode'].raw).speed).toEqual(
      DEFAULT_SPEED_SETTINGS
    );
    expect(metOf(FIXTURE_BY_NAME['metronome-other-mode'].raw).mode).toBe('ratios');
  });

  it('reads the acceptance record', () => {
    expect(metOf(FIXTURE_BY_NAME['metronome-speed'].raw)).toEqual({
      ratios: DEFAULT_SETTINGS,
      plain: DEFAULT_PLAIN_SETTINGS,
      speed: { ...DEFAULT_SPEED_SETTINGS, startBpm: 80, targetBpm: 120, atTarget: 'stop' },
      mode: 'speed'
    });
  });

  it('C10: round-trips all nine speed fields and three modes', () => {
    fc.assert(
      fc.property(arbPrefs, (p) => {
        expect(parsePreferences(serializePreferences(p)).metronome).toEqual(p.metronome);
      })
    );
  });

  it('W9-W12: order ratios, plain, speed, mode; speed whole; mode for plain and speed', () => {
    const raw = serializePreferences(
      prefs({
        ratios: { ...DEFAULT_SETTINGS, bpm: 120 },
        plain: { ...DEFAULT_PLAIN_SETTINGS, beats: 3 },
        speed: stored,
        mode: 'speed'
      })
    );
    const o = JSON.parse(raw).metronome as Record<string, Record<string, unknown> | string>;
    expect(Object.keys(o)).toEqual(['ratios', 'plain', 'speed', 'mode']);
    expect(Object.keys(o.speed as object)).toEqual(SPEED_ORDER);
    expect(o.mode).toBe('speed');
    const onlySpeed = JSON.parse(
      serializePreferences(prefs({ speed: { ...DEFAULT_SPEED_SETTINGS, loops: 5 } }))
    ).metronome;
    expect(Object.keys(onlySpeed)).toEqual(['speed']);
    expect(
      Object.keys(JSON.parse(serializePreferences(prefs({ mode: 'speed' }))).metronome)
    ).toEqual(['mode']);
    expect(serializePreferences(prefs({ mode: 'ratios' }))).not.toContain('metronome');
    expect(serializePreferences(prefs({ speed: DEFAULT_SPEED_SETTINGS }))).not.toContain('speed');
  });

  const INVALID: Record<string, unknown[]> = {
    startBpm: [29, 301, 85.5, '100', null, true, {}],
    targetBpm: [29, 301, 120.5, '100', null, false],
    increment: [0, 21, 2.5, '5', null],
    loops: [0, 17, 2.5, '4', null],
    beats: [0, 17, 2.5, '3', null],
    countIn: [1, 'yes', null, 0, []],
    initialCountIn: [-1, 9, 2.5, '2', null],
    repeatCountIn: [-1, 9, 1.5, '2', null],
    atTarget: ['HOLD', 'Stop', true, 1, null, 'x']
  };
  for (const [field, bads] of Object.entries(INVALID)) {
    it(`C11: an invalid speed.${field} resets only itself`, () => {
      for (const bad of bads) {
        const m = metOf(
          withMetronome({
            ratios: { bpm: 120 },
            plain: { bpm: 100 },
            speed: { ...stored, [field]: bad },
            mode: 'speed'
          })
        );
        const key = field as keyof SpeedSettings;
        const expected = { ...stored, [key]: DEFAULT_SPEED_SETTINGS[key] };
        expected.targetBpm = Math.max(expected.targetBpm, expected.startBpm);
        expect(m.speed).toEqual(expected);
        expect(m.ratios.bpm).toBe(120);
        expect(m.plain.bpm).toBe(100);
        expect(m.mode).toBe('speed');
      }
    });
  }

  it('C11: an invalid ratios or plain field leaves speed and mode untouched', () => {
    const m = metOf(
      withMetronome({ ratios: { bpm: 900 }, plain: { bpm: 1 }, speed: stored, mode: 'speed' })
    );
    expect(m.ratios.bpm).toBe(DEFAULT_SETTINGS.bpm);
    expect(m.plain.bpm).toBe(DEFAULT_PLAIN_SETTINGS.bpm);
    expect(m.speed).toEqual(stored);
    expect(m.mode).toBe('speed');
  });

  it('C12: a non-object speed gives the defaults; mode "speed" reads, others give ratios', () => {
    for (const bad of [null, [], 'x', 5]) {
      const m = metOf(withMetronome({ ratios: { bpm: 120 }, speed: bad, mode: 'speed' }));
      expect(m.speed).toEqual(DEFAULT_SPEED_SETTINGS);
      expect(m.ratios.bpm).toBe(120);
      expect(m.mode).toBe('speed');
    }
    expect(metOf(withMetronome({ mode: 'speed' })).mode).toBe('speed');
    for (const bad of ['SPEED', 'PLAIN', 1, null, {}]) {
      expect(metOf(withMetronome({ speed: stored, mode: bad })).mode).toBe('ratios');
    }
    expect(metOf(FIXTURE_BY_NAME['metronome-speed-array'].raw).speed).toEqual(
      DEFAULT_SPEED_SETTINGS
    );
    expect(metOf(FIXTURE_BY_NAME['metronome-speed-array'].raw).mode).toBe('speed');
  });

  it('C15: Target below Start is lifted to Start', () => {
    expect(metOf(FIXTURE_BY_NAME['metronome-speed-target-below'].raw).speed).toMatchObject({
      startBpm: 200,
      targetBpm: 200
    });
    expect(metOf(withMetronome({ speed: { startBpm: 290 } })).speed).toMatchObject({
      startBpm: 290,
      targetBpm: 290
    });
    expect(metOf(withMetronome({ speed: { startBpm: 60, targetBpm: 40 } })).speed).toMatchObject({
      startBpm: 60,
      targetBpm: 60
    });
  });

  it('C16: wrong-typed atTarget gives hold; numeric strings give the default', () => {
    for (const bad of ['HOLD', true, 1]) {
      expect(metOf(withMetronome({ speed: { ...stored, atTarget: bad } })).speed.atTarget).toBe(
        'hold'
      );
    }
    const m = metOf(FIXTURE_BY_NAME['metronome-speed-invalid'].raw);
    expect(m.speed).toEqual({
      ...DEFAULT_SPEED_SETTINGS,
      beats: 3,
      countIn: false,
      initialCountIn: 2
    });
    expect(m.mode).toBe('speed');
  });

  it('C17: all three modes non-default serialize in the fixed key order', () => {
    const raw = FIXTURE_BY_NAME['metronome-all-modes'].raw;
    const o = JSON.parse(serializePreferences(parsePreferences(raw))).metronome;
    expect(Object.keys(o)).toEqual(['ratios', 'plain', 'speed', 'mode']);
    expect(Object.keys(o.speed)).toEqual(SPEED_ORDER);
  });

  it('C18: the mirrors match the state module', () => {
    expect(METRONOME_SPEED_DEFAULTS).toEqual(DEFAULT_SPEED_SETTINGS);
    expect(Object.isFrozen(METRONOME_SPEED_DEFAULTS)).toBe(true);
    expect([...METRONOME_MODES]).toEqual([...STATE_MODES]);
    expect(METRONOME_LIMITS.increment).toEqual([1, 20]);
    expect(METRONOME_LIMITS.loops).toEqual([1, 16]);
  });
});

describe('metronome.plain.subdivision (038)', () => {
  const rec2 = (plain: unknown): string =>
    JSON.stringify({ version: 1, volume: 0.35, metronome: { plain, mode: 'plain' } });
  const plainOf = (raw: string) => parsePreferences(raw).metronome.plain;
  const four = { bpm: 100, beats: 3, countIn: true, initialCountIn: 4 };

  it('C19: an absent subdivision parses to 1 and keeps the other fields', () => {
    expect(plainOf(rec2(four))).toEqual({ ...four, subdivision: 1 });
  });

  it('C20: the integers 1-4 parse as-is', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(plainOf(rec2({ ...four, subdivision: n })).subdivision).toBe(n);
    }
  });

  it('C21: anything else parses to 1 and never throws', () => {
    for (const bad of ['3', 2.5, 0, 5, -1, null, true, {}, []]) {
      expect(plainOf(rec2({ ...four, subdivision: bad }))).toEqual({ ...four, subdivision: 1 });
    }
  });

  it('C22: a subdivision-1 plain record serializes without subdivision (as 037)', () => {
    const p = {
      ...DEFAULT_PREFERENCES,
      metronome: {
        ...DEFAULT_PREFERENCES.metronome,
        plain: { ...DEFAULT_PLAIN_SETTINGS, beats: 3 }
      }
    };
    expect(JSON.parse(serializePreferences(p)).metronome.plain).toEqual({
      bpm: 85,
      beats: 3,
      countIn: true,
      initialCountIn: 4
    });
  });

  it('C23: a record differing only in subdivision is written, after initialCountIn', () => {
    const p = {
      ...DEFAULT_PREFERENCES,
      metronome: {
        ...DEFAULT_PREFERENCES.metronome,
        plain: { ...DEFAULT_PLAIN_SETTINGS, subdivision: 3 as const }
      }
    };
    const o = JSON.parse(serializePreferences(p)).metronome.plain;
    expect(Object.keys(o)).toEqual(['bpm', 'beats', 'countIn', 'initialCountIn', 'subdivision']);
    expect(o.subdivision).toBe(3);
  });

  it('C24: the defaults mirror DEFAULT_PLAIN_SETTINGS', () => {
    expect(METRONOME_PLAIN_DEFAULTS).toEqual(DEFAULT_PLAIN_SETTINGS);
    expect(METRONOME_PLAIN_DEFAULTS.subdivision).toBe(1);
  });

  it('C25: the fixtures parse as expected', () => {
    for (const name of ['metronome-plain-subdivision', 'metronome-plain-subdivision-invalid']) {
      const f = FIXTURE_BY_NAME[name];
      expect(parsePreferences(f.raw).metronome.plain).toEqual(f.expected.metronome?.plain);
    }
    const raw = FIXTURE_BY_NAME['metronome-plain-subdivision'].raw;
    expect(serializePreferences(parsePreferences(raw))).toBe(raw);
  });
});
