// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color';

/** US4: the two-tone focus ring stays visible on the wood and on every marker fill. */

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

const FILLS = [
  '--color-root',
  '--color-third',
  '--color-fifth',
  '--color-neutral-note',
  '--color-note-highlight',
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `--octave-tone-${n}`)
];

describe.each(['light', 'dark'] as const)('focus ring (%s)', (mode) => {
  const block = blocks[mode];
  const outer = (): string => value(block, '--color-focus-ring-outer');
  const inner = (): string => value(block, '--color-focus-ring-inner');

  it('defines both ring tones', () => {
    expect(outer()).toMatch(/^#[0-9a-f]{6}$/i);
    expect(inner()).toMatch(/^#[0-9a-f]{6}$/i);
    expect(outer().toLowerCase()).not.toBe(inner().toLowerCase());
  });

  it('has contrast >= 3:1 against the wood', () => {
    const wood = value(block, '--color-fretboard-wood');
    expect(
      Math.max(contrastRatio(outer(), wood), contrastRatio(inner(), wood))
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(FILLS)('has contrast >= 3:1 against %s', (fill) => {
    const f = value(block, fill);
    expect(Math.max(contrastRatio(outer(), f), contrastRatio(inner(), f))).toBeGreaterThanOrEqual(
      3
    );
  });

  /** The inner tone is a halo separating the ring from the marker; the outer stroke is the ring colour. */
  it('has an outer stroke that is not equal to any marker fill', () => {
    const fills = FILLS.map((n) => value(block, n).toLowerCase());
    expect(fills).not.toContain(outer().toLowerCase());
  });
});
