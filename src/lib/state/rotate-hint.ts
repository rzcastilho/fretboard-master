/**
 * Rotate hint rule (016 US4). Pure: no DOM, Svelte or storage.
 * A portrait phone is width ≤ 599 and height > width.
 */
export const PHONE_MAX_WIDTH = 599 as const;

export function isPhonePortrait(width: number, height: number): boolean {
  return width <= PHONE_MAX_WIDTH && height > width;
}

export function shouldShowRotateHint(v: {
  width: number;
  height: number;
  recorded: boolean;
}): boolean {
  return !v.recorded && isPhonePortrait(v.width, v.height);
}
