// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_METRICS, layoutFretboard } from '../../../src/lib/fretboard/geometry';
import Minimap from '../../../src/lib/fretboard/Minimap.svelte';
import { presetInstrument } from '../../../src/lib/instrument/tunings';

const instrument = presetInstrument('AF-1', 6, 24);
const VIEWPORT = 320;
const MINIMAP = 200;

const sizes = new Map<string, number>();
const protoDescriptors: Record<string, PropertyDescriptor | undefined> = {};

function stubSize(prop: 'clientWidth' | 'clientHeight') {
  const proto = HTMLElement.prototype;
  protoDescriptors[prop] = Object.getOwnPropertyDescriptor(proto, prop);
  Object.defineProperty(proto, prop, {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('minimap')
        ? (sizes.get(`minimap-${prop}`) ?? 0)
        : (sizes.get('scroller') ?? 0);
    }
  });
}

beforeEach(() => {
  sizes.set('minimap-clientWidth', MINIMAP);
  sizes.set('minimap-clientHeight', 44);
  sizes.set('scroller', VIEWPORT);
  stubSize('clientWidth');
  stubSize('clientHeight');
});

afterEach(() => {
  for (const prop of ['clientWidth', 'clientHeight']) {
    const d = protoDescriptors[prop];
    if (d) Object.defineProperty(HTMLElement.prototype, prop, d);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  }
});

function setup(opts: { mirrored?: boolean; dots?: { x: number; row: number }[] } = {}) {
  const inst = opts.mirrored ? { ...instrument, handedness: 'left' as const } : instrument;
  const layout = layoutFretboard(inst, DEFAULT_METRICS, VIEWPORT, 'interactive');
  const scroller = document.createElement('div');
  scroller.className = 'scroller';
  let left = 0;
  Object.defineProperty(scroller, 'scrollLeft', {
    get: () => left,
    set: (v: number) => (left = v)
  });
  document.body.append(scroller);
  const view = render(Minimap, { layout, scroller, dots: opts.dots ?? [] });
  return { layout, scroller, view, slider: screen.getByRole('slider') };
}

function ptr(el: Element, name: string, x: number, y: number) {
  const ev = new MouseEvent(name, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(ev, { pointerId: { value: 1 }, isPrimary: { value: true } });
  el.dispatchEvent(ev);
}

describe('Minimap', () => {
  it('is a slider with label and valuetext of the visible frets', () => {
    const { slider } = setup();
    expect(slider.getAttribute('aria-label')).toBe('Fretboard overview');
    expect(slider.getAttribute('aria-valuemin')).toBe('1');
    expect(slider.getAttribute('aria-valuemax')).toBe('24');
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^Frets 1 to \d+ of 24$/);
  });

  it('draws one dot per highlighted position and none when none', () => {
    const a = setup({
      dots: [
        { x: 100, row: 0 },
        { x: 400, row: 3 }
      ]
    });
    expect(a.view.container.querySelectorAll('.dot')).toHaveLength(2);
    a.view.unmount();
    const b = setup();
    expect(b.view.container.querySelectorAll('.dot')).toHaveLength(0);
    expect(b.view.container.querySelectorAll('.window')).toHaveLength(1);
  });

  it('is at least 44 px tall by token (block-size rule present)', () => {
    const { slider } = setup();
    expect(slider.className).toContain('minimap');
    expect(sizes.get('minimap-clientHeight')).toBeGreaterThanOrEqual(44);
  });

  it('keys scroll the scroller: End, Home, ArrowRight', async () => {
    const { layout, scroller, slider } = setup();
    const max = layout.width - VIEWPORT;
    await fireEvent.keyDown(slider, { key: 'End' });
    expect(scroller.scrollLeft).toBeCloseTo(max, 0);
    await fireEvent.keyDown(slider, { key: 'Home' });
    expect(scroller.scrollLeft).toBe(0);
    await fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(scroller.scrollLeft).toBeCloseTo(VIEWPORT, 0);
  });

  it('does not preventDefault for other keys', async () => {
    const { slider } = setup();
    const notPrevented = await fireEvent.keyDown(slider, { key: 'a' });
    expect(notPrevented).toBe(true);
    const prevented = await fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(prevented).toBe(false);
  });

  it('tapping the far end scrolls to the last fret', async () => {
    const { layout, scroller, slider } = setup();
    slider.getBoundingClientRect = () => ({ left: 0, width: MINIMAP }) as DOMRect;
    ptr(slider, 'pointerdown', MINIMAP, 10);
    ptr(slider, 'pointerup', MINIMAP, 10);
    expect(scroller.scrollLeft).toBeCloseTo(layout.width - VIEWPORT, 0);
  });

  it('a drag is not a tap', async () => {
    const { scroller, slider } = setup();
    slider.getBoundingClientRect = () => ({ left: 0, width: MINIMAP }) as DOMRect;
    ptr(slider, 'pointerdown', 10, 10);
    ptr(slider, 'pointerup', MINIMAP, 10);
    expect(scroller.scrollLeft).toBe(0);
  });

  it('mirrored: Home goes to the max scroll (nut end), same fret as right-handed', async () => {
    const { layout, scroller, slider } = setup({ mirrored: true });
    expect(layout.mirrored).toBe(true);
    await fireEvent.keyDown(slider, { key: 'Home' });
    expect(scroller.scrollLeft).toBeCloseTo(layout.width - VIEWPORT, 0);
    await fireEvent.keyDown(slider, { key: 'End' });
    expect(scroller.scrollLeft).toBe(0);
  });
});
