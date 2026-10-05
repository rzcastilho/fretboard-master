import { describe, expect, it } from 'vitest';
import {
  PHONE_MAX_WIDTH,
  isPhonePortrait,
  shouldShowRotateHint
} from '../../../src/lib/state/rotate-hint';

describe('isPhonePortrait', () => {
  it('is true for a portrait phone', () => {
    expect(isPhonePortrait(390, 844)).toBe(true);
  });
  it('is false for landscape phone, tablet and desktop', () => {
    expect(isPhonePortrait(844, 390)).toBe(false);
    expect(isPhonePortrait(768, 1024)).toBe(false);
    expect(isPhonePortrait(1280, 800)).toBe(false);
  });
  it('treats width 599 as phone and 600 as not', () => {
    expect(PHONE_MAX_WIDTH).toBe(599);
    expect(isPhonePortrait(599, 800)).toBe(true);
    expect(isPhonePortrait(600, 800)).toBe(false);
  });
  it('is false for a square viewport', () => {
    expect(isPhonePortrait(599, 599)).toBe(false);
  });
});

describe('shouldShowRotateHint', () => {
  it('shows on a portrait phone with nothing recorded', () => {
    expect(shouldShowRotateHint({ width: 390, height: 844, recorded: false })).toBe(true);
  });
  it('is false when already recorded', () => {
    expect(shouldShowRotateHint({ width: 390, height: 844, recorded: true })).toBe(false);
  });
  it('is false when not a portrait phone', () => {
    expect(shouldShowRotateHint({ width: 1280, height: 800, recorded: false })).toBe(false);
  });
});
