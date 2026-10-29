import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  REFLOW_MAX,
  arrangementFor,
  wideLeftColumn,
  type LayoutChrome
} from '../../src/lib/shell/layout';

const chrome: LayoutChrome = { mainPadding: 16, gap: 16, zoneBorder: 1 };
/** Natural neck widths at a 16 px root (6 strings, marks off). */
const NECK_24 = 1220;
const NECK_12 = 644;

describe('wideLeftColumn', () => {
  it('is 3/4 of the content width minus the zone borders', () => {
    expect(wideLeftColumn(1440, chrome)).toBe(((1440 - 32 - 16) * 3) / 4 - 2);
  });
});

describe('arrangementFor', () => {
  const at = (width: number, neckWidth: number, c = chrome) =>
    arrangementFor({ width, neckWidth, chrome: c });

  it('REFLOW_MAX is 1023', () => {
    expect(REFLOW_MAX).toBe(1023);
  });

  it.each([
    ['1440/24 → wide-stacked', 1440, NECK_24, 'wide-stacked'],
    ['1440/12 → wide-side', 1440, NECK_12, 'wide-side'],
    ['2560/24 → wide-side', 2560, NECK_24, 'wide-side'],
    ['1024/24 → wide-stacked', 1024, NECK_24, 'wide-stacked'],
    ['1024/12 → wide-side', 1024, NECK_12, 'wide-side'],
    ['1023 → reflow', 1023, NECK_12, 'reflow'],
    ['800 → reflow', 800, NECK_24, 'reflow'],
    ['600 → reflow', 600, NECK_24, 'reflow'],
    ['390 → reflow', 390, NECK_24, 'reflow'],
    ['320 → reflow', 320, NECK_12, 'reflow']
  ] as const)('%s', (_name, w, neck, expected) => {
    expect(at(w, neck)).toBe(expected);
  });

  it('1440/24 at a 32 px root (neck 2440, chrome doubled) → wide-stacked', () => {
    expect(at(1440, 2440, { mainPadding: 32, gap: 32, zoneBorder: 2 })).toBe('wide-stacked');
  });

  it('neck exactly the left column → wide-side', () => {
    expect(at(1440, wideLeftColumn(1440, chrome))).toBe('wide-side');
  });

  it('never returns narrow, medium or landscape; reflow iff width ≤ 1023', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 4000 }),
        fc.integer({ min: 0, max: 4000 }),
        (w, neck) => {
          const a = at(w, neck);
          expect(['reflow', 'wide-side', 'wide-stacked']).toContain(a);
          expect(a === 'reflow').toBe(w <= 1023);
        }
      )
    );
  });
});
