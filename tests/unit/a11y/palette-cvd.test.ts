// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaEUnderCvd, type CvdType } from './color';
import { parseTokenSheet, resolveLightDark, type TokenMap } from './tokens';

/**
 * US5 and 026: root/third/fifth stay distinguishable under colour-vision deficiency, in the
 * standard, contrast-more and print palettes.
 */

const sheet = parseTokenSheet();

const SETS: Record<'standard' | 'contrast-more' | 'print', TokenMap> = {
  standard: sheet.root,
  'contrast-more': { ...sheet.root, ...sheet.contrastMore },
  print: { ...sheet.root, ...sheet.print }
};

const value = (set: TokenMap, name: string): string => {
  const v = set[name];
  if (v === undefined) throw new Error(`${name} missing`);
  return resolveLightDark(v)[0];
};

const CVD: CvdType[] = ['deuteranopia', 'protanopia', 'tritanopia'];
const DEGREES = ['--fb-color-root', '--fb-color-third', '--fb-color-fifth'] as const;
const PAIRS: [(typeof DEGREES)[number], (typeof DEGREES)[number]][] = [
  ['--fb-color-root', '--fb-color-third'],
  ['--fb-color-root', '--fb-color-fifth'],
  ['--fb-color-third', '--fb-color-fifth']
];

describe.each(Object.keys(SETS) as (keyof typeof SETS)[])('%s palette', (name) => {
  const set = SETS[name];

  for (const type of CVD) {
    for (const [a, b] of PAIRS) {
      it(`${a} vs ${b} ΔE ≥ 10 under ${type}`, () => {
        expect(deltaEUnderCvd(value(set, a), value(set, b), type)).toBeGreaterThanOrEqual(10);
      });
    }
  }

  for (const role of DEGREES) {
    it(`label on ${role} has contrast ≥ 4.5`, () => {
      expect(
        contrastRatio(value(set, '--fb-color-label'), value(set, role))
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
