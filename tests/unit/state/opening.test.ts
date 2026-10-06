import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeLink, type LinkInstrument, type ShareSnapshot } from '../../../src/lib/link';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { instrument, resetInstrumentForTests } from '../../../src/lib/state/instrument.svelte';
import { initialCagedView } from '../../../src/lib/state/caged-view';
import { initialTriadsView } from '../../../src/lib/state/triads-view';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { opening, resetOpeningForTests } from '../../../src/lib/state/opening.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { fakeStorage, type FakeStorage } from '../prefs/support';

const ORIGIN = 'https://fretboard.example';
const STORED: LinkInstrument = {
  stringCount: 6,
  tuning: { kind: 'preset', id: 'AF-1' },
  fretCount: 22
};
const DROP_D: LinkInstrument = { ...STORED, tuning: { kind: 'preset', id: 'AF-4' } };

let storage: FakeStorage;

const cagedLink = (inst: LinkInstrument, rootPc = 2): string =>
  encodeLink(
    {
      tool: 'caged',
      view: {
        ...initialCagedView('interval'),
        rootPc,
        focus: { letter: 'E', ordinal: 0 }
      },
      instrument: inst,
      temporary: false
    } satisfies ShareSnapshot,
    ORIGIN
  );

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetPreferencesForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetInstrumentForTests();
  resetOpeningForTests();
  storage = fakeStorage();
  preferences.start(storage);
});

describe('opening.start: URL classes', () => {
  it('none: bare tool path, home, about leave everything untouched', () => {
    const before = caged.state;
    for (const path of ['/', '/about', '/caged', '/caged?']) {
      resetOpeningForTests();
      opening.start(ORIGIN + path);
      expect(opening.incomplete).toBeNull();
    }
    expect(caged.state).toBe(before);
    expect(instrument.override).toBeNull();
  });

  it('unknown-tool: incomplete notice targets home', () => {
    opening.start(`${ORIGIN}/scales?v=1&rt=0`);
    expect(opening.incomplete).toEqual({ screen: 'home' });
    expect(instrument.override).toBeNull();
  });

  it('valid tool link on the stored instrument: view applied, no notice, no override', () => {
    opening.start(cagedLink(STORED));
    expect(caged.state.rootPc).toBe(2);
    expect(caged.state.focus).toEqual({ letter: 'E', ordinal: 0 });
    expect(opening.incomplete).toBeNull();
    expect(instrument.override).toBeNull();
  });

  it('valid tool link on another instrument: override on the opened tool, no incomplete notice', () => {
    opening.start(cagedLink(DROP_D));
    expect(instrument.override).toEqual({ tool: 'caged', link: DROP_D, notice: true });
    expect(opening.incomplete).toBeNull();
    expect(caged.state.rootPc).toBe(2);
  });

  it('notes and triads links reach their own stores only', () => {
    const t = encodeLink(
      {
        tool: 'triads',
        view: { ...initialTriadsView(STANDARD_GUITAR), rootPc: 5, quality: 'minor' },
        instrument: STORED
      },
      ORIGIN
    );
    opening.start(t);
    expect(triads.state.rootPc).toBe(5);
    expect(triads.state.quality).toBe('minor');
    expect(caged.state.rootPc).toBe(0);
    expect(notes.state.selection).toEqual([]);
  });

  it('incomplete tool link: valid fields stay, one notice for the tool', () => {
    opening.start(`${ORIGIN}/caged?v=1&rt=2&q=banana&fr=99`);
    expect(caged.state.rootPc).toBe(2);
    expect(caged.state.quality).toBe('major');
    expect(opening.incomplete).toEqual({ screen: 'caged' });
  });

  it('newer version opens the closest view with the notice', () => {
    opening.start(cagedLink(STORED).replace('v=1', 'v=9'));
    expect(caged.state.rootPc).toBe(2);
    expect(opening.incomplete).toEqual({ screen: 'caged' });
  });
});

describe('opening.start: guarantees', () => {
  it('O3: writes nothing to storage and keeps every preference', () => {
    const before = [...storage.data.entries()];
    const writes = storage.calls.set; // storage probe made by preferences.start()
    const remember = vi.spyOn(preferences, 'remember');
    const stop = vi.spyOn(playback, 'stop');
    opening.start(cagedLink(DROP_D));
    opening.start(`${ORIGIN}/triads?v=1&rt=3&sc=7`);
    expect(storage.calls.set).toBe(writes);
    expect([...storage.data.entries()]).toEqual(before);
    expect(remember).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('O4: incomplete is set once however many fields fell back', () => {
    opening.start(`${ORIGIN}/caged?v=1&rt=x&q=y&fc=z&ly=bad&sc=9&tu=none&fr=1`);
    expect(opening.incomplete).toEqual({ screen: 'caged' });
  });

  it('O4: a complete link sets no notice', () => {
    opening.start(cagedLink(DROP_D));
    expect(opening.incomplete).toBeNull();
  });

  it('applies the instrument before the view', () => {
    const order: string[] = [];
    vi.spyOn(instrument, 'receive').mockImplementation(() => void order.push('instrument'));
    vi.spyOn(caged, 'receive').mockImplementation(() => void order.push('view'));
    opening.start(cagedLink(DROP_D));
    expect(order).toEqual(['instrument', 'view']);
  });

  it('start twice is idempotent: the second href is ignored', () => {
    opening.start(cagedLink(STORED, 2));
    opening.start(cagedLink(STORED, 7));
    expect(caged.state.rootPc).toBe(2);
  });

  it('O2: a thrown store error raises the incomplete notice and does not throw', () => {
    vi.spyOn(caged, 'receive').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => opening.start(cagedLink(STORED))).not.toThrow();
    expect(opening.incomplete).toEqual({ screen: 'caged' });
  });

  it('O2: an error on a non-tool path raises the notice for home', () => {
    vi.spyOn(instrument, 'active', 'get').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => opening.start(`${ORIGIN}/scales?v=1`)).not.toThrow();
    expect(opening.incomplete).toEqual({ screen: 'home' });
  });
});

describe('opening notice lifecycle', () => {
  it('dismissIncomplete and screenChanged hide it', () => {
    opening.start(`${ORIGIN}/scales?v=1`);
    opening.dismissIncomplete();
    expect(opening.incomplete).toBeNull();
    resetOpeningForTests();
    opening.start(`${ORIGIN}/scales?v=1`);
    opening.screenChanged();
    expect(opening.incomplete).toBeNull();
  });

  it('unknown tool targets the home screen', () => {
    opening.start(`${ORIGIN}/scales?v=1&rt=0`);
    expect(opening.incomplete).toEqual({ screen: 'home' });
  });

  it('a tool link with a repaired value targets that tool', () => {
    opening.start(`${ORIGIN}/notes?v=9&sel=0.4.7`);
    expect(opening.incomplete).toEqual({ screen: 'notes' });
  });

  it('never re-shows the notice in the session once dismissed or left', () => {
    opening.start(`${ORIGIN}/caged?v=1&q=banana`);
    opening.screenChanged();
    opening.start(`${ORIGIN}/caged?v=1&q=banana`); // idempotent: link applies once per load
    expect(opening.incomplete).toBeNull();
    opening.dismissIncomplete();
    expect(opening.incomplete).toBeNull();
  });

  it('SC-005: exactly one notice however many values fell back', () => {
    opening.start(`${ORIGIN}/triads?v=1&rt=zz&q=zz&inv=zz&ss=99&vw=zz&oc=zz&sc=99&tu=zz&fr=999`);
    expect(opening.incomplete).toEqual({ screen: 'triads' });
  });
});
