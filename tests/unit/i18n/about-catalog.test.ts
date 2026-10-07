import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, PRIVACY_CATEGORIES } from '../../../src/lib/prefs/schema';

type Catalog = Record<string, string>;
const load = (name: string): Catalog => JSON.parse(readFileSync(`messages/${name}.json`, 'utf8'));
const subset = (c: Catalog) =>
  Object.keys(c).filter((k) => k.startsWith('about_') || k.startsWith('shortcuts_'));

const en = load('en');
const LOCALES = ['en', 'pt-BR', 'es'] as const;
const CAPS = { en: 220, 'pt-BR': 280, es: 280 } as const;
const JARGON = {
  en: ['data controller', 'processing', 'lawful basis'],
  'pt-BR': ['controlador', 'tratamento', 'base legal'],
  es: ['responsable del tratamiento', 'tratamiento', 'base jurídica']
} as const;
const STATEMENTS = [
  'no_data',
  'stored',
  'erase',
  'not_measured',
  'no_ads',
  'no_permissions',
  'hosting',
  'share_links',
  'all_ages'
].map((k) => `about_privacy_${k}`);

describe('About catalog (FR-019, SC-006)', () => {
  for (const tag of LOCALES) {
    describe(tag, () => {
      const cat = load(tag);

      it('has every about_* and shortcuts_* key, none empty', () => {
        for (const key of subset(en)) {
          expect(typeof cat[key], key).toBe('string');
          expect((cat[key] ?? '').trim(), key).not.toBe('');
        }
      });

      it(`keeps the nine policy statements within ${CAPS[tag]} words`, () => {
        const words = STATEMENTS.map((k) => (cat[k] ?? '').trim().split(/\s+/).length).reduce(
          (a, b) => a + b,
          0
        );
        expect(words).toBeLessThanOrEqual(CAPS[tag]);
      });

      it('uses no legal jargon', () => {
        const text = STATEMENTS.map((k) => cat[k] ?? '')
          .join(' ')
          .toLowerCase();
        for (const term of JARGON[tag]) expect(text).not.toContain(term.toLowerCase());
      });
    });
  }

  it('maps every stored preference to a policy category', () => {
    const covered = new Set<string>(Object.values(PRIVACY_CATEGORIES).flat());
    const missing = Object.keys(DEFAULT_PREFERENCES).filter((k) => !covered.has(k));
    expect(missing).toEqual([]);
  });
});
