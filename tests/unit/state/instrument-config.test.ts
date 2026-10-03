import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { presetInstrument } from '../../../src/lib/instrument/tunings';
import {
  CLOSED,
  DEFAULT_CONFIG,
  cancelPanel,
  confirmPanel,
  equalsConfig,
  instrumentOf,
  openPanel,
  restoreDefault,
  selectTuning,
  setFrets,
  stepFrets,
  type InstrumentConfig,
  type PanelState
} from '../../../src/lib/state/instrument-config';

const drop: InstrumentConfig = { tuningId: 'AF-4', fretCount: 20 };
const open = (c: InstrumentConfig = DEFAULT_CONFIG): PanelState => openPanel(CLOSED, c);
const pendingOf = (p: PanelState): InstrumentConfig => {
  if (!p.open) throw new Error('closed');
  return p.pending;
};

describe('instrument-config transitions (data-model §3)', () => {
  it('DEFAULT_CONFIG and CLOSED', () => {
    expect(DEFAULT_CONFIG).toEqual({ tuningId: 'AF-1', fretCount: 22 });
    expect(CLOSED).toEqual({ open: false });
  });

  it('equalsConfig / instrumentOf', () => {
    expect(equalsConfig(drop, { ...drop })).toBe(true);
    expect(equalsConfig(drop, DEFAULT_CONFIG)).toBe(false);
    expect(instrumentOf(drop)).toBe(presetInstrument('AF-4', 20));
  });

  it('openPanel: closed → open with pending = active; open → same object', () => {
    const p = openPanel(CLOSED, drop);
    expect(p).toEqual({ open: true, pending: drop });
    expect(openPanel(p, DEFAULT_CONFIG)).toBe(p);
  });

  it('selectTuning', () => {
    const p = open();
    expect(pendingOf(selectTuning(p, 'AF-7')).tuningId).toBe('AF-7');
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
    expect(pendingOf(restoreDefault(p))).toEqual({ tuningId: 'AF-1', fretCount: 22 });
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
    expect(r.next).toEqual({ tuningId: 'AF-8', fretCount: 22 });
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
