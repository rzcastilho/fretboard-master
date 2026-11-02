// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'static/manifest.webmanifest'), 'utf8'));
const tokens = readFileSync(join(root, 'src/lib/styles/tokens.css'), 'utf8');

/** Light value of the first `--name: light-dark(light, dark)` declaration. */
function lightValue(name: string): string {
  const m = tokens.match(new RegExp(`${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1].toLowerCase();
}

function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('web app manifest (C-11)', () => {
  it('has the identity fields exactly', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Fretboard Master',
      short_name: 'Fretboard Master',
      start_url: '/',
      scope: '/',
      display: 'standalone'
    });
  });

  it('has exactly the allowed keys', () => {
    expect(Object.keys(manifest).sort()).toEqual(
      [
        'id',
        'name',
        'short_name',
        'start_url',
        'scope',
        'display',
        'background_color',
        'theme_color',
        'icons'
      ].sort()
    );
  });

  it('takes its colours from the light surface tokens', () => {
    expect(manifest.background_color.toLowerCase()).toBe(lightValue('--color-surface'));
    expect(manifest.theme_color.toLowerCase()).toBe(lightValue('--color-surface-raised'));
  });

  it('lists icons that exist, are PNG and match their declared size', () => {
    for (const icon of manifest.icons) {
      const file = join(root, 'static', icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(icon.type).toBe('image/png');
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual({ width: w, height: h });
    }
  });

  it('includes the 192 and 512 any icons and the 512 maskable icon', () => {
    const has = (sizes: string, purpose: string) =>
      manifest.icons.some(
        (i: { sizes: string; purpose: string }) => i.sizes === sizes && i.purpose === purpose
      );
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
  });

  it('ships a 180x180 apple touch icon', () => {
    expect(pngSize(join(root, 'static/icons/apple-touch-icon.png'))).toEqual({
      width: 180,
      height: 180
    });
  });
});
