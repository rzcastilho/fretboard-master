import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Synth } from '../../src/lib/audio/types';
import { DEFAULT_METRICS, layoutFretboard } from '../../src/lib/fretboard/geometry';
import { STANDARD_GUITAR, type Instrument } from '../../src/lib/instrument/instrument';
import ToolPlaceholder from '../../src/lib/shell/ToolPlaceholder.svelte';
import { playback, resetPlaybackForTests } from '../../src/lib/state/playback.svelte';
import { FakeAudioPort, FakeClock } from './audio/support/fake-audio';

/** Keyboard activation: focus the cell and press Enter. */
async function press(container: Element, string: number, fret: number): Promise<void> {
  const cell = container.querySelector<SVGElement>(
    `.cell[data-string="${string}"][data-fret="${fret}"]`
  );
  if (!cell) throw new Error('cell missing');
  cell.focus();
  await fireEvent.keyDown(cell, { key: 'Enter' });
}

function pointer(el: Element, name: string, x: number, y: number): void {
  const ev = new MouseEvent(name, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperties(ev, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    isPrimary: { value: true }
  });
  el.dispatchEvent(ev);
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function injectEngine() {
  const port = new FakeAudioPort();
  const pitches: number[] = [];
  const synth: Synth = {
    renderVoice(pitch, _sr, length) {
      pitches.push(pitch);
      return new Float32Array(length);
    },
    mixVoices: (v) => v[0]
  };
  resetPlaybackForTests({
    createContext: () => port,
    loadSynth: () => Promise.resolve(synth),
    clock: new FakeClock()
  });
  playback.preload();
  return { port, pitches };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ToolPlaceholder playback wiring', () => {
  it('a pointer tap calls playback.note with the (string, fret) and instrument in use', async () => {
    injectEngine();
    await flush();
    const spy = vi.spyOn(playback, 'note');
    render(ToolPlaceholder, { tool: 'notes' });
    const layout = layoutFretboard(STANDARD_GUITAR, DEFAULT_METRICS, 0, 'interactive');
    const svg = screen.getByRole('grid', { name: 'Fretboard' });
    const x = layout.columns[0].center;
    const y = layout.rows[5].center;
    pointer(svg, 'pointerdown', x, y);
    pointer(svg, 'pointerup', x, y);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ string: 6, fret: 0 }, STANDARD_GUITAR);
  });

  it('keyboard activation (Enter on a focused cell) plays that cell', async () => {
    const { pitches } = injectEngine();
    await flush();
    const { container } = render(ToolPlaceholder, { tool: 'notes' });
    await press(container, 5, 3);
    expect(pitches).toEqual([48]);
  });

  it('a non-standard injected instrument sounds a different pitch for the same fret (US1-3)', async () => {
    const standard = injectEngine();
    await flush();
    const first = render(ToolPlaceholder, { tool: 'notes', instrument: STANDARD_GUITAR });
    await press(first.container, 6, 0);
    expect(standard.pitches).toEqual([40]);
    first.unmount();

    const dropD: Instrument = {
      ...STANDARD_GUITAR,
      openStrings: [
        ...STANDARD_GUITAR.openStrings.slice(0, 5),
        { letter: 'D', accidental: 0, octave: 2 }
      ]
    };
    const alt = injectEngine();
    await flush();
    const second = render(ToolPlaceholder, { tool: 'notes', instrument: dropD });
    await press(second.container, 6, 0);
    expect(alt.pitches).toEqual([38]);
  });
});
