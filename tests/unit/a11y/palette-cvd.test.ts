// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaEUnderCvd, type CvdType } from './color';

/** US5: root/third/fifth stay distinguishable under colour-vision deficiency. */

const tokens = readFileSync('src/lib/styles/tokens.css', 'utf8');
const blocks = {
  light: /^:root\s*\{([\s\S]*?)\n\}/m.exec(tokens)?.[1] ?? '',
  dark:
    /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/.exec(tokens)?.[1] ??
    ''
};

const value = (block: string, name: string): string => {
  const v = new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim();
  if (v === undefined) throw new Error(`${name} missing`);
  return v;
};

const CVD: CvdType[] = ['deuteranopia', 'protanopia', 'tritanopia'];
const DEGREES = ['--color-root', '--color-third', '--color-fifth'] as const;
const PAIRS: [(typeof DEGREES)[number], (typeof DEGREES)[number]][] = [
  ['--color-root', '--color-third'],
  ['--color-root', '--color-fifth'],
  ['--color-third', '--color-fifth']
];

describe.each(['light', 'dark'] as const)('%s palette', (theme) => {
  const block = blocks[theme];

  for (const type of CVD) {
    for (const [a, b] of PAIRS) {
      it(`${a} vs ${b} ΔE ≥ 10 under ${type}`, () => {
        expect(deltaEUnderCvd(value(block, a), value(block, b), type)).toBeGreaterThanOrEqual(10);
      });
    }
  }

  for (const name of DEGREES) {
    it(`label on ${name} has contrast ≥ 4.5`, () => {
      expect(
        contrastRatio(value(block, '--color-marker-label'), value(block, name))
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
