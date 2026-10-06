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
        expect(cat.note_spoken_sharp).toContain('{note}');
        expect(cat.note_spoken_flat).toContain('{note}');
      });
    });
  }

  it('English keeps R for the root', () => {
    expect(en.interval_root).toBe('R');
  });
});

describe('notation catalog keys (021 contracts/notation-api.md §9)', () => {
  const NEW_KEYS = [
    'note_name_solfege_c',
    'note_name_solfege_d',
    'note_name_solfege_e',
    'note_name_solfege_f',
    'note_name_solfege_g',
    'note_name_solfege_a',
    'note_name_solfege_b',
    'note_spoken_either',
    'notation_label',
    'notation_letters',
    'notation_solfege',
    'accidentals_label',
    'accidentals_sharps',
    'accidentals_flats',
    'accidentals_both',
    'caged_solfege_note'
  ];
  const PARAMETERIZED_TUNINGS = [4, 5, 6, 8, 9, 10, 11, 23].map((n) => `tuning_af${n}`);

  for (const tag of ['en', ...NON_BASE] as const) {
    const cat = tag === 'en' ? en : load(tag);

    it(`${tag} has the new keys`, () => {
      expect(NEW_KEYS.filter((k) => !(k in cat))).toEqual([]);
    });

    it(`${tag} drops notes_selector_altered_spoken`, () => {
      expect('notes_selector_altered_spoken' in cat).toBe(false);
    });

    it(`${tag} uses {note} in every note_spoken_* message`, () => {
      for (const k of keysOf(cat).filter((x) => x.startsWith('note_spoken_'))) {
        if (k === 'note_spoken_either') continue;
        expect(cat[k], k).toContain('{note}');
        expect(cat[k], k).not.toContain('{letter}');
      }
    });

    it(`${tag} parameterizes the tuning names with {note}, DADGAD stays literal`, () => {
      for (const k of PARAMETERIZED_TUNINGS) expect(cat[k], k).toContain('{note}');
      expect(cat.tuning_af7).toBe('DADGAD');
    });

    it(`${tag} note_spoken_either and caged_solfege_note have their placeholders`, () => {
      expect(placeholders(cat.note_spoken_either)).toEqual(['first', 'second']);
      expect(placeholders(cat.caged_solfege_note)).toEqual(['a', 'c', 'd', 'e', 'g']);
    });
  }

  it('has the contract wording for the panel labels', () => {
    expect(en.language_panel_label).toBe('Language and notation');
    expect(en.language_close).toBe('Close language and notation settings');
    expect(load('pt-BR').language_panel_label).toBe('Idioma e notação');
    expect(load('es').language_panel_label).toBe('Idioma y notación');
  });

  it('has the per-locale solfège syllables', () => {
    const syl = (c: Catalog) => 'cdefgab'.split('').map((l) => c[`note_name_solfege_${l}`]);
    expect(syl(en)).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']);
    expect(syl(load('es'))).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']);
    expect(syl(load('pt-BR'))).toEqual(['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si']);
  });
});
