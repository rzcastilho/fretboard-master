import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalogs = ['en', 'pt-BR', 'es'].map(
  (n) => JSON.parse(readFileSync(`messages/${n}.json`, 'utf8')) as Record<string, string>
);

/** Rows of the table: `| English | Português | Español | `key`, `key` | draft |`. */
const rows = readFileSync('docs/i18n/glossary.md', 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('|') && l.includes('`'));

describe('docs/i18n/glossary.md', () => {
  it('has term rows', () => {
    expect(rows.length).toBeGreaterThan(20);
  });

  it('cites only keys that exist in all three catalogs', () => {
    const cited = rows.flatMap((r) => [...r.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]));
    expect(cited.length).toBeGreaterThan(0);
    for (const key of cited) {
      for (const c of catalogs) expect(c, key).toHaveProperty(key);
    }
  });

  it('marks every row as draft pending native review', () => {
    for (const r of rows) expect(r.trim().endsWith('| draft |')).toBe(true);
  });
});
