import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../../functions/m';

interface Point {
  indexes?: string[];
  blobs?: string[];
  doubles?: number[];
}

const event = {
  r: 'e',
  type: 'first-interaction',
  tool: 'triads',
  device: 'phone',
  lang: 'pt-BR',
  strings: 6,
  tuning: 'AF-1',
  hand: 'right',
  secs: 9
};
const report = {
  r: 'r',
  kind: 'drawing',
  tool: 'triads',
  device: 'desktop',
  lang: 'en',
  strings: 6,
  tuning: 'custom',
  hand: 'left',
  frets: 22,
  ver: '0.1.0',
  view: { q: 'maj', rt: 'c' },
  name: 'TypeError',
  msg: 'boom'
};

function setup(write?: (p: Point) => void) {
  const points: Point[] = [];
  const env = {
    MEASURE: {
      writeDataPoint: (p: Point) => {
        write?.(p);
        points.push(p);
      }
    }
  };
  return { points, env };
}

const post = (body: string) => new Request('https://x.test/m', { method: 'POST', body });
const batch = (...items: unknown[]) => post(JSON.stringify({ v: 1, items }));

function expectPlain(res: Response) {
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(res.headers.has('Set-Cookie')).toBe(false);
}

describe('POST /m', () => {
  it.each(['GET', 'PUT', 'DELETE', 'OPTIONS'])('%s → 405 with Allow: POST', async (method) => {
    const { env, points } = setup();
    const res = await onRequest({ request: new Request('https://x.test/m', { method }), env });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expectPlain(res);
    expect(points).toHaveLength(0);
  });

  it('writes n points for n valid items, always 204', async () => {
    const { env, points } = setup();
    const res = await onRequest({ request: batch(event, report), env });
    expect(res.status).toBe(204);
    expectPlain(res);
    expect(points).toHaveLength(2);
  });

  it('writes only valid items from a mixed batch', async () => {
    const { env, points } = setup();
    await onRequest({ request: batch(event, { ...event, tool: 'nope' }), env });
    expect(points).toHaveLength(1);
  });

  it('strips extra keys such as ip', async () => {
    const { env, points } = setup();
    await onRequest({ request: batch({ ...event, ip: '1.2.3.4' }), env });
    expect(points).toHaveLength(1);
    expect(JSON.stringify(points[0])).not.toContain('1.2.3.4');
  });

  it('uses the contract slot layout for an event', async () => {
    const { env, points } = setup();
    await onRequest({ request: batch(event), env });
    expect(points[0]).toEqual({
      indexes: ['first-interaction'],
      blobs: [
        'event',
        'first-interaction',
        'triads',
        'phone',
        'pt-BR',
        'AF-1',
        'right',
        '',
        '',
        '',
        ''
      ],
      doubles: [6, 0, 9, 0]
    });
  });

  it('uses the contract slot layout for a report, view keys sorted', async () => {
    const { env, points } = setup();
    await onRequest({ request: batch(report), env });
    expect(points[0]).toEqual({
      indexes: ['drawing'],
      blobs: [
        'report',
        'drawing',
        'triads',
        'desktop',
        'en',
        'custom',
        'left',
        '0.1.0',
        'TypeError',
        'boom',
        '{"q":"maj","rt":"c"}'
      ],
      doubles: [6, 0, -1, 22]
    });
  });

  it('writes the key slot for missing-text and start flag for tool-opened', async () => {
    const { env, points } = setup();
    const { name, msg, view, ...rest } = report;
    expect([name, msg, view]).toHaveLength(3);
    await onRequest({
      request: batch(
        { ...rest, kind: 'missing-text', key: 'about_title' },
        { ...event, type: 'tool-opened', secs: undefined, start: true }
      ),
      env
    });
    expect(points[0]?.blobs?.[8]).toBe('');
    expect(points[0]?.blobs?.[9]).toBe('about_title');
    expect(points[0]?.blobs?.[10]).toBe('');
    expect(points[1]?.doubles).toEqual([6, 1, -1, 0]);
  });

  it('writes nothing for a 16 385-byte body', async () => {
    const { env, points } = setup();
    const body = JSON.stringify({ v: 1, items: [event] }).padEnd(16_385, ' ');
    expect(body.length).toBe(16_385);
    const res = await onRequest({ request: post(body), env });
    expect(res.status).toBe(204);
    expect(points).toHaveLength(0);
  });

  it('writes nothing for invalid JSON, wrong version or bad batch size', async () => {
    const { env, points } = setup();
    for (const body of [
      '{nope',
      JSON.stringify({ v: 2, items: [event] }),
      JSON.stringify({ v: 1, items: [] }),
      JSON.stringify({ v: 1, items: Array(11).fill(event) })
    ]) {
      expect((await onRequest({ request: post(body), env })).status).toBe(204);
    }
    expect(points).toHaveLength(0);
  });

  it('answers 204 when the binding is undefined', async () => {
    const res = await onRequest({ request: batch(event), env: {} });
    expect(res.status).toBe(204);
    expectPlain(res);
  });

  it('still attempts item 2 when item 1 throws', async () => {
    let calls = 0;
    const { env, points } = setup(() => {
      if (calls++ === 0) throw new Error('write failed');
    });
    const res = await onRequest({ request: batch(event, report), env });
    expect(res.status).toBe(204);
    expect(calls).toBe(2);
    expect(points).toHaveLength(1);
  });

  it('never calls console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    const { env } = setup(() => {
      throw new Error('x');
    });
    await onRequest({ request: batch(event), env });
    await onRequest({ request: post('{nope'), env });
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
