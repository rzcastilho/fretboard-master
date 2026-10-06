import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeLink, encodeLink, type ShareSnapshot } from '$lib/link';

/**
 * v1 compatibility fixtures (FR-019, Constitution IX): a released link must decode the same in every
 * later build. Fixtures are only ever added; the MANIFEST is the append-only record of file names.
 */
interface Fixture {
  readonly name: string;
  readonly snapshot: ShareSnapshot;
  readonly link: string;
}

const ORIGIN = 'https://fretboard.example';
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v1');

const modules = import.meta.glob<Omit<Fixture, never>>('./fixtures/v1/*.ts', { eager: true });
const fixtures: readonly Fixture[] = Object.entries(modules).map(([path, mod]) => ({
  ...mod,
  name: mod.name ?? path
}));

const manifest = readFileSync(join(DIR, 'MANIFEST'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l !== '');

describe('v1 fixture manifest', () => {
  it('lists every fixture file and no listed file is missing', () => {
    const onDisk = readdirSync(DIR)
      .filter((f) => f !== 'MANIFEST' && !f.startsWith('.'))
      .sort();
    expect([...manifest].sort()).toEqual(onDisk);
  });

  it('has no duplicate entries and covers the required minimum set', () => {
    expect(new Set(manifest).size).toBe(manifest.length);
    expect(manifest.length).toBeGreaterThanOrEqual(11);
  });

  it('every fixture name matches its file name', () => {
    for (const f of fixtures) expect(manifest).toContain(`${f.name}.ts`);
  });
});

describe('v1 fixtures', () => {
  it('loads every manifest entry', () => {
    expect(fixtures).toHaveLength(manifest.length);
  });

  for (const [path, mod] of Object.entries(modules)) {
    const f = mod as unknown as Fixture;
    describe(path, () => {
      it('is under the origin and length limit', () => {
        expect(f.link.startsWith(`${ORIGIN}/`)).toBe(true);
        expect(f.link.length).toBeLessThan(1000);
      });

      it('encodes to exactly the recorded link', () => {
        expect(encodeLink(f.snapshot, ORIGIN)).toBe(f.link);
      });

      it('decodes to exactly the recorded snapshot with no fallbacks', () => {
        expect(decodeLink(new URL(f.link))).toEqual({
          kind: 'ok',
          snapshot: f.snapshot,
          fellBack: []
        });
      });
    });
  }
});
