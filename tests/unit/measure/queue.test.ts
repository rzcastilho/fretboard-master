import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueue, type QueueDeps } from '../../../src/lib/measure/queue';
import type { FailureReport, UsageEvent } from '../../../src/lib/measure/wire';

const ev = (i = 0): UsageEvent =>
  ({
    r: 'e',
    type: 'link-shared',
    tool: 'notes',
    device: 'desktop',
    lang: 'en',
    strings: 6,
    tuning: 'AF-1',
    hand: 'right',
    ...(i ? {} : {})
  }) as UsageEvent;

const rep = (msg: string): FailureReport =>
  ({
    r: 'r',
    kind: 'calculation',
    tool: 'notes',
    device: 'desktop',
    lang: 'en',
    strings: 6,
    tuning: 'AF-1',
    hand: 'right',
    frets: 22,
    ver: '0.1.0',
    name: 'Error',
    msg
  }) as FailureReport;

function setup() {
  const sent: string[] = [];
  const deps: QueueDeps = {
    send: (b) => void sent.push(b),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
  };
  return { sent, queue: createQueue(deps) };
}
const itemsOf = (body: string) => (JSON.parse(body) as { items: unknown[] }).items;

describe('queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes at 10 items', () => {
    const { sent, queue } = setup();
    for (let i = 0; i < 9; i++) queue.push(ev());
    expect(sent).toHaveLength(0);
    queue.push(ev());
    expect(sent).toHaveLength(1);
    expect(itemsOf(sent[0])).toHaveLength(10);
  });

  it('flushes 5000 ms after the first queued item', () => {
    const { sent, queue } = setup();
    queue.push(ev());
    vi.advanceTimersByTime(4999);
    expect(sent).toHaveLength(0);
    queue.push(ev());
    vi.advanceTimersByTime(1);
    expect(sent).toHaveLength(1);
    expect(itemsOf(sent[0])).toHaveLength(2);
  });

  it('manual flush sends and empties; flushing empty is a no-op', () => {
    const { sent, queue } = setup();
    queue.flush();
    expect(sent).toHaveLength(0);
    queue.push(ev());
    queue.flush();
    expect(sent).toHaveLength(1);
    queue.flush();
    vi.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(1);
  });

  it('re-arms the timer for the next batch after a flush', () => {
    const { sent, queue } = setup();
    queue.push(ev());
    queue.flush();
    queue.push(ev());
    vi.advanceTimersByTime(5000);
    expect(sent).toHaveLength(2);
  });

  it('drops the 51st usage event', () => {
    const { sent, queue } = setup();
    for (let i = 0; i < 51; i++) queue.push(ev());
    queue.flush();
    const total = sent.reduce((n, b) => n + itemsOf(b).length, 0);
    expect(total).toBe(50);
  });

  it('drops the 11th report', () => {
    const { sent, queue } = setup();
    for (let i = 0; i < 11; i++) queue.push(rep(`m${i}`));
    queue.flush();
    const total = sent.reduce((n, b) => n + itemsOf(b).length, 0);
    expect(total).toBe(10);
  });

  it('drops a duplicate report and counts nothing for it', () => {
    const { sent, queue } = setup();
    queue.push(rep('same'));
    queue.push(rep('same'));
    for (let i = 0; i < 9; i++) queue.push(rep(`other${i}`));
    queue.flush();
    const total = sent.reduce((n, b) => n + itemsOf(b).length, 0);
    expect(total).toBe(10); // 1 + 9 distinct; the duplicate did not use a slot
  });

  it('never resets caps or de-dup after a flush', () => {
    const { sent, queue } = setup();
    queue.push(rep('a'));
    queue.flush();
    queue.push(rep('a'));
    queue.flush();
    expect(sent).toHaveLength(1);
    for (let i = 0; i < 50; i++) queue.push(ev());
    queue.flush();
    queue.push(ev());
    queue.flush();
    const total = sent.reduce((n, b) => n + itemsOf(b).length, 0);
    expect(total).toBe(51); // 1 report + 50 events
  });

  it('serializes {"v":1,"items":[…]} within 16 KB', () => {
    const { sent, queue } = setup();
    for (let i = 0; i < 10; i++) queue.push(rep('x'.repeat(200) + i));
    expect(sent).toHaveLength(1);
    expect(sent[0].startsWith('{"v":1,"items":[')).toBe(true);
    expect(new TextEncoder().encode(sent[0]).length).toBeLessThanOrEqual(16_384);
  });
});
