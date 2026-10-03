import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { presetOffsets } from '../../../src/lib/instrument/custom-tuning';
import {
  offsetsOfTuning,
  tuningFromOffsets,
  tuningInstrument,
  presetInstrument
} from '../../../src/lib/instrument/tunings';
import {
  CLOSED,
  DEFAULT_CONFIG,
  cancelPanel,
  chooseCustom,
  confirmPanel,
  equalsConfig,
  instrumentOf,
  openPanel,
  restoreDefault,
  selectTuning,
  setFrets,
  setStringCount,
  stepFrets,
  stepString,
  type InstrumentConfig,
  type PanelState
} from '../../../src/lib/state/instrument-config';

const drop: InstrumentConfig = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-4' },
  fretCount: 20
};
const open = (c: InstrumentConfig = DEFAULT_CONFIG): PanelState => openPanel(CLOSED, c);
const pendingOf = (p: PanelState): InstrumentConfig => {
  if (!p.open) throw new Error('closed');
  return p.pending;
};

const customCfg: InstrumentConfig = {
  stringCount: 6,
  tuning: tuningFromOffsets([1, 0, 0, 0, 0, 0]),
  fretCount: 20
};

describe('customOpen transitions (011 data-model §3)', () => {
  it('openPanel: customOpen iff the active tuning is custom', () => {
    const c = openPanel(CLOSED, customCfg);
    expect(c.open && c.customOpen).toBe(true);
    const d = openPanel(CLOSED, drop);
    expect(d.open && d.customOpen).toBe(false);
  });

  it('selectTuning sets customOpen = false and replaces pending pitches', () => {
    const p = selectTuning(openPanel(CLOSED, customCfg), 'AF-3');
    expect(p.open && p.customOpen).toBe(false);
    expect(pendingOf(p).tuning).toEqual({ kind: 'preset', id: 'AF-3' });
  });

  it('selectTuning of the already pending preset still leaves custom mode only when it changes pitches', () => {
    const p = selectTuning(openPanel(CLOSED, customCfg), 'AF-1');
    expect(p.open && p.customOpen).toBe(false);
  });

  it('restoreDefault: Standard, customOpen = false, frets 22', () => {
    const p = restoreDefault(openPanel(CLOSED, customCfg));
    expect(p.open && p.customOpen).toBe(false);
    expect(pendingOf(p)).toEqual(DEFAULT_CONFIG);
  });

  it('instrumentOf uses tuningInstrument', () => {
    expect(instrumentOf(customCfg)).toBe(tuningInstrument(customCfg.tuning, 6, 20));
  });
});

describe('instrument-config transitions (data-model §3)', () => {
  it('DEFAULT_CONFIG and CLOSED', () => {
    expect(DEFAULT_CONFIG).toEqual({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-1' },
      fretCount: 22
    });
    expect(CLOSED).toEqual({ open: false });
  });

  it('equalsConfig / instrumentOf', () => {
    expect(equalsConfig(drop, { ...drop })).toBe(true);
    expect(equalsConfig(drop, DEFAULT_CONFIG)).toBe(false);
    expect(instrumentOf(drop)).toBe(presetInstrument('AF-4', 6, 20));
  });

  it('openPanel: closed → open with pending = active; open → same object', () => {
    const p = openPanel(CLOSED, drop);
    expect(p).toEqual({ open: true, pending: drop, customOpen: false });
    expect(openPanel(p, DEFAULT_CONFIG)).toBe(p);
  });

  it('selectTuning', () => {
    const p = open();
    expect(pendingOf(selectTuning(p, 'AF-7')).tuning).toEqual({ kind: 'preset', id: 'AF-7' });
    expect(selectTuning(p, 'nope' as never)).toBe(p);
    expect(selectTuning(p, 'AF-1')).toBe(p);
  });

  it('stepFrets and setFrets clamp to 12..24', () => {
    const p = open();
    expect(pendingOf(stepFrets(p, -1)).fretCount).toBe(21);
    expect(pendingOf(stepFrets(p, 1)).fretCount).toBe(23);
    const max = open({ ...DEFAULT_CONFIG, fretCount: 24 });
    expect(stepFrets(max, 1)).toBe(max);
    const min = open({ ...DEFAULT_CONFIG, fretCount: 12 });
    expect(stepFrets(min, -1)).toBe(min);
    expect(pendingOf(setFrets(p, 99)).fretCount).toBe(24);
    expect(pendingOf(setFrets(p, 0)).fretCount).toBe(12);
    expect(pendingOf(setFrets(p, 12.4)).fretCount).toBe(12);
    expect(setFrets(p, 22)).toBe(p);
  });

  it('restoreDefault', () => {
    const p = open(drop);
    expect(pendingOf(restoreDefault(p))).toEqual({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-1' },
      fretCount: 22
    });
    const d = open();
    expect(restoreDefault(d)).toBe(d);
  });

  it('cancelPanel closes and leaves active untouched (SC-005)', () => {
    const active = { ...drop };
    const p = selectTuning(open(active), 'AF-9');
    expect(cancelPanel(p)).toEqual({ open: false });
    expect(active).toEqual(drop);
    expect(cancelPanel(CLOSED)).toBe(CLOSED);
  });

  it('confirmPanel', () => {
    const p = selectTuning(open(), 'AF-8');
    const r = confirmPanel(p, DEFAULT_CONFIG);
    expect(r.panel).toEqual({ open: false });
    expect(r.next).toEqual({
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-8' },
      fretCount: 22
    });
    expect(r.changed).toBe(true);
    const same = confirmPanel(open(drop), drop);
    expect(same.changed).toBe(false);
    expect(same.next).toEqual(drop);
  });

  it('confirmPanel on a closed panel', () => {
    const r = confirmPanel(CLOSED, drop);
    expect(r.panel).toBe(CLOSED);
    expect(r.next).toBe(drop);
    expect(r.changed).toBe(false);
  });

  it('edits on a closed panel return the same object', () => {
    expect(selectTuning(CLOSED, 'AF-2')).toBe(CLOSED);
    expect(stepFrets(CLOSED, 1)).toBe(CLOSED);
    expect(setFrets(CLOSED, 14)).toBe(CLOSED);
    expect(restoreDefault(CLOSED)).toBe(CLOSED);
  });

  it('property: fretCount stays an integer in 12..24 under any sequence', () => {
    const op = fc.oneof(
      fc.constant((p: PanelState) => stepFrets(p, 1)),
      fc.constant((p: PanelState) => stepFrets(p, -1)),
      fc.double({ noNaN: false }).map((n) => (p: PanelState) => setFrets(p, n)),
      fc.constant((p: PanelState) => restoreDefault(p)),
      fc.constant((p: PanelState) => selectTuning(p, 'AF-5'))
    );
    fc.assert(
      fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
        let p = open();
        for (const f of ops) {
          p = f(p);
          const n = pendingOf(p).fretCount;
          expect(Number.isInteger(n) && n >= 12 && n <= 24).toBe(true);
        }
      })
    );
  });
});

describe('US1 custom transitions (011 data-model §3)', () => {
  const strings = [6, 5, 4, 3, 2, 1] as const;
  const offsetsOf = (p: PanelState) => offsetsOfTuning(pendingOf(p).tuning, 6);

  it('chooseCustom sets customOpen and keeps pending pitches (Standard and Half step down)', () => {
    const s = chooseCustom(open());
    expect(s.open && s.customOpen).toBe(true);
    expect(pendingOf(s)).toEqual(DEFAULT_CONFIG);
    const half: InstrumentConfig = {
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-2' },
      fretCount: 22
    };
    const h = chooseCustom(open(half));
    expect(h.open && h.customOpen).toBe(true);
    expect(pendingOf(h).tuning).toEqual({ kind: 'preset', id: 'AF-2' });
  });

  it('chooseCustom is a no-op when closed or already custom', () => {
    expect(chooseCustom(CLOSED)).toBe(CLOSED);
    const s = chooseCustom(open());
    expect(chooseCustom(s)).toBe(s);
  });

  it('stepString changes one offset and returns the canonical tuning', () => {
    let s = chooseCustom(open());
    s = stepString(s, 6, -1);
    expect(offsetsOf(s)).toEqual([-1, 0, 0, 0, 0, 0]);
    expect(pendingOf(s).tuning.kind).toBe('custom');
    s = stepString(s, 6, -1);
    expect(pendingOf(s).tuning).toEqual({ kind: 'preset', id: 'AF-4' }); // Drop D
    expect(s.open && s.customOpen).toBe(true);
  });

  it('refused step at a limit returns the same object (6 strings × 2 directions, SC-003)', () => {
    for (const n of strings) {
      let s = chooseCustom(open());
      for (let i = 0; i < 7; i++) s = stepString(s, n, -1);
      expect(offsetsOf(s)[6 - n]).toBe(-7);
      expect(stepString(s, n, -1)).toBe(s);
      let u = chooseCustom(open());
      for (let i = 0; i < 4; i++) u = stepString(u, n, 1);
      expect(offsetsOf(u)[6 - n]).toBe(4);
      expect(stepString(u, n, 1)).toBe(u);
    }
  });

  it('stepString needs an open panel in custom mode', () => {
    expect(stepString(CLOSED, 6, -1)).toBe(CLOSED);
    const s = open();
    expect(stepString(s, 6, -1)).toBe(s);
  });

  it('stepFrets/setFrets keep tuning and customOpen', () => {
    const s = stepString(chooseCustom(open()), 3, 1);
    const t = pendingOf(s).tuning;
    const f = setFrets(stepFrets(s, -1), 15);
    expect(pendingOf(f).tuning).toBe(t);
    expect(f.open && f.customOpen).toBe(true);
    expect(pendingOf(f).fretCount).toBe(15);
  });

  it('preset after Custom replaces pitches and hides rows; Custom again restarts from the preset', () => {
    let s = stepString(stepString(chooseCustom(open()), 1, 1), 1, 1);
    s = selectTuning(s, 'AF-3');
    expect(s.open && s.customOpen).toBe(false);
    expect(pendingOf(s).tuning).toEqual({ kind: 'preset', id: 'AF-3' });
    s = chooseCustom(s);
    expect(offsetsOf(s)).toEqual(presetOffsets('AF-3', 6));
  });

  it('cancelPanel discards; confirmPanel changed is false for identical pitches', () => {
    const s = stepString(chooseCustom(open()), 6, -1);
    expect(cancelPanel(s)).toBe(CLOSED);
    expect(confirmPanel(s, DEFAULT_CONFIG).changed).toBe(true);
    const back = stepString(s, 6, 1);
    expect(confirmPanel(back, DEFAULT_CONFIG).changed).toBe(false);
    const active: InstrumentConfig = {
      stringCount: 6,
      tuning: tuningFromOffsets([1, 0, 0, 0, 0, 0]),
      fretCount: 22
    };
    const same = stepString(chooseCustom(open(DEFAULT_CONFIG)), 6, 1);
    expect(confirmPanel(same, active).changed).toBe(false);
  });
});

describe('string count transitions (012 data-model §4)', () => {
  const cfg = (
    stringCount: 6 | 7,
    tuning: InstrumentConfig['tuning'],
    fretCount = 22
  ): InstrumentConfig => ({ stringCount, tuning, fretCount });
  const preset = (id: 'AF-1') => ({ kind: 'preset' as const, id });
  const to = (c: InstrumentConfig, n: number): InstrumentConfig =>
    pendingOf(setStringCount(open(c), n));

  it('DEFAULT_CONFIG is 6 strings, AF-1, 22 frets', () => {
    expect(DEFAULT_CONFIG).toEqual({ stringCount: 6, tuning: preset('AF-1'), fretCount: 22 });
  });

  it('6/AF-1 → 7/AF-21', () => {
    const r = to(DEFAULT_CONFIG, 7);
    expect(r.stringCount).toBe(7);
    expect(r.tuning).toEqual({ kind: 'preset', id: 'AF-21' });
  });

  it('6/AF-2 → 7/AF-22', () => {
    const r = to(cfg(6, { kind: 'preset', id: 'AF-2' }), 7);
    expect(r.tuning).toEqual({ kind: 'preset', id: 'AF-22' });
  });

  it('6/AF-4 → 7/AF-4', () => {
    const r = to(cfg(6, { kind: 'preset', id: 'AF-4' }), 7);
    expect(r.tuning).toEqual({ kind: 'preset', id: 'AF-4' });
    expect(r.stringCount).toBe(7);
  });

  it('6/custom → 7/custom with string 7 copying string 6', () => {
    const r = to(cfg(6, tuningFromOffsets([-2, 0, 0, -1, 0, 0])), 7);
    expect(r.tuning).toEqual({ kind: 'custom', offsets: [-2, -2, 0, 0, -1, 0, 0] });
  });

  it('7/AF-21 → 6/AF-1; 7/AF-23 → 6/AF-1; 7/AF-22 → 6/AF-2', () => {
    expect(to(cfg(7, { kind: 'preset', id: 'AF-21' }), 6).tuning).toEqual(preset('AF-1'));
    expect(to(cfg(7, { kind: 'preset', id: 'AF-23' }), 6).tuning).toEqual(preset('AF-1'));
    expect(to(cfg(7, { kind: 'preset', id: 'AF-22' }), 6).tuning).toEqual({
      kind: 'preset',
      id: 'AF-2'
    });
    expect(to(cfg(7, { kind: 'preset', id: 'AF-21' }), 6).stringCount).toBe(6);
  });

  it('7/AF-21 custom open: lowering string 7 twice reaches AF-23', () => {
    let p = chooseCustom(open(cfg(7, { kind: 'preset', id: 'AF-21' })));
    p = stepString(p, 7, -1);
    expect(pendingOf(p).tuning.kind).toBe('custom');
    p = stepString(p, 7, -1);
    expect(pendingOf(p).tuning).toEqual({ kind: 'preset', id: 'AF-23' });
  });

  it('7/AF-23 custom open: lowering string 7 once gives custom [-3,0,…]', () => {
    let p = chooseCustom(open(cfg(7, { kind: 'preset', id: 'AF-23' })));
    p = stepString(p, 7, -1);
    expect(pendingOf(p).tuning).toEqual({ kind: 'custom', offsets: [-3, 0, 0, 0, 0, 0, 0] });
  });

  it('Restore default → 6/AF-1/22 frets', () => {
    const p = restoreDefault(open(cfg(7, { kind: 'preset', id: 'AF-23' }, 15)));
    expect(pendingOf(p)).toEqual(DEFAULT_CONFIG);
  });

  it('setStringCount returns the same object when closed, invalid or same count', () => {
    expect(setStringCount(CLOSED, 7)).toBe(CLOSED);
    const p = open();
    expect(setStringCount(p, 6)).toBe(p);
    expect(setStringCount(p, 8)).toBe(p);
    expect(setStringCount(p, 5)).toBe(p);
    expect(setStringCount(p, 6.5)).toBe(p);
    expect(setStringCount(p, NaN)).toBe(p);
  });

  it('fretCount and customOpen are preserved', () => {
    const p = chooseCustom(open(cfg(6, tuningFromOffsets([1, 0, 0, 0, 0, 0]), 17)));
    const q = setStringCount(p, 7);
    expect(pendingOf(q).fretCount).toBe(17);
    expect(q.open && q.customOpen).toBe(true);
  });

  it('selectTuning refuses ids of the other count', () => {
    const six = open();
    expect(selectTuning(six, 'AF-21')).toBe(six);
    const seven = open(cfg(7, { kind: 'preset', id: 'AF-21' }));
    expect(selectTuning(seven, 'AF-1')).toBe(seven);
    expect(pendingOf(selectTuning(seven, 'AF-23')).tuning).toEqual({
      kind: 'preset',
      id: 'AF-23'
    });
  });

  it('stepString refuses string 7 on 6 strings', () => {
    const p = chooseCustom(open());
    expect(stepString(p, 7, -1)).toBe(p);
  });

  it('equalsConfig compares stringCount; instrumentOf carries it', () => {
    const a = cfg(7, { kind: 'preset', id: 'AF-4' });
    const b = cfg(6, { kind: 'preset', id: 'AF-4' });
    expect(equalsConfig(a, b)).toBe(false);
    expect(equalsConfig(a, { ...a })).toBe(true);
    expect(instrumentOf(a).stringCount).toBe(7);
    expect(instrumentOf(b)).toBe(presetInstrument('AF-4', 6, 22));
  });

  it('confirm reports a count change as changed', () => {
    const p = setStringCount(open(), 7);
    expect(confirmPanel(p, DEFAULT_CONFIG).changed).toBe(true);
  });
});
