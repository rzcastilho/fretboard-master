import { describe, expect, it } from 'vitest';
import { KNOWN_PATHS } from '../../src/lib/shell/screens';
import { TOOLS } from '../../src/lib/shell/tools';

describe('TOOLS', () => {
  it('has exactly four tools in order notes, triads, caged, metronome', () => {
    expect(TOOLS).toHaveLength(4);
    expect(TOOLS.map((t) => t.id)).toEqual(['notes', 'triads', 'caged', 'metronome']);
  });

  it('lists CAGED third with path /caged', () => {
    expect(TOOLS[2].path).toBe('/caged');
  });

  it('has unique ids and paths, all known', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.path)).size).toBe(TOOLS.length);
    for (const t of TOOLS) expect((KNOWN_PATHS as readonly string[]).includes(t.path)).toBe(true);
  });
});
