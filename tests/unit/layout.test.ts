import { describe, expect, it } from 'vitest';
import {
  LANDSCAPE_MAX_HEIGHT,
  MEDIUM_MAX,
  NARROW_MAX,
  arrangementFor,
  isPhoneLandscape,
  wideLeftColumn,
  type LayoutChrome
} from '../../src/lib/shell/layout';

const chrome: LayoutChrome = { mainPadding: 16, gap: 16, zoneBorder: 1 };
/** Natural neck widths at a 16 px root (6 strings, marks off). */
const NECK_24 = 1220;
const NECK_12 = 644;

describe('isPhoneLandscape', () => {
  it.each([
    [844, 390, true],
    [1024, 768, false],
    [390, 844, false],
    [500, 499, true],
    [499, 499, false]
  ])('(%i, %i) → %s', (w, h, expected) => {
    expect(isPhoneLandscape(w, h)).toBe(expected);
  });

  it('constants', () => {
    expect(NARROW_MAX).toBe(599);
    expect(MEDIUM_MAX).toBe(1023);
    expect(LANDSCAPE_MAX_HEIGHT).toBe(499);
  });
});

describe('wideLeftColumn', () => {
  it('is 3/4 of the content width minus the zone borders', () => {
    expect(wideLeftColumn(1440, chrome)).toBe(((1440 - 32 - 16) * 3) / 4 - 2);
  });
});

describe('arrangementFor', () => {
  const at = (width: number, height: number, neckWidth: number, c = chrome) =>
    arrangementFor({ width, height, neckWidth, chrome: c });

  it.each([
    ['1440/24 → wide-stacked', 1440, 900, NECK_24, 'wide-stacked'],
    ['1440/12 → wide-side', 1440, 900, NECK_12, 'wide-side'],
    ['2560/24 → wide-side', 2560, 1440, NECK_24, 'wide-side'],
    ['1024/24 → wide-stacked', 1024, 700, NECK_24, 'wide-stacked'],
    ['844×390 → landscape', 844, 390, NECK_24, 'landscape'],
    ['1024×768 → wide-stacked', 1024, 768, NECK_24, 'wide-stacked'],
    ['390×844 → narrow', 390, 844, NECK_24, 'narrow'],
    ['800×1280 → medium', 800, 1280, NECK_24, 'medium'],
    ['599 → narrow', 599, 900, NECK_24, 'narrow'],
    ['600 → medium', 600, 900, NECK_24, 'medium'],
    ['1023 → medium', 1023, 900, NECK_24, 'medium'],
    ['wide landscape any width', 1200, 450, NECK_12, 'landscape'],
    ['height 499 square → not landscape', 499, 499, NECK_24, 'narrow']
  ] as const)('%s', (_name, w, h, neck, expected) => {
    expect(at(w, h, neck)).toBe(expected);
  });

  it('1440/24 at a 32 px root (neck 2440, chrome doubled) → wide-stacked', () => {
    expect(at(1440, 900, 2440, { mainPadding: 32, gap: 32, zoneBorder: 2 })).toBe('wide-stacked');
  });

  it('neck exactly the left column → wide-side', () => {
    expect(at(1440, 900, wideLeftColumn(1440, chrome))).toBe('wide-side');
  });
});
