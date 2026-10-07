/** Batching queue with caps and de-duplication (specs/028 data-model §8). Pure over `QueueDeps`. */
import { reportKey } from './sanitize';
import { MAX_BATCH, MAX_BODY_BYTES, type FailureReport, type WireItem } from './wire';

const FLUSH_AFTER_MS = 5000;
const MAX_EVENTS = 50;
const MAX_REPORTS = 10;

export interface QueueDeps {
  /** Never throws (the transport swallows). */
  send(body: string): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function createQueue(deps: QueueDeps): { push(item: WireItem): void; flush(): void } {
  let pending: WireItem[] = [];
  let timer: unknown = null;
  let eventsAccepted = 0;
  let reportsAccepted = 0;
  const reportKeys = new Set<string>();

  /** Split a batch in half until each body fits the server limit. */
  function sendItems(items: WireItem[]): void {
    const body = JSON.stringify({ v: 1, items });
    if (bytes(body) > MAX_BODY_BYTES && items.length > 1) {
      const mid = Math.ceil(items.length / 2);
      sendItems(items.slice(0, mid));
      sendItems(items.slice(mid));
      return;
    }
    deps.send(body);
  }

  function flush(): void {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    if (pending.length === 0) return;
    const items = pending;
    pending = [];
    sendItems(items);
  }

  function push(item: WireItem): void {
    if (item.r === 'r') {
      const key = reportKey(item as FailureReport);
      if (reportKeys.has(key) || reportsAccepted >= MAX_REPORTS) return;
      reportKeys.add(key);
      reportsAccepted++;
    } else {
      if (eventsAccepted >= MAX_EVENTS) return;
      eventsAccepted++;
    }
    pending.push(item);
    if (pending.length >= MAX_BATCH) {
      flush();
    } else if (timer === null) {
      timer = deps.setTimer(() => {
        timer = null;
        flush();
      }, FLUSH_AFTER_MS);
    }
  }

  return { push, flush };
}
