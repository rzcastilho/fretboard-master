// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeLink, type ShareSnapshot } from '../../../src/lib/link';
import { measure } from '../../../src/lib/measure/measure.svelte';
import { initialTriadsView } from '../../../src/lib/state/triads-view';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { opening, resetOpeningForTests } from '../../../src/lib/state/opening.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { resetTriadsForTests } from '../../../src/lib/state/triads.svelte';
import { resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import {
  resetShareForTests,
  share,
  useSharePlatformForTests,
  type SharePlatform
} from '../../../src/lib/state/share.svelte';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { DEFAULT_CONFIG } from '../../../src/lib/state/instrument-config';
import type { Synth } from '../../../src/lib/audio/types';
import { FakeAudioPort, FakeClock } from '../audio/support/fake-audio';

const platform = (over: Partial<SharePlatform>): SharePlatform => ({
  share: null,
  writeText: () => Promise.resolve(),
  coarsePointer: false,
  ...over
});

let sound: ReturnType<typeof vi.spyOn>;
let shared: ReturnType<typeof vi.spyOn>;
let opened: ReturnType<typeof vi.spyOn>;
let edited: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  resetShareForTests();
  resetOpeningForTests();
  resetInstrumentForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  sound = vi.spyOn(measure, 'soundPlayed');
  shared = vi.spyOn(measure, 'linkShared');
  opened = vi.spyOn(measure, 'linkOpened');
  edited = vi.spyOn(measure, 'instrumentEdited');
});
afterEach(() => resetShareForTests());

describe('playback → soundPlayed', () => {
  it('a scheduled sound calls soundPlayed; a muted one does not', () => {
    const port = new FakeAudioPort();
    const synth: Synth = {
      renderVoice: (_p, _sr, length) => new Float32Array(length),
      mixVoices: (v) => v[0]
    };
    resetPlaybackForTests({
      createContext: () => port,
      loadSynth: () => Promise.resolve(synth),
      clock: new FakeClock()
    });
    playback.note({ string: 1, fret: 3 }, STANDARD_GUITAR);
    expect(sound).toHaveBeenCalledTimes(1);
    sound.mockClear();
    playback.setMuted(true);
    playback.note({ string: 1, fret: 3 }, STANDARD_GUITAR);
    expect(sound).not.toHaveBeenCalled();
  });
});

describe('share → linkShared', () => {
  it('clipboard, manual panel and system sheet each call it once', async () => {
    useSharePlatformForTests(platform({}));
    await share.share('triads', 't');
    expect(shared).toHaveBeenLastCalledWith('triads');

    useSharePlatformForTests(platform({ writeText: null }));
    await share.share('notes', 't');
    expect(shared).toHaveBeenLastCalledWith('notes');

    useSharePlatformForTests(platform({ writeText: () => Promise.reject(new Error('no')) }));
    await share.share('caged', 't');
    expect(shared).toHaveBeenLastCalledWith('caged');

    useSharePlatformForTests(platform({ share: () => Promise.resolve(), coarsePointer: true }));
    await share.share('triads', 't');
    expect(shared).toHaveBeenCalledTimes(4);
  });

  it('a cancelled system sheet does not', async () => {
    useSharePlatformForTests(
      platform({
        share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })),
        coarsePointer: true
      })
    );
    await share.share('triads', 't');
    expect(shared).not.toHaveBeenCalled();
  });
});

describe('opening → linkOpened', () => {
  const snap: ShareSnapshot = {
    tool: 'triads',
    view: initialTriadsView(STANDARD_GUITAR),
    instrument: { stringCount: 6, tuning: { kind: 'preset', id: 'AF-1' }, fretCount: 22 }
  };

  it('a valid link calls it with the tool', () => {
    opening.start(encodeLink(snap, 'https://fretboard.example'));
    expect(opened).toHaveBeenCalledWith('triads');
  });

  it('no link and an unknown tool do not', () => {
    opening.start('https://fretboard.example/');
    expect(opened).not.toHaveBeenCalled();
    resetOpeningForTests();
    opening.start('https://fretboard.example/zzz?v=1');
    expect(opened).not.toHaveBeenCalled();
  });
});

describe('instrument → instrumentEdited', () => {
  it('panel actions call it; restore, receive and useMine do not', () => {
    instrument.open();
    instrument.setStringCount(7);
    instrument.selectTuning('AF-4' as never);
    instrument.setFrets(20);
    instrument.setHandedness('left');
    instrument.setOrientation('lowest-top');
    instrument.chooseCustom();
    expect(edited.mock.calls.length).toBeGreaterThanOrEqual(6);
    edited.mockClear();
    instrument.cancel();

    instrument.restore({ ...DEFAULT_CONFIG, handedness: 'left' });
    instrument.receive('triads', {
      stringCount: 6,
      tuning: { kind: 'preset', id: 'AF-4' },
      fretCount: 22
    });
    instrument.useMine();
    expect(edited).not.toHaveBeenCalled();
  });
});
