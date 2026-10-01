import { describe, expect, it } from 'vitest';
import { KNOWN_PATHS, screenTitle } from '../../src/lib/shell/screens';

describe('screens', () => {
  it('KNOWN_PATHS is exactly the four screens', () => {
    expect([...KNOWN_PATHS]).toEqual(['/', '/notes', '/triads', '/about']);
  });

  it.each(['/caged', '/Triads', '/triads/x'])('%s is not a known path', (path) => {
    expect((KNOWN_PATHS as readonly string[]).includes(path)).toBe(false);
  });

  it('screenTitle formats titles', () => {
    expect(screenTitle('home')).toBe('Fretboard Master');
    expect(screenTitle('triads')).toBe('Triads — Fretboard Master');
  });
});
