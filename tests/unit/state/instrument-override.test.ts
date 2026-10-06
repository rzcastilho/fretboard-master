import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkInstrument } from '../../../src/lib/link/types';
import { tuningFromOffsets } from '../../../src/lib/instrument/tunings';
import { DEFAULT_CONFIG, instrumentOf } from '../../../src/lib/state/instrument-config';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';

const STORED: LinkInstrument = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-1' },
  fretCount: 22
};
const DROP_D: LinkInstrument = { ...STORED, tuning: { kind: 'preset', id: 'AF-4' } };
const FRETS_ONLY: LinkInstrument = { ...STORED, fretCount: 19 };
const SEVEN: LinkInstrument = {
  stringCount: 7,
  tuning: { kind: 'preset', id: 'AF-21' },
  fretCount: 22
};

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetInstrumentForTests();
});

describe('instrument override: receive (023 I1)', () => {
  it('different tuning creates an override with notice', () => {
    instrument.receive('caged', DROP_D);
    expect(instrument.override).toEqual({ tool: 'caged', link: DROP_D, notice: true });
  });

  it('different string count creates an override with notice', () => {
    instrument.receive('notes', SEVEN);
    expect(instrument.override).toEqual({ tool: 'notes', link: SEVEN, notice: true });
  });

  it('a custom tuning musically different from stored gets a notice', () => {
    const link: LinkInstrument = { ...STORED, tuning: tuningFromOffsets([0, 0, 0, 0, -3, 0]) };
    instrument.receive('triads', link);
    expect(instrument.override?.notice).toBe(true);
  });

  it('fret-count-only difference overrides without a notice', () => {
    instrument.receive('notes', FRETS_ONLY);
    expect(instrument.override).toEqual({ tool: 'notes', link: FRETS_ONLY, notice: false });
    expect(notes.instrument.fretCount).toBe(19);
    expect(instrument.overrideNoticeFor('notes')).toBeNull();
  });

  it('is a no-op when the link equals the stored instrument', () => {
    const apply = vi.spyOn(notes, 'applyInstrument');
    instrument.receive('notes', STORED);
    expect(instrument.override).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('writes nothing, stops no playback and sets no adjustment notice', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    instrument.receive('triads', DROP_D);
    expect(remember).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(instrument.adjustedIn).toBeNull();
  });

  it('changes only the opened tool store; active stays the stored instrument', () => {
    const notesBefore = notes.instrument;
    const cagedBefore = caged.instrument;
    instrument.receive('triads', DROP_D);
    expect(triads.instrument.openStrings).not.toEqual(notesBefore.openStrings);
    expect(notes.instrument).toBe(notesBefore);
    expect(caged.instrument).toBe(cagedBefore);
    expect(instrument.active).toEqual(DEFAULT_CONFIG);
  });

  it('keeps the viewer handedness and orientation on the link instrument', () => {
    // Stored left-handed: the link instrument is drawn mirrored too.
    const left = { ...DEFAULT_CONFIG, handedness: 'left' as const };
    instrument.restore(left);
    instrument.receive('notes', DROP_D);
    expect(notes.instrument.handedness).toBe('left');
  });

  it('CAGED applies the preferred link tuning', () => {
    instrument.receive('caged', DROP_D);
    expect(caged.instrument.openStrings).toEqual(
      instrumentOf({ ...DEFAULT_CONFIG, ...DROP_D }).openStrings
    );
  });

  it('CAGED compares the preferred sc/tu/fr, ignoring tmp', () => {
    instrument.receive('caged', STORED);
    expect(instrument.override).toBeNull();
  });
});

describe('instrument override: effectiveFor and notice', () => {
  it('effectiveFor is the link for the opened tool and the stored instrument elsewhere', () => {
    instrument.receive('caged', DROP_D);
    expect(instrument.effectiveFor('caged')).toBe(DROP_D);
    expect(instrument.effectiveFor('notes')).toEqual(STORED);
    expect(instrument.effectiveFor('triads')).toEqual(STORED);
  });

  it('effectiveFor is the stored instrument with no override', () => {
    expect(instrument.effectiveFor('caged')).toEqual(STORED);
  });

  it('overrideNoticeFor shows for the opened tool only', () => {
    instrument.receive('caged', DROP_D);
    expect(instrument.overrideNoticeFor('caged')).not.toBeNull();
    expect(instrument.overrideNoticeFor('notes')).toBeNull();
  });
});

describe('instrument override: ending it (023 I4, I5, R-04)', () => {
  const confirmChange = () => {
    instrument.open();
    instrument.selectTuning('AF-9');
    instrument.confirm('notes');
  };

  it('a confirm with a change clears the override and applies the stored instrument everywhere', () => {
    instrument.receive('caged', DROP_D);
    confirmChange();
    expect(instrument.override).toBeNull();
    expect(instrument.effectiveFor('caged')).toEqual(musicalOfActive());
    expect(caged.instrument.openStrings).toEqual(notes.instrument.openStrings);
  });

  it('cancel keeps the override', () => {
    instrument.receive('caged', DROP_D);
    instrument.open();
    instrument.selectTuning('AF-9');
    instrument.cancel();
    expect(instrument.override).not.toBeNull();
  });

  it('a confirm without a change keeps the override', () => {
    instrument.receive('caged', DROP_D);
    instrument.open();
    instrument.confirm('caged');
    expect(instrument.override).not.toBeNull();
  });

  it('restore (startup, erase) clears the override and applies the stored instrument', () => {
    instrument.receive('triads', DROP_D);
    instrument.restore(DEFAULT_CONFIG);
    expect(instrument.override).toBeNull();
    expect(triads.instrument.openStrings).toEqual(notes.instrument.openStrings);
  });

  it('screenChanged resets the dismissal but keeps the override', () => {
    instrument.receive('caged', DROP_D);
    expect(instrument.overrideDismissed).toBe(false);
    instrument.screenChanged();
    expect(instrument.override).not.toBeNull();
    expect(instrument.overrideDismissed).toBe(false);
  });
});

describe('instrument override: useMine (023 I2)', () => {
  it('writes nothing, stops playback with instrument and clears the override', () => {
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    instrument.receive('triads', DROP_D);
    instrument.useMine();
    expect(remember).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledWith('instrument');
    expect(instrument.override).toBeNull();
    expect(instrument.overrideNoticeFor('triads')).toBeNull();
  });

  it('puts every store on instrumentOf(active)', () => {
    instrument.receive('triads', DROP_D);
    instrument.useMine();
    const stored = instrumentOf(instrument.active);
    expect(triads.instrument.openStrings).toEqual(stored.openStrings);
    expect(notes.instrument.openStrings).toEqual(stored.openStrings);
    expect(caged.instrument.openStrings).toEqual(stored.openStrings);
    expect(instrument.effectiveFor('triads')).toEqual(STORED);
  });

  it('sets no adjustment when the opened view needed none', () => {
    instrument.receive('notes', DROP_D);
    instrument.useMine();
    expect(instrument.adjustedIn).toBeNull();
  });

  it('sets adjustedIn only for the tool whose store reports an adjustment', () => {
    instrument.receive('triads', SEVEN);
    vi.spyOn(triads, 'applyInstrument').mockReturnValue(true);
    instrument.useMine();
    expect(instrument.adjustedIn).toBe('triads');
  });

  it('ends the CAGED temporary view when the stored tuning is compatible', () => {
    instrument.receive('caged', DROP_D);
    const end = vi.spyOn(caged, 'endTemporary');
    instrument.useMine();
    expect(end).toHaveBeenCalled();
    expect(caged.temporary).toBe(false);
  });

  it('is a no-op without an override', () => {
    const stop = vi.spyOn(playback, 'stop');
    instrument.useMine();
    expect(stop).not.toHaveBeenCalled();
  });
});

describe('instrument override: adopt and dismiss (023 I3)', () => {
  it('remembers once with only the instrument fields changed', () => {
    const remember = vi.spyOn(preferences, 'remember');
    instrument.receive('caged', DROP_D);
    instrument.adopt();
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith({
      stringCount: 6,
      tuningId: 'AF-4',
      customTuning: null,
      fretCount: 22,
      handedness: DEFAULT_CONFIG.handedness,
      orientation: DEFAULT_CONFIG.orientation
    });
  });

  it('keeps stored handedness and orientation', () => {
    instrument.restore({ ...DEFAULT_CONFIG, handedness: 'left' });
    instrument.receive('notes', DROP_D);
    instrument.adopt();
    expect(instrument.active.handedness).toBe('left');
    expect(instrument.active.orientation).toBe(DEFAULT_CONFIG.orientation);
  });

  it('leaves the opened view unchanged and updates the other stores', () => {
    instrument.receive('notes', DROP_D);
    const before = notes.state;
    const adopted = notes.instrument;
    instrument.adopt();
    expect(notes.state).toBe(before);
    expect(notes.instrument).toBe(adopted);
    expect(triads.instrument.openStrings).toEqual(adopted.openStrings);
    expect(caged.instrument.openStrings).toEqual(adopted.openStrings);
    expect(instrument.override).toBeNull();
    expect(instrument.adjustedIn).toBeNull();
  });

  it('is a no-op without an override', () => {
    const remember = vi.spyOn(preferences, 'remember');
    instrument.adopt();
    expect(remember).not.toHaveBeenCalled();
  });

  it('dismissOverrideNotice hides the notice and keeps the override', () => {
    instrument.receive('caged', DROP_D);
    instrument.dismissOverrideNotice();
    expect(instrument.overrideDismissed).toBe(true);
    expect(instrument.overrideNoticeFor('caged')).toBeNull();
    expect(instrument.override).not.toBeNull();
  });

  it('screenChanged shows the notice again and the override survives', () => {
    instrument.receive('caged', DROP_D);
    instrument.dismissOverrideNotice();
    instrument.screenChanged();
    expect(instrument.overrideNoticeFor('caged')).not.toBeNull();
  });

  it('a panel change that is confirmed ends the override and closes the notice', () => {
    instrument.receive('caged', DROP_D);
    instrument.open();
    instrument.selectTuning('AF-9');
    instrument.confirm('caged');
    expect(instrument.override).toBeNull();
    expect(instrument.overrideNoticeFor('caged')).toBeNull();
  });
});

function musicalOfActive(): LinkInstrument {
  const a = instrument.active;
  return { stringCount: a.stringCount, tuning: a.tuning, fretCount: a.fretCount };
}
