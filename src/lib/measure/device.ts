/** Coarse device class (specs/028 clarification). Computed once, never stored. */
import type { DeviceClass } from './wire';

const TABLET_MIN_SHORT_SIDE = 600;

export function deviceClass(input: { coarse: boolean; shortSide: number }): DeviceClass {
  if (!input.coarse) return 'desktop';
  return input.shortSide < TABLET_MIN_SHORT_SIDE ? 'phone' : 'tablet';
}

export function readDeviceClass(): DeviceClass {
  return deviceClass({
    coarse: matchMedia('(pointer: coarse)').matches,
    shortSide: Math.min(screen.width, screen.height)
  });
}
