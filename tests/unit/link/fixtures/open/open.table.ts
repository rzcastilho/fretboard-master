/**
 * Receive-layer fixtures (specs/023 T007). Append-only, like `../v1` (Constitution IX): a link
 * released today must open the same way in every later build. Kept beside `v1` rather than in it
 * because the 022 fixture test treats every file in `v1` as a fully valid, fallback-free link.
 */
import type { LinkInstrument } from '$lib/link';

export interface OpenFixture {
  readonly name: string;
  /** Path and query of the opened address. */
  readonly url: string;
  /** The stored instrument at open time. */
  readonly stored: LinkInstrument;
  readonly expect: {
    readonly kind: 'none' | 'unknown-tool' | 'tool';
    readonly instrument?: LinkInstrument;
    /** Keys that must be reported (others may be too). */
    readonly fellBack?: readonly string[];
    readonly forcedNotice?: boolean;
    readonly rootPc?: number;
  };
}

const AF1 = { kind: 'preset', id: 'AF-1' } as const;
const AF4 = { kind: 'preset', id: 'AF-4' } as const;

const STORED: LinkInstrument = { stringCount: 6, tuning: AF1, fretCount: 22 };

export const fixtures: readonly OpenFixture[] = [
  {
    name: 'stored-instrument-defaults',
    url: '/triads?v=1&rt=2',
    stored: { stringCount: 6, tuning: AF4, fretCount: 19 },
    expect: {
      kind: 'tool',
      instrument: { stringCount: 6, tuning: AF4, fretCount: 19 },
      fellBack: ['sc', 'tu', 'fr'],
      forcedNotice: false,
      rootPc: 2
    }
  },
  {
    name: 'paired-sc-tu-fallback',
    url: '/caged?v=1&rt=2&sc=6&tu=AF-21&fr=20',
    stored: STORED,
    expect: {
      kind: 'tool',
      instrument: { stringCount: 6, tuning: AF1, fretCount: 20 },
      fellBack: ['sc', 'tu'],
      forcedNotice: false,
      rootPc: 2
    }
  },
  {
    name: 'version-greater-than-1',
    url: '/caged?v=9&rt=2&sc=6&tu=AF-4&fr=20',
    stored: STORED,
    expect: { kind: 'tool', forcedNotice: true, rootPc: 2 }
  },
  {
    name: 'missing-version',
    url: '/caged?rt=2&sc=6&tu=AF-4&fr=20',
    stored: STORED,
    expect: { kind: 'tool', forcedNotice: true, rootPc: 2 }
  },
  {
    name: 'unknown-tool',
    url: '/scales?v=1&rt=0',
    stored: STORED,
    expect: { kind: 'unknown-tool' }
  },
  {
    name: 'unknown-extra-params',
    url: '/triads?v=1&rt=2&zz=1&utm_source=mail&sc=6&tu=AF-4&fr=20',
    stored: STORED,
    expect: { kind: 'tool', instrument: { stringCount: 6, tuning: AF4, fretCount: 20 }, rootPc: 2 }
  },
  {
    name: 'duplicate-params-first-wins',
    url: '/triads?v=1&rt=2&rt=5&sc=6&tu=AF-4&fr=20',
    stored: STORED,
    expect: { kind: 'tool', forcedNotice: false, rootPc: 2 }
  },
  { name: 'bare-tool-path', url: '/caged', stored: STORED, expect: { kind: 'none' } }
];
