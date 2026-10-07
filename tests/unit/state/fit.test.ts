// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fit, resetFitForTests } from '../../../src/lib/state/fit.svelte';

const P = { string: 3, fret: 20 };

beforeEach(() => resetFitForTests());

describe('fit store', () => {
  it('defaults to comfortable and unavailable', () => {
    expect(fit.mode).toBe('comfortable');
    expect(fit.available).toBe(false);
    expect(fit.effective).toBe('comfortable');
    expect(fit.notice).toBeNull();
    expect(fit.takeAnchor()).toBeNull();
  });

  it('toggle is a no-op while unavailable', () => {
    fit.toggle();
    expect(fit.mode).toBe('comfortable');
  });

  it('toggle flips the mode when available', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    expect(fit.mode).toBe('whole');
    expect(fit.effective).toBe('whole');
    fit.toggle();
    expect(fit.mode).toBe('comfortable');
  });

  it('request switches only when available and different', () => {
    fit.handle({ kind: 'request', mode: 'whole' });
    expect(fit.mode).toBe('comfortable');
    fit.handle({ kind: 'overflow', value: true });
    fit.handle({ kind: 'request', mode: 'comfortable' });
    expect(fit.mode).toBe('comfortable');
    fit.handle({ kind: 'request', mode: 'whole' });
    expect(fit.mode).toBe('whole');
    fit.handle({ kind: 'request', mode: 'whole' });
    expect(fit.mode).toBe('whole');
  });

  it('overflow change keeps the mode; effective follows availability', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'overflow', value: false });
    expect(fit.mode).toBe('whole');
    expect(fit.effective).toBe('comfortable');
    fit.handle({ kind: 'overflow', value: true });
    expect(fit.effective).toBe('whole');
  });

  it('small-tap raises the notice only in effective whole', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.handle({ kind: 'small-tap', position: P });
    expect(fit.notice).toBeNull();
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    expect(fit.notice).toEqual({ position: P });
  });

  it('small-tap is blocked after dismissal until the next mode change', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    fit.dismissNotice();
    expect(fit.notice).toBeNull();
    fit.handle({ kind: 'small-tap', position: P });
    expect(fit.notice).toBeNull();
    fit.toggle();
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    expect(fit.notice).toEqual({ position: P });
  });

  it('acceptNotice sets the anchor, switches to comfortable, clears the notice', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    fit.acceptNotice();
    expect(fit.mode).toBe('comfortable');
    expect(fit.notice).toBeNull();
    expect(fit.takeAnchor()).toEqual(P);
  });

  it('takeAnchor returns once and clears', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    fit.acceptNotice();
    fit.takeAnchor();
    expect(fit.takeAnchor()).toBeNull();
  });

  it('acceptNotice without a notice does nothing', () => {
    fit.acceptNotice();
    expect(fit.takeAnchor()).toBeNull();
    expect(fit.mode).toBe('comfortable');
  });

  it('clears the notice when effective becomes comfortable', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    fit.handle({ kind: 'overflow', value: false });
    expect(fit.notice).toBeNull();
    fit.handle({ kind: 'overflow', value: true });
    expect(fit.notice).toBeNull();
  });

  it('clears the notice on a mode change by toggle', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    fit.handle({ kind: 'small-tap', position: P });
    fit.toggle();
    expect(fit.notice).toBeNull();
  });

  it('resetFitForTests restores the initial state', () => {
    fit.handle({ kind: 'overflow', value: true });
    fit.toggle();
    resetFitForTests();
    expect(fit.mode).toBe('comfortable');
    expect(fit.available).toBe(false);
  });
});
