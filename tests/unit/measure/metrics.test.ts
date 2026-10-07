import { describe, expect, it } from 'vitest';

/** Rows as Analytics Engine stores them (contract §4), reduced to what the queries read. */
interface Row {
  blob1: 'event' | 'report';
  blob2: string;
  blob4: string;
  double2: number;
  double3: number;
  w: number; // _sample_interval
}

const ev = (type: string, device: string, extra: Partial<Row> = {}, w = 1): Row => ({
  blob1: 'event',
  blob2: type,
  blob4: device,
  double2: 0,
  double3: -1,
  w,
  ...extra
});
const start = (device: string, w = 1) => ev('tool-opened', device, { double2: 1 }, w);
const first = (device: string, secs: number, w = 1) =>
  ev('first-interaction', device, { double3: secs }, w);

// Mirrors of the documented SQL (contracts/measurement-wire.md §6).
const sum = (rows: Row[], f: (r: Row) => boolean) => rows.reduce((a, r) => a + (f(r) ? r.w : 0), 0);
const sessions = (rows: Row[]) =>
  sum(rows, (r) => r.blob1 === 'event' && r.blob2 === 'tool-opened' && r.double2 === 1);

function weightedMedian(rows: Row[]): number {
  const xs = rows
    .filter((r) => r.blob2 === 'first-interaction' && r.double3 >= 0)
    .map((r) => ({ v: r.double3, w: r.w }))
    .sort((a, b) => a.v - b.v);
  const total = xs.reduce((a, x) => a + x.w, 0);
  let acc = 0;
  for (const x of xs) {
    acc += x.w;
    if (acc >= total * 0.5) return x.v;
  }
  return NaN;
}
const m6 = (rows: Row[]) =>
  sum(rows, (r) => r.blob1 === 'event' && r.blob2 === 'sound-played') / sessions(rows);
function m7(rows: Row[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of new Set(rows.map((r) => r.blob4))) {
    const of = rows.filter((r) => r.blob4 === d);
    out[d] = sum(of, (r) => r.blob2 === 'first-interaction') / sessions(of);
  }
  return out;
}

const rows: Row[] = [
  // phone: 4 sessions, 3 interact (secs 4, 10, 30), 2 sound
  start('phone'),
  start('phone'),
  start('phone'),
  start('phone'),
  first('phone', 4),
  first('phone', 10),
  first('phone', 30),
  ev('sound-played', 'phone'),
  ev('sound-played', 'phone'),
  // desktop: 5 weighted sessions, 4 weighted interactions (secs 2, 6, 8 x2), 3 sound
  start('desktop'),
  start('desktop'),
  start('desktop'),
  start('desktop', 2),
  first('desktop', 2),
  first('desktop', 6),
  first('desktop', 8, 2),
  ev('sound-played', 'desktop'),
  ev('sound-played', 'desktop'),
  ev('sound-played', 'desktop'),
  // noise: reports and non-start tool-opened must not count as sessions
  { blob1: 'report', blob2: 'drawing', blob4: 'desktop', double2: 0, double3: -1, w: 1 },
  ev('tool-opened', 'desktop')
];

describe('measurement queries (SC-005)', () => {
  it('counts sessions by weighted tool-opened with start', () => {
    expect(sessions(rows)).toBe(9);
  });

  it('M-5 median seconds to first interaction', () => {
    // sorted weighted: 2,4,6,8,8,10,30 (7 total) → half = 3.5; cumulative 1,2,3,5 at 2,4,6,8 → 8
    expect(weightedMedian(rows)).toBe(8);
  });

  it('M-6 sound sessions ÷ sessions', () => {
    expect(m6(rows)).toBeCloseTo(5 / 9, 10);
  });

  it('M-7 per-device share and phone-vs-desktop gap', () => {
    const s = m7(rows);
    expect(s.phone).toBeCloseTo(3 / 4, 10);
    expect(s.desktop).toBeCloseTo(4 / 5, 10);
    expect(Math.abs((s.desktop ?? NaN) - (s.phone ?? NaN)) * 100).toBeCloseTo(5, 10);
  });

  it('needs no user-level key: rows carry only counts, device and seconds', () => {
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'blob1',
      'blob2',
      'blob4',
      'double2',
      'double3',
      'w'
    ]);
  });
});
