// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './color';
import { parseTokenSheet, resolveLightDark } from './tokens';

/**
 * US4 and 026: the two-tone focus ring stays visible on the wood and on every marker fill. The
 * ring tones are surface tokens, `light-dark(light, dark)`; the board palette is shared, so
 * both ring arms are checked against the same wood and fills.
 */

const { root } = parseTokenSheet();

const FILLS = [
  '--fb-color-root',
  '--fb-color-third',
  '--fb-color-fifth',
  '--fb-color-neutral',
  '--fb-color-note-highlight',
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `--fb-octave-tone-${n}`)
];

describe.each([
  ['light', 0],
  ['dark', 1]
] as const)('focus ring (%s)', (_mode, arm) => {
  const outer = (): string => resolveLightDark(root['--color-focus-ring-outer'])[arm];
  const inner = (): string => resolveLightDark(root['--color-focus-ring-inner'])[arm];

  it('defines both ring tones', () => {
    expect(outer()).toMatch(/^#[0-9a-f]{6}$/i);
    expect(inner()).toMatch(/^#[0-9a-f]{6}$/i);
    expect(outer().toLowerCase()).not.toBe(inner().toLowerCase());
  });

  it('has contrast >= 3:1 against the wood', () => {
    const wood = root['--fb-color-wood'];
    expect(
      Math.max(contrastRatio(outer(), wood), contrastRatio(inner(), wood))
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(FILLS)('has contrast >= 3:1 against %s', (fill) => {
    const f = root[fill];
    expect(Math.max(contrastRatio(outer(), f), contrastRatio(inner(), f))).toBeGreaterThanOrEqual(
      3
    );
  });

  /** The inner tone is a halo separating the ring from the marker; the outer stroke is the ring colour. */
  it('has an outer stroke that is not equal to any marker fill', () => {
    const fills = FILLS.map((n) => root[n].toLowerCase());
    expect(fills).not.toContain(outer().toLowerCase());
  });
});
