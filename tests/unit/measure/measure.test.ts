// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  measure,
  resetMeasureForTests,
  useMeasureForTests
} from '../../../src/lib/measure/measure.svelte';
import { parseItems, type UsageEvent } from '../../../src/lib/measure/wire';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';

const ALLOWED = [
  'r',
  'type',
  'tool',
  'device',
  'lang',
  'strings',
  'tuning',
  'hand',
  'start',
  'secs'
];
const ID_LIKE = ['id', 'uuid', 'token', 'session', 'visitor', 'cookie'];

let bodies: string[];
let nowMs: number;

function begin(extra: Parameters<typeof useMeasureForTests>[0] = {}): void {
  bodies = [];
  nowMs = 0;
  useMeasureForTests({
    endpoint: '/m',
    send: (b) => void bodies.push(b),
    device: 'desktop',
    now: () => nowMs,
    hidden: false,
    ...extra
  });
  measure.start();
}

/** Every item sent so far, in order. */
const sent = (): UsageEvent[] =>
  bodies.flatMap((b) => [...parseItems(JSON.parse(b))] as UsageEvent[]);

const flushAll = (): void => void vi.advanceTimersByTime(5000);

beforeEach(() => {
  vi.useFakeTimers();
  resetInstrumentForTests();
});
afterEach(() => {
  resetMeasureForTests();
  vi.useRealTimers();
});

describe('toolOpened', () => {
  it('sends once per tool per load, start: true only on the first', () => {
    begin();
    measure.toolOpened('triads');
    measure.toolOpened('triads');
    measure.toolOpened('notes');
    flushAll();
    expect(sent().map((i) => [i.type, i.tool, i.start])).toEqual([
      ['tool-opened', 'triads', true],
      ['tool-opened', 'notes', undefined]
    ]);
  });
});

describe('firstInteraction', () => {
  it('sends once with whole seconds', () => {
    begin();
    measure.toolOpened('notes');
    nowMs = 4_900;
    measure.firstInteraction();
    measure.firstInteraction();
    flushAll();
    const firsts = sent().filter((i) => i.type === 'first-interaction');
    expect(firsts).toHaveLength(1);
    expect(firsts[0].secs).toBe(4);
  });

  it('caps secs at 3600', () => {
    begin();
    measure.toolOpened('notes');
    nowMs = 9_000_000;
    measure.firstInteraction();
    flushAll();
    expect(sent().find((i) => i.type === 'first-interaction')?.secs).toBe(3600);
  });

  it('omits secs when the page was hidden at start', () => {
    begin({ hidden: true });
    measure.toolOpened('notes');
    nowMs = 5_000;
    measure.firstInteraction();
    flushAll();
    const first = sent().find((i) => i.type === 'first-interaction');
    expect(first).toBeDefined();
    expect(first?.secs).toBeUndefined();
  });

  it('omits secs when the page was hidden earlier', () => {
    begin();
    measure.toolOpened('notes');
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    state.mockRestore();
    nowMs = 5_000;
    measure.firstInteraction();
    flushAll();
    const first = sent().find((i) => i.type === 'first-interaction');
    expect(first).toBeDefined();
    expect(first?.secs).toBeUndefined();
  });
});

describe('soundPlayed, linkShared, linkOpened', () => {
  it('soundPlayed sends once, tagged with the last opened tool', () => {
    begin();
    measure.toolOpened('triads');
    measure.toolOpened('caged');
    measure.soundPlayed();
    measure.soundPlayed();
    flushAll();
    expect(
      sent()
        .filter((i) => i.type === 'sound-played')
        .map((s) => s.tool)
    ).toEqual(['caged']);
  });

  it('linkShared carries only the tool and is not once-only', () => {
    begin();
    measure.linkShared('notes');
    measure.linkShared('notes');
    flushAll();
    const shared = sent().filter((i) => i.type === 'link-shared');
    expect(shared).toHaveLength(2);
    expect(Object.keys(shared[0]).sort()).toEqual(
      ['device', 'hand', 'lang', 'r', 'strings', 'tool', 'tuning', 'type'].sort()
    );
  });

  it('linkOpened called before start() is sent once start() has run', () => {
    bodies = [];
    useMeasureForTests({ endpoint: '/m', send: (b) => void bodies.push(b), device: 'desktop' });
    measure.linkOpened('triads');
    expect(bodies).toEqual([]);
    measure.start();
    flushAll();
    expect(sent().filter((i) => i.type === 'link-opened')).toHaveLength(1);
  });

  it('linkOpened sends once', () => {
    begin();
    measure.linkOpened('triads');
    measure.linkOpened('triads');
    flushAll();
    expect(sent().filter((i) => i.type === 'link-opened')).toHaveLength(1);
  });
});

describe('instrumentEdited', () => {
  function change(id: 'AF-4' | 'AF-1'): void {
    instrument.open();
    instrument.selectTuning(id);
    instrument.confirm('notes');
  }

  it('five edits within 1 s send one event with the final traits', () => {
    begin();
    measure.toolOpened('notes');
    for (let i = 0; i < 4; i++) {
      change('AF-4');
      vi.advanceTimersByTime(200);
    }
    change('AF-4');
    vi.advanceTimersByTime(1000);
    flushAll();
    const changed = sent().filter((i) => i.type === 'instrument-changed');
    expect(changed).toHaveLength(1);
    expect(changed[0].tuning).toBe('AF-4');
  });

  it('sends nothing when traits return to the baseline within the quiet period', () => {
    begin();
    measure.toolOpened('notes');
    change('AF-4');
    vi.advanceTimersByTime(300);
    change('AF-1');
    vi.advanceTimersByTime(2000);
    flushAll();
    expect(sent().filter((i) => i.type === 'instrument-changed')).toHaveLength(0);
  });

  it('sends nothing when the traits did not change (custom notes stay custom)', () => {
    begin();
    measure.toolOpened('notes');
    measure.instrumentEdited();
    vi.advanceTimersByTime(1000);
    flushAll();
    expect(sent().filter((i) => i.type === 'instrument-changed')).toHaveLength(0);
  });
});

describe('payload privacy', () => {
  it('every sent item parses and carries only allowlisted keys', () => {
    begin();
    measure.toolOpened('triads');
    measure.firstInteraction();
    measure.soundPlayed();
    measure.linkShared('triads');
    measure.linkOpened('triads');
    flushAll();
    const raw = bodies.flatMap((b) => (JSON.parse(b) as { items: object[] }).items);
    expect(raw).toHaveLength(5);
    expect(sent()).toHaveLength(5);
    for (const item of raw) {
      for (const key of Object.keys(item)) {
        expect(ALLOWED).toContain(key);
        expect(ID_LIKE).not.toContain(key.toLowerCase());
      }
    }
  });

  it('two simulated loads send identical payloads: nothing carries over', () => {
    begin();
    measure.toolOpened('triads');
    flushAll();
    const first = bodies.join('');
    resetMeasureForTests();
    begin();
    measure.toolOpened('triads');
    flushAll();
    expect(bodies.join('')).toBe(first);
  });
});

describe('inert', () => {
  it('does nothing with an empty endpoint', () => {
    begin({ endpoint: '' });
    measure.toolOpened('notes');
    measure.firstInteraction();
    flushAll();
    expect(bodies).toEqual([]);
  });
});

describe('never gets in the way (US2)', () => {
  it('registers no listeners and sends nothing with an empty endpoint', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const addWin = vi.spyOn(window, 'addEventListener');
    const timers = vi.getTimerCount();
    begin({ endpoint: '' });
    measure.toolOpened('notes');
    expect(add).not.toHaveBeenCalled();
    expect(addWin).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(timers);
    add.mockRestore();
    addWin.mockRestore();
  });

  it('is inert when tracking is refused (DNT/GPC)', () => {
    const add = vi.spyOn(document, 'addEventListener');
    begin({ refused: true });
    measure.toolOpened('triads');
    measure.firstInteraction();
    measure.soundPlayed();
    measure.linkShared('triads');
    measure.instrumentEdited();
    flushAll();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    expect(bodies).toEqual([]);
    expect(add).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    add.mockRestore();
  });

  it('never throws even when send, timers and performance throw', () => {
    const boom = (): never => {
      throw new Error('boom');
    };
    begin({ send: boom, setTimer: boom, clearTimer: boom, now: boom });
    expect(() => {
      measure.toolOpened('triads');
      measure.firstInteraction();
      measure.soundPlayed();
      measure.linkShared('triads');
      measure.linkOpened('triads');
      measure.instrumentEdited();
      measure.instrumentEdited();
      measure.report({ kind: 'calculation', tool: null, error: new Error('x') });
      measure.missingText('some_key');
    }).not.toThrow();
  });

  it('flushes when the page becomes hidden', () => {
    begin();
    measure.toolOpened('triads');
    expect(bodies).toEqual([]);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(bodies).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('flushes on pagehide', () => {
    begin();
    measure.toolOpened('triads');
    window.dispatchEvent(new Event('pagehide'));
    expect(bodies).toHaveLength(1);
  });

  it('a bfcache restore re-sends no once-per-load event', () => {
    begin();
    measure.toolOpened('triads');
    measure.soundPlayed();
    window.dispatchEvent(new Event('pagehide'));
    const before = sent().length;
    const restore = new Event('pageshow') as Event & { persisted: boolean };
    Object.defineProperty(restore, 'persisted', { value: true });
    window.dispatchEvent(restore);
    measure.toolOpened('triads');
    measure.soundPlayed();
    flushAll();
    expect(sent()).toHaveLength(before);
  });
});
