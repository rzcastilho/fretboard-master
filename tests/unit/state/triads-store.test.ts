import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AF_4, NC_UNISON, SHORT_7 } from '../../../src/lib/instrument/fixtures';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import type { Offsets } from '../../../src/lib/instrument/custom-tuning';
import { tuningFromOffsets, tuningInstrument } from '../../../src/lib/instrument/tunings';
import { LISTEN_BPM } from '../../../src/lib/state/listen';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

describe('triads store (US7)', () => {
  it('listen() sends one sequence at LISTEN_BPM with the four steps', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listen();
    expect(seq).toHaveBeenCalledTimes(1);
    expect(seq).toHaveBeenCalledWith(triads.display.listenSteps, LISTEN_BPM, STANDARD_GUITAR);
    expect(triads.display.listenSteps).toHaveLength(4);
    seq.mockRestore();
  });

  it('listen() is a no-op when disabled', () => {
    triads.useInstrument(NC_UNISON);
    expect(triads.display.listen.enabled).toBe(false);
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listen();
    expect(seq).not.toHaveBeenCalled();
    seq.mockRestore();
  });

  it('a second listen() restarts without calling stop', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    const stop = vi.spyOn(playback, 'stop');
    triads.listen();
    triads.listen();
    expect(seq).toHaveBeenCalledTimes(2);
    expect(stop).not.toHaveBeenCalled();
    seq.mockRestore();
    stop.mockRestore();
  });

  it('every state-changing action stops playback with reason view', () => {
    const stop = vi.spyOn(playback, 'stop');
    const actions: (() => void)[] = [
      () => triads.selectRoot(7),
      () => triads.setQuality('minor'),
      () => triads.setInversion('first'),
      () => triads.setStringSet(4),
      () => triads.setLabelType('name'),
      () => triads.octaveUp()
    ];
    for (const act of actions) {
      stop.mockClear();
      act();
      expect(stop).toHaveBeenCalledWith('view');
    }
    stop.mockRestore();
  });

  it('useInstrument stops with reason instrument', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.useInstrument(AF_4);
    expect(stop).toHaveBeenCalledWith('instrument');
    stop.mockRestore();
  });

  it('activate plays a note and changes no state', () => {
    const note = vi.spyOn(playback, 'note').mockImplementation(() => []);
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.activate({ string: 3, fret: 5 });
    expect(note).toHaveBeenCalledWith({ string: 3, fret: 5 }, STANDARD_GUITAR);
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    note.mockRestore();
    stop.mockRestore();
  });
});

describe('triads store (US8)', () => {
  it('anotherSet() selects the nearest closing set and stops playback', () => {
    triads.useInstrument(NC_UNISON);
    expect(triads.display.anotherSet).toBe(5);
    const stop = vi.spyOn(playback, 'stop');
    triads.anotherSet();
    expect(triads.state.stringSet).toBe(5);
    expect(triads.display.shape.kind).toBe('shown');
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('anotherSet() is a no-op when no set is offered', () => {
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.anotherSet();
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });
});

describe('triads store Full neck (US1)', () => {
  it('setView changes the view and stops playback only when it changed', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.setView('full-neck');
    expect(triads.state.view).toBe('full-neck');
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockClear();
    triads.setView('full-neck');
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it("selectTag('second:0') sets inversion and occurrence together (C3)", () => {
    triads.selectRoot(9);
    triads.setView('full-neck');
    triads.selectTag('second:1');
    expect(triads.state.inversion).toBe('second');
    expect(triads.state.occurrence).toBe(1);
    triads.selectTag('second:0');
    expect(triads.state.occurrence).toBe(0);
  });

  it('a tag of the already selected inversion only updates the occurrence', () => {
    triads.selectRoot(9);
    triads.setView('full-neck');
    triads.selectTag('root:1');
    expect(triads.state.inversion).toBe('root');
    expect(triads.state.occurrence).toBe(1);
  });

  it('an unknown or no-op tag id changes nothing and does not stop playback', () => {
    triads.selectRoot(9);
    triads.setView('full-neck');
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.selectTag('bogus');
    triads.selectTag('root:0');
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });
});

describe('triads store reset (US2)', () => {
  it('reset() returns the view to isolated and stops playback when the state changed', () => {
    triads.selectRoot(9);
    triads.setView('all-notes');
    const stop = vi.spyOn(playback, 'stop');
    triads.reset();
    expect(triads.state.view).toBe('isolated');
    expect(triads.state.rootPc).toBe(0);
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('reset() on an untouched state is a no-op and does not stop playback', () => {
    const stop = vi.spyOn(playback, 'stop');
    const before = triads.state;
    triads.reset();
    expect(triads.state).toBe(before);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('inversion and string set changes are ignored in All notes', () => {
    triads.setView('all-notes');
    const before = triads.state;
    triads.setInversion('second');
    triads.setStringSet(4);
    expect(triads.state).toBe(before);
  });
});

describe('triads store guidance actions (US3)', () => {
  it('seeAllNotes() changes only the view and stops playback (C8, C13)', () => {
    triads.useInstrument(NC_UNISON);
    const before = triads.state;
    const stop = vi.spyOn(playback, 'stop');
    triads.seeAllNotes();
    expect(triads.state).toEqual({ ...before, view: 'all-notes' });
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('anotherSet() keeps the current view and stops playback', () => {
    triads.useInstrument(NC_UNISON);
    triads.setView('full-neck');
    const stop = vi.spyOn(playback, 'stop');
    triads.anotherSet();
    expect(triads.state.view).toBe('full-neck');
    expect(triads.state.stringSet).toBe(5);
    expect(stop).toHaveBeenCalled();
    stop.mockRestore();
  });
});

describe('triads store Listen per view (US4)', () => {
  it('Full neck listen() sends 24 steps at LISTEN_BPM (C11)', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.selectRoot(9);
    triads.setView('full-neck');
    triads.listen();
    expect(seq).toHaveBeenCalledWith(triads.display.listenSteps, LISTEN_BPM, STANDARD_GUITAR);
    expect(triads.display.listenSteps).toHaveLength(24);
    seq.mockRestore();
  });

  it('All notes listen() sends three single notes (C12)', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.selectRoot(9);
    triads.setView('all-notes');
    triads.listen();
    expect(seq).toHaveBeenCalledWith(
      [
        { string: 5, fret: 0 },
        { string: 5, fret: 4 },
        { string: 4, fret: 2 }
      ],
      LISTEN_BPM,
      STANDARD_GUITAR
    );
    seq.mockRestore();
  });

  describe('playback stops on every real change (C13)', () => {
    const cases: [string, () => void, () => void][] = [
      ['view', () => {}, () => triads.setView('full-neck')],
      ['root', () => {}, () => triads.selectRoot(7)],
      ['spelling', () => triads.selectRoot(1), () => triads.switchSpelling()],
      ['quality', () => {}, () => triads.setQuality('minor')],
      ['inversion', () => {}, () => triads.setInversion('first')],
      ['string set', () => {}, () => triads.setStringSet(4)],
      [
        'occurrence',
        () => {
          triads.selectRoot(9);
          triads.setView('full-neck');
        },
        () => triads.selectTag('root:1')
      ],
      ['label type', () => {}, () => triads.setLabelType('name')],
      ['See all notes', () => {}, () => triads.seeAllNotes()],
      ['Another set', () => triads.useInstrument(NC_UNISON), () => triads.anotherSet()]
    ];
    for (const [name, setup, act] of cases) {
      it(name, () => {
        setup();
        const stop = vi.spyOn(playback, 'stop');
        act();
        expect(stop).toHaveBeenCalledWith('view');
        stop.mockRestore();
      });
    }
  });
});

describe('triads store Compare (US1)', () => {
  it('setCompare(on) updates the display and stops playback (A1)', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.setCompare(true);
    expect(stop).toHaveBeenCalledWith('view');
    expect(triads.display.compare).toMatchObject({ on: true, quality: 'minor' });
    expect(triads.display.comparison?.quality).toBe('minor');
    stop.mockClear();
    triads.setCompare(false);
    expect(stop).toHaveBeenCalledWith('view');
    expect(triads.display.comparison).toBeNull();
    stop.mockRestore();
  });

  it('setCompareQuality(q) updates the display and stops playback (A1)', () => {
    triads.setCompare(true);
    const stop = vi.spyOn(playback, 'stop');
    triads.setCompareQuality('augmented');
    expect(stop).toHaveBeenCalledWith('view');
    expect(triads.display.compare.quality).toBe('augmented');
    expect(triads.display.comparison?.quality).toBe('augmented');
    stop.mockRestore();
  });

  it('no-ops do not stop playback or change the display', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.setCompareQuality('minor'); // Compare is off
    triads.setCompare(false); // already off
    triads.setCompare(true);
    stop.mockClear();
    triads.setCompare(true); // already on
    triads.setCompareQuality('minor'); // already minor
    triads.setCompareQuality('major'); // the current quality
    expect(stop).not.toHaveBeenCalled();
    expect(triads.display.compare.quality).toBe('minor');
    stop.mockRestore();
  });
});

describe('triads store Compare notice (007 US4: A2, A5)', () => {
  it('A2: the swap sets a compare-swapped notice naming the new comparison quality', () => {
    triads.setCompare(true); // major vs minor
    expect(triads.notice).toBeNull();
    triads.setQuality('minor');
    expect(triads.state.quality).toBe('minor');
    expect(triads.state.compare.quality).toBe('major');
    expect(triads.notice).toEqual({ kind: 'compare-swapped', quality: 'major' });
  });

  it('A2: any other applied transition clears the notice', () => {
    triads.setCompare(true);
    triads.setQuality('minor');
    triads.selectRoot(2);
    expect(triads.notice).toBeNull();
    triads.setQuality('major'); // swap back: compare is major, so major becomes current
    expect(triads.notice).toEqual({ kind: 'compare-swapped', quality: 'minor' });
    triads.setInversion('first');
    expect(triads.notice).toBeNull();
  });

  it('a no-op keeps the notice', () => {
    triads.setCompare(true);
    triads.setQuality('minor');
    triads.setQuality('minor'); // no-op
    expect(triads.notice).toEqual({ kind: 'compare-swapped', quality: 'major' });
  });

  it('a quality change that is not a swap sets no notice', () => {
    triads.setCompare(true);
    triads.setQuality('diminished');
    expect(triads.notice).toBeNull();
  });

  it('A5: dismissNotice() clears it without touching the view', () => {
    triads.setCompare(true);
    triads.setQuality('minor');
    const before = triads.state;
    triads.dismissNotice();
    expect(triads.notice).toBeNull();
    expect(triads.state).toBe(before);
  });

  it('A5: reset() clears it', () => {
    triads.setCompare(true);
    triads.setQuality('minor');
    triads.reset();
    expect(triads.notice).toBeNull();
  });
});

describe('triads store Listen to comparison (007 US6)', () => {
  it('A1: sequence(steps, LISTEN_BPM, instrument) from listenComparison', () => {
    triads.setCompare(true);
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listenComparison();
    expect(seq).toHaveBeenCalledWith(
      triads.display.listenComparison.steps,
      LISTEN_BPM,
      STANDARD_GUITAR
    );
    expect(triads.notice).toBeNull();
    seq.mockRestore();
  });

  it('A3: does nothing when disabled', () => {
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listenComparison();
    expect(seq).not.toHaveBeenCalled();
    seq.mockRestore();
  });

  it('A4: omitted notes set the compare-omitted notice', () => {
    triads.useInstrument(SHORT_7);
    triads.selectRoot(7);
    triads.setInversion('second');
    triads.setStringSet(4);
    triads.setCompare(true);
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listenComparison();
    expect(triads.notice).toEqual({
      kind: 'compare-omitted',
      notes: [{ letter: 'B', accidental: -1 }]
    });
    seq.mockRestore();
  });

  it('plain listen() still plays only the first triad', () => {
    triads.setCompare(true);
    const seq = vi.spyOn(playback, 'sequence').mockImplementation(() => []);
    triads.listen();
    expect(seq).toHaveBeenCalledWith(triads.display.listenSteps, LISTEN_BPM, STANDARD_GUITAR);
    expect(triads.display.listenSteps).toHaveLength(4);
    seq.mockRestore();
  });

  it('changing the comparison quality or Compare state stops playback', () => {
    triads.setCompare(true);
    const stop = vi.spyOn(playback, 'stop');
    triads.setCompareQuality('augmented');
    triads.setCompare(false);
    expect(stop).toHaveBeenCalledTimes(2);
    stop.mockRestore();
  });
});

describe('triads store applyInstrument (009 foundational)', () => {
  it('keeps the whole view and reports no adjustment when nothing needs clamping', () => {
    triads.selectRoot(7);
    triads.setQuality('minor');
    triads.setInversion('first');
    triads.setStringSet(4);
    triads.setLabelType('name');
    triads.setCompare(true);
    const before = triads.state;
    const adjusted = triads.applyInstrument(AF_4);
    expect(adjusted).toBe(false);
    expect(triads.instrument).toBe(AF_4);
    expect(triads.state).toEqual(before);
  });

  it('returns false when next === instrument', () => {
    const before = triads.state;
    expect(triads.applyInstrument(STANDARD_GUITAR)).toBe(false);
    expect(triads.state).toBe(before);
  });

  it('clamps occurrence to the highest remaining one and returns true', () => {
    while (triads.display.octave.up) triads.octaveUp();
    const high = triads.state.occurrence;
    expect(high).toBeGreaterThan(0);
    const adjusted = triads.applyInstrument(SHORT_7);
    const max = Math.max(0, triads.display.octave.count - 1);
    expect(triads.state.occurrence).toBeLessThanOrEqual(max);
    expect(adjusted).toBe(triads.state.occurrence !== high);
    expect(adjusted).toBe(true);
  });

  it('never calls playback.stop', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.applyInstrument(AF_4);
    triads.applyInstrument(SHORT_7);
    expect(stop).not.toHaveBeenCalled();
    stop.mockRestore();
  });

  it('SC-003: Drop D C major root 6-5-4 is 10-7-5 wide stretch; Standard is 8-7-5', () => {
    triads.setStringSet(6);
    const frets = () => {
      const s = triads.display.shape;
      return s.kind === 'shown' ? [...s.frets].sort((a, b) => b - a) : [];
    };
    expect(frets()).toEqual([8, 7, 5]);
    triads.applyInstrument(AF_4);
    expect(frets()).toEqual([10, 7, 5]);
    const s = triads.display.shape;
    expect(s.kind === 'shown' && s.wideStretch).toBe(true);
    expect(triads.display.model.summary).toContain('Wide stretch.');
  });

  it('useInstrument stops playback with reason instrument then delegates', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.useInstrument(AF_4);
    expect(stop).toHaveBeenCalledWith('instrument');
    expect(triads.instrument).toBe(AF_4);
    stop.mockRestore();
  });
});

describe('triads.restoreLabelType (010)', () => {
  it('sets the label type without stopping playback and keeps it through reset()', () => {
    const stop = vi.spyOn(playback, 'stop');
    triads.restoreLabelType('name');
    expect(triads.state.labelType).toBe('name');
    expect(stop).not.toHaveBeenCalled();
    triads.selectRoot(5);
    triads.reset();
    expect(triads.state.labelType).toBe('name');
    expect(triads.state.rootPc).toBe(0);
    stop.mockRestore();
  });
});

describe('triads store with unusual custom tunings (011 US4)', () => {
  const tuned = (o: readonly number[]) =>
    tuningInstrument(tuningFromOffsets(o as unknown as Offsets), 22);
  /** String 3 raised to string 2's pitch (B3): strings 3 and 2 are in unison. */
  const UNISON = tuned([0, 0, 0, 4, 0, 0]);
  /** Several unisons at once: the triad closes on no string set. */
  const NO_SET = tuned([-7, 0, -7, 0, -7, -7]);

  it('unison 3-2-1: does not close, offers Another set and See all notes (4.2, 4.3)', () => {
    triads.useInstrument(UNISON);
    expect(triads.state.stringSet).toBe(3);
    expect(triads.display.shape.kind).toBe('does-not-close');
    expect(triads.display.anotherSet).toBe(5);
    triads.seeAllNotes();
    expect(triads.state.view).toBe('all-notes');
  });

  it('Another set moves to the nearest closing set (4.2)', () => {
    triads.useInstrument(UNISON);
    triads.anotherSet();
    expect(triads.state.stringSet).toBe(5);
    expect(triads.display.shape.kind).toBe('shown');
  });

  it('no closing set: no Another set offer, See all notes remains (4.4)', () => {
    triads.useInstrument(NO_SET);
    expect(triads.display.shape.kind).toBe('does-not-close');
    expect(triads.display.anotherSet).toBeNull();
    triads.anotherSet();
    expect(triads.state.stringSet).toBe(3);
    triads.seeAllNotes();
    expect(triads.state.view).toBe('all-notes');
  });

  it('a tuning change keeps the current set; guidance only where it does not close (4.8)', () => {
    triads.useInstrument(UNISON);
    expect(triads.state.stringSet).toBe(3);
    triads.setStringSet(5);
    expect(triads.display.shape.kind).toBe('shown');
    triads.useInstrument(STANDARD_GUITAR);
    triads.setStringSet(3);
    triads.useInstrument(UNISON);
    expect(triads.state.stringSet).toBe(3);
    triads.setStringSet(5);
    triads.useInstrument(tuned([0, 0, 0, 4, 0, 0]));
    expect(triads.state.stringSet).toBe(5);
    expect(triads.display.shape.kind).toBe('shown');
  });
});
