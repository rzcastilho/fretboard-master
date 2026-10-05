import { describe, expect, it } from 'vitest';
import { GAP_WARNING, findMissingKeys, takeUnreported } from '../../../src/lib/i18n/gaps';

describe('findMissingKeys', () => {
  const base = { $schema: 'x', a: 'A', b: 'B', c: ['x'] };

  it('reports keys absent from the catalog', () => {
    expect(findMissingKeys(base, { a: 'a' })).toEqual(['b', 'c']);
  });

  it('reports empty-string values', () => {
    expect(findMissingKeys(base, { a: '', b: 'b', c: ['y'] })).toEqual(['a']);
  });

  it('ignores $schema in base and catalog', () => {
    expect(findMissingKeys(base, { a: 'a', b: 'b', c: ['y'] })).toEqual([]);
    expect(findMissingKeys({ $schema: 'x' }, {})).toEqual([]);
  });

  it('reports values that are neither string nor array', () => {
    expect(findMissingKeys(base, { a: 3, b: null, c: { k: 1 } })).toEqual(['a', 'b', 'c']);
  });

  it('accepts arrays as present', () => {
    expect(findMissingKeys({ c: ['x'] }, { c: [{ declarations: [] }] })).toEqual([]);
  });
});

describe('takeUnreported', () => {
  it('returns each locale:key once', () => {
    const seen = new Set<string>();
    expect(takeUnreported(seen, 'es', ['a', 'b'])).toEqual(['a', 'b']);
    expect(takeUnreported(seen, 'es', ['a', 'b', 'c'])).toEqual(['c']);
    expect(takeUnreported(seen, 'es', ['a'])).toEqual([]);
  });

  it('tracks locales separately', () => {
    const seen = new Set<string>();
    takeUnreported(seen, 'es', ['a']);
    expect(takeUnreported(seen, 'pt-BR', ['a'])).toEqual(['a']);
    expect(seen.has('es:a')).toBe(true);
    expect(seen.has('pt-BR:a')).toBe(true);
  });

  it('dedupes within one call', () => {
    expect(takeUnreported(new Set(), 'es', ['a', 'a'])).toEqual(['a']);
  });
});

it('GAP_WARNING text', () => {
  expect(GAP_WARNING).toBe('[fretboard-master] missing text');
});
