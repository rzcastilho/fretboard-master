import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_1_12, AF_1_24, AF_8 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR, withPresentation } from '../../../src/lib/instrument/instrument';
import { readFileSync } from 'node:fs';
import { REVEAL_WINDOW_MS, caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { sharedPositions } from '../../../src/lib/theory/caged';

beforeEach(() => {
  resetPlaybackForTests();
  resetCagedForTests();
});

describe('caged store (US1)', () => {
  it('starts on C major with a display for the instrument', () => {
    expect(caged.state).toEqual({
      rootPc: 0,
      spellingOverride: 'none',
      quality: 'major',
      focus: null,
      connections: false,
      layers: { chord: true, arpeggio: false, pentatonic: false, scale: false },
      labelType: 'interval'
    });
    expect(caged.instrument).toBe(STANDARD_GUITAR);
    expect(caged.display.keyName).toBe('C major');
    expect(caged.display.model?.tags).toHaveLength(9);
  });

  it('activate plays the note and leaves state unchanged', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => undefined as never);
    const before = caged.state;
    caged.activate({ string: 5, fret: 3 });
    expect(note).toHaveBeenCalledWith({ string: 5, fret: 3 }, STANDARD_GUITAR);
    expect(caged.state).toBe(before);
    note.mockRestore();
  });
});

describe('caged store: instrument changes (US4)', () => {
  it('keeps key, quality and override; recomputes display; returns false', () => {
    caged.selectRoot(1);
    caged.setQuality('minor');
    const before = caged.state;
    expect(caged.applyInstrument(AF_1_12, 'Standard')).toBe(false);
    expect(caged.state).toBe(before);
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.fitNote).toBe('With 12 frets, 4 shapes fit on the fretboard');
  });

  it('redraws for handedness and orientation changes', () => {
    const base = caged.display.model;
    caged.applyInstrument(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top'), 'Standard');
    expect(caged.display.model).toEqual(base);
    expect(caged.instrument.handedness).toBe('left');
    expect(caged.instrument.orientation).toBe('lowest-top');
  });
});

describe('caged store: session and reset (US6)', () => {
  it('reset gives C major with no override and keeps the instrument', () => {
    caged.useInstrument(AF_1_12);
    caged.selectRoot(10);
    caged.switchSpelling();
    caged.setQuality('minor');
    caged.reset();
    expect(caged.state).toEqual({
      rootPc: 0,
      spellingOverride: 'none',
      quality: 'major',
      focus: null,
      connections: false,
      layers: { chord: true, arpeggio: false, pentatonic: false, scale: false },
      labelType: 'interval'
    });
    expect(caged.instrument).toBe(AF_1_12);
  });

  it('a view change stops playback with reason view; a no-op does not', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.setQuality('major');
    expect(stop).not.toHaveBeenCalled();
    caged.selectRoot(7);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });
});

describe('caged store: tuning name (slice 015)', () => {
  it('applyInstrument stores preferred and tuningName, keeps the view, returns false', () => {
    caged.selectRoot(3);
    const before = caged.state;
    expect(caged.applyInstrument(AF_1_12, 'Standard')).toBe(false);
    expect(caged.state).toBe(before);
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Standard');
    expect(caged.applyInstrument(AF_1_12, 'Drop D')).toBe(false);
    expect(caged.display.tuningName).toBe('Drop D');
  });

  it('useInstrument(next, tuningName) applies the name', () => {
    caged.useInstrument(AF_1_12, 'Half step down');
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Half step down');
  });

  it('resetCagedForTests(next, tuningName) sets both', () => {
    resetCagedForTests(AF_1_12, 'Custom');
    expect(caged.instrument).toBe(AF_1_12);
    expect(caged.display.tuningName).toBe('Custom');
  });
});

describe('caged store: temporary standard view (slice 015 US1)', () => {
  const openG = () => resetCagedForTests(AF_8, 'Open G');

  it('viewInStandard is a no-op unless the class is non-compatible', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.viewInStandard();
    expect(caged.temporary).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('viewInStandard keeps the view, goes compatible and stops playback once', () => {
    openG();
    caged.selectRoot(7);
    caged.setQuality('minor');
    const before = caged.state;
    expect(caged.display.tuningClass).toBe('non-compatible');
    const stop = vi.spyOn(playback, 'stop');
    caged.viewInStandard();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith('instrument');
    expect(caged.state).toBe(before);
    expect(caged.temporary).toBe(true);
    expect(caged.display.tuningClass).toBe('compatible');
    expect(caged.display.temporaryName).toBe('Standard');
    expect(caged.instrument.openStrings).toEqual(STANDARD_GUITAR.openStrings);
    caged.viewInStandard();
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });

  it('key, quality, spelling and reset keep temporary', () => {
    openG();
    caged.viewInStandard();
    caged.selectRoot(1);
    expect(caged.temporary).toBe(true);
    caged.switchSpelling();
    expect(caged.temporary).toBe(true);
    caged.setQuality('minor');
    expect(caged.temporary).toBe(true);
    caged.reset();
    expect(caged.temporary).toBe(true);
  });

  it('screenChanged and endTemporary clear it', () => {
    openG();
    caged.viewInStandard();
    caged.screenChanged();
    expect(caged.temporary).toBe(false);
    expect(caged.display.tuningClass).toBe('non-compatible');
    caged.viewInStandard();
    caged.endTemporary();
    expect(caged.temporary).toBe(false);
    expect(caged.display.temporaryName).toBeNull();
  });

  it('activate plays on the standard instrument while temporary', () => {
    openG();
    caged.viewInStandard();
    const note = vi.spyOn(playback, 'note').mockImplementation(() => undefined as never);
    caged.activate({ string: 5, fret: 3 });
    expect(note).toHaveBeenCalledWith({ string: 5, fret: 3 }, caged.instrument);
    expect(caged.instrument).not.toBe(AF_8);
    note.mockRestore();
  });
});

describe('caged store: shape focus (016 US1)', () => {
  it('chooseShape focuses ordinal 0, keeps an already-focused letter, and "all" clears', () => {
    caged.chooseShape('E');
    expect(caged.state.focus).toEqual({ letter: 'E', ordinal: 0 });
    const f = caged.state.focus;
    caged.chooseShape('E');
    expect(caged.state.focus).toBe(f);
    caged.chooseShape('all');
    expect(caged.state.focus).toBeNull();
  });

  it('toggleTag toggles the exact occurrence; unknown ids do nothing', () => {
    caged.toggleTag('C@12');
    expect(caged.state.focus).toEqual({ letter: 'C', ordinal: 1 });
    caged.chooseShape('C'); // already on C: unchanged
    expect(caged.state.focus).toEqual({ letter: 'C', ordinal: 1 });
    caged.toggleTag('E@8');
    expect(caged.state.focus).toEqual({ letter: 'E', ordinal: 0 });
    caged.toggleTag('E@8');
    expect(caged.state.focus).toBeNull();
    caged.toggleTag('Z@1');
    caged.toggleTag('E@9');
    expect(caged.state.focus).toBeNull();
  });

  it('focus changes do not stop playback', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.chooseShape('G');
    caged.toggleTag('G@5');
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('selectRoot and setQuality re-resolve focus; spelling change keeps it', () => {
    caged.chooseShape('E');
    caged.selectRoot(7);
    expect(caged.state.focus).toEqual({ letter: 'E', ordinal: 0 });
    caged.setQuality('minor');
    expect(caged.state.focus?.letter).toBe('E');
    caged.selectRoot(1);
    const f = caged.state.focus;
    caged.switchSpelling();
    expect(caged.state.focus).toEqual(f);
  });

  it('reset clears focus', () => {
    caged.chooseShape('A');
    caged.reset();
    expect(caged.state.focus).toBeNull();
  });

  it('applyInstrument: true when the focused occurrence moves (24 → 12 frets, A@15)', () => {
    resetCagedForTests(AF_1_24);
    caged.toggleTag('A@15');
    expect(caged.state.focus).toEqual({ letter: 'A', ordinal: 1 });
    expect(caged.applyInstrument(AF_1_12, 'Standard')).toBe(true);
    expect(caged.display.focused?.shape.id).toBe('A');
    expect(caged.display.focused?.start).toBe(3);
  });

  it('applyInstrument: presentation-only changes keep focus and return false', () => {
    caged.chooseShape('E');
    const f = caged.state.focus;
    expect(
      caged.applyInstrument(withPresentation(STANDARD_GUITAR, 'left', 'lowest-top'), 'Standard')
    ).toBe(false);
    expect(caged.state.focus).toEqual(f);
  });

  it('applyInstrument: a non-compatible tuning clears focus and returns false', () => {
    caged.chooseShape('E');
    expect(caged.applyInstrument(AF_8, 'Open G')).toBe(false);
    expect(caged.state.focus).toBeNull();
  });

  it('endTemporary clears focus when the preferred tuning is non-compatible', () => {
    resetCagedForTests(AF_8, 'Open G');
    caged.viewInStandard();
    caged.chooseShape('E');
    expect(caged.state.focus?.letter).toBe('E');
    caged.endTemporary();
    expect(caged.state.focus).toBeNull();
  });

  it('never writes focus to storage', () => {
    const before = JSON.stringify({ ...localStorage });
    caged.chooseShape('E');
    caged.toggleTag('C@0');
    expect(JSON.stringify({ ...localStorage })).toBe(before);
  });
});

describe('caged store: step transition (016 US2)', () => {
  const ring = () => caged.display.model?.markers.filter((mk) => mk.ring === true) ?? [];

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('step(1) from E moves focus to D and rings the shared positions for 500 ms', () => {
    caged.chooseShape('E');
    caged.step(1);
    expect(caged.display.focused?.shape.id).toBe('D');
    expect(caged.transition?.positions).toContain('4:10');
    expect(ring().map((mk) => mk.id)).toContain('4:10');
    vi.advanceTimersByTime(499);
    expect(caged.transition).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(caged.transition).toBeNull();
    expect(ring()).toHaveLength(0);
  });

  it('the transition equals sharedPositions(departing, arriving)', () => {
    caged.chooseShape('E');
    const from = caged.display.focused;
    caged.step(1);
    const to = caged.display.focused;
    if (!from || !to) throw new Error('expected focus');
    const expected = sharedPositions(from, to).map((n) => `${n.string}:${n.fret}`);
    expect([...(caged.transition?.positions ?? [])].sort()).toEqual(expected.sort());
  });

  it('a second step within the window replaces the pair and restarts the window', () => {
    caged.chooseShape('E');
    caged.step(1);
    const first = [...(caged.transition?.positions ?? [])];
    vi.advanceTimersByTime(300);
    caged.step(1);
    const second = [...(caged.transition?.positions ?? [])];
    expect(second).not.toEqual(first);
    vi.advanceTimersByTime(300); // 600 ms after the first press, 300 after the second
    expect(caged.transition).not.toBeNull();
    vi.advanceTimersByTime(200);
    expect(caged.transition).toBeNull();
  });

  it('step at either end or with no focus is a no-op with no transition', () => {
    caged.step(1);
    expect(caged.state.focus).toBeNull();
    expect(caged.transition).toBeNull();
    caged.toggleTag('C@0');
    caged.step(-1);
    expect(caged.display.focusIndex).toBe(0);
    expect(caged.transition).toBeNull();
    const last = caged.display.occurrences.length - 1;
    caged.toggleTag(
      `${caged.display.occurrences[last].shape.id}@${caged.display.occurrences[last].start}`
    );
    caged.step(1);
    expect(caged.display.focusIndex).toBe(last);
    expect(caged.transition).toBeNull();
  });

  it('step(-1) moves to the neighbor nearer the nut', () => {
    caged.chooseShape('E');
    caged.step(-1);
    expect(caged.display.focused?.shape.id).toBe('G');
    expect(caged.transition?.positions.length).toBeGreaterThan(0);
  });

  it('visits a letter drawn twice once per occurrence', () => {
    caged.toggleTag('C@0');
    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const idx = caged.display.focusIndex;
      if (idx === null) break;
      const o = caged.display.occurrences[idx];
      seen.push(`${o.shape.id}@${o.start}`);
      if (idx === caged.display.occurrences.length - 1) break;
      caged.step(1);
    }
    expect(seen).toHaveLength(caged.display.occurrences.length);
    expect(new Set(seen).size).toBe(seen.length);
  });

  const stepped = () => {
    caged.chooseShape('E');
    caged.step(1);
    expect(caged.transition).not.toBeNull();
  };

  it.each([
    ['chooseShape', () => caged.chooseShape('A')],
    ['toggleTag', () => caged.toggleTag('E@8')],
    ['reset', () => caged.reset()],
    ['selectRoot', () => caged.selectRoot(7)],
    ['setQuality', () => caged.setQuality('minor')],
    ['applyInstrument', () => caged.applyInstrument(AF_1_12, 'Standard')],
    ['resetCagedForTests', () => resetCagedForTests()]
  ])('%s clears the transition immediately', (_name, act) => {
    stepped();
    act();
    expect(caged.transition).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(caged.transition).toBeNull();
  });
});

describe('caged store: connections (016 US3)', () => {
  it('setConnections toggles the flag and rings the connection markers', () => {
    expect(caged.state.connections).toBe(false);
    caged.setConnections(true);
    expect(caged.state.connections).toBe(true);
    const rings = caged.display.model?.markers.filter((mk) => mk.ring === true) ?? [];
    expect(rings).toHaveLength(caged.display.connections.length);
    caged.setConnections(false);
    expect(caged.state.connections).toBe(false);
    expect(caged.display.model?.markers.some((mk) => mk.ring === true)).toBe(false);
  });

  it('leaves any transition untouched', () => {
    vi.useFakeTimers();
    try {
      caged.chooseShape('E');
      caged.step(1);
      const t = caged.transition;
      expect(t).not.toBeNull();
      caged.setConnections(true);
      expect(caged.transition).toBe(t);
      caged.setConnections(false);
      expect(caged.transition).toBe(t);
      vi.advanceTimersByTime(1000);
      expect(caged.transition).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is never persisted', () => {
    const before = JSON.stringify({ ...localStorage });
    caged.setConnections(true);
    expect(JSON.stringify({ ...localStorage })).toBe(before);
  });

  it('reset() turns it off', () => {
    caged.setConnections(true);
    caged.reset();
    expect(caged.state.connections).toBe(false);
  });

  it('a non-compatible tuning keeps its value', () => {
    caged.setConnections(true);
    caged.applyInstrument(AF_8, 'Open');
    expect(caged.display.tuningClass).toBe('non-compatible');
    expect(caged.state.connections).toBe(true);
    expect(caged.display.connections).toEqual([]);
    caged.applyInstrument(STANDARD_GUITAR, 'Standard');
    expect(caged.state.connections).toBe(true);
  });
});

describe('caged store: layers (US2)', () => {
  const only = (on: Partial<Record<'chord' | 'arpeggio' | 'pentatonic' | 'scale', boolean>>) => ({
    chord: false,
    arpeggio: false,
    pentatonic: false,
    scale: false,
    ...on
  });

  it('starts with Chord only, switches match and Chord is the last layer', () => {
    expect(caged.state.layers).toEqual(only({ chord: true }));
    expect(caged.switches.chord).toEqual({ on: true, disabled: 'last-layer' });
    expect(caged.switches.scale).toEqual({ on: false, disabled: null });
    expect(caged.reveal).toBeNull();
    expect(caged.layerChange).toBeNull();
  });

  it('toggleLayer flips an enabled layer and records the change', () => {
    caged.toggleLayer('arpeggio');
    expect(caged.state.layers).toEqual(only({ chord: true, arpeggio: true }));
    expect(caged.layerChange).toEqual({ layer: 'arpeggio', on: true });
    caged.toggleLayer('arpeggio');
    expect(caged.layerChange).toEqual({ layer: 'arpeggio', on: false });
  });

  it('a disabled switch does nothing (the last layer cannot be turned off)', () => {
    const before = caged.state;
    caged.toggleLayer('chord');
    expect(caged.state).toBe(before);
    expect(caged.layerChange).toBeNull();
  });

  it('toggleLayer does not stop playback (R-16)', () => {
    const stop = vi.spyOn(playback, 'stop');
    caged.toggleLayer('arpeggio');
    caged.toggleLayer('chord');
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('a key change clears the transient layer change but keeps the layers', () => {
    caged.toggleLayer('arpeggio');
    caged.selectRoot(7);
    expect(caged.layerChange).toBeNull();
    expect(caged.state.layers.arpeggio).toBe(true);
  });

  it('reset() returns to Chord only, clears transients and keeps the preferred label', () => {
    caged.toggleLayer('arpeggio');
    caged.reset();
    expect(caged.state.layers).toEqual(only({ chord: true }));
    expect(caged.layerChange).toBeNull();
    expect(caged.state.labelType).toBe('interval');
  });

  it('restores Chord when See all leaves nothing drawable (Chord off, Scale on, focus E)', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    caged.toggleLayer('chord');
    expect(caged.state.layers).toEqual(only({ scale: true }));
    caged.chooseShape('all');
    expect(caged.state.layers).toEqual(only({ chord: true, scale: true }));
    expect(caged.layerChange).toEqual({ layer: 'chord', on: true });
  });

  it('restores Chord when toggling the focused tag off', () => {
    caged.chooseShape('E');
    caged.toggleLayer('pentatonic');
    caged.toggleLayer('chord');
    const id = caged.display.model?.tags?.find((t) => t.pressed)?.id as string;
    caged.toggleTag(id);
    expect(caged.state.focus).toBeNull();
    expect(caged.state.layers.chord).toBe(true);
    expect(caged.layerChange).toEqual({ layer: 'chord', on: true });
  });

  it('restores Chord when a tuning change drops the focus', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    caged.toggleLayer('chord');
    caged.applyInstrument(AF_8, 'Open');
    expect(caged.state.focus).toBeNull();
    expect(caged.state.layers.chord).toBe(true);
    expect(caged.layerChange).toEqual({ layer: 'chord', on: true });
  });

  it('restores Chord when viewInStandard or endTemporary clears the focus', () => {
    caged.applyInstrument(AF_8, 'Open');
    caged.viewInStandard();
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    caged.toggleLayer('chord');
    caged.endTemporary();
    expect(caged.state.focus).toBeNull();
    expect(caged.state.layers.chord).toBe(true);
  });

  it('layers survive an instrument change and no layer data reaches storage', () => {
    const before = JSON.stringify({ ...localStorage });
    caged.toggleLayer('arpeggio');
    caged.applyInstrument(AF_1_12, 'Standard');
    expect(caged.state.layers.arpeggio).toBe(true);
    expect(JSON.stringify({ ...localStorage })).toBe(before);
  });
});

describe('caged store: pentatonic and scale auto-focus (017 US4)', () => {
  it.each(['pentatonic', 'scale'] as const)(
    '%s on with no focus focuses the first drawn occurrence, then turns on',
    (layer) => {
      expect(caged.state.focus).toBeNull();
      const first = caged.display.occurrences[0];
      caged.toggleLayer(layer);
      expect(caged.state.focus).toEqual({ letter: first.shape.id, ordinal: 0 });
      expect(caged.state.layers[layer]).toBe(true);
      expect(caged.layerChange).toEqual({ layer, on: true });
      const idx = caged.display.occurrences.findIndex((o) => o.shape.id === first.shape.id);
      expect(idx).toBe(0);
    }
  );

  it('computes the reveal after the focus move', () => {
    caged.toggleLayer('pentatonic');
    const drawn = caged.display.positions.filter((p) => p.layer === 'pentatonic');
    expect(drawn.length).toBeGreaterThan(0);
    expect(caged.reveal).not.toBeNull();
    const keys = new Set(drawn.map((p) => `${p.string}:${p.fret}`));
    for (const k of caged.reveal?.ids ?? []) expect(keys.has(k)).toBe(true);
  });

  it('keeps an existing focus untouched', () => {
    caged.chooseShape('G');
    const f = caged.state.focus;
    caged.toggleLayer('scale');
    expect(caged.state.focus).toBe(f);
  });

  it('never targets an undrawn occurrence', () => {
    caged.toggleLayer('scale');
    const f = caged.state.focus;
    expect(f).not.toBeNull();
    const drawn = caged.display.occurrences.filter((o) => o.shape.id === f?.letter);
    expect(drawn.length).toBeGreaterThan(f?.ordinal ?? 0);
  });

  it('clearing focus keeps the switch on and draws nothing for it', () => {
    caged.toggleLayer('pentatonic');
    caged.chooseShape('all');
    expect(caged.state.focus).toBeNull();
    expect(caged.state.layers.pentatonic).toBe(true);
    expect(caged.display.positions.some((p) => p.layer === 'pentatonic')).toBe(false);
  });
});

describe('caged store: reveal and label type (017 US1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const noReveal = () => expect(caged.reveal).toBeNull();

  it('turning a layer on reveals only the newly drawn keys, low to high', () => {
    caged.chooseShape('E');
    const before = new Set(caged.display.positions.map((p) => `${p.string}:${p.fret}`));
    caged.toggleLayer('scale');
    const ids = caged.reveal?.ids ?? [];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(before.has(id)).toBe(false);
    const pitchOf = new Map<string, number>(
      caged.display.positions.map((p) => [`${p.string}:${p.fret}`, p.pitch])
    );
    const pitches = ids.map((id) => pitchOf.get(id) as number);
    expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('clears after REVEAL_WINDOW_MS', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    expect(caged.reveal).not.toBeNull();
    vi.advanceTimersByTime(REVEAL_WINDOW_MS - 1);
    expect(caged.reveal).not.toBeNull();
    vi.advanceTimersByTime(1);
    noReveal();
  });

  it('clears on the next change and never staggers on a turn off', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    expect(caged.reveal).not.toBeNull();
    caged.toggleLayer('scale'); // off
    noReveal();
    expect(caged.layerChange).toEqual({ layer: 'scale', on: false });
  });

  it('other redraws never stagger (FR-013)', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    caged.chooseShape('A');
    noReveal();
    caged.selectRoot(7);
    noReveal();
    caged.setQuality('minor');
    noReveal();
    caged.reset();
    noReveal();
  });

  it('a later switch with nothing new to draw drops the pending reveal and its timer', () => {
    caged.chooseShape('E');
    caged.toggleLayer('scale');
    expect(caged.reveal).not.toBeNull();
    caged.toggleLayer('arpeggio'); // already drawn by Chord and Scale: nothing new
    noReveal();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('setLabelType changes the label and the model label mode; Reset tool keeps it', () => {
    caged.setLabelType('name');
    expect(caged.state.labelType).toBe('name');
    expect(caged.display.model?.labelMode).toBe('note');
    caged.reset();
    expect(caged.state.labelType).toBe('name');
    caged.setLabelType('interval');
    expect(caged.display.model?.labelMode).toBe('interval');
    caged.reset();
    expect(caged.state.labelType).toBe('interval');
  });

  it('restoreLabelType sets the preferred label without remembering it', () => {
    caged.restoreLabelType('name');
    expect(caged.state.labelType).toBe('name');
    caged.reset();
    expect(caged.state.labelType).toBe('name');
  });

  it('restoreLabelType ignores an unknown value', () => {
    // @ts-expect-error not a label type
    caged.restoreLabelType('octave');
    expect(caged.state.labelType).toBe('interval');
  });
});

describe('REVEAL_WINDOW_MS', () => {
  it('equals --duration-short', () => {
    const css = readFileSync('src/lib/styles/tokens.css', 'utf8');
    const ms = /--duration-short:\s*(\d+)ms/.exec(css)?.[1];
    expect(REVEAL_WINDOW_MS).toBe(Number(ms));
  });
});
