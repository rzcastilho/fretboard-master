import { beforeEach, describe, expect, it, vi } from 'vitest';

const goto = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));

import { AF_7 } from '../../../src/lib/instrument/fixtures';
import {
  linkTools,
  openTriadsFromNote,
  resetTool,
  viewAsTriad
} from '../../../src/lib/state/links.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

beforeEach(() => {
  goto.mockClear();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
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

  it('after reset, a switch away and back reopens the initial state', () => {
    const initial = triads.state;
    triads.setQuality('diminished');
    resetTool('triads');
    linkTools('triads', 'notes');
    linkTools('notes', 'triads');
    expect(triads.state).toEqual(initial);
  });
});
