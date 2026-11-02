// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerOffline, type OfflineHost } from '$lib/offline/register';

function host(opts: { sw?: boolean; ready?: string; register?: () => Promise<unknown> }) {
  const register = vi.fn(opts.register ?? (() => Promise.resolve({})));
  const addEventListener = vi.fn();
  const h = {
    navigator: opts.sw === false ? {} : { serviceWorker: { register } },
    document: { readyState: opts.ready ?? 'complete' },
    addEventListener
  } as unknown as OfflineHost;
  return { h, register, addEventListener };
}

afterEach(() => vi.restoreAllMocks());

describe('registerOffline', () => {
  it('does nothing in dev', () => {
    const { h, register, addEventListener } = host({});
    registerOffline(h, true);
    expect(register).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('does nothing without serviceWorker', () => {
    const { h, addEventListener } = host({ sw: false });
    registerOffline(h, false);
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('waits for load when the document is not complete', () => {
    const { h, register, addEventListener } = host({ ready: 'loading' });
    registerOffline(h, false);
    expect(register).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledTimes(1);
    const [type, fn, opts] = addEventListener.mock.calls[0];
    expect(type).toBe('load');
    expect(opts).toEqual({ once: true });
    fn();
    expect(register).toHaveBeenCalledWith('/service-worker.js');
  });

  it('registers at once when complete', () => {
    const { h, register, addEventListener } = host({});
    registerOffline(h, false);
    expect(register).toHaveBeenCalledWith('/service-worker.js');
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('logs a rejection and never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new Error('nope');
    const { h } = host({ register: () => Promise.reject(error) });
    expect(() => registerOffline(h, false)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith('[fretboard-master] offline unavailable', error);
  });

  it('logs a synchronous throw too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { h } = host({
      register: () => {
        throw new Error('sync');
      }
    });
    expect(() => registerOffline(h, false)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('attaches no update handlers', () => {
    const { h, addEventListener } = host({});
    registerOffline(h, false);
    const types = addEventListener.mock.calls.map((c) => c[0]);
    expect(types).not.toContain('updatefound');
    expect(types).not.toContain('controllerchange');
  });
});
