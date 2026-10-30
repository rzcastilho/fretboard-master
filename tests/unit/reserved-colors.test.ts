// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaEHex, hexToSrgb } from './a11y/color';
import { parseTokenSheet, resolveLightDark, type TokenMap } from './a11y/tokens';

/** Constitution V: root/third/fifth colors are reserved for fretboard markers. */

/** The shared palette names (026) and the legacy names still read until US2 migrates them. */
const RESERVED = /var\(\s*--(?:fb-)?color-(root|third|fifth)\b/;
const FRETBOARD = 'src/lib/fretboard/Fretboard.svelte';
/** Legend sample of the same marker glyph (spec 017, R-09): still a fretboard marker, not UI chrome. */
const MARKER_SAMPLE = 'src/lib/fretboard/MarkerSample.svelte';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(svelte|css)$/.test(name) ? [path] : [];
  });
}

const all = files('src').map((p) => ({ path: relative('.', p), text: readFileSync(p, 'utf8') }));
const sheet = parseTokenSheet();

const SETS: Record<'standard' | 'contrast-more' | 'print', TokenMap> = {
  standard: sheet.root,
  'contrast-more': { ...sheet.root, ...sheet.contrastMore },
  print: { ...sheet.root, ...sheet.print }
};

const ROLE_NAMES = ['--fb-color-root', '--fb-color-third', '--fb-color-fifth'];
const LEGACY_ROLE_NAMES = ['--color-root', '--color-third', '--color-fifth'];

describe('reserved marker colors', () => {
  it('are referenced only from Fretboard.svelte and its legend sample', () => {
    const offenders = all.filter(
      (f) => f.path !== FRETBOARD && f.path !== MARKER_SAMPLE && RESERVED.test(f.text)
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('are not referenced from the view-aids components (ViewAids, LegendPanel)', () => {
    for (const path of [
      'src/lib/fretboard/ViewAids.svelte',
      'src/lib/fretboard/LegendPanel.svelte'
    ]) {
      const file = all.find((f) => f.path === path);
      expect(file, `${path} is scanned`).toBeDefined();
      expect(RESERVED.test(file?.text ?? ''), path).toBe(false);
    }
  });

  it('are defined in tokens.css for the standard, contrast-more and print sets', () => {
    for (const [name, set] of Object.entries(SETS)) {
      for (const token of ROLE_NAMES) expect(set[token], `${token} in ${name}`).toBeDefined();
    }
    expect(Object.keys(sheet.contrastMore)).toEqual(expect.arrayContaining(ROLE_NAMES));
    expect(Object.keys(sheet.print)).toEqual(expect.arrayContaining(ROLE_NAMES));
  });

  it('are used in Fretboard.svelte only inside marker-function rules (.marker.root|third|fifth .glyph)', () => {
    const text = all.find((f) => f.path === FRETBOARD)?.text ?? '';
    const style = /<style[^>]*>([\s\S]*)<\/style>/.exec(text)?.[1] ?? '';
    const bad: string[] = [];
    for (const rule of style.split('}')) {
      const [selector, body = ''] = rule.split('{');
      const match = RESERVED.exec(body);
      if (!match) continue;
      if (!new RegExp(`\\.marker\\.${match[1]}\\s+\\.glyph\\b`).test(selector)) {
        bad.push(selector.trim());
      }
    }
    expect(bad).toEqual([]);
  });

  it('are used in MarkerSample.svelte only as the glyph fill', () => {
    const text = all.find((f) => f.path === MARKER_SAMPLE)?.text ?? '';
    const style = /<style[^>]*>([\s\S]*)<\/style>/.exec(text)?.[1] ?? '';
    const bad: string[] = [];
    for (const rule of style.split('}')) {
      const [selector, body = ''] = rule.split('{');
      if (!RESERVED.test(body)) continue;
      const declarations = body
        .split(';')
        .filter((d) => RESERVED.test(d))
        .map((d) => d.split(':')[0].trim());
      if (declarations.some((p) => p !== 'fill')) bad.push(selector.trim());
    }
    expect(bad).toEqual([]);
  });

  it('are never used by buttons, links, focus rings, selection or notices', () => {
    const chrome = [
      '--color-accent',
      '--color-accent-text',
      '--color-focus-ring',
      '--color-focus-ring-outer',
      '--color-focus-ring-inner',
      '--color-notice-surface',
      '--color-notice-text',
      '--color-notice-border',
      '--color-border'
    ];
    const reserved = ROLE_NAMES.flatMap((n) =>
      Object.values(SETS).map((set) => set[n].toLowerCase())
    );
    for (const name of chrome) {
      for (const arm of resolveLightDark(sheet.root[name])) {
        expect(reserved, `${name} = ${arm}`).not.toContain(arm.toLowerCase());
      }
    }
    const global = all.find((f) => f.path === 'src/lib/styles/global.css');
    if (global) expect(RESERVED.test(global.text)).toBe(false);
  });

  it('no notice token resolves to error red', () => {
    for (const name of ['--color-notice-surface', '--color-notice-text', '--color-notice-border']) {
      for (const arm of resolveLightDark(sheet.root[name])) {
        const [r, g, b] = hexToSrgb(arm);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const isRed = max - min > 0.2 && r === max && r - Math.max(g, b) > 0.15;
        expect(isRed, `${name} = ${arm}`).toBe(false);
      }
    }
  });

  describe('notes tokens', () => {
    const names = [
      '--fb-color-note-highlight',
      '--fb-color-note-highlight-label',
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => `--fb-octave-tone-${n}`),
      '--fb-region-band'
    ];

    it.each(names)('%s is defined for standard, contrast-more and print', (name) => {
      for (const mode of Object.keys(SETS) as (keyof typeof SETS)[]) {
        expect(SETS[mode][name], `${name} in ${mode}`).toBeDefined();
      }
    });

    it('never equals or references the reserved root/third/fifth colors', () => {
      for (const mode of Object.keys(SETS) as (keyof typeof SETS)[]) {
        const set = SETS[mode];
        const reserved = ROLE_NAMES.map((n) => set[n]);
        for (const name of names) {
          expect(set[name]).not.toMatch(/--(?:fb-)?color-(root|third|fifth)\b/);
          expect(reserved).not.toContain(set[name]);
        }
      }
    });
  });

  describe('reuse of reserved values (US4)', () => {
    const roleNames = new Set([...ROLE_NAMES, ...LEGACY_ROLE_NAMES]);

    it.each(['standard', 'contrast-more', 'print'] as const)(
      'no token besides root/third/fifth equals a reserved value (%s)',
      (mode) => {
        const set = SETS[mode];
        const reserved = new Set(ROLE_NAMES.map((n) => set[n].toLowerCase()));
        const offenders = Object.entries(set)
          .filter(([n, v]) => !roleNames.has(n) && reserved.has(v.toLowerCase()))
          .map(([n]) => n);
        expect(offenders).toEqual([]);
      }
    );

    it('accent is distinct from root/third/fifth in both themes', () => {
      const accents = resolveLightDark(sheet.root['--color-accent']);
      const accentText = resolveLightDark(sheet.root['--color-accent-text']);
      accents.forEach((accent, i) => {
        for (const n of ROLE_NAMES) {
          expect(deltaEHex(accent, sheet.root[n]), `${accent} vs ${n}`).toBeGreaterThanOrEqual(10);
        }
        expect(contrastRatio(accent, accentText[i])).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  describe('metronome danger token (031, FR-021)', () => {
    const arms = (set: TokenMap, name: string) => resolveLightDark(set[name]);

    it.each(['standard', 'contrast-more'] as const)(
      'is ΔE ≥ 10 from the root colour and ≥ 3:1 on the surface (%s)',
      (mode) => {
        const set = SETS[mode];
        const danger = arms(set, '--color-danger');
        const surface = arms(set, '--color-surface');
        danger.forEach((d, i) => {
          expect(deltaEHex(d, set['--fb-color-root']), `${d} vs root`).toBeGreaterThanOrEqual(10);
          expect(
            contrastRatio(d, surface[i] ?? surface[0]),
            `${d} on surface`
          ).toBeGreaterThanOrEqual(3);
        });
      }
    );

    it('is a system colour in forced-colours mode', () => {
      expect(sheet.forcedColors['--color-danger']).toBeDefined();
    });

    it('is referenced only in RunControls.svelte', () => {
      const offenders = all.filter(
        (f) =>
          f.path !== 'src/lib/tools/metronome/RunControls.svelte' &&
          f.path !== 'src/lib/styles/tokens.css' &&
          /--color-danger\b/.test(f.text)
      );
      expect(offenders.map((f) => f.path)).toEqual([]);
    });
  });
});
