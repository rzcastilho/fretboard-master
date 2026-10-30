import { describe, expect, it } from 'vitest';
import { KNOWN_PATHS, screenTitle } from '../../src/lib/shell/screens';

describe('screens', () => {
  it('KNOWN_PATHS is exactly the six screens', () => {
    expect([...KNOWN_PATHS]).toEqual(['/', '/notes', '/triads', '/caged', '/metronome', '/about']);
  });

  it.each(['/Triads', '/triads/x', '/caged/x'])('%s is not a known path', (path) => {
    expect((KNOWN_PATHS as readonly string[]).includes(path)).toBe(false);
  });

  it('/caged is a known path', () => {
    expect((KNOWN_PATHS as readonly string[]).includes('/caged')).toBe(true);
  });

  it('screenTitle formats titles', () => {
    expect(screenTitle('home')).toBe('Fretboard Master');
    expect(screenTitle('triads')).toBe('Triads — Fretboard Master');
    expect(screenTitle('caged')).toBe('CAGED — Fretboard Master');
    expect(screenTitle('metronome')).toBe('Metronome — Fretboard Master');
  });
});
