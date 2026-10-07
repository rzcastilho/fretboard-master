/**
 * POST /m — anonymous measurement intake (specs/028 contracts/measurement-wire.md).
 * Validates a batch against the shared allowlist and writes one Analytics Engine data point per
 * valid item. Reads only the body; never `request.cf`, IP or other headers beyond content-length.
 */
import { MAX_BODY_BYTES, parseItems, type WireItem } from '../src/lib/measure/wire';

interface DataPoint {
  indexes?: string[];
  blobs?: string[];
  doubles?: number[];
}

interface MeasureEnv {
  MEASURE?: { writeDataPoint(p: DataPoint): void };
}

const HEADERS = { 'Cache-Control': 'no-store' };

function toDataPoint(item: WireItem): DataPoint {
  if (item.r === 'e') {
    return {
      indexes: [item.type],
      blobs: [
        'event',
        item.type,
        item.tool,
        item.device,
        item.lang,
        item.tuning,
        item.hand,
        '',
        '',
        '',
        ''
      ],
      doubles: [item.strings, item.start ? 1 : 0, item.secs ?? -1, 0]
    };
  }
  const view = item.view
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(item.view).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        )
      )
    : '';
  return {
    indexes: [item.kind],
    blobs: [
      'report',
      item.kind,
      item.tool,
      item.device,
      item.lang,
      item.tuning,
      item.hand,
      item.ver,
      item.name ?? '',
      item.msg ?? item.key ?? '',
      view
    ],
    doubles: [item.strings, 0, -1, item.frets]
  };
}

export const onRequest = async (context: {
  request: Request;
  env: MeasureEnv;
}): Promise<Response> => {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...HEADERS, Allow: 'POST' } });
  }
  try {
    const declared = Number(request.headers.get('content-length'));
    if (declared > MAX_BODY_BYTES) return new Response(null, { status: 204, headers: HEADERS });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return new Response(null, { status: 204, headers: HEADERS });
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: nothing to record, and the client never reads the response.
      return new Response(null, { status: 204, headers: HEADERS });
    }
    const binding = env?.MEASURE;
    if (binding) {
      for (const item of parseItems(body)) {
        try {
          binding.writeDataPoint(toDataPoint(item));
        } catch {
          // One failed write must not stop the rest of the batch; measurement is best effort.
        }
      }
    }
  } catch {
    // Body unreadable: measurement is best effort and the response is always 204.
  }
  return new Response(null, { status: 204, headers: HEADERS });
};
