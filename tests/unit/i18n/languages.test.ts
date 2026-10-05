import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE_LANGUAGE,
  LANGUAGES,
  LANGUAGE_TAGS,
  isLanguageTag,
  matchDeviceLanguage
} from '../../../src/lib/i18n/languages';
import { locales } from '../../../src/lib/paraglide/runtime.js';

describe('matchDeviceLanguage (contracts/language-api.md §1)', () => {
  const table: readonly [readonly string[], string][] = [
    [['pt-PT'], 'pt-BR'],
    [['pt-BR'], 'pt-BR'],
    [['es-ES'], 'es'],
    [['es-MX'], 'es'],
    [['es-419'], 'es'],
    [['es-AR'], 'es'],
    [['en-GB'], 'en'],
    [['en-US'], 'en'],
    [['EN-au'], 'en'],
    [['fr'], 'en'],
    [['ja'], 'en'],
    [[], 'en'],
    [['fr-FR', 'es-MX'], 'es'],
    [['', '  ', 'x_y', 'pt'], 'pt-BR'],
    [['de', 'pt-PT', 'es'], 'pt-BR']
  ];
  it.each(table)('%j → %s', (input, out) => {
    expect(matchDeviceLanguage(input)).toBe(out);
  });

  it('SC-002: ten device cases', () => {
    const cases: readonly [string, string][] = [
      ['pt-PT', 'pt-BR'],
      ['pt-BR', 'pt-BR'],
      ['es-ES', 'es'],
      ['es-MX', 'es'],
      ['es-419', 'es'],
      ['en-GB', 'en'],
      ['en-US', 'en'],
      ['fr', 'en'],
      ['ja', 'en'],
      ['de-DE', 'en']
    ];
    for (const [tag, out] of cases) expect(matchDeviceLanguage([tag])).toBe(out);
  });

  it('trims and is case-insensitive', () => {
    expect(matchDeviceLanguage(['  PT-br '])).toBe('pt-BR');
    expect(matchDeviceLanguage(['ES'])).toBe('es');
  });

  it('never throws on odd input', () => {
    const odd = ['-', 'a', 'pt-', 'pt--BR', '💥', 'p t', 'x'.repeat(50)] as const;
    expect(() => matchDeviceLanguage(odd)).not.toThrow();
    expect(matchDeviceLanguage(odd)).toBe('en');
  });
});

describe('isLanguageTag', () => {
  it('accepts exactly the supported tags', () => {
    for (const t of ['en', 'pt-BR', 'es']) expect(isLanguageTag(t)).toBe(true);
    for (const t of ['pt', 'PT-BR', 'fr', '', 3, null, undefined, {}, ['en']]) {
      expect(isLanguageTag(t)).toBe(false);
    }
  });
});

describe('LANGUAGES', () => {
  it('is ordered English, Português, Español with unique primaries', () => {
    expect(LANGUAGES.map((l) => l.tag)).toEqual(['en', 'pt-BR', 'es']);
    expect(new Set(LANGUAGES.map((l) => l.primary)).size).toBe(LANGUAGES.length);
    expect(LANGUAGE_TAGS).toEqual(['en', 'pt-BR', 'es']);
    expect(BASE_LANGUAGE).toBe('en');
  });

  it('equals Paraglide locales and inlang settings locales (R-15)', () => {
    const settings = JSON.parse(
      readFileSync(resolve(process.cwd(), 'project.inlang/settings.json'), 'utf8')
    ) as { locales: string[] };
    expect([...locales]).toEqual([...LANGUAGE_TAGS]);
    expect(settings.locales).toEqual([...LANGUAGE_TAGS]);
  });
});
