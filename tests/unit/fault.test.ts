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

  it('calculation phase reads its own key; drawing phase reads the plain key', () => {
    globalThis.__fmFault = { 'triads:calculation': 1, caged: 1 };
    expect(() => maybeFault('triads')).not.toThrow();
    expect(() => maybeFault('triads', 'drawing')).not.toThrow();
    expect(() => maybeFault('triads', 'calculation')).toThrow('Injected fault: triads:calculation');
    expect(() => maybeFault('triads', 'calculation')).not.toThrow();
    expect(() => maybeFault('caged', 'calculation')).not.toThrow();
    expect(() => maybeFault('caged', 'drawing')).toThrow('Injected fault: caged');
  });

  it('never throws in a production build, whatever is set', () => {
    vi.stubGlobal('__FM_FAULT_INJECTION__', false);
    globalThis.__fmFault = { notes: Infinity, 'notes:calculation': Infinity };
    expect(() => maybeFault('notes')).not.toThrow();
    expect(() => maybeFault('notes', 'calculation')).not.toThrow();
    expect(() => maybeFault('notes', 'drawing')).not.toThrow();
  });

  it('does not affect another tool', () => {
    globalThis.__fmFault = { notes: 1 };
    expect(() => maybeFault('triads')).not.toThrow();
    expect(globalThis.__fmFault.notes).toBe(1);
  });
});
