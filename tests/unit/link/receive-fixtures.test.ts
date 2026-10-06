import { describe, expect, it } from 'vitest';
import { readReceivedLink } from '$lib/link';
import { fixtures } from './fixtures/open/open.table';

const ORIGIN = 'https://fretboard.example';

describe('receive fixtures (append-only)', () => {
  it('has unique names', () => {
    expect(new Set(fixtures.map((f) => f.name)).size).toBe(fixtures.length);
  });

  for (const f of fixtures) {
    it(f.name, () => {
      const r = readReceivedLink(new URL(ORIGIN + f.url), f.stored);
      expect(r.kind).toBe(f.expect.kind);
      if (r.kind !== 'tool') return;
      if (f.expect.instrument) expect(r.snapshot.instrument).toEqual(f.expect.instrument);
      if (f.expect.fellBack)
        expect(r.fellBack).toEqual(expect.arrayContaining([...f.expect.fellBack]));
      if (f.expect.forcedNotice !== undefined) expect(r.forcedNotice).toBe(f.expect.forcedNotice);
      if (f.expect.rootPc !== undefined && r.snapshot.tool !== 'notes') {
        expect(r.snapshot.view.rootPc).toBe(f.expect.rootPc);
      }
    });
  }
});
