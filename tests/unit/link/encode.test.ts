// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeLink, linkPath, LINK_VERSION, type ShareSnapshot } from '$lib/link';
import { STANDARD_TUNING, tuningFromOffsets } from '$lib/instrument/tunings';
import { CHORD_ONLY } from '$lib/state/caged-layers';
import type { NotesViewState } from '$lib/state/notes-view';
import type { TriadsViewState } from '$lib/state/triads-view';
import type { CagedViewState } from '$lib/state/caged-view';
import { currentLink } from '$lib/state/share.svelte';
import { instrument, resetInstrumentForTests } from '$lib/state/instrument.svelte';
import { language, resetLanguageForTests } from '$lib/state/language.svelte';
import { notation, resetNotationForTests } from '$lib/state/notation.svelte';
import { playback, resetPlaybackForTests } from '$lib/state/playback.svelte';
import { caged as cagedStore, resetCagedForTests } from '$lib/state/caged.svelte';
import { notes as notesStore, resetNotesForTests } from '$lib/state/notes.svelte';
import { triads as triadsStore } from '$lib/state/triads.svelte';
import { timer, resetTimerForTests } from '$lib/state/timer.svelte';

const ORIGIN = 'https://fretboard.example';
const INSTRUMENT = { stringCount: 6, tuning: STANDARD_TUNING, fretCount: 22 } as const;

const notes: NotesViewState = {
  selection: [],
  labelType: 'name',
  background: 'naturals',
  hideNames: false,
  activeStrings: [1, 2, 3, 4, 5, 6],
  region: { start: 0, end: 22 },
  card: null
};
const triads: TriadsViewState = {
  rootPc: 0,
  spellingOverride: 'none',
  quality: 'major',
  inversion: 'root',
  stringSet: 3,
  labelType: 'interval',
  occurrence: 0,
  view: 'isolated',
  compare: { on: false, quality: null }
};
const caged: CagedViewState = {
  rootPc: 0,
  spellingOverride: 'none',
  quality: 'major',
  focus: null,
  connections: false,
  layers: CHORD_ONLY,
  triadSet: null,
  labelType: 'interval'
};

const snapshots: Record<'notes' | 'triads' | 'caged', ShareSnapshot> = {
  notes: { tool: 'notes', view: notes, instrument: INSTRUMENT },
  triads: { tool: 'triads', view: triads, instrument: INSTRUMENT },
  caged: { tool: 'caged', view: caged, instrument: INSTRUMENT, temporary: false }
};

/** link-format §3–§5, in order. */
const KEYS = {
  notes: ['v', 'sel', 'str', 'rg', 'bg', 'hn', 'cd', 'lb', 'sc', 'tu', 'fr'],
  triads: ['v', 'rt', 'sp', 'q', 'inv', 'ss', 'vw', 'oc', 'cmp', 'cq', 'lb', 'sc', 'tu', 'fr'],
  caged: ['v', 'rt', 'sp', 'q', 'fc', 'ly', 'cn', 'ts', 'lb', 'tmp', 'sc', 'tu', 'fr']
} as const;

/** link-format §6: never present. */
const FORBIDDEN = [
  'lang',
  'language',
  'notation',
  'acc',
  'accidentals',
  'hand',
  'handedness',
  'orient',
  'orientation',
  'theme',
  'sound',
  'volume',
  'tempo',
  'scroll',
  't',
  'id'
];

const parts = (link: string) => {
  const url = new URL(link);
  return { url, pairs: [...url.searchParams.entries()], keys: [...url.searchParams.keys()] };
};

describe('encodeLink', () => {
  it('exposes version and path helpers', () => {
    expect(LINK_VERSION).toBe(1);
    expect(linkPath('notes')).toBe('/notes');
    expect(linkPath('triads')).toBe('/triads');
    expect(linkPath('caged')).toBe('/caged');
  });

  for (const tool of ['notes', 'triads', 'caged'] as const) {
    describe(tool, () => {
      const link = encodeLink(snapshots[tool], ORIGIN);
      const { url, keys } = parts(link);

      it('uses origin + path, no fragment, no trailing slash', () => {
        expect(link.startsWith(`${ORIGIN}/${tool}?v=1&`)).toBe(true);
        expect(url.hash).toBe('');
        expect(url.pathname).toBe(`/${tool}`);
      });

      it('writes exactly the canonical keys in canonical order', () => {
        expect(keys).toEqual([...KEYS[tool]]);
      });

      it('never writes a key from the never-present list', () => {
        for (const k of FORBIDDEN) expect(keys).not.toContain(k);
      });

      it('uses only [A-Za-z0-9.-] token values (no percent-encoding)', () => {
        const query = link.slice(link.indexOf('?') + 1);
        for (const pair of query.split('&')) {
          const [, value] = pair.split('=');
          expect(value).toMatch(/^[A-Za-z0-9.-]+$/);
        }
        expect(link).not.toContain('%');
      });
    });
  }

  it('writes defaults explicitly (canonical)', () => {
    expect(encodeLink(snapshots.notes, ORIGIN)).toBe(
      `${ORIGIN}/notes?v=1&sel=-&str=1.2.3.4.5.6&rg=0.22&bg=naturals&hn=0&cd=-&lb=name&sc=6&tu=AF-1&fr=22`
    );
    expect(encodeLink(snapshots.triads, ORIGIN)).toBe(
      `${ORIGIN}/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=3&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=6&tu=AF-1&fr=22`
    );
    expect(encodeLink(snapshots.caged, ORIGIN)).toBe(
      `${ORIGIN}/caged?v=1&rt=0&sp=none&q=major&fc=-&ly=10000&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22`
    );
  });

  it('encodes the CAGED A minor E-shape chord+pentatonic example', () => {
    const s: ShareSnapshot = {
      tool: 'caged',
      view: {
        ...caged,
        rootPc: 9,
        quality: 'minor',
        focus: { letter: 'E', ordinal: 0 },
        layers: { ...CHORD_ONLY, pentatonic: true }
      },
      instrument: INSTRUMENT,
      temporary: false
    };
    expect(encodeLink(s, ORIGIN)).toBe(
      `${ORIGIN}/caged?v=1&rt=9&sp=none&q=minor&fc=E.0&ly=10100&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22`
    );
  });

  it('encodes the temporary flag and the triad set', () => {
    const s: ShareSnapshot = {
      tool: 'caged',
      view: {
        ...caged,
        focus: { letter: 'C', ordinal: 1 },
        layers: { ...CHORD_ONLY, triad: true },
        triadSet: 4
      },
      instrument: INSTRUMENT,
      temporary: true
    };
    const link = encodeLink(s, ORIGIN);
    expect(link).toContain('&ly=10001&');
    expect(link).toContain('&ts=4&');
    expect(link).toContain('&tmp=1&');
  });

  it('writes compare.quality even when compare is off', () => {
    const s: ShareSnapshot = {
      tool: 'triads',
      view: { ...triads, compare: { on: false, quality: 'minor' } },
      instrument: INSTRUMENT
    };
    expect(encodeLink(s, ORIGIN)).toContain('&cmp=0&cq=minor&');
  });

  it('writes a custom tuning as MIDI pitches from string 1 to string n', () => {
    const tuning = tuningFromOffsets([-1, 0, 0, 0, 0, 2]);
    expect(tuning.kind).toBe('custom');
    const s: ShareSnapshot = {
      tool: 'notes',
      view: notes,
      instrument: { stringCount: 6, tuning, fretCount: 22 }
    };
    // lowest string E2(40)-1=39 … string 1 E4(64)+2=66
    expect(encodeLink(s, ORIGIN)).toContain('&tu=c.66.59.55.50.45.39&');
  });

  it('orders selection as selected and active strings ascending', () => {
    const s: ShareSnapshot = {
      tool: 'notes',
      view: { ...notes, selection: [7, 0, 4], activeStrings: [1, 3, 6] },
      instrument: INSTRUMENT
    };
    const link = encodeLink(s, ORIGIN);
    expect(link).toContain('&sel=7.0.4&');
    expect(link).toContain('&str=1.3.6&');
  });

  it('keeps the worst case under 1,000 characters (SC-006)', () => {
    const tuning = tuningFromOffsets([-3, -1, 1, 2, 3, 4, -2]);
    const s: ShareSnapshot = {
      tool: 'notes',
      view: {
        ...notes,
        selection: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        activeStrings: [1, 2, 3, 4, 5, 6, 7],
        region: { start: 10, end: 24 },
        card: { string: 7, fret: 24 },
        background: 'naturals',
        hideNames: true,
        labelType: 'octave'
      },
      instrument: { stringCount: 7, tuning, fretCount: 24 }
    };
    expect(encodeLink(s, 'https://fretboard.example').length).toBeLessThan(1000);
  });

  it('makes no network request (FR-018)', () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    try {
      for (const tool of ['notes', 'triads', 'caged'] as const) {
        encodeLink(snapshots[tool], ORIGIN);
      }
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('exclusion matrix (SC-003, E3)', () => {
  const TOOLS = ['notes', 'triads', 'caged'] as const;

  beforeEach(() => {
    resetInstrumentForTests();
    resetCagedForTests();
    resetNotesForTests();
    resetLanguageForTests();
    resetNotationForTests();
    resetPlaybackForTests();
    resetTimerForTests();
    triadsStore.reset();
  });
  afterEach(() => {
    triadsStore.reset();
    document.documentElement.removeAttribute('data-theme');
  });

  /** Each excluded preference, applied through the real stores. */
  const EXCLUDED: Record<string, () => void> = {
    'locale es': () => language.restore('es'),
    'locale pt-BR': () => language.restore('pt-BR'),
    'locale en': () => language.restore('en'),
    'notation solfege': () => notation.restore('solfege', 'sharps'),
    'accidentals flats': () => notation.restore('letters', 'flats'),
    'accidentals both': () => notation.restore('letters', 'both'),
    'handedness left': () => instrument.restore({ ...instrument.active, handedness: 'left' }),
    'orientation lowest-top': () =>
      instrument.restore({ ...instrument.active, orientation: 'lowest-top' }),
    'theme dark': () => document.documentElement.setAttribute('data-theme', 'dark'),
    'sound muted': () => playback.restore({ muted: true, volume: 0.2 }),
    'tempo slow': () => cagedStore.restoreTempo('slow'),
    'practice timer 10m (C35)': () => timer.restore(10),
    scroll: () => {
      document.documentElement.scrollTop = 120;
      window.dispatchEvent(new Event('scroll'));
    }
  };

  for (const tool of TOOLS) {
    it(`${tool}: every excluded preference leaves the link byte-identical`, () => {
      const baseline = currentLink(tool);
      for (const [name, apply] of Object.entries(EXCLUDED)) {
        apply();
        expect(currentLink(tool), name).toBe(baseline);
      }
    });
  }

  /** Each included field, changed through the real stores. Every one must move the link. */
  const INCLUDED: Record<(typeof TOOLS)[number], Record<string, () => void>> = {
    notes: {
      selection: () => notesStore.toggleNote(4),
      'active strings': () => notesStore.toggleString(2),
      region: () => notesStore.setRegionStart(3),
      background: () => notesStore.setBackground('none'),
      'hide names': () => notesStore.setHideNames(true),
      'label type': () => notesStore.setLabelType('octave'),
      'string count': () => instrument.restore({ ...instrument.active, stringCount: 7 }),
      tuning: () =>
        instrument.restore({
          ...instrument.active,
          tuning: tuningFromOffsets([-2, 0, 0, 0, 0, 0])
        }),
      'fret count': () => instrument.restore({ ...instrument.active, fretCount: 17 })
    },
    triads: {
      root: () => triadsStore.selectRoot(7),
      quality: () => triadsStore.setQuality('minor'),
      inversion: () => triadsStore.setInversion('first'),
      'string set': () => triadsStore.setStringSet(4),
      view: () => triadsStore.setView('all-notes'),
      compare: () => triadsStore.setCompare(true),
      'label type': () => triadsStore.setLabelType('name'),
      'fret count': () => instrument.restore({ ...instrument.active, fretCount: 17 })
    },
    caged: {
      root: () => cagedStore.selectRoot(9),
      quality: () => cagedStore.setQuality('minor'),
      connections: () => cagedStore.setConnections(true),
      layer: () => cagedStore.toggleLayer('pentatonic'),
      'label type': () => cagedStore.setLabelType('name'),
      'fret count': () => instrument.restore({ ...instrument.active, fretCount: 17 })
    }
  };

  for (const tool of TOOLS) {
    for (const [name, change] of Object.entries(INCLUDED[tool])) {
      it(`${tool}: changing ${name} changes the link`, () => {
        const before = currentLink(tool);
        change();
        expect(currentLink(tool)).not.toBe(before);
      });
    }
  }

  it('carries no timestamp, identifier or random token across 100 invocations', () => {
    for (const tool of TOOLS) {
      const first = currentLink(tool);
      for (let i = 0; i < 100; i += 1) expect(currentLink(tool)).toBe(first);
    }
    for (const tool of ['notes', 'triads', 'caged'] as const) {
      const first = encodeLink(snapshots[tool], ORIGIN);
      for (let i = 0; i < 100; i += 1) expect(encodeLink(snapshots[tool], ORIGIN)).toBe(first);
    }
  });
});
