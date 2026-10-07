// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToSrgb } from './color';
import { parseTokenSheet, resolveLightDark, type TokenMap } from './tokens';

/**
 * Fretboard palette thresholds (data-model §5) for the standard, contrast-more and print sets.
 * Every value is read from `src/lib/styles/tokens.css`; nothing is restated here.
 */

const sheet = parseTokenSheet();

type SetName = 'standard' | 'contrast-more' | 'print';

const SETS: Record<SetName, TokenMap> = {
  standard: sheet.root,
  'contrast-more': { ...sheet.root, ...sheet.contrastMore },
  print: { ...sheet.root, ...sheet.print }
};

/** Thresholds per set: [standard, contrast-more, print]. */
const T = {
  text: { standard: 4.5, 'contrast-more': 7, print: 4.5 },
  marker: { standard: 3, 'contrast-more': 4.5, print: 3 },
  label: { standard: 4.5, 'contrast-more': 7, print: 4.5 }
} as const;

const get = (set: SetName, name: string): string => {
  const v = SETS[set][name];
  if (v === undefined) throw new Error(`${name} missing in ${set}`);
  const [light] = resolveLightDark(v);
  return light;
};

/** Source-over composite of `fg` at `alpha` on `bg`, blended on sRGB values as CSS opacity does. */
function composite(fg: string, bg: string, alpha: number): string {
  const f = hexToSrgb(fg);
  const b = hexToSrgb(bg);
  const mixed = [0, 1, 2].map((i) => f[i] * alpha + b[i] * (1 - alpha));
  return (
    '#' +
    mixed
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

const ROLES = ['root', 'third', 'fifth'].map((r) => `--fb-color-${r}`);
const TONES = [1, 2, 3, 4, 5, 6, 7].map((n) => `--fb-octave-tone-${n}`);
const MARKER_FILLS = [...ROLES, '--fb-color-note-highlight', ...TONES];
const SURFACES = [
  ...resolveLightDark(sheet.root['--color-surface']),
  ...resolveLightDark(sheet.root['--color-surface-raised'])
];

describe.each(Object.keys(SETS) as SetName[])('%s palette', (set) => {
  const v = (name: string): string => get(set, name);
  const wood = (): string => v('--fb-color-wood');

  it.each(['--fb-color-number', '--fb-color-number-strong'])(
    '%s text vs wood meets the text threshold',
    (name) => {
      expect(contrastRatio(v(name), wood())).toBeGreaterThanOrEqual(T.text[set]);
    }
  );

  it.each(ROLES)('label vs %s meets the label threshold', (role) => {
    expect(contrastRatio(v('--fb-color-label'), v(role))).toBeGreaterThanOrEqual(T.label[set]);
  });

  it.each(MARKER_FILLS)('normal marker %s vs wood meets the marker threshold', (name) => {
    expect(contrastRatio(v(name), wood())).toBeGreaterThanOrEqual(T.marker[set]);
  });

  it.each(ROLES)('dimmed marker %s keeps the marker threshold and opacity < 1', (name) => {
    const alpha = Number(v('--emph-dim-opacity'));
    expect(alpha).toBeLessThan(1);
    expect(alpha).toBeGreaterThan(0);
    expect(contrastRatio(composite(v(name), wood(), alpha), wood())).toBeGreaterThanOrEqual(
      T.marker[set]
    );
  });

  it.each(['--fb-color-line', '--fb-color-nut'])(
    '%s meets the marker threshold and stays below every normal marker',
    (name) => {
      const c = contrastRatio(v(name), wood());
      expect(c).toBeGreaterThanOrEqual(T.marker[set]);
      const minMarker = Math.min(...ROLES.map((r) => contrastRatio(v(r), wood())));
      expect(c).toBeLessThan(minMarker);
    }
  );

  it('inlays stay quieter than the lines', () => {
    expect(contrastRatio(v('--fb-color-inlay'), wood())).toBeLessThan(
      contrastRatio(v('--fb-color-line'), wood())
    );
  });

  it.each(['--fb-color-outline', '--fb-color-neutral-stroke', '--fb-color-degree-stroke'])(
    '%s vs wood meets the marker threshold',
    (name) => {
      expect(contrastRatio(v(name), wood())).toBeGreaterThanOrEqual(T.marker[set]);
    }
  );

  it('arrow label (outline) vs its halo meets the label threshold', () => {
    expect(
      contrastRatio(v('--fb-color-outline'), v('--fb-color-arrow-halo'))
    ).toBeGreaterThanOrEqual(T.label[set]);
  });

  it('label on neutral meets the label threshold against the neutral fill', () => {
    expect(
      contrastRatio(v('--fb-color-label-on-neutral'), v('--fb-color-neutral'))
    ).toBeGreaterThanOrEqual(T.label[set]);
  });

  it.each([...MARKER_FILLS.filter((n) => !ROLES.includes(n))])(
    'note-highlight label vs %s meets the label threshold',
    (name) => {
      expect(contrastRatio(v('--fb-color-note-highlight-label'), v(name))).toBeGreaterThanOrEqual(
        T.label[set]
      );
    }
  );

  it('the board edge separates the board from both light and dark surfaces (>= 3)', () => {
    for (const surface of SURFACES) {
      const edge = Math.max(
        contrastRatio(wood(), surface),
        contrastRatio(v('--fb-color-edge'), surface)
      );
      expect(edge, surface).toBeGreaterThanOrEqual(3);
    }
  });

  it('the edge width is set and at least the standard width', () => {
    expect(Number(v('--fb-edge-width'))).toBeGreaterThanOrEqual(
      Number(get('standard', '--fb-edge-width'))
    );
    expect(Number(get('standard', '--fb-edge-width'))).toBeGreaterThan(0);
  });
});

describe('print palette', () => {
  it('has a white or very light wood', () => {
    const [r, g, b] = hexToSrgb(get('print', '--fb-color-wood'));
    expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(0.9);
  });

  it('draws the neutral stroke at >= 3 against the wood', () => {
    expect(
      contrastRatio(get('print', '--fb-color-neutral-stroke'), get('print', '--fb-color-wood'))
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps the standard board dark and warm', () => {
    const [r, g, b] = hexToSrgb(get('standard', '--fb-color-wood'));
    expect(Math.max(r, g, b)).toBeLessThan(0.4);
    expect(r).toBeGreaterThan(b);
  });
});

/** Surface text under prefers-contrast: more (026 US3): all non-board text reaches 7:1. */
describe('contrast-more surface tokens', () => {
  const merged: TokenMap = { ...sheet.root, ...sheet.contrastMore };

  /** Resolve a token to its [light, dark] pair, following `var(--x)` references. */
  const pair = (name: string, depth = 0): readonly [string, string] => {
    const raw = merged[name];
    if (raw === undefined) throw new Error(`${name} missing`);
    const ref = /^var\((--[\w-]+)\)$/.exec(raw.trim());
    if (ref) {
      if (depth > 5) throw new Error(`${name}: reference loop`);
      return pair(ref[1], depth + 1);
    }
    return resolveLightDark(raw);
  };

  const PAIRS: readonly (readonly [string, string])[] = [
    ['--color-text', '--color-surface'],
    ['--color-text', '--color-surface-raised'],
    ['--color-text-muted', '--color-surface'],
    ['--color-text-muted', '--color-surface-raised'],
    ['--color-accent', '--color-surface'],
    ['--color-accent', '--color-surface-raised'],
    ['--color-accent-text', '--color-accent'],
    ['--color-notice-text', '--color-notice-surface']
  ];

  it.each(PAIRS)('%s on %s is at least 7:1 in light and dark', (fg, bg) => {
    const f = pair(fg);
    const b = pair(bg);
    for (const i of [0, 1] as const) {
      expect(
        contrastRatio(f[i], b[i]),
        `${fg}/${bg} ${i === 0 ? 'light' : 'dark'}`
      ).toBeGreaterThanOrEqual(7);
    }
  });

  it.each(['--color-border', '--color-notice-border'])(
    '%s stays at least 3:1 against the surface',
    (name) => {
      const f = pair(name);
      const b = pair('--color-surface');
      for (const i of [0, 1] as const) {
        expect(contrastRatio(f[i], b[i])).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it('widths and strokes are not thinner than standard', () => {
    const num = (v: string): number => Number.parseFloat(v);
    for (const name of [
      '--border-width',
      '--focus-ring-width',
      '--marker-stroke',
      '--marker-neutral-stroke-width',
      '--marker-triad-stroke',
      '--fb-edge-width'
    ]) {
      expect(num(merged[name]), name).toBeGreaterThanOrEqual(num(sheet.root[name]));
    }
  });
});
