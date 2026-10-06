import { beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));

import { AF_7 } from '../../../src/lib/instrument/fixtures';
import {
  linkTools,
  openCagedFromNote,
  openCagedFromTriads,
  openTriadsFromCaged,
  openTriadsFromNote,
  resetTool,
  viewAsTriad
} from '../../../src/lib/state/links.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

beforeEach(() => {
  goto.mockClear();
  resetPlaybackForTests();
  resetNotationForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
});

const select = (...pcs: number[]) => pcs.forEach((pc) => notes.toggleNote(pc));

describe('viewAsTriad (US1)', () => {
  it('carries G♯, C, E as G♯ augmented with the sharp override, keeping inversion and string set', async () => {
    const { inversion, stringSet } = triads.state;
    select(8, 0, 4);
    await viewAsTriad();
    expect(triads.state.rootPc).toBe(8);
    expect(triads.state.spellingOverride).toBe('sharp');
    expect(triads.state.quality).toBe('augmented');
    expect(triads.state.inversion).toBe(inversion);
    expect(triads.state.stringSet).toBe(stringSet);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/triads');
  });

  it('carries C, E, G as C major with no spelling override', async () => {
    select(0, 4, 7);
    await viewAsTriad();
    expect(triads.state.rootPc).toBe(0);
    expect(triads.state.quality).toBe('major');
    expect(triads.state.spellingOverride).toBe('none');
  });

  it('does nothing and does not navigate when no triad is detected', async () => {
    select(0, 2, 4);
    const before = triads.state;
    await viewAsTriad();
    expect(triads.state).toBe(before);
    expect(goto).not.toHaveBeenCalled();
  });

  it('swaps qualities with Compare on and raises the notice', async () => {
    triads.setQuality('minor');
    triads.setCompare(true);
    triads.setCompareQuality('major');
    select(0, 4, 7); // C major == compare quality
    await viewAsTriad();
    expect(triads.state.quality).toBe('major');
    expect(triads.state.compare.quality).toBe('minor');
    expect(triads.notice).toMatchObject({ kind: 'compare-swapped' });
  });
});

describe('linkTools (US2)', () => {
  it('notes → triads with one note keeps quality, inversion and string set, sets the root', () => {
    triads.setQuality('minor');
    triads.setInversion('first');
    triads.setStringSet(4);
    select(9);
    linkTools('notes', 'triads');
    expect(triads.state.rootPc).toBe(9);
    expect(triads.state.quality).toBe('minor');
    expect(triads.state.inversion).toBe('first');
    expect(triads.state.stringSet).toBe(4);
    expect(goto).not.toHaveBeenCalled();
  });

  it('G♯ only with augmented shows as A♭ (override none)', () => {
    triads.setQuality('augmented');
    select(8);
    linkTools('notes', 'triads');
    expect(triads.state.rootPc).toBe(8);
    expect(triads.state.spellingOverride).toBe('none');
    expect(triads.display.rootSpelling).toEqual({ letter: 'A', accidental: -1 });
  });

  it('same-root carry keeps a user-switched D♭', () => {
    triads.selectRoot(1);
    triads.switchSpelling();
    const before = triads.state;
    expect(before.spellingOverride).not.toBe('none');
    select(1);
    linkTools('notes', 'triads');
    expect(triads.state).toBe(before);
  });

  it.each([[[]], [[0, 2]], [[0, 2, 4]], [[0, 2, 4, 5]]] as number[][][])(
    'does nothing with selection %j',
    (sel) => {
      select(...sel);
      const before = triads.state;
      linkTools('notes', 'triads');
      expect(triads.state).toBe(before);
    }
  );

  it('triads → notes on E augmented sets the selection to [4, 8, 0], keeping other Notes state', () => {
    notes.setLabelType('octave');
    notes.setBackground('all');
    notes.setHideNames(true);
    notes.toggleString(1);
    notes.setRegionShortcut('5-9');
    const kept = { ...notes.state };
    triads.selectRoot(4);
    triads.setQuality('augmented');
    triads.setCompare(true);
    linkTools('triads', 'notes');
    expect(notes.state.selection).toEqual([4, 8, 0]);
    expect({ ...notes.state, selection: kept.selection }).toEqual(kept);
  });

  it('ignores Compare when carrying to Notes', () => {
    triads.setQuality('major');
    triads.setCompare(true);
    triads.setCompareQuality('minor');
    linkTools('triads', 'notes');
    expect(notes.state.selection).toEqual([0, 4, 7]);
  });

  it('is a no-op from home/about and when from === to', () => {
    select(9);
    const t = triads.state;
    linkTools('home', 'triads');
    linkTools('about', 'triads');
    linkTools('notes', 'notes');
    linkTools('triads', 'triads');
    expect(triads.state).toBe(t);
    expect(notes.state.selection).toEqual([9]);
  });

  it('E augmented → Notes → viewAsTriad returns to E augmented', async () => {
    triads.selectRoot(4);
    triads.setQuality('augmented');
    linkTools('triads', 'notes');
    await viewAsTriad();
    expect(triads.state.rootPc).toBe(4);
    expect(triads.state.quality).toBe('augmented');
  });
});

describe('openTriadsFromNote (US3)', () => {
  it.each(['major', 'minor', 'diminished'] as const)(
    'sets root F♯ for %s and keeps quality, inversion and string set',
    async (quality) => {
      triads.setQuality(quality);
      triads.setInversion('first');
      triads.setStringSet(4);
      await openTriadsFromNote(6);
      expect(triads.state.rootPc).toBe(6);
      expect(triads.display.rootSpelling).toEqual({ letter: 'F', accidental: 1 });
      expect(triads.state.quality).toBe(quality);
      expect(triads.state.inversion).toBe('first');
      expect(triads.state.stringSet).toBe(4);
      expect(goto).toHaveBeenCalledTimes(1);
      expect(goto).toHaveBeenCalledWith('/triads');
    }
  );

  it('shows G♭ for augmented', async () => {
    triads.setQuality('augmented');
    await openTriadsFromNote(6);
    expect(triads.state.rootPc).toBe(6);
    expect(triads.display.rootSpelling).toEqual({ letter: 'G', accidental: -1 });
  });

  it('ignores what the Notes selection holds', async () => {
    select(0, 4, 7);
    await openTriadsFromNote(6);
    expect(triads.state.rootPc).toBe(6);
    expect(notes.state.selection).toEqual([0, 4, 7]);
    expect(goto).toHaveBeenCalledTimes(1);
  });
});

describe('session memory and Reset tool (US4)', () => {
  it('keeps each tool state across switches without a carry (FR-004)', () => {
    triads.setQuality('minor');
    triads.setInversion('first');
    select(0, 2, 4);
    const t = triads.state;
    const n = notes.state;
    linkTools('triads', 'notes'); // carries Triads → Notes selection only
    linkTools('notes', 'triads'); // 3 notes: no carry
    expect(triads.state).toBe(t);
    expect(notes.state.selection).toEqual([0, 3, 7]);
    expect({ ...notes.state, selection: n.selection }).toEqual(n);
  });

  it("resetTool('triads') restores Triads and leaves Notes untouched", () => {
    const initial = triads.state;
    triads.setQuality('minor');
    triads.selectRoot(5);
    select(1, 2);
    const notesBefore = notes.state;
    resetTool('triads');
    expect(triads.state).toEqual(initial);
    expect(notes.state).toBe(notesBefore);
  });

  it("resetTool('notes') restores Notes and leaves Triads untouched", () => {
    const initial = notes.state;
    select(1, 2);
    triads.setQuality('minor');
    const triadsBefore = triads.state;
    resetTool('notes');
    expect(notes.state).toEqual(initial);
    expect(triads.state).toBe(triadsBefore);
  });

  it('keeps the instrument (and the settings outside tool state) on reset', () => {
    notes.useInstrument(AF_7);
    triads.useInstrument(AF_7);
    triads.setQuality('minor');
    resetTool('triads');
    resetTool('notes');
    expect(triads.instrument).toBe(AF_7);
    expect(notes.instrument).toBe(AF_7);
  });

  it('Reset tool never changes notation or accidentals (FR-1.11), and no link carries them (DM-17)', () => {
    notation.choose('solfege');
    notation.chooseAccidentals('flats');
    for (const id of ['notes', 'triads', 'caged'] as const) resetTool(id);
    expect(notation.chosen).toBe('solfege');
    expect(notation.accidentals).toBe('flats');
    for (const call of goto.mock.calls as unknown[][]) {
      expect(String(call[0])).not.toMatch(/notation|accidental|solfege|flats/i);
    }
  });

  it('after reset, a switch away and back reopens the initial state', () => {
    const initial = triads.state;
    triads.setQuality('diminished');
    resetTool('triads');
    linkTools('triads', 'notes');
    linkTools('notes', 'triads');
    expect(triads.state).toEqual(initial);
  });
});

describe('CAGED links (US3)', () => {
  it('Notes with one note carries the root into CAGED and keeps the quality', () => {
    caged.setQuality('minor');
    select(10);
    linkTools('notes', 'caged');
    expect(caged.state.rootPc).toBe(10);
    expect(caged.state.quality).toBe('minor');
    expect(caged.state.spellingOverride).toBe('none');
  });

  it('Notes with zero or two or more notes does not carry', () => {
    caged.selectRoot(7);
    const before = caged.state;
    linkTools('notes', 'caged');
    expect(caged.state).toBe(before);
    select(2, 4);
    linkTools('notes', 'caged');
    expect(caged.state).toBe(before);
  });

  it('a carry equal to the current key is a no-op that keeps spelling and focus', () => {
    caged.selectRoot(1);
    caged.switchSpelling();
    caged.chooseShape('A');
    const before = caged.state;
    select(1);
    linkTools('notes', 'caged');
    expect(caged.state).toBe(before);
  });

  it('CAGED → Notes selects root, third and fifth', () => {
    caged.selectRoot(9);
    caged.setQuality('minor');
    linkTools('caged', 'notes');
    expect([...notes.state.selection]).toEqual([9, 0, 4]);
  });

  it('Triads → CAGED carries major and minor; diminished becomes major', () => {
    triads.carryTriad(2, 'minor', 'none');
    linkTools('triads', 'caged');
    expect(caged.state.rootPc).toBe(2);
    expect(caged.state.quality).toBe('minor');
    triads.carryTriad(11, 'diminished', 'none');
    linkTools('triads', 'caged');
    expect(caged.state.rootPc).toBe(11);
    expect(caged.state.quality).toBe('major');
  });

  it('CAGED → Triads keeps inversion, string set, view and Compare', () => {
    triads.setInversion('first');
    triads.setStringSet(4);
    triads.setCompare(true);
    const { inversion, stringSet, view, compare } = triads.state;
    caged.selectRoot(2);
    linkTools('caged', 'triads');
    expect(triads.state.rootPc).toBe(2);
    expect(triads.state.quality).toBe('major');
    expect(triads.state.inversion).toBe(inversion);
    expect(triads.state.stringSet).toBe(stringSet);
    expect(triads.state.view).toBe(view);
    expect(triads.state.compare.on).toBe(compare.on);
  });

  it('Notes ↔ Triads is unchanged', () => {
    select(9);
    linkTools('notes', 'triads');
    expect(triads.state.rootPc).toBe(9);
  });

  it('focus is re-resolved after the carry, keeping the same letter', () => {
    caged.chooseShape('A');
    select(7);
    linkTools('notes', 'caged');
    expect(caged.state.rootPc).toBe(7);
    expect(caged.state.focus?.letter).toBe('A');
  });

  it('a carry stops playback', () => {
    const stop = vi.spyOn(playback, 'stop');
    select(5);
    linkTools('notes', 'caged');
    expect(stop).toHaveBeenCalledWith('view');
    stop.mockRestore();
  });

  it('a carried A♯ major is accepted and offers the Switch to B♭ guidance', () => {
    triads.carryTriad(10, 'major', 'sharp');
    linkTools('triads', 'caged');
    expect(caged.state.rootPc).toBe(10);
    expect(caged.state.spellingOverride).toBe('sharp');
    expect(caged.display.switchTo).not.toBeNull();
  });

  it('carry never happens from state alone (no handler call, no change)', () => {
    const before = caged.state;
    select(3);
    triads.carryTriad(6, 'minor', 'none');
    expect(caged.state).toBe(before);
  });
});

describe('caged reset (US6)', () => {
  it("resetTool('caged') restores CAGED and leaves Notes and Triads untouched", () => {
    caged.selectRoot(7);
    caged.setQuality('minor');
    triads.setQuality('minor');
    const triadsBefore = triads.state;
    resetTool('caged');
    expect(caged.state).toEqual({
      rootPc: 0,
      spellingOverride: 'none',
      quality: 'major',
      focus: null,
      connections: false,
      layers: { chord: true, arpeggio: false, pentatonic: false, scale: false, triad: false },
      triadSet: null,
      labelType: 'interval'
    });
    expect(triads.state).toBe(triadsBefore);
  });
});

describe('openTriadsFromCaged (slice 015 US1)', () => {
  it('goes to /triads once and leaves the triads state unchanged', async () => {
    const before = triads.state;
    await openTriadsFromCaged();
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/triads');
    expect(triads.state).toBe(before);
  });
});

describe('openCagedFromNote (019 US4)', () => {
  it('carries the pitch class as the key, keeps quality, leaves Notes alone, one goto', async () => {
    caged.setQuality('minor');
    select(0, 4);
    const notesBefore = notes.state;
    await openCagedFromNote(7);
    expect(caged.state.rootPc).toBe(7);
    expect(caged.state.quality).toBe('minor');
    expect(notes.state).toBe(notesBefore);
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/caged');
  });

  it('same pitch class as the current key: no key change, still one goto', async () => {
    caged.selectRoot(7);
    const before = caged.state;
    await openCagedFromNote(7);
    expect(caged.state).toBe(before);
    expect(goto).toHaveBeenCalledTimes(1);
  });
});

describe('openCagedFromTriads (019 US4)', () => {
  it('carries B♭ minor, shows the Triad layer, one goto', async () => {
    triads.selectRoot(10);
    triads.setQuality('minor');
    await openCagedFromTriads();
    expect(caged.state.rootPc).toBe(10);
    expect(caged.state.quality).toBe('minor');
    expect(caged.state.layers.triad).toBe(true);
    expect(caged.state.focus).not.toBeNull();
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/caged');
  });

  it.each(['diminished', 'augmented'] as const)('is a no-op for %s', async (q) => {
    triads.setQuality(q);
    const before = caged.state;
    await openCagedFromTriads();
    expect(caged.state).toBe(before);
    expect(goto).not.toHaveBeenCalled();
  });
});
