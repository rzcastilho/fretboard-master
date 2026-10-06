import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE2000,
  deltaEHex,
  deltaEUnderCvd,
  hexToLab,
  hexToSrgb,
  simulateCvd
} from './color';

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('is symmetric and accepts 3-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#000', '#fff'), 10);
    expect(hexToSrgb('#f00')).toEqual([1, 0, 0]);
  });

  it('rejects malformed colours', () => {
    expect(() => hexToSrgb('red')).toThrow();
  });
});

describe('hexToLab', () => {
  it('maps white and black to L 100 and 0', () => {
    const [lw, aw, bw] = hexToLab('#ffffff');
    expect(lw).toBeCloseTo(100, 1);
    expect(aw).toBeCloseTo(0, 1);
    expect(bw).toBeCloseTo(0, 1);
    expect(hexToLab('#000000')[0]).toBeCloseTo(0, 5);
  });

  it('maps sRGB red near the CIELAB reference', () => {
    const [l, a, b] = hexToLab('#ff0000');
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 0);
    expect(b).toBeCloseTo(67.2, 0);
  });
});

describe('deltaE2000 (Sharma 2005 reference pairs)', () => {
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082]
  ] as const)('%j vs %j = %f', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3);
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3);
  });

  it('is 0 for identical colours', () => {
    expect(deltaEHex('#336699', '#336699')).toBe(0);
  });
});

describe('simulateCvd', () => {
  it('leaves neutral greys unchanged', () => {
    for (const type of ['deuteranopia', 'protanopia', 'tritanopia'] as const) {
      expect(simulateCvd('#808080', type)).toBe('#808080');
      expect(simulateCvd('#ffffff', type)).toBe('#ffffff');
      expect(simulateCvd('#000000', type)).toBe('#000000');
    }
  });

  it('collapses red and green under red-green deficiencies but not for normal vision', () => {
    const normal = deltaEHex('#d03030', '#30a030');
    expect(normal).toBeGreaterThan(40);
    expect(deltaEUnderCvd('#d03030', '#30a030', 'deuteranopia')).toBeLessThan(normal / 2);
    expect(deltaEUnderCvd('#d03030', '#30a030', 'protanopia')).toBeLessThan(normal / 2);
  });
});
