import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maybeFault } from '../../src/lib/shell/fault';

beforeEach(() => vi.stubGlobal('__FM_FAULT_INJECTION__', true));
afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { __fmFault?: unknown }).__fmFault;
});

describe('maybeFault', () => {
  it('throws once for a count of 1', () => {
    globalThis.__fmFault = { notes: 1 };
    expect(() => maybeFault('notes')).toThrow('Injected fault: notes');
    expect(() => maybeFault('notes')).not.toThrow();
  });

  it('always throws for Infinity', () => {
    globalThis.__fmFault = { notes: Infinity };
    for (let i = 0; i < 3; i++) expect(() => maybeFault('notes')).toThrow('Injected fault: notes');
  });

  it('never throws when absent or 0', () => {
    expect(() => maybeFault('notes')).not.toThrow();
    globalThis.__fmFault = { notes: 0 };
    expect(() => maybeFault('notes')).not.toThrow();
  });

  it('does not affect another tool', () => {
    globalThis.__fmFault = { notes: 1 };
    expect(() => maybeFault('triads')).not.toThrow();
    expect(globalThis.__fmFault.notes).toBe(1);
  });
});
