import { describe, expect, it } from 'vitest';
import {
  CAGED_QUALITIES,
  cagedRootSpelling,
  equalsCagedView,
  initialCagedView,
  resetCaged,
  selectRoot,
  setConnections,
  setFocus,
  setQuality,
  switchSpelling,
  type CagedViewState
} from '../../../src/lib/state/caged-view';

const name = (s: CagedViewState): string => {
  const sp = cagedRootSpelling(s);
  return `${sp.letter}${['𝄫', '♭', '', '♯', '𝄪'][sp.accidental + 2]}`;
};

describe('caged view state', () => {
  it('starts on C major with no override (FR-002)', () => {
    expect(initialCagedView()).toEqual({
      rootPc: 0,
      spellingOverride: 'none',
      quality: 'major',
      focus: null,
      connections: false
    });
    expect(CAGED_QUALITIES).toEqual(['major', 'minor']);
  });

  it('resetCaged returns the initial state', () => {
    expect(resetCaged()).toEqual(initialCagedView());
  });

  describe('selectRoot', () => {
    it('sets the root and clears the override', () => {
      const s = { ...initialCagedView(), rootPc: 1, spellingOverride: 'sharp' as const };
      expect(selectRoot(s, 7)).toEqual({
        ...s,
        rootPc: 7,
        spellingOverride: 'none'
      });
    });
    it('same root is a no-op (keeps the override)', () => {
      const s = { ...initialCagedView(), rootPc: 1, spellingOverride: 'sharp' as const };
      expect(selectRoot(s, 1)).toBe(s);
    });
    it.each([-1, 12, 1.5, NaN])('invalid pitch class %s is a no-op', (pc) => {
      const s = initialCagedView();
      expect(selectRoot(s, pc)).toBe(s);
    });
  });

  describe('setQuality', () => {
    it('changes quality and keeps the override (FR-003)', () => {
      const s = { ...initialCagedView(), rootPc: 1, spellingOverride: 'flat' as const };
      expect(setQuality(s, 'minor')).toEqual({ ...s, quality: 'minor' });
    });
    it('same quality is a no-op', () => {
      const s = initialCagedView();
      expect(setQuality(s, 'major')).toBe(s);
    });
    it('unknown quality is a no-op', () => {
      const s = initialCagedView();
      // @ts-expect-error not a CAGED quality
      expect(setQuality(s, 'diminished')).toBe(s);
    });
  });

  describe('switchSpelling', () => {
    it('is a no-op on a natural root', () => {
      const s = initialCagedView();
      expect(switchSpelling(s)).toBe(s);
    });
    it('toggles an altered root from its default', () => {
      const s = selectRoot(initialCagedView(), 1); // D♭ major by default
      expect(name(s)).toBe('D♭');
      const t = switchSpelling(s);
      expect(t.spellingOverride).toBe('sharp');
      expect(name(t)).toBe('C♯');
      expect(switchSpelling(t).spellingOverride).toBe('flat');
    });
  });

  it('spelling scenario: D♭ major → C♯ minor → switch → D♭ minor → major stays D♭ major', () => {
    let s = selectRoot(initialCagedView(), 1);
    expect(name(s)).toBe('D♭');
    s = setQuality(s, 'minor');
    expect(name(s)).toBe('C♯');
    s = switchSpelling(s);
    expect(name(s)).toBe('D♭');
    s = setQuality(s, 'major');
    expect(name(s)).toBe('D♭');
    expect(s.spellingOverride).toBe('flat');
  });

  it('defaults for the five altered roots (TM-4.3)', () => {
    const major = [1, 3, 6, 8, 10].map((pc) => name(selectRoot(initialCagedView(), pc)));
    expect(major).toEqual(['D♭', 'E♭', 'F♯', 'A♭', 'B♭']);
    const minor = [1, 3, 6, 8, 10].map((pc) =>
      name(setQuality(selectRoot(initialCagedView(), pc), 'minor'))
    );
    expect(minor).toEqual(['C♯', 'E♭', 'F♯', 'G♯', 'B♭']);
  });

  it('selectRoot resets the override, setQuality keeps it', () => {
    const s = switchSpelling(selectRoot(initialCagedView(), 1));
    expect(setQuality(s, 'minor').spellingOverride).toBe(s.spellingOverride);
    expect(selectRoot(s, 3).spellingOverride).toBe('none');
  });

  it('equalsCagedView compares fields', () => {
    const a = initialCagedView();
    expect(equalsCagedView(a, { ...a })).toBe(true);
    expect(equalsCagedView(a, { ...a, rootPc: 2 })).toBe(false);
    expect(equalsCagedView(a, { ...a, quality: 'minor' })).toBe(false);
    expect(equalsCagedView(a, { ...a, spellingOverride: 'sharp' })).toBe(false);
  });

  it('equalsCagedView compares focus and connections (slice 016)', () => {
    const a = initialCagedView();
    expect(equalsCagedView(a, setFocus(a, { letter: 'E', ordinal: 0 }))).toBe(false);
    expect(
      equalsCagedView(
        setFocus(a, { letter: 'E', ordinal: 0 }),
        setFocus(a, { letter: 'E', ordinal: 0 })
      )
    ).toBe(true);
    expect(
      equalsCagedView(
        setFocus(a, { letter: 'A', ordinal: 0 }),
        setFocus(a, { letter: 'A', ordinal: 1 })
      )
    ).toBe(false);
    expect(equalsCagedView(a, setConnections(a, true))).toBe(false);
  });

  describe('focus and connections (slice 016)', () => {
    it('resetCaged clears both', () => {
      expect(resetCaged()).toEqual(initialCagedView());
      expect(resetCaged().focus).toBeNull();
      expect(resetCaged().connections).toBe(false);
    });
    it('setFocus sets, equal value is the same object', () => {
      const a = initialCagedView();
      const b = setFocus(a, { letter: 'E', ordinal: 0 });
      expect(b.focus).toEqual({ letter: 'E', ordinal: 0 });
      expect(setFocus(b, { letter: 'E', ordinal: 0 })).toBe(b);
      expect(setFocus(a, null)).toBe(a);
      expect(setFocus(b, null).focus).toBeNull();
    });
    it('setConnections sets, equal value is the same object', () => {
      const a = initialCagedView();
      const b = setConnections(a, true);
      expect(b.connections).toBe(true);
      expect(setConnections(b, true)).toBe(b);
      expect(setConnections(a, false)).toBe(a);
    });
    it('switchSpelling leaves focus untouched; selectRoot/setQuality keep prior behavior', () => {
      const f = setFocus(selectRoot(initialCagedView(), 1), { letter: 'A', ordinal: 0 });
      expect(switchSpelling(f).focus).toBe(f.focus);
      expect(selectRoot(f, 3).spellingOverride).toBe('none');
      expect(setQuality(f, 'minor').quality).toBe('minor');
    });
  });
});
