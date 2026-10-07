import { describe, expect, it } from 'vitest';
import { deviceClass } from '../../../src/lib/measure/device';

describe('deviceClass', () => {
  it('coarse + short side < 600 is phone', () => {
    expect(deviceClass({ coarse: true, shortSide: 599 })).toBe('phone');
  });
  it('coarse + short side ≥ 600 is tablet', () => {
    expect(deviceClass({ coarse: true, shortSide: 600 })).toBe('tablet');
  });
  it('not coarse is desktop at any size', () => {
    expect(deviceClass({ coarse: false, shortSide: 300 })).toBe('desktop');
    expect(deviceClass({ coarse: false, shortSide: 1200 })).toBe('desktop');
  });
});
