import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_METRICS, layoutFretboard } from '../../../src/lib/fretboard/geometry';
import Fretboard from '../../../src/lib/fretboard/Fretboard.svelte';
import type { DisplayModel, Marker } from '../../../src/lib/fretboard/types';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { presetInstrument } from '../../../src/lib/instrument/tunings';

describe('Fretboard (interactive)', () => {
  it('renders a grid named Fretboard with 6 rows and 138 cells', () => {
    render(Fretboard, { instrument: STANDARD_GUITAR });
    const grid = screen.getByRole('grid', { name: 'Fretboard' });
    expect(within(grid).getAllByRole('row')).toHaveLength(6);
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(138);
  });

  it('labels cells with spoken note, string and fret', () => {
    render(Fretboard, { instrument: STANDARD_GUITAR });
    expect(screen.getByRole('gridcell', { name: 'C, string 2, fret 1' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'E, string 6, open' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'E, string 1, open' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'F sharp, string 1, fret 2' })).toBeTruthy();
  });

  it('has exactly one tab stop: string 1 open', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('data-string')).toBe('1');
    expect(stops[0].getAttribute('data-fret')).toBe('0');
  });

  it('draws string labels, fret numbers 1–22 (inlay frets bold), and inlays', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const nums = [...container.querySelectorAll('.fret-number')];
    expect(nums.map((n) => n.textContent)).toEqual(
      Array.from({ length: 22 }, (_, i) => `${i + 1}`)
    );
    const bold = nums.filter((n) => n.classList.contains('inlay-fret')).map((n) => n.textContent);
    expect(bold).toEqual(['3', '5', '7', '9', '12', '15', '17', '19', '21']);
    const labels = [...container.querySelectorAll('.string-label')].map((n) => n.textContent);
    expect(labels).toEqual(['1 E', '2 B', '3 G', '4 D', '5 A', '6 E']);
    expect(container.querySelectorAll('.inlay')).toHaveLength(8 + 2);
    expect(container.querySelector('.nut')).toBeTruthy();
    expect(container.querySelectorAll('.fret-line')).toHaveLength(22);
  });

  it('uses no inline style attributes (CSP)', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });
});

describe('Fretboard (thumbnail)', () => {
  it('renders a decorative svg with only open-string labels, no cells or listeners', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, variant: 'thumbnail' });
    const svg = container.querySelector('svg.fretboard-thumbnail');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(container.querySelectorAll('[role], button, [tabindex]')).toHaveLength(0);
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual([
      'E',
      'B',
      'G',
      'D',
      'A',
      'E'
    ]);
  });
});

describe('Fretboard (preview)', () => {
  it('draws pending frets and open-string labels in the preset spelling, inert and hidden', () => {
    const { container } = render(Fretboard, {
      instrument: presetInstrument('AF-2', 24),
      variant: 'preview'
    });
    const svg = container.querySelector('svg.fretboard-preview');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.fret-line')).toHaveLength(24);
    const labels = [...container.querySelectorAll('.string-label')].map((n) => n.textContent);
    expect(labels).toEqual(['E♭', 'B♭', 'G♭', 'D♭', 'A♭', 'E♭']);
    expect(container.querySelectorAll('.marker')).toHaveLength(0);
    expect(container.querySelectorAll('[role], button, [tabindex], .cell')).toHaveLength(0);
    expect(container.querySelector('.description, [aria-live]')).toBeNull();
  });

  it('shows sharps for open tunings', () => {
    const { container } = render(Fretboard, {
      instrument: presetInstrument('AF-11', 22),
      variant: 'preview'
    });
    const labels = [...container.querySelectorAll('.string-label')].map((n) => n.textContent);
    expect(labels).toEqual(['E', 'C♯', 'A', 'E', 'A', 'E']);
  });
});

const mk = (over: Partial<Marker> & Pick<Marker, 'string' | 'fret'>): Marker => ({
  function: 'neutral',
  emphasis: 'normal',
  ...over
});

const show = (markers: Marker[], labelMode: DisplayModel['labelMode'] = 'note') =>
  render(Fretboard, { instrument: STANDARD_GUITAR, model: { markers, labelMode } });

describe('Fretboard markers', () => {
  it('draws one marker per function with function and emphasis classes', () => {
    const { container } = show([
      mk({ string: 1, fret: 1, function: 'root', emphasis: 'highlighted' }),
      mk({ string: 2, fret: 1, function: 'third', emphasis: 'normal' }),
      mk({ string: 3, fret: 1, function: 'fifth', emphasis: 'dimmed' }),
      mk({ string: 4, fret: 1, function: 'degree' }),
      mk({ string: 5, fret: 1, function: 'neutral' })
    ]);
    const root = container.querySelector('.marker[data-key="1:1"]');
    expect(root?.classList.contains('root')).toBe(true);
    expect(root?.classList.contains('highlighted')).toBe(true);
    expect(container.querySelector('.marker[data-key="2:1"]')?.classList).toContain('third');
    expect(container.querySelector('.marker[data-key="3:1"]')?.classList).toContain('fifth');
    expect(container.querySelector('.marker[data-key="3:1"]')?.classList).toContain('dimmed');
    expect(container.querySelector('.marker[data-key="4:1"]')?.classList).toContain('degree');
    expect(container.querySelector('.marker[data-key="5:1"]')?.classList).toContain('neutral');
    expect(container.querySelector('g.markers')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws nothing for hidden markers but keeps the cell', () => {
    const { container } = show([mk({ string: 2, fret: 1, emphasis: 'hidden' })]);
    expect(container.querySelectorAll('.marker')).toHaveLength(0);
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(138);
  });

  it('ignores duplicates (first wins) and out-of-range markers without throwing', () => {
    const { container } = show([
      mk({ string: 2, fret: 1, function: 'root' }),
      mk({ string: 2, fret: 1, function: 'fifth' }),
      mk({ string: 7, fret: 1 }),
      mk({ string: 1, fret: 23 }),
      mk({ string: 0, fret: 0 }),
      mk({ string: 1, fret: -1 })
    ]);
    const all = container.querySelectorAll('.marker');
    expect(all).toHaveLength(1);
    expect(all[0].classList).toContain('root');
  });

  it('shows a label iff labelMode is note and emphasis is highlighted or normal', () => {
    const markers = [
      mk({ string: 2, fret: 1, emphasis: 'highlighted' }),
      mk({ string: 3, fret: 1, emphasis: 'normal' }),
      mk({ string: 4, fret: 1, emphasis: 'dimmed' })
    ];
    const withNotes = show(markers).container;
    expect(withNotes.querySelector('.marker[data-key="2:1"] text')?.textContent).toBe('C');
    expect(withNotes.querySelector('.marker[data-key="3:1"] text')?.textContent).toBe('G♯');
    expect(withNotes.querySelector('.marker[data-key="4:1"] text')).toBeNull();
    const none = show(markers, 'none').container;
    expect(none.querySelectorAll('.marker text')).toHaveLength(0);
  });

  it('uses an explicit spelling instead of the sharp default', () => {
    const { container } = show([
      mk({ string: 1, fret: 1, spelling: { letter: 'E', accidental: 1 } }),
      mk({ string: 2, fret: 10, spelling: { letter: 'B', accidental: -2 } })
    ]);
    expect(container.querySelector('.marker[data-key="1:1"] text')?.textContent).toBe('E♯');
    expect(container.querySelector('.marker[data-key="2:10"] text')?.textContent).toBe(
      'B\u{1D12B}'
    );
  });

  it('names marked cells with their function', () => {
    show([mk({ string: 1, fret: 2, function: 'third' })]);
    expect(screen.getByRole('gridcell', { name: 'F sharp, string 1, fret 2, third' })).toBeTruthy();
  });

  it('gives every function a distinct shape/outline/size (not color alone)', () => {
    const fns = ['root', 'third', 'fifth', 'degree', 'neutral'] as const;
    const { container } = show(fns.map((f, i) => mk({ string: i + 1, fret: 3, function: f })));
    const tuples = fns.map((f, i) => {
      const shape = container.querySelector(`.marker[data-key="${i + 1}:3"] .glyph`);
      if (!shape) throw new Error(`no glyph for ${f}`);
      const size = shape.getAttribute('r') ?? shape.getAttribute('width') ?? shape.tagName;
      const outline = shape.classList.contains('ring')
        ? 'ring'
        : shape.classList.contains('outline')
          ? 'outline'
          : 'none';
      return `${shape.tagName}|${outline}|${size}`;
    });
    expect(new Set(tuples).size).toBe(5);
    const third = container.querySelector('.marker.third .glyph');
    const neutral = container.querySelector('.marker.neutral .glyph');
    expect(third?.classList.contains('ring')).toBe(false);
    expect(neutral?.classList.contains('ring')).toBe(true);
  });
});

type PtrInit = {
  x: number;
  y: number;
  id?: number;
  type?: string;
  button?: number;
  primary?: boolean;
};

function ptr(el: Element, name: string, o: PtrInit) {
  const ev = new MouseEvent(name, {
    bubbles: true,
    cancelable: true,
    clientX: o.x,
    clientY: o.y,
    button: o.button ?? 0
  });
  Object.defineProperties(ev, {
    pointerId: { value: o.id ?? 1 },
    pointerType: { value: o.type ?? 'touch' },
    isPrimary: { value: o.primary ?? true }
  });
  el.dispatchEvent(ev);
}

const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
const center = (string: number, fret: number) => ({
  x: layout.columns[fret].center,
  y: layout.rows[string - 1].center
});

function tap(svg: Element, x: number, y: number, type = 'touch') {
  ptr(svg, 'pointerdown', { x, y, type });
  ptr(svg, 'pointerup', { x, y, type });
}

describe('Fretboard pointer activation', () => {
  it('reports { string, fret } only, for a tap on any cell', () => {
    const onactivate = vi.fn();
    render(Fretboard, { instrument: STANDARD_GUITAR, onactivate });
    const svg = screen.getByRole('grid');
    for (const [s, f] of [
      [1, 0],
      [3, 7],
      [6, 22]
    ]) {
      const c = center(s, f);
      tap(svg, c.x, c.y);
      expect(onactivate).toHaveBeenLastCalledWith({ string: s, fret: f });
    }
    expect(Object.keys(onactivate.mock.calls[0][0]).sort()).toEqual(['fret', 'string']);
  });

  it('moves focus to the cell before reporting', () => {
    let focusedAtCall: string | null = null;
    const onactivate = () => {
      const a = document.activeElement;
      focusedAtCall = `${a?.getAttribute('data-string')}:${a?.getAttribute('data-fret')}`;
    };
    render(Fretboard, { instrument: STANDARD_GUITAR, onactivate });
    const c = center(4, 9);
    tap(screen.getByRole('grid'), c.x, c.y);
    expect(focusedAtCall).toBe('4:9');
  });

  it('reports again on repeat taps', () => {
    const onactivate = vi.fn();
    render(Fretboard, { instrument: STANDARD_GUITAR, onactivate });
    const svg = screen.getByRole('grid');
    const c = center(2, 2);
    tap(svg, c.x, c.y);
    tap(svg, c.x, c.y);
    expect(onactivate).toHaveBeenCalledTimes(2);
  });

  it('does not report for a drag, a secondary button, or a second touch', () => {
    const onactivate = vi.fn();
    render(Fretboard, { instrument: STANDARD_GUITAR, onactivate });
    const svg = screen.getByRole('grid');
    const c = center(2, 2);
    ptr(svg, 'pointerdown', { ...c });
    ptr(svg, 'pointermove', { x: c.x + 15, y: c.y });
    ptr(svg, 'pointerup', { x: c.x + 15, y: c.y });
    ptr(svg, 'pointerdown', { ...c, button: 2 });
    ptr(svg, 'pointerup', { ...c, button: 2 });
    ptr(svg, 'pointerdown', { ...c });
    ptr(svg, 'pointerdown', { ...c, id: 2, primary: false });
    ptr(svg, 'pointerup', { ...c, id: 2, primary: false });
    ptr(svg, 'pointerup', { ...c });
    expect(onactivate).not.toHaveBeenCalled();
  });

  it('shows a hover hint for mouse only, including unmarked cells, and clears on leave', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const svg = screen.getByRole('grid');
    const c = center(2, 1);
    ptr(svg, 'pointermove', { ...c, type: 'touch' });
    await tick();
    expect(container.querySelector('.hover-hint')).toBeNull();
    ptr(svg, 'pointermove', { ...c, type: 'mouse' });
    await tick();
    const hint = container.querySelector('.hover-hint');
    expect(hint?.textContent).toContain('C');
    expect(hint?.getAttribute('aria-hidden')).toBe('true');
    ptr(svg, 'pointerleave', { ...c, type: 'mouse' });
    await tick();
    expect(container.querySelector('.hover-hint')).toBeNull();
  });

  it('model.hoverHint === false never renders the hover hint', async () => {
    const model: DisplayModel = { markers: [], labelMode: 'note', hoverHint: false };
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, model });
    const c = center(2, 1);
    ptr(screen.getByRole('grid'), 'pointermove', { ...c, type: 'mouse' });
    await tick();
    expect(container.querySelector('.hover-hint')).toBeNull();
  });

  it('shows the hint on hidden markers too', async () => {
    const model: DisplayModel = {
      markers: [{ string: 2, fret: 1, function: 'root', emphasis: 'hidden' }],
      labelMode: 'note'
    };
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, model });
    const c = center(2, 1);
    ptr(screen.getByRole('grid'), 'pointermove', { ...c, type: 'mouse' });
    await tick();
    expect(container.querySelector('.hover-hint')).not.toBeNull();
  });

  it('hides the hint when a mouse drag starts', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const svg = screen.getByRole('grid');
    const c = center(2, 1);
    ptr(svg, 'pointermove', { ...c, type: 'mouse' });
    ptr(svg, 'pointerdown', { ...c, type: 'mouse' });
    ptr(svg, 'pointermove', { x: c.x + 20, y: c.y, type: 'mouse' });
    await tick();
    expect(container.querySelector('.hover-hint')).toBeNull();
  });

  it('thumbnail has no pointer handlers or hint', () => {
    const onactivate = vi.fn();
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      variant: 'thumbnail',
      onactivate
    });
    const svg = container.querySelector('svg') as SVGSVGElement;
    tap(svg, 20, 20);
    ptr(svg, 'pointermove', { x: 20, y: 20, type: 'mouse' });
    expect(onactivate).not.toHaveBeenCalled();
    expect(container.querySelector('.hover-hint')).toBeNull();
  });
});

describe('Fretboard auto-scroll', () => {
  const hl = (string: number, fret: number): Marker => ({
    string,
    fret,
    function: 'neutral',
    emphasis: 'highlighted'
  });
  const model = (...markers: Marker[]): DisplayModel => ({ markers, labelMode: 'none' });

  /** jsdom has no layout: give the scroller a 286 px viewport and record scrollLeft writes. */
  function setup() {
    const writes: number[] = [];
    const proto = HTMLElement.prototype;
    const widthDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const leftDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 286 });
    Object.defineProperty(proto, 'scrollLeft', {
      configurable: true,
      get(this: HTMLElement & { __sl?: number }) {
        return this.__sl ?? 0;
      },
      set(this: HTMLElement & { __sl?: number }, v: number) {
        this.__sl = v;
        writes.push(v);
      }
    });
    return {
      writes,
      restore() {
        if (widthDesc) Object.defineProperty(proto, 'clientWidth', widthDesc);
        else delete (proto as unknown as Record<string, unknown>).clientWidth;
        if (leftDesc) Object.defineProperty(Element.prototype, 'scrollLeft', leftDesc);
        delete (proto as unknown as Record<string, unknown>).scrollLeft;
      }
    };
  }

  it('scrolls once on initial render with far highlights, and not on unrelated re-renders', async () => {
    const env = setup();
    try {
      const far = model(hl(6, 15), hl(6, 16), hl(6, 17));
      const view = render(Fretboard, { instrument: STANDARD_GUITAR, model: far });
      await tick();
      expect(env.writes).toHaveLength(1);
      expect(env.writes[0]).toBeGreaterThan(0);

      // Unrelated change: new model object, same highlighted set, extra normal marker.
      await view.rerender({
        instrument: STANDARD_GUITAR,
        model: {
          markers: [...far.markers, { string: 1, fret: 1, function: 'root', emphasis: 'normal' }],
          labelMode: 'note'
        }
      });
      await tick();
      expect(env.writes).toHaveLength(1);
    } finally {
      env.restore();
    }
  });

  it('scrolls again when the highlighted set changes, but not after a manual scroll', async () => {
    const env = setup();
    try {
      const view = render(Fretboard, {
        instrument: STANDARD_GUITAR,
        model: model(hl(6, 15), hl(6, 16))
      });
      await tick();
      expect(env.writes).toHaveLength(1);

      // Manual scroll does not trigger anything.
      const scroller = document.querySelector('.scroller') as HTMLElement;
      scroller.scrollLeft = 400;
      scroller.dispatchEvent(new Event('scroll'));
      await tick();
      expect(env.writes).toHaveLength(2);

      await view.rerender({ instrument: STANDARD_GUITAR, model: model(hl(6, 1), hl(6, 2)) });
      await tick();
      expect(env.writes.length).toBe(3);
      expect(env.writes[2]).toBeLessThan(env.writes[1]);
    } finally {
      env.restore();
    }
  });

  it('does not scroll without highlighted markers', async () => {
    const env = setup();
    try {
      render(Fretboard, { instrument: STANDARD_GUITAR });
      await tick();
      expect(env.writes).toHaveLength(0);
    } finally {
      env.restore();
    }
  });
});

describe('Fretboard keyboard and description', () => {
  const stops = (c: HTMLElement) => c.querySelectorAll('[role="gridcell"][tabindex="0"]');
  const cell = (c: HTMLElement, s: number, f: number): SVGElement => {
    const el = c.querySelector<SVGElement>(`.cell[data-string="${s}"][data-fret="${f}"]`);
    if (!el) throw new Error('missing cell');
    return el;
  };

  it('keeps exactly one tab stop that follows arrow navigation', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    cell(container, 1, 0).focus();
    await fireEvent.keyDown(cell(container, 1, 0), { key: 'ArrowRight' });
    await tick();
    expect(document.activeElement).toBe(cell(container, 1, 1));
    expect(stops(container)).toHaveLength(1);
    expect(stops(container)[0]).toBe(cell(container, 1, 1));
    await fireEvent.keyDown(cell(container, 1, 1), { key: 'ArrowDown' });
    await tick();
    expect(document.activeElement).toBe(cell(container, 2, 1));
  });

  it('does not move past an edge', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    cell(container, 1, 0).focus();
    await fireEvent.keyDown(cell(container, 1, 0), { key: 'ArrowLeft' });
    await fireEvent.keyDown(cell(container, 1, 0), { key: 'ArrowUp' });
    await tick();
    expect(document.activeElement).toBe(cell(container, 1, 0));
  });

  it('Enter and Space activate; arrows never do', async () => {
    const onactivate = vi.fn();
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, onactivate });
    const c = cell(container, 1, 0);
    c.focus();
    await fireEvent.keyDown(c, { key: 'ArrowRight' });
    await fireEvent.keyDown(c, { key: 'ArrowDown' });
    expect(onactivate).not.toHaveBeenCalled();
    const at = document.activeElement as Element;
    await fireEvent.keyDown(at, { key: 'Enter' });
    expect(onactivate).toHaveBeenLastCalledWith({ string: 2, fret: 1 });
    await fireEvent.keyDown(at, { key: ' ' });
    expect(onactivate).toHaveBeenCalledTimes(2);
  });

  it('shows the focus ring iff focus is inside, even on unmarked cells', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    expect(container.querySelector('.focus-ring')).toBeNull();
    cell(container, 4, 9).focus();
    await tick();
    expect(container.querySelector('.focus-ring')).toBeTruthy();
    (document.activeElement as HTMLElement).blur();
    await tick();
    expect(container.querySelector('.focus-ring')).toBeNull();
  });

  it('a tap moves the roving stop to the tapped cell', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const c = center(4, 9);
    tap(screen.getByRole('grid'), c.x, c.y);
    await tick();
    expect(stops(container)[0]).toBe(cell(container, 4, 9));
    expect(container.querySelector('.focus-ring')).toBeTruthy();
  });

  it('live region is empty at first and updates when the description changes', async () => {
    const view = render(Fretboard, { instrument: STANDARD_GUITAR });
    const live = view.container.querySelector('[aria-live="polite"]');
    if (!live) throw new Error('missing live region');
    expect(live.getAttribute('aria-atomic')).toBe('true');
    expect(live.textContent).toBe('');
    await view.rerender({
      instrument: STANDARD_GUITAR,
      model: {
        markers: [{ string: 2, fret: 1, function: 'root', emphasis: 'highlighted' }],
        labelMode: 'note'
      }
    });
    await tick();
    expect(live.textContent).toContain('string 2, fret 1');
  });

  it('toggle flips aria-expanded and label; empty board says no positions', async () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR });
    const btn = screen.getByRole('button', { name: 'Show text description' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const para = container.querySelector(`#${btn.getAttribute('aria-controls')}`) as HTMLElement;
    expect(para.hidden).toBe(true);
    await fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent).toContain('Hide text description');
    expect(para.hidden).toBe(false);
    expect(para.textContent).toBe('No positions marked.');
  });
});

describe('Fretboard pulses (US2)', () => {
  const pulse = (id: number, string: number, fret: number, durationMs = 1500) => ({
    id,
    position: { string, fret },
    durationMs
  });

  it('draws .pulse markers keyed by pulse id and sets --pulse-duration', async () => {
    const view = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      pulses: [pulse(1, 6, 0)]
    });
    const el = view.container.querySelector('.marker.pulse') as HTMLElement | null;
    expect(el).toBeTruthy();
    expect(el?.getAttribute('data-key')).toBe('6:0');
    expect(el?.style.getPropertyValue('--pulse-duration')).toBe('1500ms');
    // Re-sounding with a new id re-creates the element (restarts the animation).
    await view.rerender({ instrument: STANDARD_GUITAR, pulses: [pulse(2, 6, 0)] });
    await tick();
    const again = view.container.querySelector('.marker.pulse');
    expect(again).toBeTruthy();
    expect(again).not.toBe(el);
    await view.rerender({ instrument: STANDARD_GUITAR, pulses: [] });
    await tick();
    expect(view.container.querySelector('.marker.pulse')).toBeNull();
  });

  it('keeps cell names and the text description identical with and without pulses', () => {
    const model: DisplayModel = {
      markers: [{ string: 2, fret: 1, function: 'root', emphasis: 'normal' }],
      labelMode: 'note'
    };
    const names = (c: HTMLElement) =>
      [...c.querySelectorAll('[role="gridcell"]')].map((n) => n.getAttribute('aria-label'));
    const plain = render(Fretboard, { instrument: STANDARD_GUITAR, model });
    const pulsed = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model,
      pulses: [pulse(1, 2, 1), pulse(2, 6, 0)]
    });
    expect(names(pulsed.container)).toEqual(names(plain.container));
    expect(pulsed.container.querySelector('.description')?.textContent).toBe(
      plain.container.querySelector('.description')?.textContent
    );
  });

  it('does not change the live region when a pulse starts', async () => {
    const view = render(Fretboard, { instrument: STANDARD_GUITAR });
    const live = view.container.querySelector('[aria-live="polite"]');
    await view.rerender({ instrument: STANDARD_GUITAR, pulses: [pulse(1, 6, 0)] });
    await tick();
    expect(live?.textContent).toBe('');
  });

  it('draws a transient neutral highlighted marker for an empty position', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      pulses: [pulse(1, 3, 5)]
    });
    const el = container.querySelector('.marker[data-key="3:5"]');
    expect(el?.classList).toContain('neutral');
    expect(el?.classList).toContain('highlighted');
    expect(el?.classList).toContain('pulse');
  });

  it('declares animation: none for the pulse under reduced motion', () => {
    const src = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([^}]*\{[^}]*\}[^}]*)\}/.exec(src);
    expect(block?.[1]).toMatch(/\.marker\.pulse \.shape\s*\{\s*animation:\s*none;/);
  });
});

describe('Fretboard notes-tool model fields (US1)', () => {
  it('fills neutral highlighted markers with the highlight token', () => {
    const { container } = show([mk({ string: 1, fret: 3, emphasis: 'highlighted' })]);
    const marker = container.querySelector('.marker.neutral.highlighted');
    expect(marker).toBeTruthy();
    const css = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    expect(css).toMatch(
      /\.marker\.neutral\.highlighted[^{]*\.glyph[^{]*\{[^}]*--color-note-highlight\)/
    );
  });

  it('adds tone-N only on highlighted markers, wired to --octave-tone-N', () => {
    const { container } = show([
      mk({ string: 1, fret: 3, emphasis: 'highlighted', tone: 3 }),
      mk({ string: 2, fret: 3, emphasis: 'dimmed', tone: 3 }),
      mk({ string: 3, fret: 3, emphasis: 'normal', tone: 3 })
    ]);
    expect(container.querySelectorAll('.marker.tone-3')).toHaveLength(1);
    expect(container.querySelector('.marker.tone-3')?.classList.contains('highlighted')).toBe(true);
    const css = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    for (let n = 1; n <= 7; n++) expect(css).toContain(`var(--octave-tone-${n})`);
  });

  it('draws an octave badge only for labelMode note', () => {
    const marker = mk({ string: 1, fret: 3, emphasis: 'highlighted', octaveBadge: true });
    const note = show([marker]);
    expect(note.container.querySelector('text.octave-badge')?.textContent).toBe('4');
    note.unmount();
    const oct = show([marker], 'octave');
    expect(oct.container.querySelector('text.octave-badge')).toBeNull();
    oct.unmount();
    const none = show([marker], 'none');
    expect(none.container.querySelector('text.octave-badge')).toBeNull();
  });

  it('labels in octave mode with pitch + octave', () => {
    const { container } = show([mk({ string: 1, fret: 3, emphasis: 'highlighted' })], 'octave');
    expect(container.querySelector('text.marker-label')?.textContent).toBe('G4');
  });

  it('octave mode labels with the spelled pitch and octave, e.g. A3 and C♯5', () => {
    // string 6 fret 5 = A2? use positions: string 2 fret 1 = C5, string 1 fret 9 = C♯5
    const { container } = show(
      [
        mk({ string: 1, fret: 9, emphasis: 'normal' }),
        mk({ string: 4, fret: 7, emphasis: 'dimmed', label: true })
      ],
      'octave'
    );
    const labels = [...container.querySelectorAll('text.marker-label')].map((t) => t.textContent);
    expect(labels).toEqual(['C♯5', 'A3']);
  });

  it('labelMode none renders no marker-label', () => {
    const { container } = show(
      [
        mk({ string: 1, fret: 3, emphasis: 'highlighted' }),
        mk({ string: 2, fret: 3, emphasis: 'normal' }),
        mk({ string: 3, fret: 3, emphasis: 'dimmed', label: true })
      ],
      'none'
    );
    expect(container.querySelector('.marker-label')).toBeNull();
  });

  it('label:true labels a dimmed marker; label:false never labels', () => {
    const { container } = show([
      mk({ string: 1, fret: 3, emphasis: 'dimmed', label: true }),
      mk({ string: 2, fret: 3, emphasis: 'highlighted', label: false }),
      mk({ string: 3, fret: 3, emphasis: 'dimmed' })
    ]);
    expect(container.querySelectorAll('text.marker-label')).toHaveLength(1);
    expect(container.querySelector('[data-key="1:3"] text.marker-label')).toBeTruthy();
  });

  it('replaces the description verbatim', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: {
        markers: [mk({ string: 1, fret: 3, emphasis: 'highlighted' })],
        labelMode: 'note',
        summary: 'ignored',
        description: 'Custom description.'
      }
    });
    expect(container.querySelector('.description')?.textContent).toBe('Custom description.');
  });

  it('keeps the tone class while pulsing', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: {
        markers: [mk({ string: 1, fret: 3, emphasis: 'highlighted', tone: 4 })],
        labelMode: 'note'
      },
      pulses: [{ id: 1, position: { string: 1, fret: 3 }, durationMs: 1000 }]
    });
    const el = container.querySelector('.marker.pulse');
    expect(el?.classList.contains('tone-4')).toBe(true);
  });
});

describe('Fretboard focusPosition (US2)', () => {
  it('focuses the cell, moves the roving tabindex, and keeps accessible names', async () => {
    const { container, component } = render(Fretboard, { instrument: STANDARD_GUITAR });
    component.focusPosition({ string: 3, fret: 2 });
    await tick();
    const cell = container.querySelector<SVGElement>('.cell[data-string="3"][data-fret="2"]');
    expect(document.activeElement).toBe(cell);
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cell);
    expect(cell?.getAttribute('aria-label')).toBe('A, string 3, fret 2');
  });

  it('is a no-op for an invalid position', async () => {
    const { container, component } = render(Fretboard, { instrument: STANDARD_GUITAR });
    component.focusPosition({ string: 9, fret: 2 });
    component.focusPosition({ string: 1, fret: 99 });
    await tick();
    expect(document.activeElement).not.toBe(
      container.querySelector('.cell[data-string="9"][data-fret="2"]')
    );
    const stop = container.querySelector('[role="gridcell"][tabindex="0"]');
    expect(stop?.getAttribute('data-string')).toBe('1');
    expect(stop?.getAttribute('data-fret')).toBe('0');
  });
});

describe('Fretboard region band (US3)', () => {
  const withRegion = (region?: { start: number; end: number }): DisplayModel => ({
    markers: [],
    labelMode: 'none',
    ...(region ? { region } : {})
  });

  it('draws no band without a region', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: withRegion()
    });
    expect(container.querySelector('.region-band')).toBeNull();
  });

  it('draws one aria-hidden band in the drawing layer, below strings and markers', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: withRegion({ start: 5, end: 9 })
    });
    const bands = container.querySelectorAll('rect.region-band');
    expect(bands).toHaveLength(1);
    const band = bands[0];
    expect(band.closest('g.drawing')).toBeTruthy();
    expect(band.closest('[aria-hidden="true"]')).toBeTruthy();
    const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 1000, 'interactive');
    const x = Number(band.getAttribute('x'));
    const w = Number(band.getAttribute('width'));
    expect(x).toBeCloseTo(layout.columns[5].start, 3);
    expect(x + w).toBeCloseTo(layout.columns[9].end, 3);
    const all = [...container.querySelectorAll('g.drawing *')];
    const firstString = container.querySelector('g.drawing .string');
    if (!firstString) throw new Error('no strings');
    expect(all.indexOf(band)).toBeLessThan(all.indexOf(firstString));
    const css = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    expect(css).toMatch(/\.region-band[^{]*\{[^}]*var\(--region-band\)/);
  });

  it('clamps an out-of-range region to 0..fretCount', () => {
    const { container } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: withRegion({ start: -4, end: 99 })
    });
    const band = container.querySelector('rect.region-band');
    expect(band).toBeTruthy();
    const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 1000, 'interactive');
    expect(Number(band?.getAttribute('x'))).toBeCloseTo(layout.columns[0].start, 3);
  });

  it('scrolls when the region changes (by start:end), not on first render or an equal region', async () => {
    const writes: number[] = [];
    const proto = HTMLElement.prototype;
    const widthDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 286 });
    Object.defineProperty(proto, 'scrollLeft', {
      configurable: true,
      get(this: HTMLElement & { __sl?: number }) {
        return this.__sl ?? 0;
      },
      set(this: HTMLElement & { __sl?: number }, v: number) {
        this.__sl = v;
        writes.push(v);
      }
    });
    try {
      const view = render(Fretboard, {
        instrument: STANDARD_GUITAR,
        model: withRegion({ start: 0, end: 4 })
      });
      await tick();
      expect(writes).toHaveLength(0);
      await view.rerender({ instrument: STANDARD_GUITAR, model: withRegion({ start: 0, end: 4 }) });
      await tick();
      expect(writes).toHaveLength(0);
      await view.rerender({
        instrument: STANDARD_GUITAR,
        model: withRegion({ start: 15, end: 19 })
      });
      await tick();
      expect(writes.length).toBeGreaterThan(0);
      expect(writes[writes.length - 1]).toBeGreaterThan(0);
    } finally {
      if (widthDesc) Object.defineProperty(proto, 'clientWidth', widthDesc);
      else delete (proto as unknown as Record<string, unknown>).clientWidth;
      delete (proto as unknown as Record<string, unknown>).scrollLeft;
    }
  });
});

describe('Fretboard interval label mode (005)', () => {
  const m = (o: Partial<Marker>): Marker => ({
    string: 1,
    fret: 1,
    function: 'neutral',
    emphasis: 'highlighted',
    ...o
  });
  const labels = (c: HTMLElement) =>
    [...c.querySelectorAll('.marker text')].map((t) => t.textContent);

  it('labels with the interval glyphs when present', () => {
    const { container } = show(
      [
        m({ string: 3, fret: 5, function: 'root', interval: 'R' }),
        m({ string: 2, fret: 5, function: 'third', interval: 'b3' }),
        m({ string: 1, fret: 3, function: 'fifth', interval: '#5' })
      ],
      'interval'
    );
    expect(new Set(labels(container))).toEqual(new Set(['R', '♭3', '♯5']));
  });

  it('shows no label when the marker has no interval', () => {
    const { container } = show([m({ string: 2, fret: 1 })], 'interval');
    expect(container.querySelectorAll('.marker text')).toHaveLength(0);
  });

  it('does not change marker shape classes or cell names', () => {
    const markers = [m({ string: 2, fret: 1, function: 'fifth', interval: '5' })];
    const interval = show(markers, 'interval').container;
    const note = show(markers, 'note').container;
    expect(interval.querySelector('.marker')?.classList).toContain('fifth');
    expect(interval.querySelector('.marker')?.outerHTML.replace(/<text.*<\/text>/, '')).toBe(
      note.querySelector('.marker')?.outerHTML.replace(/<text.*<\/text>/, '')
    );
  });

  it('note mode shows F𝄪 for a double-sharp spelling', () => {
    const { container } = show(
      [m({ string: 2, fret: 6, spelling: { letter: 'F', accidental: 2 }, interval: '3' })],
      'note'
    );
    expect(labels(container)).toEqual(['F𝄪']);
  });
});

describe('Fretboard tags (Full neck)', () => {
  const tags = [
    {
      id: 'root:0',
      start: 2,
      end: 2,
      label: 'Root position',
      name: 'Root position, frets 2-2-0',
      pressed: false
    },
    {
      id: 'first:0',
      start: 5,
      end: 6,
      label: '1st',
      name: '1st inversion, frets 6-5-5',
      pressed: false
    },
    {
      id: 'second:0',
      start: 9,
      end: 10,
      label: '2nd',
      name: '2nd inversion, frets 9-10-9',
      pressed: true,
      detail: 'Wide stretch'
    }
  ];
  const withTags = (extra: Partial<DisplayModel> = {}): DisplayModel => ({
    markers: [],
    labelMode: 'none',
    tags,
    ...extra
  });

  function scrollEnv() {
    const writes: number[] = [];
    const proto = HTMLElement.prototype;
    const widthDesc = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    const leftDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 286 });
    Object.defineProperty(proto, 'scrollLeft', {
      configurable: true,
      get(this: HTMLElement & { __sl?: number }) {
        return this.__sl ?? 0;
      },
      set(this: HTMLElement & { __sl?: number }, v: number) {
        this.__sl = v;
        writes.push(v);
      }
    });
    return {
      writes,
      restore() {
        if (widthDesc) Object.defineProperty(proto, 'clientWidth', widthDesc);
        else delete (proto as unknown as Record<string, unknown>).clientWidth;
        if (leftDesc) Object.defineProperty(Element.prototype, 'scrollLeft', leftDesc);
        delete (proto as unknown as Record<string, unknown>).scrollLeft;
      }
    };
  }

  it('renders tag buttons in order inside the scroller, before the svg', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, model: withTags() });
    const group = screen.getByRole('group', { name: 'Shapes' });
    expect(group.closest('.scroller')).toBeTruthy();
    expect(group.nextElementSibling?.tagName.toLowerCase()).toBe('svg');
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(tags.map((t) => t.name));
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(buttons[2].textContent).toContain('Wide stretch');
    expect(container.querySelector('.scroller')?.firstElementChild).toBe(group);
  });

  it('calls ontag on click, Enter and Space', async () => {
    const ontag = vi.fn();
    render(Fretboard, { instrument: STANDARD_GUITAR, model: withTags(), ontag });
    const button = screen.getByRole('button', { name: '1st inversion, frets 6-5-5' });
    await fireEvent.click(button);
    expect(ontag).toHaveBeenLastCalledWith('first:0');
    // Native buttons turn Enter/Space into click; jsdom does not, so assert they are buttons.
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('does not change scrollLeft when a tag is clicked', async () => {
    const env = scrollEnv();
    try {
      render(Fretboard, { instrument: STANDARD_GUITAR, model: withTags(), ontag: vi.fn() });
      await tick();
      const before = env.writes.length;
      await fireEvent.click(screen.getAllByRole('button', { name: /inversion/ })[0]);
      await tick();
      expect(env.writes.length).toBe(before);
    } finally {
      env.restore();
    }
  });

  it('renders no strip without tags (or with an empty list)', () => {
    const a = render(Fretboard, { instrument: STANDARD_GUITAR });
    expect(a.container.querySelector('.tags')).toBeNull();
    a.unmount();
    const b = render(Fretboard, { instrument: STANDARD_GUITAR, model: withTags({ tags: [] }) });
    expect(b.container.querySelector('.tags')).toBeNull();
  });

  it('keeps tags out of the text description', () => {
    const { container } = render(Fretboard, { instrument: STANDARD_GUITAR, model: withTags() });
    expect(container.querySelector('.description')?.textContent).not.toContain('2nd');
  });

  it('auto-scrolls only when autoScroll.key changes', async () => {
    const env = scrollEnv();
    try {
      const group = [
        { string: 3, fret: 15 },
        { string: 2, fret: 16 },
        { string: 1, fret: 16 }
      ];
      const model = (key: string, groups = [group]): DisplayModel =>
        withTags({ autoScroll: { key, groups } });
      const view = render(Fretboard, { instrument: STANDARD_GUITAR, model: model('a') });
      await tick();
      expect(env.writes).toHaveLength(1);
      expect(env.writes[0]).toBeGreaterThan(0);

      await view.rerender({ instrument: STANDARD_GUITAR, model: model('a') });
      await tick();
      expect(env.writes).toHaveLength(1);

      await view.rerender({
        instrument: STANDARD_GUITAR,
        model: model('b', [[{ string: 3, fret: 1 }]])
      });
      await tick();
      expect(env.writes).toHaveLength(2);
      expect(env.writes[1]).toBeLessThan(env.writes[0]);
    } finally {
      env.restore();
    }
  });

  it('keeps unchanged marker elements on a view switch (keyed per position, FR-021)', async () => {
    const a = mk({ string: 1, fret: 3, function: 'root', emphasis: 'highlighted' });
    const b = mk({ string: 2, fret: 5, function: 'third', emphasis: 'normal' });
    const view = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: { markers: [a, b], labelMode: 'note' }
    });
    const before = view.container.querySelector('.marker[data-key="1:3"]');
    expect(before).toBeTruthy();
    await view.rerender({
      instrument: STANDARD_GUITAR,
      model: {
        markers: [a, mk({ string: 4, fret: 7, function: 'fifth', emphasis: 'normal' })],
        labelMode: 'note'
      }
    });
    expect(view.container.querySelector('.marker[data-key="1:3"]')).toBe(before);
    expect(view.container.querySelector('.marker[data-key="2:5"]')).toBeNull();
    expect(view.container.querySelector('.marker[data-key="4:7"]')).toBeTruthy();
  });

  it('scrolls instantly (one write) under reduced motion', async () => {
    const env = scrollEnv();
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
      onchange: null
    })) as unknown as typeof globalThis.matchMedia;
    try {
      const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
      render(Fretboard, {
        instrument: STANDARD_GUITAR,
        model: withTags({
          autoScroll: { key: 'k', groups: [[{ string: 3, fret: 18 }]] }
        })
      });
      await tick();
      expect(env.writes).toHaveLength(1);
      expect(env.writes[0]).toBeGreaterThan(0);
      expect(raf).not.toHaveBeenCalled();
      raf.mockRestore();
    } finally {
      globalThis.matchMedia = original;
      env.restore();
    }
  });
});

describe('Fretboard comparison markers and arrows (007 US1)', () => {
  const cmp = (over: Partial<Marker> = {}): Marker =>
    mk({
      string: 2,
      fret: 4,
      function: 'third',
      emphasis: 'highlighted',
      variant: 'comparison',
      ...over
    });
  const move = (over: Record<string, unknown> = {}) =>
    ({
      kind: 'move',
      id: 'iso:arrow:third',
      string: 2,
      fromFret: 5,
      toFret: 4,
      label: '1 fret',
      ...over
    }) as const;
  const showWith = (markers: Marker[], arrows: DisplayModel['arrows'], extra = {}) =>
    render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: { markers, labelMode: 'note', arrows },
      ...extra
    });

  it('F6: a comparison marker carries the comparison class and keeps its function', () => {
    const { container } = showWith([cmp()], []);
    const g = container.querySelector('.marker[data-key="2:4"]');
    expect(g?.classList).toContain('comparison');
    expect(g?.classList).toContain('third');
    expect(g?.getAttribute('data-variant')).toBe('comparison');
    const plain = showWith([mk({ string: 2, fret: 5, function: 'third' })], []).container;
    expect(plain.querySelector('.marker[data-key="2:5"]')?.classList).not.toContain('comparison');
  });

  it('F9: a move arrow joins the two cells with an arrowhead at toFret and the label', () => {
    const { container } = showWith([cmp()], [move()]);
    const arrow = container.querySelector('g.arrows .arrow[data-id="iso:arrow:third"]');
    expect(arrow).toBeTruthy();
    const line = arrow?.querySelector('line');
    const l = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
    const x1 = Number(line?.getAttribute('x1'));
    const x2 = Number(line?.getAttribute('x2'));
    // Drawn toward the nut (smaller x), between the two cell centres.
    expect(x2).toBeLessThan(x1);
    expect(x1).toBeLessThanOrEqual(l.columns[5].center);
    expect(x2).toBeGreaterThanOrEqual(l.columns[4].center);
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(l.rows[1].center, 0);
    expect(arrow?.querySelector('polygon.arrowhead')).toBeTruthy();
    expect(arrow?.querySelector('text')?.textContent).toBe('1 fret');
  });

  it('F11: arrow direction follows the layout columns (toFret side)', () => {
    const normal = showWith([cmp()], [move()]).container;
    const reversed = showWith([cmp()], [move({ fromFret: 4, toFret: 5 })]).container;
    const dir = (c: HTMLElement) => {
      const line = c.querySelector('g.arrows line');
      return Math.sign(Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1')));
    };
    expect(dir(normal)).toBe(-1);
    expect(dir(reversed)).toBe(1);
  });

  it('F12: arrows sit in an aria-hidden group above the markers', () => {
    const { container } = showWith([cmp()], [move()]);
    const group = container.querySelector('g.arrows');
    expect(group?.getAttribute('aria-hidden')).toBe('true');
    const markers = container.querySelector('g.markers');
    expect(
      markers && group && markers.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('F14: invalid arrows are dropped without throwing', () => {
    const { container } = showWith(
      [cmp()],
      [
        move({ id: 'a', string: 7 }),
        move({ id: 'b', string: 0 }),
        move({ id: 'c', toFret: 23 }),
        move({ id: 'd', fromFret: -1 }),
        move({ id: 'e', fromFret: 4, toFret: 4 }),
        move({ id: 'f', toFret: 1.5 })
      ]
    );
    expect(container.querySelectorAll('g.arrows .arrow')).toHaveLength(0);
  });

  it('F15: the thumbnail ignores arrows', () => {
    const { container } = showWith([cmp()], [move()], { variant: 'thumbnail' });
    expect(container.querySelector('.arrows')).toBeNull();
    expect(container.querySelector('.arrow')).toBeNull();
  });

  it('US1-5: no arrows or dashes when the model has none', () => {
    const { container } = showWith([mk({ string: 2, fret: 5, function: 'third' })], undefined);
    expect(container.querySelectorAll('.arrow')).toHaveLength(0);
    expect(container.querySelectorAll('.marker.comparison')).toHaveLength(0);
  });

  it('US1-6: every comparison marker has a dash style hook and an arrow', () => {
    const { container } = showWith([cmp()], [move()]);
    expect(container.querySelectorAll('.marker.comparison')).toHaveLength(1);
    expect(container.querySelectorAll('.arrow')).toHaveLength(1);
    const css = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    expect(css).toMatch(/\.marker\.comparison[^{]*\{[^}]*stroke-dasharray:\s*var\(--marker-dash\)/);
  });

  it('F8: the comparison cell name carries the comparison suffix', () => {
    render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: { markers: [cmp()], labelMode: 'note' }
    });
    expect(screen.getByRole('gridcell', { name: /string 2, fret 4.*comparison/ })).toBeTruthy();
  });
});

describe('Fretboard off-board arrows (007 US3)', () => {
  const base = mk({ string: 2, fret: 12, function: 'third' });
  const off = (over: Record<string, unknown> = {}) =>
    ({
      kind: 'off-board',
      id: 'iso:arrow:off:third',
      string: 2,
      fromFret: 0,
      edge: 'nut',
      label: 'B♭',
      ...over
    }) as const;
  const showWith = (arrows: DisplayModel['arrows'], markers: Marker[] = [base], extra = {}) =>
    render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: { markers, labelMode: 'note', arrows },
      ...extra
    });
  const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
  const tipX = (c: HTMLElement) => {
    const pts = c.querySelector('g.arrows polygon.arrowhead')?.getAttribute('points') ?? '';
    return Number(pts.split(' ')[0]?.split(',')[0]);
  };

  it('F10: edge nut draws a head at the open-string side edge, with the note name', () => {
    const { container } = showWith([off()], [mk({ string: 2, fret: 0, function: 'third' })]);
    const arrow = container.querySelector('g.arrows .arrow[data-id="iso:arrow:off:third"]');
    expect(arrow).toBeTruthy();
    expect(arrow?.querySelector('polygon.arrowhead')).toBeTruthy();
    expect(arrow?.querySelector('text')?.textContent).toBe('B♭');
    // Toward the nut: left of the open-string marker, no further than the column edge.
    expect(tipX(container)).toBeLessThan(layout.columns[0].center);
    expect(tipX(container)).toBeGreaterThanOrEqual(layout.columns[0].start);
  });

  it('F10: edge end draws a head past the last fret column centre, toward the board end', () => {
    const last = STANDARD_GUITAR.fretCount;
    const { container } = showWith(
      [off({ edge: 'end', fromFret: last, label: 'E♯' })],
      [mk({ string: 2, fret: last, function: 'third' })]
    );
    expect(container.querySelector('g.arrows .arrow text')?.textContent).toBe('E♯');
    expect(tipX(container)).toBeGreaterThan(layout.columns[last].center);
    expect(tipX(container)).toBeLessThanOrEqual(layout.columns[last].end);
    const line = container.querySelector('g.arrows line');
    expect(Number(line?.getAttribute('y1'))).toBeCloseTo(layout.rows[1].center, 0);
  });

  it('F11: the head side follows the layout columns (nut left of end)', () => {
    const nut = showWith([off()], [mk({ string: 2, fret: 0, function: 'third' })]).container;
    const last = STANDARD_GUITAR.fretCount;
    const end = showWith(
      [off({ edge: 'end', fromFret: last })],
      [mk({ string: 2, fret: last, function: 'third' })]
    ).container;
    expect(tipX(nut)).toBeLessThan(layout.columns[0].center);
    expect(tipX(end)).toBeGreaterThan(layout.columns[last].center);
  });

  it('F12: off-board arrows are aria-hidden with the move arrows', () => {
    const { container } = showWith([off()], [mk({ string: 2, fret: 0, function: 'third' })]);
    expect(container.querySelector('g.arrows')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('F14: invalid off-board arrows are dropped without throwing', () => {
    const { container } = showWith(
      [
        off({ id: 'a', string: 0 }),
        off({ id: 'b', string: 7 }),
        off({ id: 'c', fromFret: 23 }),
        off({ id: 'd', fromFret: -1 }),
        off({ id: 'e', edge: 'top' })
      ],
      [mk({ string: 2, fret: 0, function: 'third' })]
    );
    expect(container.querySelectorAll('g.arrows .arrow')).toHaveLength(0);
  });

  it('F15: the thumbnail ignores off-board arrows', () => {
    const { container } = showWith([off()], [base], { variant: 'thumbnail' });
    expect(container.querySelector('.arrow')).toBeNull();
  });
});

describe('Fretboard marker motion (007 US5)', () => {
  const id = (over: Partial<Marker> & Pick<Marker, 'string' | 'fret'>): Marker =>
    mk({ function: 'third', emphasis: 'highlighted', ...over });
  const model = (markers: Marker[], arrows: DisplayModel['arrows'] = []): DisplayModel => ({
    markers,
    labelMode: 'note',
    arrows
  });
  const nodes = (c: HTMLElement) => [...c.querySelectorAll<SVGGElement>('.marker')];

  it('F1: markers without an id keep the position key (Notes tool unchanged)', async () => {
    const { container, rerender } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: model([mk({ string: 2, fret: 3 })])
    });
    const before = container.querySelector('.marker[data-key="2:3"]');
    await rerender({ instrument: STANDARD_GUITAR, model: model([mk({ string: 2, fret: 3 })]) });
    expect(container.querySelector('.marker[data-key="2:3"]')).toBe(before);
    await rerender({ instrument: STANDARD_GUITAR, model: model([mk({ string: 2, fret: 4 })]) });
    expect(container.querySelector('.marker[data-key="2:3"]')).toBeNull();
    expect(container.querySelector('.marker[data-key="2:4"]')).not.toBe(before);
  });

  it('F2: same id at a new fret reuses the DOM node with a changed transform', async () => {
    const { container, rerender } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: model([id({ string: 2, fret: 5, id: 'a:third' })])
    });
    const [node] = nodes(container);
    const t0 = node.style.transform;
    expect(t0).toMatch(/^translate\(.+px, .+px\)$/);
    await rerender({
      instrument: STANDARD_GUITAR,
      model: model([id({ string: 2, fret: 4, id: 'a:third' })])
    });
    const [after] = nodes(container);
    expect(after).toBe(node);
    expect(after.getAttribute('data-key')).toBe('2:4');
    expect(after.style.transform).not.toBe(t0);
    // The SVG attribute (the CSP-safe prerender position) follows; the inline style wins once mounted.
    const attr = after.getAttribute('transform') ?? '';
    expect(attr).toMatch(/^translate\(\S+ \S+\)$/);
    expect(after.style.transform).toBe(
      attr.replace(/translate\((\S+) (\S+)\)/, 'translate($1px, $2px)')
    );
  });

  it('F3: unchanged id, position and function keep node and transform', async () => {
    const ms = () => [
      id({ string: 3, fret: 0, id: 'a:root', function: 'root' }),
      id({ string: 2, fret: 5, id: 'a:third' })
    ];
    const { container, rerender } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: model(ms())
    });
    const before = nodes(container);
    const transforms = before.map((n) => n.style.transform);
    await rerender({ instrument: STANDARD_GUITAR, model: model(ms()) });
    const after = nodes(container);
    expect(after).toHaveLength(2);
    after.forEach((n, i) => {
      expect(n).toBe(before[i]);
      expect(n.style.transform).toBe(transforms[i]);
    });
  });

  it('F4: the slide uses the duration and easing tokens, zeroed under reduced motion', () => {
    const src = readFileSync('src/lib/fretboard/Fretboard.svelte', 'utf8');
    expect(src).toMatch(
      /\.marker\s*\{[^}]*transition:\s*transform var\(--duration-short\) var\(--ease-standard\)/s
    );
    expect(src).not.toMatch(/duration:\s*\d/);
    const tokens = readFileSync('src/lib/styles/tokens.css', 'utf8');
    expect(tokens).toMatch(/prefers-reduced-motion: reduce[\s\S]*--duration-short:\s*0s/);
  });

  describe('fades (F5)', () => {
    const animate = vi.fn();
    const proto = Element.prototype as unknown as { animate: unknown };
    const original = proto.animate;
    const stub = (value: string, reduce = false) => {
      vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
        () => ({ getPropertyValue: () => value }) as unknown as CSSStyleDeclaration
      );
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: reduce && q.includes('reduce'),
        addEventListener() {}
      }));
      proto.animate = (...args: unknown[]) => {
        animate(...args);
        return { cancel() {}, finished: Promise.resolve(), onfinish: null, currentTime: 0 };
      };
    };
    const cleanup = () => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      animate.mockReset();
      proto.animate = original;
    };

    it('comparison markers and arrows fade in using --duration-short; arrows are delayed', async () => {
      stub('300ms');
      try {
        const base = [id({ string: 2, fret: 5, id: 'a:third' })];
        const { container, rerender } = render(Fretboard, {
          instrument: STANDARD_GUITAR,
          model: model(base)
        });
        animate.mockClear();
        await rerender({
          instrument: STANDARD_GUITAR,
          model: model(
            [...base, id({ string: 2, fret: 4, id: 'a:cmp', variant: 'comparison' })],
            [{ kind: 'move', id: 'a:arrow', string: 2, fromFret: 5, toFret: 4, label: '1 fret' }]
          )
        });
        const opts = animate.mock.calls.map((c) => c[1] as { duration: number; delay: number });
        expect(opts.length).toBeGreaterThanOrEqual(2);
        // Marker fades over the token duration; the delayed arrow holds (duration 0) until the
        // marker's fade has run, then fades with the same token duration.
        expect(opts.filter((o) => o.duration === 300)).toHaveLength(1);
        expect(opts.filter((o) => o.duration === 0)).toHaveLength(1);
        // The unchanged first-triad marker does not fade.
        expect(container.querySelectorAll('.marker')).toHaveLength(2);
        expect(opts).toHaveLength(2);
      } finally {
        cleanup();
      }
    });

    it('fades are instant under reduced motion', async () => {
      stub('300ms', true);
      try {
        const { rerender } = render(Fretboard, {
          instrument: STANDARD_GUITAR,
          model: model([id({ string: 2, fret: 5, id: 'a:third' })])
        });
        animate.mockClear();
        await rerender({
          instrument: STANDARD_GUITAR,
          model: model(
            [id({ string: 2, fret: 4, id: 'a:cmp', variant: 'comparison' })],
            [{ kind: 'move', id: 'a:arrow', string: 2, fromFret: 5, toFret: 4, label: '1 fret' }]
          )
        });
        // Arrows get no transition at all; markers keep a 1 ms floor (never 0, see markerFade),
        // so nothing waits or fades for a visible time.
        for (const c of animate.mock.calls) {
          expect((c[1] as { duration: number }).duration).toBeLessThanOrEqual(1);
        }
      } finally {
        cleanup();
      }
    });
  });

  it('US5-2: a comparison-quality change slides only the changed comparison note', async () => {
    const first = [
      id({ string: 3, fret: 0, id: 'a:root', function: 'root' }),
      id({ string: 2, fret: 5, id: 'a:first:third' }),
      id({ string: 2, fret: 4, id: 'a:cmp:third', variant: 'comparison' }),
      id({ string: 1, fret: 3, id: 'a:first:fifth', function: 'fifth' }),
      id({ string: 1, fret: 2, id: 'a:cmp:fifth', variant: 'comparison', function: 'fifth' })
    ];
    const { container, rerender } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: model(first)
    });
    const before = nodes(container);
    const t = before.map((n) => n.style.transform);
    const next = first.map((m) => (m.id === 'a:cmp:fifth' ? { ...m, fret: 1 } : m));
    await rerender({ instrument: STANDARD_GUITAR, model: model(next) });
    const after = nodes(container);
    expect(after).toHaveLength(5);
    const changed = after.filter((n, i) => n.style.transform !== t[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toBe(before[4]);
    after.forEach((n, i) => expect(n).toBe(before[i]));
  });

  it('US5-4: when every id changes, old nodes are replaced and nothing slides', async () => {
    const set = (p: string, fret: number) => [
      id({ string: 3, fret, id: `${p}:root`, function: 'root' }),
      id({ string: 2, fret: fret + 1, id: `${p}:third` })
    ];
    const { container, rerender } = render(Fretboard, {
      instrument: STANDARD_GUITAR,
      model: model(set('C', 5))
    });
    const before = nodes(container);
    await rerender({ instrument: STANDARD_GUITAR, model: model(set('D', 7)) });
    const after = nodes(container);
    expect(after).toHaveLength(2);
    for (const n of after) {
      expect(before).not.toContain(n);
      expect(n.isConnected).toBe(true);
    }
    for (const n of before) expect(n.isConnected).toBe(false);
  });
});
