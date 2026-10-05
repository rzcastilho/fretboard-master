import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../../src/lib/i18n/languages';
import { IDENTICAL_ALLOWLIST } from './identical-allowlist';

type Catalog = Record<string, string>;
const load = (name: string): Catalog => JSON.parse(readFileSync(`messages/${name}.json`, 'utf8'));
const keysOf = (c: Catalog) => Object.keys(c).filter((k) => k !== '$schema');
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();

const en = load('en');
const NON_BASE = ['pt-BR', 'es'] as const;

describe('catalogs (R-08, SC-001)', () => {
  it('inlang locales equal the supported language tags', () => {
    const settings = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8')) as {
      locales: string[];
    };
    expect(settings.locales).toEqual(LANGUAGES.map((l) => l.tag));
  });

  for (const tag of NON_BASE) {
    describe(tag, () => {
      const cat = load(tag);

      it('has exactly the English key set', () => {
        const base = new Set(keysOf(en));
        const own = new Set(keysOf(cat));
        expect(keysOf(en).filter((k) => !own.has(k))).toEqual([]);
        expect(keysOf(cat).filter((k) => !base.has(k))).toEqual([]);
      });

      it('has no empty values', () => {
        expect(
          keysOf(cat).filter((k) => typeof cat[k] !== 'string' || cat[k].trim() === '')
        ).toEqual([]);
      });

      it('keeps the same placeholders per key', () => {
        const bad = keysOf(en).filter(
          (k) => JSON.stringify(placeholders(en[k])) !== JSON.stringify(placeholders(cat[k] ?? ''))
        );
        expect(bad).toEqual([]);
      });

      it('differs from English unless allowlisted', () => {
        const allow = new Set(IDENTICAL_ALLOWLIST[tag]);
        const same = keysOf(en).filter((k) => cat[k] === en[k] && !allow.has(k));
        expect(same).toEqual([]);
      });

      it('has no stale allowlist entries', () => {
        const stale = IDENTICAL_ALLOWLIST[tag].filter((k) => !(k in en) || cat[k] !== en[k]);
        expect(stale).toEqual([]);
      });

      it('uses the language-specific values', () => {
        expect(cat.interval_root).toBe('T');
        expect(cat.note_spoken_sharp).toContain('{letter}');
        expect(cat.note_spoken_flat).toContain('{letter}');
      });
    });
  }

  it('English keeps R for the root', () => {
    expect(en.interval_root).toBe('R');
  });
});
