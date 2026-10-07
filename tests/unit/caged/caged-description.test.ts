import { describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { buildCagedModel } from '../../../src/lib/state/caged-model';
import { initialCagedView } from '../../../src/lib/state/caged-view';

const ctx = { tuningName: 'Standard', temporary: false };

describe('CAGED description entries (US1, FR-004)', () => {
  const text = buildCagedModel(initialCagedView(), STANDARD_GUITAR, ctx).model
    ?.description as string;

  it('names the note in every entry, with the open form', () => {
    expect(text).toContain('string 5, fret 3, C, root');
    const a = buildCagedModel({ ...initialCagedView(), rootPc: 9 }, STANDARD_GUITAR, ctx).model
      ?.description as string;
    expect(a).toContain('string 5, open, A, root');
  });

  it('sorts entries string descending then fret ascending within a shape', () => {
    const shape = text
      .split(/(?=[A-G] shape, frets)/)
      .find((p) => p.startsWith('C shape, frets')) as string;
    const entries = [...shape.matchAll(/string (\d), (?:fret (\d+)|open)/g)].map((x) => [
      Number(x[1]),
      Number(x[2] ?? 0)
    ]);
    expect(entries.length).toBeGreaterThan(3);
    for (let i = 1; i < entries.length; i++) {
      const [ps, pf] = entries[i - 1];
      const [cs, cf] = entries[i];
      expect(ps > cs || (ps === cs && pf <= cf)).toBe(true);
    }
  });
});
