import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/lib/audio/prng';

describe('mulberry32', () => {
  it('same seed gives identical sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('different seeds differ', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('values are in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
