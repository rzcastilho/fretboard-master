import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeLink, encodeLink } from '../../../src/lib/link';
import { AF_8 } from '../../../src/lib/instrument/fixtures';
import { tuningFromOffsets } from '../../../src/lib/instrument/tunings';
import { preferences } from '../../../src/lib/state/preferences.svelte';
import {
  currentLink,
  currentSnapshot,
  resetShareForTests,
  share,
  useShareClockForTests,
  useSharePlatformForTests,
  type SharePlatform
} from '../../../src/lib/state/share.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { triads } from '../../../src/lib/state/triads.svelte';

/** A clock whose timers run only when the test advances it. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    clock: {
      setTimer: (fn: () => void, ms: number) => {
        const id = nextId++;
        pending.set(id, { at: now + ms, fn });
        return id;
      },
      clearTimer: (id: unknown) => {
        pending.delete(id as number);
      }
    },
    advance(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(id);
          t.fn();
        }
      }
    },
    get pendingCount() {
      return pending.size;
    }
  };
}

type Deferred = { promise: Promise<void>; resolve: () => void };
function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const abortError = () => Object.assign(new Error('dismissed'), { name: 'AbortError' });

function platform(patch: {
  share?: SharePlatform['share'];
  writeText?: SharePlatform['writeText'];
  coarsePointer?: boolean;
}): SharePlatform {
  return {
    share: patch.share ?? null,
    writeText: patch.writeText ?? null,
    coarsePointer: patch.coarsePointer ?? false
  };
}

let fake: ReturnType<typeof fakeClock>;

beforeEach(() => {
  resetInstrumentForTests();
  resetCagedForTests();
  resetNotesForTests();
  resetShareForTests();
  fake = fakeClock();
  useShareClockForTests(fake.clock);
});

afterEach(() => {
  resetShareForTests();
  vi.restoreAllMocks();
});

describe('share cascade (link-api §2)', () => {
  it('coarse pointer + share resolves: sheet receives { url, title }, nothing shown', async () => {
    const sheet = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    useSharePlatformForTests(platform({ share: sheet, writeText, coarsePointer: true }));
    await share.share('caged', 'A minor — CAGED, E shape');
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(sheet).toHaveBeenCalledWith({
      url: currentLink('caged'),
      title: 'A minor — CAGED, E shape'
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(share.notice).toBeNull();
    expect(share.fallback).toBeNull();
  });

  it('AbortError: nothing shown and writeText is not called', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    useSharePlatformForTests(
      platform({ share: vi.fn().mockRejectedValue(abortError()), writeText, coarsePointer: true })
    );
    await share.share('notes', 'Notes');
    expect(writeText).not.toHaveBeenCalled();
    expect(share.notice).toBeNull();
    expect(share.fallback).toBeNull();
  });

  it('other share error + clipboard ok → copied notice', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    useSharePlatformForTests(
      platform({
        share: vi.fn().mockRejectedValue(new Error('boom')),
        writeText,
        coarsePointer: true
      })
    );
    await share.share('triads', 'Triads');
    expect(writeText).toHaveBeenCalledWith(currentLink('triads'));
    expect(share.notice).not.toBeNull();
    expect(share.fallback).toBeNull();
  });

  it('other share error + clipboard rejects → fallback', async () => {
    useSharePlatformForTests(
      platform({
        share: vi.fn().mockRejectedValue(new Error('boom')),
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
        coarsePointer: true
      })
    );
    await share.share('triads', 'Triads');
    expect(share.notice).toBeNull();
    expect(share.fallback).toEqual({ href: currentLink('triads') });
  });

  it('fine pointer never calls share; copies and shows the notice', async () => {
    const sheet = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    useSharePlatformForTests(platform({ share: sheet, writeText, coarsePointer: false }));
    await share.share('caged', 'x');
    expect(sheet).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(currentLink('caged'));
    expect(share.notice).not.toBeNull();
  });

  it('no share API (coarse or not) → copy and notice', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    useSharePlatformForTests(platform({ share: null, writeText, coarsePointer: true }));
    await share.share('notes', 'x');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(share.notice).not.toBeNull();
  });

  it('no clipboard → fallback, never a notice', async () => {
    useSharePlatformForTests(platform({ share: null, writeText: null }));
    await share.share('notes', 'x');
    expect(share.notice).toBeNull();
    expect(share.fallback).toEqual({ href: currentLink('notes') });
  });

  it('clipboard rejects → fallback, never a notice', async () => {
    useSharePlatformForTests(
      platform({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    );
    await share.share('notes', 'x');
    expect(share.notice).toBeNull();
    expect(share.fallback).not.toBeNull();
  });

  it('a throwing platform never rejects', async () => {
    useSharePlatformForTests(
      platform({
        share: () => {
          throw new Error('sync throw');
        },
        writeText: () => {
          throw new Error('sync throw');
        },
        coarsePointer: true
      })
    );
    await expect(share.share('notes', 'x')).resolves.toBeUndefined();
    expect(share.fallback).not.toBeNull();
    expect(share.busy).toBe(false);
  });
});

describe('busy and re-entry', () => {
  it('a second share() while busy is ignored', async () => {
    const gate = deferred();
    const sheet = vi.fn().mockReturnValue(gate.promise);
    useSharePlatformForTests(platform({ share: sheet, coarsePointer: true }));
    const first = share.share('notes', 'x');
    expect(share.busy).toBe(true);
    await share.share('notes', 'x');
    expect(sheet).toHaveBeenCalledTimes(1);
    gate.resolve();
    await first;
    expect(share.busy).toBe(false);
  });

  it('busy clears after a failure', async () => {
    useSharePlatformForTests(platform({ writeText: vi.fn().mockRejectedValue(new Error('x')) }));
    await share.share('notes', 'x');
    expect(share.busy).toBe(false);
  });
});

describe('notice lifetime', () => {
  beforeEach(() => {
    useSharePlatformForTests(platform({ writeText: vi.fn().mockResolvedValue(undefined) }));
  });

  it('a second successful copy bumps notice.id (one notice)', async () => {
    await share.share('notes', 'x');
    const first = share.notice?.id;
    await share.share('notes', 'x');
    expect(share.notice?.id).toBeGreaterThan(first as number);
    expect(fake.pendingCount).toBe(1);
  });

  it('clears after 4,000 ms on the injected clock', async () => {
    await share.share('notes', 'x');
    fake.advance(3999);
    expect(share.notice).not.toBeNull();
    fake.advance(1);
    expect(share.notice).toBeNull();
  });

  it('the second copy restarts the 4,000 ms window', async () => {
    await share.share('notes', 'x');
    fake.advance(3000);
    await share.share('notes', 'x');
    fake.advance(3000);
    expect(share.notice).not.toBeNull();
    fake.advance(1000);
    expect(share.notice).toBeNull();
  });

  it('dismissNotice() clears it and its timer', async () => {
    await share.share('notes', 'x');
    share.dismissNotice();
    expect(share.notice).toBeNull();
    expect(fake.pendingCount).toBe(0);
  });
});

describe('no network, no storage (FR-018, Principle II)', () => {
  it('share() and link generation make no network request and write nothing to storage', async () => {
    const fetchSpy = vi.fn();
    const beacon = vi.fn();
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const remember = vi.spyOn(preferences, 'remember');
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: beacon }));
    try {
      for (const tool of ['notes', 'triads', 'caged'] as const) currentLink(tool);
      useSharePlatformForTests(
        platform({
          share: vi.fn().mockResolvedValue(undefined),
          writeText: vi.fn().mockResolvedValue(undefined),
          coarsePointer: true
        })
      );
      await share.share('caged', 'x');
      useSharePlatformForTests(platform({ writeText: vi.fn().mockResolvedValue(undefined) }));
      await share.share('triads', 'x');
      useSharePlatformForTests(platform({ writeText: null }));
      await share.share('notes', 'x');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(beacon).not.toHaveBeenCalled();
      expect(xhrOpen).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(remember).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('current snapshot and link', () => {
  it.each(['notes', 'triads', 'caged'] as const)(
    'currentLink(%s) equals encodeLink(currentSnapshot, origin)',
    (tool) => {
      expect(currentLink(tool)).toBe(encodeLink(currentSnapshot(tool), location.origin));
      expect(currentLink(tool).startsWith(`${location.origin}/${tool}?v=1&`)).toBe(true);
    }
  );

  it('follows the live view', () => {
    const before = currentLink('triads');
    triads.setInversion('first');
    expect(currentLink('triads')).not.toBe(before);
    expect(currentLink('triads')).toContain('inv=first');
    triads.reset();
  });

  it('carries only the musical instrument', () => {
    instrument.setHandedness('left');
    const snap = currentSnapshot('notes');
    expect(Object.keys(snap.instrument).sort()).toEqual(['fretCount', 'stringCount', 'tuning']);
    expect(caged.temporary).toBe(false);
  });
});

describe('manual-copy fallback (link-api §2, US2)', () => {
  it('clipboard rejects → fallback.href set, no notice ever', async () => {
    useSharePlatformForTests(
      platform({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    );
    await share.share('caged', 'x');
    expect(share.fallback).toEqual({ href: currentLink('caged') });
    expect(share.notice).toBeNull();
  });

  it('writeText unavailable → fallback.href set, no notice', async () => {
    useSharePlatformForTests(platform({ writeText: null }));
    await share.share('triads', 'x');
    expect(share.fallback).toEqual({ href: currentLink('triads') });
    expect(share.notice).toBeNull();
  });

  it('opening the fallback clears a previous notice and its timer', async () => {
    useSharePlatformForTests(platform({ writeText: vi.fn().mockResolvedValue(undefined) }));
    await share.share('notes', 'x');
    expect(share.notice).not.toBeNull();
    useSharePlatformForTests(platform({ writeText: null }));
    await share.share('notes', 'x');
    expect(share.notice).toBeNull();
    expect(share.fallback).not.toBeNull();
    expect(fake.pendingCount).toBe(0);
  });

  it('a later successful copy closes the fallback (never both)', async () => {
    useSharePlatformForTests(platform({ writeText: null }));
    await share.share('notes', 'x');
    useSharePlatformForTests(platform({ writeText: vi.fn().mockResolvedValue(undefined) }));
    await share.share('notes', 'x');
    expect(share.fallback).toBeNull();
    expect(share.notice).not.toBeNull();
  });

  it('viewChanged closes only when the href differs', async () => {
    useSharePlatformForTests(platform({ writeText: null }));
    await share.share('triads', 'x');
    const href = currentLink('triads');
    share.viewChanged(href);
    expect(share.fallback).not.toBeNull();
    share.viewChanged(`${href}&x=1`);
    expect(share.fallback).toBeNull();
  });

  it('viewChanged is a no-op with no fallback open', () => {
    expect(() => share.viewChanged('https://x.example/notes?v=1')).not.toThrow();
    expect(share.fallback).toBeNull();
  });

  it('dismissFallback() closes without moving focus', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    try {
      share.registerOpener(button);
      useSharePlatformForTests(platform({ writeText: null }));
      await share.share('notes', 'x');
      share.dismissFallback();
      expect(share.fallback).toBeNull();
      expect(document.activeElement).not.toBe(button);
    } finally {
      button.remove();
    }
  });

  it('closeFallback() focuses the registered opener', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    try {
      share.registerOpener(button);
      useSharePlatformForTests(platform({ writeText: null }));
      await share.share('notes', 'x');
      share.closeFallback();
      expect(share.fallback).toBeNull();
      expect(document.activeElement).toBe(button);
    } finally {
      button.remove();
    }
  });
});

describe('link completeness and privacy (US3)', () => {
  it('a custom tuning with a different note on each string carries each pitch', () => {
    instrument.restore({
      ...instrument.active,
      tuning: tuningFromOffsets([1, -1, 2, -2, 3, -3])
    });
    // string 1 (highest) first: E4(64)-3, B3(59)+3, G3(55)-2, D3(50)+2, A2(45)-1, E2(40)+1
    expect(currentLink('notes')).toContain('&tu=c.61.62.53.52.44.41&');
    for (const tool of ['triads', 'caged'] as const) {
      expect(currentLink(tool)).toContain('&tu=c.61.62.53.52.44.41&');
    }
  });

  it('a default view on the default instrument still yields a valid link', () => {
    for (const tool of ['notes', 'triads', 'caged'] as const) {
      const result = decodeLink(new URL(currentLink(tool)));
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.snapshot.tool).toBe(tool);
        expect(result.fellBack).toEqual([]);
      }
    }
  });

  it('the CAGED temporary flag is tmp=1 in the link and never written to storage', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    try {
      resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
      expect(currentLink('caged')).toContain('&tmp=0&');
      caged.viewInStandard();
      expect(caged.temporary).toBe(true);
      expect(currentLink('caged')).toContain('&tmp=1&');
      expect(currentSnapshot('caged')).toMatchObject({ tool: 'caged', temporary: true });
      caged.selectRoot(7);
      expect(currentLink('caged')).toContain('&tmp=1&');
      expect(remember).not.toHaveBeenCalledWith(expect.objectContaining({ temporary: true }));
      for (const [, value] of setItem.mock.calls) {
        expect(String(value)).not.toMatch(/temporary|tmp/);
      }
    } finally {
      remember.mockRestore();
      setItem.mockRestore();
    }
  });
});
