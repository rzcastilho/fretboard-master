// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTransport, trackingRefused } from '../../../src/lib/measure/transport';

type NavLike = Record<string, unknown>;

function setNav(props: NavLike): void {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  }
}

afterEach(() => {
  for (const key of ['sendBeacon', 'globalPrivacyControl', 'doNotTrack']) {
    // Remove the per-test own property so jsdom defaults apply again.
    Reflect.deleteProperty(navigator, key);
  }
  vi.unstubAllGlobals();
});

describe('createTransport', () => {
  it('uses the beacon when sendBeacon returns true', () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    const fetchSpy = vi.fn();
    setNav({ sendBeacon: beacon });
    vi.stubGlobal('fetch', fetchSpy);
    createTransport('/m')('{"v":1}');
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]?.[0]).toBe('/m');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch with exact options when the beacon refuses', () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    setNav({ sendBeacon: () => false });
    vi.stubGlobal('fetch', fetchSpy);
    createTransport('/m')('{"v":1}');
    expect(fetchSpy).toHaveBeenCalledWith('/m', {
      method: 'POST',
      body: '{"v":1}',
      keepalive: true,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store'
    });
  });

  it('falls back to fetch when sendBeacon is absent', () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    setNav({ sendBeacon: undefined });
    vi.stubGlobal('fetch', fetchSpy);
    createTransport('/m')('x');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws when sendBeacon throws', () => {
    setNav({
      sendBeacon: () => {
        throw new Error('boom');
      }
    });
    vi.stubGlobal('fetch', vi.fn());
    expect(() => createTransport('/m')('x')).not.toThrow();
  });

  it('never throws when fetch rejects', async () => {
    setNav({ sendBeacon: () => false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    expect(() => createTransport('/m')('x')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('never throws when fetch throws synchronously', () => {
    setNav({ sendBeacon: () => false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('sync');
      })
    );
    expect(() => createTransport('/m')('x')).not.toThrow();
  });
});

describe('trackingRefused', () => {
  it('is true for Global Privacy Control', () => {
    setNav({ globalPrivacyControl: true });
    expect(trackingRefused()).toBe(true);
  });

  it('is true for Do Not Track "1"', () => {
    setNav({ doNotTrack: '1' });
    expect(trackingRefused()).toBe(true);
  });

  it('is false otherwise', () => {
    setNav({ globalPrivacyControl: false, doNotTrack: '0' });
    expect(trackingRefused()).toBe(false);
    setNav({ globalPrivacyControl: undefined, doNotTrack: null });
    expect(trackingRefused()).toBe(false);
  });
});
