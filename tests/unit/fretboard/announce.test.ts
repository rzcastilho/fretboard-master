import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOUNCE_DELAY_MS,
  createAnnouncer,
  type AnnouncerTimer
} from '../../../src/lib/fretboard/announce';

const timer: AnnouncerTimer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>)
};

function setup() {
  const emitted: string[] = [];
  const announcer = createAnnouncer({
    delayMs: ANNOUNCE_DELAY_MS,
    timer,
    emit: (t) => emitted.push(t)
  });
  return { announcer, emitted };
}

describe('createAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a 500 ms delay', () => {
    expect(ANNOUNCE_DELAY_MS).toBe(500);
  });

  it('is silent for the first update', () => {
    const { announcer, emitted } = setup();
    announcer.update('first');
    vi.advanceTimersByTime(5000);
    expect(emitted).toEqual([]);
  });

  it('emits once, exactly 500 ms after the last of several differing updates', () => {
    const { announcer, emitted } = setup();
    announcer.update('base');
    announcer.update('a');
    vi.advanceTimersByTime(200);
    announcer.update('b');
    vi.advanceTimersByTime(200);
    announcer.update('c');
    vi.advanceTimersByTime(499);
    expect(emitted).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(emitted).toEqual(['c']);
    vi.advanceTimersByTime(5000);
    expect(emitted).toEqual(['c']);
  });

  it('does nothing when the same text is sent again', () => {
    const { announcer, emitted } = setup();
    announcer.update('base');
    announcer.update('a');
    vi.advanceTimersByTime(300);
    announcer.update('a');
    vi.advanceTimersByTime(199);
    expect(emitted).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(emitted).toEqual(['a']);
  });

  it('does not emit when the settled text equals the last announced text', () => {
    const { announcer, emitted } = setup();
    announcer.update('base');
    announcer.update('a');
    vi.advanceTimersByTime(500);
    expect(emitted).toEqual(['a']);
    announcer.update('b');
    vi.advanceTimersByTime(100);
    announcer.update('a');
    vi.advanceTimersByTime(1000);
    expect(emitted).toEqual(['a']);
  });

  it('dispose cancels a pending emit', () => {
    const { announcer, emitted } = setup();
    announcer.update('base');
    announcer.update('a');
    announcer.dispose();
    vi.advanceTimersByTime(5000);
    expect(emitted).toEqual([]);
  });
});
