// @vitest-environment jsdom
import { must } from '../must';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openTriadsFromCaged = vi.hoisted(() => vi.fn(async () => {}));
const openTriadsFromCagedTriad = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../../src/lib/state/links.svelte', async (orig) => ({
  ...(await orig<object>()),
  openTriadsFromCaged,
  openTriadsFromCagedTriad
}));

import { AF_1_12, AF_1_24, AF_8 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import { playback } from '../../../src/lib/state/playback.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import CagedTool from '../../../src/lib/tools/caged/CagedTool.svelte';

beforeEach(() => {
  openTriadsFromCagedTriad.mockClear();
  resetPreferencesForTests();
  resetCagedForTests();
  resetInstrumentForTests();
});

describe('CagedTool', () => {
  it('shows the key heading and the fretboard with the CAGED model', () => {
    render(CagedTool);
    expect(screen.getByText('C major')).toBeTruthy();
    const board = screen.getByRole('region', { name: 'Fretboard' });
    expect(within(board).getByRole('grid', { name: 'Fretboard' })).toBeTruthy();
    expect(within(board).getAllByText('C shape · roots on strings 5, 2').length).toBeGreaterThan(0);
    expect(within(board).getAllByText('D shape · roots on strings 4, 2').length).toBeGreaterThan(0);
  });

  it('has the Labels group (017) but no connection, focus or link buttons', () => {
    render(CagedTool);
    const labels = screen.getByRole('radiogroup', { name: 'Labels' });
    expect(
      within(labels)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label') ?? r.textContent?.trim())
    ).toEqual(['Intervals', 'Note names']);
    for (const name of [/layer/i, /connect/i, /focus/i, /link/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByRole('radio', { name })).toBeNull();
      expect(screen.queryByRole('checkbox', { name })).toBeNull();
    }
    // Board buttons: the nine toggle tags, then the description and Legend toggles.
    const buttons = within(screen.getByRole('region', { name: 'Fretboard' })).queryAllByRole(
      'button'
    );
    expect(buttons.filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(9);
    expect(buttons.map((b) => b.textContent?.trim()).slice(-2)).toEqual([
      'Describe this view',
      'Legend'
    ]);
  });

  describe('key selection (US2)', () => {
    const keyGroup = () => screen.getByRole('group', { name: 'Key' });

    it('offers a labelled group of 12 keys in chromatic order from C', () => {
      render(CagedTool);
      const keys = within(keyGroup()).getAllByRole('button');
      expect(keys).toHaveLength(12);
      expect(keys[0].getAttribute('aria-label')).toBe('C');
      expect(keys[7].getAttribute('aria-label')).toBe('G');
      expect(keys.filter((k) => k.getAttribute('aria-pressed') === 'true')).toEqual([keys[0]]);
    });

    it('shows Switch only for altered roots, labelled with noteLabel glyphs', async () => {
      render(CagedTool);
      expect(screen.queryByRole('button', { name: /^Switch to/ })).toBeNull();
      await fireEvent.click(within(keyGroup()).getAllByRole('button')[1]);
      const sw = screen.getByRole('button', { name: 'Switch to C♯' });
      expect(screen.getByText('D♭ major')).toBeTruthy();
      await fireEvent.click(sw);
      expect(screen.getByText('C♯ major')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Switch to D♭' })).toBeTruthy();
    });

    it('selecting a key updates heading and tags', async () => {
      render(CagedTool);
      await fireEvent.click(within(keyGroup()).getAllByRole('button')[7]);
      expect(screen.getByText('G major')).toBeTruthy();
      const board = screen.getByRole('region', { name: 'Fretboard' });
      expect(
        within(board).getAllByText('G shape · roots on strings 6, 3, 1').length
      ).toBeGreaterThan(0);
    });
  });

  describe('quality (US3)', () => {
    const quality = () => screen.getByRole('radiogroup', { name: 'Quality' });

    it('offers Major / Minor, defaults to Major', () => {
      render(CagedTool);
      const radios = within(quality()).getAllByRole('radio');
      expect(radios.map((r) => r.textContent?.trim())).toEqual(['Major', 'Minor']);
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    });

    it('changing it updates tags and heading', async () => {
      render(CagedTool);
      await fireEvent.click(within(quality()).getByRole('radio', { name: 'Minor' }));
      expect(screen.getByText('C minor')).toBeTruthy();
      const board = screen.getByRole('region', { name: 'Fretboard' });
      expect(within(board).getAllByText('Cm shape · roots on strings 5, 2').length).toBeGreaterThan(
        0
      );
      expect(
        within(quality()).getByRole('radio', { name: 'Minor' }).getAttribute('aria-checked')
      ).toBe('true');
    });
  });

  describe('fit note (US4)', () => {
    it('renders a status paragraph only when fewer than five shapes fit', () => {
      caged.useInstrument(AF_1_12);
      render(CagedTool);
      const note = within(screen.getByRole('region', { name: 'Fretboard' })).getByRole('status');
      expect(note.tagName).toBe('P');
      expect(note.textContent).toBe('With 12 frets, 4 shapes fit on the fretboard');
    });

    it('is absent at 22 frets', () => {
      render(CagedTool);
      expect(screen.queryByText(/shapes fit on the fretboard/)).toBeNull();
    });
  });

  describe('non-compatible tunings (slice 015 US1)', () => {
    const NOTICE =
      "CAGED depends on the standard relationship between the strings, so its shapes don't exist in Open G.";

    it('shows the notice and two buttons in zone C, keeping the controls', () => {
      resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
      render(CagedTool);
      const zone = screen.getByRole('region', { name: 'Fretboard' });
      const note = within(zone).getByRole('status');
      expect(note.tagName).toBe('P');
      expect(note.textContent).toBe(NOTICE);
      expect(within(zone).queryByRole('grid')).toBeNull();
      expect(within(zone).queryByText(/shape ·/)).toBeNull();
      expect(within(zone).queryByText(/shapes fit/)).toBeNull();
      expect(
        within(zone)
          .getAllByRole('button')
          .map((b) => b.textContent?.trim())
      ).toEqual(['View in standard tuning', 'Go to Triads']);
      expect(screen.getByText('C major')).toBeTruthy();
      const keys = within(screen.getByRole('group', { name: 'Key' })).getAllByRole('button');
      expect(keys[0].getAttribute('aria-pressed')).toBe('true');
      expect(
        within(screen.getByRole('radiogroup', { name: 'Quality' }))
          .getByRole('radio', { name: 'Major' })
          .getAttribute('aria-checked')
      ).toBe('true');
    });

    it('View in standard tuning calls viewInStandard and focuses zone C', async () => {
      resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
      const spy = vi.spyOn(caged, 'viewInStandard');
      render(CagedTool);
      await fireEvent.click(screen.getByRole('button', { name: 'View in standard tuning' }));
      expect(spy).toHaveBeenCalledTimes(1);
      await tick();
      expect(document.activeElement?.id).toBe('caged-zone-c');
      spy.mockRestore();
    });

    it('Go to Triads calls openTriadsFromCaged', async () => {
      resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
      render(CagedTool);
      await fireEvent.click(screen.getByRole('button', { name: 'Go to Triads' }));
      expect(openTriadsFromCaged).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reset tool (US6)', () => {
    it('is a button in zone D that calls caged.reset()', async () => {
      render(CagedTool);
      caged.selectRoot(7);
      const button = screen.getByRole('button', { name: 'Reset tool' });
      await fireEvent.click(button);
      expect(caged.state.rootPc).toBe(0);
      expect(screen.getByText('C major')).toBeTruthy();
    });
  });

  describe('shape focus (016 US1)', () => {
    const board = () => screen.getByRole('region', { name: 'Fretboard' });
    const tagButtons = () =>
      within(board())
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed'));
    const shapeGroup = () => screen.getByRole('radiogroup', { name: 'Shape' });

    it('tags are toggle buttons named by their text, in neck order', () => {
      render(CagedTool);
      const tags = tagButtons();
      expect(tags).toHaveLength(9);
      expect(tags[0].getAttribute('aria-label')).toBe('C shape · roots on strings 5, 2');
      expect(tags[3].getAttribute('aria-label')).toBe('E shape · roots on strings 6, 4, 1');
      expect(tags.every((t) => t.getAttribute('aria-pressed') === 'false')).toBe(true);
    });

    it('offers C A G E D then See all; See all is checked with no focus', () => {
      render(CagedTool);
      const radios = within(shapeGroup()).getAllByRole('radio');
      expect(radios.map((r) => r.textContent?.trim())).toEqual([
        'C',
        'A',
        'G',
        'E',
        'D',
        'See all'
      ]);
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
        'false',
        'false',
        'false',
        'false',
        'false',
        'true'
      ]);
    });

    it('tag activation and selector choice show the same state', async () => {
      render(CagedTool);
      await fireEvent.click(tagButtons()[3]);
      await tick();
      expect(tagButtons()[3].getAttribute('aria-pressed')).toBe('true');
      expect(
        within(shapeGroup()).getByRole('radio', { name: 'E' }).getAttribute('aria-checked')
      ).toBe('true');
      // Second press leaves focus.
      await fireEvent.click(tagButtons()[3]);
      await tick();
      expect(
        within(shapeGroup()).getByRole('radio', { name: 'See all' }).getAttribute('aria-checked')
      ).toBe('true');

      await fireEvent.click(within(shapeGroup()).getByRole('radio', { name: 'G' }));
      await tick();
      expect(tagButtons()[2].getAttribute('aria-pressed')).toBe('true');
      expect(tagButtons().filter((t) => t.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
      await fireEvent.click(within(shapeGroup()).getByRole('radio', { name: 'See all' }));
      await tick();
      expect(tagButtons().every((t) => t.getAttribute('aria-pressed') === 'false')).toBe(true);
    });

    it('undrawn letters are aria-disabled (12 frets omits D)', () => {
      caged.useInstrument(AF_1_12);
      render(CagedTool);
      const d = within(shapeGroup()).getByRole('radio', { name: 'D' });
      expect(d.getAttribute('aria-disabled')).toBe('true');
      expect(
        within(shapeGroup()).getByRole('radio', { name: 'E' }).getAttribute('aria-disabled')
      ).toBeNull();
    });

    it('the whole group is aria-disabled for a non-compatible tuning', () => {
      caged.useInstrument(AF_8, { kind: 'preset', id: 'AF-8' });
      render(CagedTool);
      expect(shapeGroup().getAttribute('aria-disabled')).toBe('true');
    });

    it('shows the adjusted notice when adjustedIn is caged', async () => {
      caged.chooseShape('A');
      caged.toggleTag('A@15');
      render(CagedTool);
      expect(screen.queryByText('We adjusted the view to the new instrument')).toBeNull();
      instrument.open();
      instrument.setFrets(12);
      instrument.confirm('caged');
      await tick();
      expect(instrument.adjustedIn).toBe('caged');
      expect(screen.getByText('We adjusted the view to the new instrument')).toBeTruthy();
    });
  });
  describe('step buttons (016 US2)', () => {
    const prev = () => screen.getByRole('button', { name: 'Previous shape' });
    const next = () => screen.getByRole('button', { name: 'Next shape' });
    const disabled = (b: HTMLElement) => b.getAttribute('aria-disabled') === 'true';

    it('are always rendered, Previous first, and in the tab order', () => {
      render(CagedTool);
      const all = screen.getAllByRole('button');
      expect(all.indexOf(prev())).toBeGreaterThanOrEqual(0);
      expect(all.indexOf(next())).toBe(all.indexOf(prev()) + 1);
      expect(prev().getAttribute('tabindex')).not.toBe('-1');
      expect(next().getAttribute('tabindex')).not.toBe('-1');
      expect(prev().hasAttribute('disabled')).toBe(false);
    });

    it('both aria-disabled with no focus', () => {
      render(CagedTool);
      expect(disabled(prev())).toBe(true);
      expect(disabled(next())).toBe(true);
    });

    it('both aria-disabled for a non-compatible tuning', () => {
      caged.useInstrument(AF_8, { kind: 'preset', id: 'AF-8' });
      render(CagedTool);
      expect(disabled(prev())).toBe(true);
      expect(disabled(next())).toBe(true);
    });

    it.each([
      ['12 frets', AF_1_12],
      ['22 frets', undefined],
      ['24 frets', AF_1_24]
    ])('Previous is disabled at index 0 and Next at the last index (%s)', async (_n, inst) => {
      if (inst) caged.useInstrument(inst);
      render(CagedTool);
      const occs = caged.display.occurrences;
      const id = (i: number) => `${occs[i].shape.id}@${occs[i].start}`;
      caged.toggleTag(id(0));
      await tick();
      expect(disabled(prev())).toBe(true);
      expect(disabled(next())).toBe(false);
      caged.toggleTag(id(occs.length - 1));
      await tick();
      expect(disabled(prev())).toBe(false);
      expect(disabled(next())).toBe(true);
    });

    it('labels never flip for left-handed or orientation', async () => {
      caged.applyInstrument(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top'), {
        kind: 'preset',
        id: 'AF-1'
      });
      render(CagedTool);
      const all = screen.getAllByRole('button');
      expect(all.indexOf(next())).toBe(all.indexOf(prev()) + 1);
    });

    it('activating a disabled button does nothing', async () => {
      render(CagedTool);
      await fireEvent.click(next());
      expect(caged.state.focus).toBeNull();
    });

    it('pressing Next moves the focus and shows the ring for the window', async () => {
      vi.useFakeTimers();
      try {
        caged.chooseShape('E');
        const { container } = render(CagedTool);
        await fireEvent.click(next());
        await tick();
        expect(caged.display.focused?.shape.id).toBe('D');
        expect(container.querySelector('.marker[data-key="4:10"] .connection-ring')).toBeTruthy();
        vi.advanceTimersByTime(500);
        await tick();
        expect(container.querySelector('.connection-ring')).toBeNull();
        await fireEvent.click(prev());
        await tick();
        expect(caged.display.focused?.shape.id).toBe('E');
        expect(container.querySelector('.connection-ring')).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('CagedTool: Show connections (016 US3)', () => {
  const sw = () => screen.getByRole('switch', { name: 'Show connections' });

  it('renders an off-by-default switch before Reset tool', () => {
    render(CagedTool);
    expect(sw().getAttribute('aria-checked')).toBe('false');
    const reset = screen.getByRole('button', { name: 'Reset tool' });
    expect(sw().compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sw().nextElementSibling).toBe(reset);
  });

  it('toggles on click, rings markers, and shows a visible position', async () => {
    const { container } = render(CagedTool);
    expect(container.querySelector('.connection-ring')).toBeNull();
    await fireEvent.click(sw());
    await tick();
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(container.querySelectorAll('.connection-ring').length).toBe(
      caged.display.connections.length
    );
    // Position shown by text, not color alone.
    expect(sw().querySelector('.switch-track')).toBeTruthy();
    expect(sw().textContent).toMatch(/On/i);
    await fireEvent.click(sw());
    await tick();
    expect(sw().textContent).toMatch(/Off/i);
  });

  it('is aria-disabled with its value kept for a non-compatible tuning', async () => {
    caged.setConnections(true);
    caged.applyInstrument(AF_8, { kind: 'preset', id: 'AF-8' });
    render(CagedTool);
    expect(sw().getAttribute('aria-disabled')).toBe('true');
    expect(sw().getAttribute('aria-checked')).toBe('true');
    await fireEvent.click(sw());
    expect(caged.state.connections).toBe(true);
  });

  it('Reset tool turns it off', async () => {
    render(CagedTool);
    await fireEvent.click(sw());
    await fireEvent.click(screen.getByRole('button', { name: 'Reset tool' }));
    await tick();
    expect(sw().getAttribute('aria-checked')).toBe('false');
  });
});

describe('CagedTool: no phone notice', () => {
  it('shows no notice at portrait size (390×844)', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    render(CagedTool);
    await tick();
    expect(screen.queryByText(/phone/i)).toBeNull();
    expect(document.querySelector('.notice')).toBeNull();
  });
});

describe('CagedLayerList (US2)', () => {
  const layerSwitches = () => {
    const group = screen.getByRole('group', { name: 'Layers' });
    return within(group).getAllByRole('switch');
  };

  it('lists Chord, Arpeggio, Pentatonic, Scale, Triad in order as switches', () => {
    render(CagedTool);
    const sw = layerSwitches();
    expect(sw.map((s) => s.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Chord On',
      'Arpeggio Off',
      'Pentatonic Off',
      'Scale Off',
      'Triad Off'
    ]);
    expect(sw.map((s) => s.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false'
    ]);
    for (const s of sw) expect(s.getAttribute('type')).toBe('button');
  });

  it('Chord starts disabled with the last-layer reason; the others are enabled', () => {
    render(CagedTool);
    const [chord, arpeggio] = layerSwitches();
    expect(chord.getAttribute('aria-disabled')).toBe('true');
    const reason = document.getElementById(chord.getAttribute('aria-describedby') as string);
    expect(reason?.textContent).toBe('At least one layer stays on.');
    expect(arpeggio.getAttribute('aria-disabled')).toBeNull();
  });

  it('a disabled switch stays focusable and does nothing on activate', async () => {
    render(CagedTool);
    const [chord] = layerSwitches();
    chord.focus();
    expect(document.activeElement).toBe(chord);
    await fireEvent.click(chord);
    expect(caged.state.layers.chord).toBe(true);
  });

  it('activating a switch toggles the layer and the checked state', async () => {
    render(CagedTool);
    const sw = layerSwitches();
    await fireEvent.click(sw[1]);
    await tick();
    expect(caged.state.layers.arpeggio).toBe(true);
    expect(layerSwitches()[1].getAttribute('aria-checked')).toBe('true');
    // Chord is no longer the last layer.
    expect(layerSwitches()[0].getAttribute('aria-disabled')).toBeNull();
  });

  it('every switch is disabled with the no-shapes reason in a non-compatible tuning', async () => {
    render(CagedTool);
    caged.applyInstrument(AF_8, { kind: 'preset', id: 'AF-8' });
    await tick();
    for (const s of layerSwitches()) {
      expect(s.getAttribute('aria-disabled')).toBe('true');
      const reason = document.getElementById(s.getAttribute('aria-describedby') as string);
      expect(reason?.textContent).toBe('Layers need a CAGED shape on the fretboard.');
    }
  });

  it('shows the second Scale sample only when Pentatonic and Scale are both on', async () => {
    render(CagedTool);
    const samples = () => layerSwitches()[3].querySelectorAll('svg.marker-sample').length;
    expect(samples()).toBe(1);
    await fireEvent.click(layerSwitches()[2]);
    await fireEvent.click(layerSwitches()[3]);
    await tick();
    expect(samples()).toBe(2);
  });

  it('sample markers are aria-hidden, 44 by 44, and mirror the board tokens', () => {
    render(CagedTool);
    const sw = layerSwitches();
    for (const s of sw) {
      const svg = s.querySelector('svg.marker-sample');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('width')).toBe('44');
      expect(svg?.getAttribute('height')).toBe('44');
    }
    const shape = (i: number) => sw[i].querySelector('svg.marker-sample .shape') as SVGElement;
    // Arpeggio sample uses the same token-driven transform and opacity as an arpeggio board marker.
    expect(sw[1].querySelector('svg.marker-sample')?.classList.contains('layer-arpeggio')).toBe(
      true
    );
    expect(shape(1).style.transform).toBe('scale(var(--marker-layer-scale))');
    expect(shape(1).style.opacity).toBe('var(--marker-layer-opacity)');
    expect(shape(0).style.transform).toBe('');
  });
});

describe('Triad layer controls (018 US1)', () => {
  const triadSwitch = () => screen.getByRole('switch', { name: /^Triad/ });

  it('the Triad switch is the last row, role switch, with a triad sample', () => {
    render(CagedTool);
    const group = screen.getByRole('group', { name: 'Layers' });
    const sw = within(group).getAllByRole('switch');
    expect(sw.at(-1)).toBe(triadSwitch());
    expect(triadSwitch().getAttribute('role')).toBe('switch');
    expect(triadSwitch().querySelector('svg.marker-sample.layer-triad')).not.toBeNull();
  });

  it('the selector is hidden until Triad is on and a shape is focused', async () => {
    render(CagedTool);
    expect(screen.queryByRole('radiogroup', { name: 'Triad strings' })).toBeNull();
    await fireEvent.click(triadSwitch());
    await tick();
    // Turning Triad on focuses a shape.
    expect(caged.state.focus).not.toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Triad strings' })).toBeTruthy();
    await fireEvent.click(triadSwitch());
    await tick();
    expect(screen.queryByRole('radiogroup', { name: 'Triad strings' })).toBeNull();
  });

  it('lists the string sets bass to treble with the selected one checked, and a summary', async () => {
    render(CagedTool);
    caged.chooseShape('A');
    await fireEvent.click(triadSwitch());
    await tick();
    const group = screen.getByRole('radiogroup', { name: 'Triad strings' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent?.trim())).toEqual([
      '6-5-4',
      '5-4-3 ✕',
      '4-3-2',
      '3-2-1'
    ]);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true'
    ]);
    expect(screen.getByText('C major, root position, strings 3-2-1, frets 5-5-3')).toBeTruthy();
  });

  it('choosing another set selects it', async () => {
    render(CagedTool);
    caged.chooseShape('A');
    await fireEvent.click(triadSwitch());
    await tick();
    const group = screen.getByRole('radiogroup', { name: 'Triad strings' });
    await fireEvent.click(within(group).getByRole('radio', { name: '4-3-2' }));
    await tick();
    expect(caged.state.triadSet).toBe(4);
    expect(
      within(screen.getByRole('radiogroup', { name: 'Triad strings' }))
        .getByRole('radio', { name: '4-3-2' })
        .getAttribute('aria-checked')
    ).toBe('true');
  });
});

describe('Open in Triads (018 US3)', () => {
  const triadSwitch = () => screen.getByRole('switch', { name: /^Triad/ });
  const openButton = () => screen.queryByRole('button', { name: 'Open in Triads' });

  it('is absent until a triad is drawn', async () => {
    render(CagedTool);
    expect(openButton()).toBeNull();
    caged.chooseShape('A');
    await tick();
    expect(openButton()).toBeNull();
  });

  it('is shown while a triad is drawn, with a 44px target, and activates once', async () => {
    render(CagedTool);
    caged.chooseShape('A');
    await fireEvent.click(triadSwitch());
    await tick();
    expect(caged.display.triad?.handoff).not.toBeNull();
    const btn = must(openButton());
    expect(btn).toBeTruthy();
    expect(btn.classList.contains('open-triads')).toBe(true);
    await fireEvent.click(btn);
    expect(openTriadsFromCagedTriad).toHaveBeenCalledTimes(1);
  });

  it('is absent again once Triad is turned off', async () => {
    render(CagedTool);
    caged.chooseShape('A');
    await fireEvent.click(triadSwitch());
    await tick();
    expect(caged.display.triad?.handoff).not.toBeNull();
    // Triad off again: selector and shortcut go away.
    await fireEvent.click(triadSwitch());
    await tick();
    expect(openButton()).toBeNull();
  });

  it('is absent in the temporary standard view', async () => {
    resetCagedForTests(AF_8, { kind: 'preset', id: 'AF-8' });
    render(CagedTool);
    await fireEvent.click(screen.getByRole('button', { name: 'View in standard tuning' }));
    await tick();
    caged.chooseShape('A');
    await fireEvent.click(triadSwitch());
    await tick();
    expect(caged.display.triad?.handoff ?? null).toBeNull();
    expect(openButton()).toBeNull();
  });
});

describe('CagedTool: Listen button (019 US1)', () => {
  it('renders caged_listen and is enabled when a shape is drawn', () => {
    render(CagedTool);
    const b = screen.getByRole('button', { name: 'Listen' });
    expect(b.getAttribute('aria-disabled')).toBeNull();
  });

  it('is aria-disabled, focusable and described by the visible reason when no shape fits', async () => {
    caged.applyInstrument(AF_8, { kind: 'preset', id: 'AF-8' });
    render(CagedTool);
    const b = screen.getByRole('button', { name: 'Listen' });
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.hasAttribute('disabled')).toBe(false);
    b.focus();
    expect(document.activeElement).toBe(b);
    const reason = document.getElementById(must(b.getAttribute('aria-describedby')));
    expect(reason?.textContent?.trim()).toBeTruthy();
    expect(reason?.textContent).toBe(caged.display.listen.reason);
  });

  it('announces the playing layer and shape (empty while idle)', async () => {
    const playing = vi.spyOn(playback, 'sequencePlaying', 'get').mockReturnValue(true);
    vi.spyOn(playback, 'timeline').mockImplementation(() => []);
    caged.chooseShape('E');
    render(CagedTool);
    const status = () => document.querySelector('[data-listen-status]');
    expect(status()?.getAttribute('role')).toBe('status');
    expect(status()?.textContent?.trim()).toBe('');
    await fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    await tick();
    expect(status()?.textContent?.trim()).toBe('Playing: Chord, E shape');
    caged.chooseShape('all');
    await fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    await tick();
    expect(status()?.textContent?.trim()).toBe('Playing every shape');
    playing.mockRestore();
    vi.restoreAllMocks();
  });
});

describe('CagedTool: Tempo radiogroup (019 US2)', () => {
  const radios = () =>
    within(screen.getByRole('radiogroup', { name: 'Tempo' })).getAllByRole('radio');

  it('is labelled Tempo and offers Slow, Medium and Fast', () => {
    render(CagedTool);
    expect(radios().map((r) => r.textContent?.trim())).toEqual(['Slow', 'Medium', 'Fast']);
  });

  it('has Medium selected by default', () => {
    render(CagedTool);
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
  });

  it('arrow keys move the selection and the store', async () => {
    render(CagedTool);
    const medium = must(radios()[1]);
    medium.focus();
    await fireEvent.keyDown(medium, { key: 'ArrowRight' });
    await tick();
    expect(caged.tempo).toBe('fast');
    expect(radios()[2].getAttribute('aria-checked')).toBe('true');
    await fireEvent.keyDown(radios()[2], { key: 'ArrowLeft' });
    await fireEvent.keyDown(radios()[1], { key: 'ArrowLeft' });
    await tick();
    expect(caged.tempo).toBe('slow');
  });

  it('clicking an option selects it', async () => {
    render(CagedTool);
    await fireEvent.click(must(radios()[0]));
    await tick();
    expect(caged.tempo).toBe('slow');
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
  });
});
