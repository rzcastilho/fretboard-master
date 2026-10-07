// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { joinNotes, joinSummary } from '../../../src/lib/state/context-summary';
import { language, resetLanguageForTests } from '../../../src/lib/state/language.svelte';

beforeEach(() => resetLanguageForTests());
afterEach(() => resetLanguageForTests());

describe('joinSummary', () => {
  it('joins parts with the catalog separator', () => {
    expect(joinSummary(['A major', '1st inversion', 'C♯ – E – A'])).toBe(
      'A major · 1st inversion · C♯ – E – A'
    );
  });

  it('drops empty parts', () => {
    expect(joinSummary(['C major', '', 'C – E – G'])).toBe('C major · C – E – G');
    expect(joinSummary(['', ''])).toBe('');
    expect(joinSummary(['only'])).toBe('only');
    expect(joinSummary([])).toBe('');
  });

  it('uses the same separator in pt-BR and es', () => {
    for (const locale of ['pt-BR', 'es'] as const) {
      language.start(locale);
      expect(joinSummary(['a', 'b'])).toBe('a · b');
    }
  });
});

describe('joinNotes', () => {
  it('joins note names with the catalog en dash', () => {
    expect(joinNotes(['C', 'E', 'G'])).toBe('C – E – G');
    expect(joinNotes(['C'])).toBe('C');
    expect(joinNotes([])).toBe('');
  });

  it('drops empty names', () => {
    expect(joinNotes(['C', '', 'G'])).toBe('C – G');
  });

  it('uses the same separator in pt-BR and es', () => {
    for (const locale of ['pt-BR', 'es'] as const) {
      language.start(locale);
      expect(joinNotes(['Dó', 'Mi', 'Sol'])).toBe('Dó – Mi – Sol');
    }
  });
});
