import { afterEach, describe, expect, it } from 'vitest';
import {
  STANDARD_GUITAR,
  allPositions,
  positionKey,
  positionPitch
} from '../../../src/lib/instrument/instrument';
import {
  LISTEN_BPM,
  buildNotesModel,
  cardInfo,
  listenSteps
} from '../../../src/lib/state/notes-model';
import {
  initialNotesView,
  openCard,
  setBackground,
  setHideNames,
  setRegionShortcut,
  toggleString,
  toggleNote,
  type NotesViewState
} from '../../../src/lib/state/notes-view';
import type { Marker } from '../../../src/lib/fretboard/types';
import { tuningFromOffsets, tuningInstrument } from '../../../src/lib/instrument/tunings';
import { pitchClass } from '../../../src/lib/theory/pitch';
import {
  defaultSpelling,
  noteLabel,
  overwriteNotationSource,
  resetNotationSourceForTests
} from '../../../src/lib/notation/notation';
import type { AccidentalPolicy } from '../../../src/lib/notation/policy';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import {
  initialTriadsView,
  selectRoot as selectTriadRoot
} from '../../../src/lib/state/triads-view';
import { buildCagedModel as buildCaged } from '../../../src/lib/state/caged-model';
import { initialCagedView, selectRoot as selectCagedRoot } from '../../../src/lib/state/caged-view';
import { presetInstrument } from '../../../src/lib/instrument/tunings';

const INIT = initialNotesView(STANDARD_GUITAR);
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);

const select = (...pcs: number[]): NotesViewState => pcs.reduce(toggleNote, INIT);
const build = (s: NotesViewState) => buildNotesModel(s, STANDARD_GUITAR);
const byKey = (markers: readonly Marker[]) =>
  new Map(markers.map((mk) => [`${mk.string}:${mk.fret}`, mk]));

const pcOf = (string: number, fret: number) => ([4, 11, 7, 2, 9, 4][string - 1] + fret) % 12;

describe('buildNotesModel: initial state (US1-1)', () => {
  const { model, highlightedCount } = build(INIT);
  const markers = byKey(model.markers);

  it('has one marker per position, naturals normal and labeled, altered hidden', () => {
    expect(model.markers).toHaveLength(allPositions(STANDARD_GUITAR).length);
    for (const p of allPositions(STANDARD_GUITAR)) {
      const mk = markers.get(positionKey(p));
      if (!mk) throw new Error('missing marker');
      if (NATURALS.has(pcOf(p.string, p.fret))) {
        expect(mk.emphasis).toBe('normal');
        expect(mk.label).not.toBe(false);
      } else {
        expect(mk.emphasis).toBe('hidden');
      }
      expect(mk.function).toBe('neutral');
      expect(mk.tone).toBeUndefined();
      expect(mk.octaveBadge).toBeFalsy();
    }
    expect(highlightedCount).toBe(0);
    expect(model.labelMode).toBe('note');
  });

  it('describes the natural background', () => {
    expect(model.description).toBe('Showing natural notes, strings 1 to 6, frets 0 to 22.');
  });
});

describe('buildNotesModel: one note selected (US1-2)', () => {
  const display = build(select(7));
  const markers = display.model.markers;
  const highlighted = markers.filter((mk) => mk.emphasis === 'highlighted');

  it('highlights exactly the 12 G positions with tones 2–5 and octave badges', () => {
    expect(display.highlightedCount).toBe(12);
    expect(highlighted).toHaveLength(12);
    const tones = highlighted.map((mk) => mk.tone).sort();
    expect(tones).toEqual([2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5]);
    for (const mk of highlighted) {
      expect(mk.octaveBadge).toBe(true);
      expect(pcOf(mk.string, mk.fret)).toBe(7);
      expect(mk.function).toBe('neutral');
    }
  });

  it('dims the other visible positions and keeps their label (selection-dimmed)', () => {
    const dimmed = markers.filter((mk) => mk.emphasis === 'dimmed');
    expect(dimmed.length).toBeGreaterThan(0);
    for (const mk of dimmed) {
      expect(NATURALS.has(pcOf(mk.string, mk.fret))).toBe(true);
      expect(mk.label).toBe(true);
      expect(mk.tone).toBeUndefined();
    }
    expect(markers.filter((mk) => mk.emphasis === 'hidden').length).toBeGreaterThan(0);
  });

  it('writes the FR-019a description', () => {
    const d = display.model.description ?? '';
    expect(
      d.startsWith('G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22.')
    ).toBe(true);
    expect(d).toContain('string 6, fret 3, G2');
    expect(d).toContain('string 1, fret 15, G5');
    expect(d).toContain('string 3, open, G3');
    // ordered string descending then fret ascending
    expect(d.indexOf('string 6, fret 3, G2')).toBeLessThan(d.indexOf('string 6, fret 15, G3'));
    expect(d.indexOf('string 6, fret 15, G3')).toBeLessThan(d.indexOf('string 5, fret 10, G3'));
    expect(d.indexOf('string 2, fret 20, G5')).toBeLessThan(d.indexOf('string 1, fret 3, G4'));
  });
});

describe('buildNotesModel: several notes', () => {
  it('shows no tones and no badges for two notes', () => {
    const display = build(select(1, 4));
    const hl = display.model.markers.filter((mk) => mk.emphasis === 'highlighted');
    expect(hl.length).toBe(display.highlightedCount);
    expect(hl.length).toBeGreaterThan(0);
    for (const mk of hl) {
      expect(mk.tone).toBeUndefined();
      expect(mk.octaveBadge).toBeFalsy();
    }
    expect((display.model.description ?? '').startsWith('C sharp and E selected:')).toBe(true);
  });

  it('highlights every position when all 12 notes are selected', () => {
    const display = build(select(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11));
    expect(display.model.markers.every((mk) => mk.emphasis === 'highlighted')).toBe(true);
    expect(display.highlightedCount).toBe(allPositions(STANDARD_GUITAR).length);
  });
});

describe('toneOf clamp', () => {
  it('maps low and high octaves into 1..7', () => {
    const low = {
      ...STANDARD_GUITAR,
      openStrings: [{ letter: 'C' as const, accidental: 0 as const, octave: 0 }],
      stringCount: 1,
      fretCount: 0
    };
    const hi = {
      ...low,
      openStrings: [{ letter: 'C' as const, accidental: 0 as const, octave: 9 }]
    };
    const s = toggleNote(initialNotesView(low), 0);
    expect(buildNotesModel(s, low).model.markers[0].tone).toBe(1);
    expect(buildNotesModel(toggleNote(initialNotesView(hi), 0), hi).model.markers[0].tone).toBe(7);
  });
});

describe('buildNotesModel: position card open (US2)', () => {
  const s3f2 = { string: 3, fret: 2 };
  const open = (s: NotesViewState, p = s3f2): NotesViewState => openCard(s, p);

  it('highlights the tapped position and its unisons only, labeled, no tones', () => {
    const { model, highlightedCount } = build(open(INIT));
    const hl = model.markers.filter((mk) => mk.emphasis === 'highlighted');
    expect(hl.map((mk) => `${mk.string}:${mk.fret}`).sort()).toEqual(
      ['3:2', '4:7', '5:12', '6:17'].sort()
    );
    expect(highlightedCount).toBe(4);
    for (const mk of hl) {
      expect(mk.tone).toBeUndefined();
      expect(mk.octaveBadge).toBeFalsy();
      expect(mk.label).not.toBe(false);
      expect(mk.function).toBe('neutral');
    }
  });

  it('dims every other visible position; labels it only inside the filters', () => {
    const s = { ...open(INIT), activeStrings: [3, 4, 5, 6] };
    const markers = byKey(build(s).model.markers);
    const inFilter = markers.get('4:0');
    const outFilter = markers.get('1:0');
    expect(inFilter?.emphasis).toBe('dimmed');
    expect(inFilter?.label).not.toBe(false);
    expect(outFilter?.emphasis).toBe('dimmed');
    expect(outFilter?.label).toBe(false);
  });

  it('keeps a hidden altered position highlighted and labeled when tapped', () => {
    const mk = byKey(build(open(INIT, { string: 5, fret: 4 })).model.markers).get('5:4');
    expect(mk?.emphasis).toBe('highlighted');
    expect(mk?.label).not.toBe(false);
  });

  it('hides unselected, non-background positions even with the card open (row 1b)', () => {
    const markers = byKey(build(open(INIT)).model.markers);
    // s5f1 = A♯2: altered, not selected, not in naturals background
    expect(markers.get('5:1')?.emphasis).toBe('hidden');
  });

  it('cardInfo carries the §6 fields', () => {
    const info = cardInfo(open(INIT), STANDARD_GUITAR);
    expect(info).toEqual({
      position: s3f2,
      pitchClass: 9,
      spelling: { letter: 'A', accidental: 0 },
      altSpelling: null,
      octave: 3,
      unisons: [
        { string: 4, fret: 7 },
        { string: 5, fret: 12 },
        { string: 6, fret: 17 }
      ],
      selected: false
    });
    expect(build(open(INIT)).cardInfo).toEqual(info);
  });

  it('cardInfo gives sharp + flat spellings for altered notes and the selected flag', () => {
    const info = cardInfo(open(select(1), { string: 5, fret: 4 }), STANDARD_GUITAR);
    expect(info?.spelling).toEqual({ letter: 'C', accidental: 1 });
    expect(info?.altSpelling).toEqual({ letter: 'D', accidental: -1 });
    expect(info?.octave).toBe(3);
    expect(info?.selected).toBe(true);
  });

  it('cardInfo is null when no card is open', () => {
    expect(cardInfo(INIT, STANDARD_GUITAR)).toBeNull();
    expect(build(INIT).cardInfo).toBeNull();
  });

  it('appends the card sentence to the description', () => {
    expect(build(open(INIT)).model.description).toContain(
      'Position card: A3, string 3, fret 2, 3 positions with the same pitch.'
    );
  });
});

describe('buildNotesModel: filters (US3)', () => {
  const filtered = (
    selection: number[],
    activeStrings: number[],
    start: number,
    end: number
  ): NotesViewState => ({ ...select(...selection), activeStrings, region: { start, end } });

  it('dims and unlabels positions outside the active strings or region (row 3)', () => {
    const s = filtered([4], [1, 2], 3, 9);
    const markers = byKey(build(s).model.markers);
    for (const p of allPositions(STANDARD_GUITAR)) {
      const mk = markers.get(positionKey(p));
      if (!mk || mk.emphasis === 'hidden') continue;
      const inFilter = p.string <= 2 && p.fret >= 3 && p.fret <= 9;
      if (!inFilter) {
        expect(mk.emphasis).toBe('dimmed');
        expect(mk.label).toBe(false);
      }
    }
  });

  it('keeps in-filter selected positions highlighted', () => {
    const s = filtered([4], [1], 0, 22);
    const { model, highlightedCount } = build(s);
    expect(highlightedCount).toBe(
      model.markers.filter((mk) => mk.emphasis === 'highlighted').length
    );
    expect(model.markers.find((mk) => mk.string === 1 && mk.fret === 0)?.emphasis).toBe(
      'highlighted'
    );
    expect(model.markers.find((mk) => mk.string === 2 && mk.fret === 8)?.emphasis).toBe('dimmed');
  });

  it('with a card open, out-of-filter dimmed markers are unlabeled (row 1c)', () => {
    const s = openCard(filtered([0], [1], 0, 4), { string: 1, fret: 0 });
    const markers = byKey(build(s).model.markers);
    const inside = markers.get('1:1');
    const outside = markers.get('2:1');
    if (!inside || !outside) throw new Error('missing marker');
    expect(inside.emphasis).toBe('dimmed');
    expect(inside.label).toBe(true);
    expect(outside.emphasis).toBe('dimmed');
    expect(outside.label).toBe(false);
  });

  it('lists missing notes in selection order', () => {
    const s = filtered([1, 0, 4, 3], [1], 0, 4);
    expect(build(s).missing).toEqual([1, 0, 3]);
    expect(build(INIT).missing).toEqual([]);
    expect(build(select(1)).missing).toEqual([]);
  });

  it('exposes model.region', () => {
    expect(build(filtered([], [1, 2, 3, 4, 5, 6], 5, 9)).model.region).toEqual({
      start: 5,
      end: 9
    });
    expect(build(INIT).model.region).toBeUndefined();
  });

  it('describes active strings and frets', () => {
    expect(build(filtered([], [1, 2, 3, 4, 5, 6], 5, 9)).model.description).toBe(
      'Showing natural notes, strings 1 to 6, frets 5 to 9.'
    );
    expect(build(filtered([], [1, 3, 6], 0, 22)).model.description).toContain('strings 1, 3, 6');
    expect(build(filtered([], [2, 3, 4], 0, 22)).model.description).toContain('strings 2 to 4');
  });
});

describe('buildNotesModel: background and label type (US4)', () => {
  const withBg = (s: NotesViewState, background: NotesViewState['background']): NotesViewState => ({
    ...s,
    background
  });
  const withLabel = (
    s: NotesViewState,
    labelType: NotesViewState['labelType']
  ): NotesViewState => ({ ...s, labelType });

  it("background 'all' shows naturals and altered notes", () => {
    const markers = byKey(build(withBg(INIT, 'all')).model.markers);
    for (const p of allPositions(STANDARD_GUITAR)) {
      const mk = markers.get(positionKey(p));
      expect(mk?.emphasis).toBe('normal');
    }
  });

  it("background 'all' dims with a label when a selection exists", () => {
    const { model } = build(withBg(select(0), 'all'));
    const markers = byKey(model.markers);
    // string 5 fret 4 = C♯ (unselected, altered)
    const mk = markers.get('5:4');
    expect(mk?.emphasis).toBe('dimmed');
    expect(mk?.label).toBe(true);
    // string 5 fret 3 = C (selected)
    expect(markers.get('5:3')?.emphasis).toBe('highlighted');
  });

  it("background 'none' shows only selected notes, others hidden", () => {
    const { model } = build(withBg(select(0), 'none'));
    for (const mk of model.markers) {
      const selected = pcOf(mk.string, mk.fret) === 0;
      expect(mk.emphasis).toBe(selected ? 'highlighted' : 'hidden');
    }
  });

  it('a selected altered note shows under naturals', () => {
    const markers = byKey(build(select(1)).model.markers);
    expect(markers.get('5:4')?.emphasis).toBe('highlighted');
    expect(markers.get('5:6')?.emphasis).toBe('hidden'); // D♯ stays hidden
  });

  it("emptyGuidance only when background 'none' and nothing selected", () => {
    expect(build(INIT).emptyGuidance).toBe(false);
    expect(build(withBg(INIT, 'all')).emptyGuidance).toBe(false);
    expect(build(withBg(INIT, 'none')).emptyGuidance).toBe(true);
    expect(build(withBg(select(1), 'none')).emptyGuidance).toBe(false);
    expect(build(select(1)).emptyGuidance).toBe(false);
  });

  it('Octave label type: labelMode octave, tones on for any selection size', () => {
    const one = build(withLabel(select(9), 'octave')).model;
    expect(one.labelMode).toBe('octave');
    expect(one.markers.some((mk) => mk.emphasis === 'highlighted' && mk.tone !== undefined)).toBe(
      true
    );
    expect(one.markers.every((mk) => !mk.octaveBadge)).toBe(true);
    const two = build(withLabel(select(0, 4), 'octave')).model;
    const hl = two.markers.filter((mk) => mk.emphasis === 'highlighted');
    expect(hl.length).toBeGreaterThan(0);
    expect(hl.every((mk) => mk.tone !== undefined)).toBe(true);
    // labels on highlighted and selection-dimmed markers
    const dimmed = two.markers.filter((mk) => mk.emphasis === 'dimmed');
    expect(dimmed.every((mk) => mk.label === true || mk.label === false)).toBe(true);
    expect(dimmed.some((mk) => mk.label === true)).toBe(true);
    expect(hl.every((mk) => mk.label !== false)).toBe(true);
  });

  it('Octave label type with no selection: normal markers carry no tone', () => {
    const { model } = build(withLabel(INIT, 'octave'));
    expect(model.labelMode).toBe('octave');
    expect(model.markers.every((mk) => mk.tone === undefined)).toBe(true);
  });

  it('No label: labelMode none, tones off, single highlight token', () => {
    const { model } = build(withLabel(select(0), 'none'));
    expect(model.labelMode).toBe('none');
    for (const mk of model.markers) {
      expect(mk.tone).toBeUndefined();
      expect(mk.octaveBadge).toBeFalsy();
    }
    const single = build(withLabel(select(0), 'none')).model;
    expect(single.markers.filter((mk) => mk.emphasis === 'highlighted').length).toBeGreaterThan(0);
  });
});

describe('Hide names (US5, FR-011)', () => {
  const hidden = (pcs: number[]) => setHideNames(select(...pcs), true);

  it('removes labels, tones and badges; hover hint off', () => {
    const { model } = build(hidden([7]));
    expect(model.labelMode).toBe('none');
    expect(model.hoverHint).toBe(false);
    for (const mk of model.markers) {
      expect(mk.tone).toBeUndefined();
      expect(mk.octaveBadge).toBeFalsy();
    }
  });

  it('hover hint stays on by default', () => {
    expect(build(select(7)).model.hoverHint).toBe(true);
  });

  it('description lists no entries for unselected positions', () => {
    const d = build(setHideNames(INIT, true)).model.description ?? '';
    expect(d).not.toMatch(/string \d, (fret|open)/);
  });

  it('the position card still shows the name', () => {
    const s = openCard(hidden([]), { string: 3, fret: 2 });
    expect(cardInfo(s, STANDARD_GUITAR)?.octave).toBe(3);
    expect(build(s).cardInfo?.spelling.letter).toBe('A');
  });
});

describe('Listen (US5, FR-012)', () => {
  const pitchOf = (p: { string: number; fret: number }) => positionPitch(STANDARD_GUITAR, p);
  const flat = (steps: ReturnType<typeof listenSteps>) =>
    steps.map((st) => (Array.isArray(st) ? st : [st]));

  it('LISTEN_BPM is 120', () => {
    expect(LISTEN_BPM).toBe(120);
  });

  it('A: steps ascend by pitch, unisons group as chords ordered by string number', () => {
    const steps = flat(listenSteps(select(9), STANDARD_GUITAR));
    const pitches = steps.map((g) => pitchOf(g[0]));
    expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
    expect(new Set(pitches).size).toBe(pitches.length);
    const a3 = steps.find((g) => g.some((p) => p.string === 3 && p.fret === 2));
    expect(a3?.map((p) => p.string)).toEqual([3, 4, 5, 6]);
    expect(a3?.map((p) => p.fret)).toEqual([2, 7, 12, 17]);
    // single positions stay bare
    const raw = listenSteps(select(4), STANDARD_GUITAR);
    expect(raw.some((st) => !Array.isArray(st))).toBe(true);
    expect(steps.flat()).toHaveLength(
      allPositions(STANDARD_GUITAR).filter((p) => pcOf(p.string, p.fret) === 9).length
    );
  });

  it('respects active strings and region', () => {
    const s = setRegionShortcut(toggleString(select(9), 6), '0-4', STANDARD_GUITAR);
    const ps = flat(listenSteps(s, STANDARD_GUITAR)).flat();
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.string).not.toBe(6);
      expect(p.fret).toBeLessThanOrEqual(4);
      expect(pcOf(p.string, p.fret)).toBe(9);
    }
  });

  it('availability matrix', () => {
    expect(build(INIT).listen).toEqual({ enabled: false, reason: 'none' });
    expect(build(select(9)).listen).toEqual({ enabled: true });
    expect(build(select(9, 0, 4)).listen).toEqual({ enabled: true });
    expect(build(select(9, 0, 4, 7)).listen).toEqual({ enabled: false, reason: 'too-many' });
    expect(build(select(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)).listen).toEqual({
      enabled: false,
      reason: 'too-many'
    });
  });

  it('no-positions when nothing selected is inside the filters', () => {
    const s = {
      ...select(1),
      activeStrings: [1],
      region: { start: 0, end: 4 }
    };
    expect(build(s).listen).toEqual({ enabled: false, reason: 'no-positions' });
  });

  it('exposes listenSteps on the display', () => {
    expect(build(select(9)).listenSteps).toEqual(listenSteps(select(9), STANDARD_GUITAR));
  });
});

describe('buildNotesModel with a unison tuning (011 US4, scenario 4.7)', () => {
  const unison = tuningInstrument(tuningFromOffsets([0, 0, 0, 4, 0, 0]), 6, 22);

  it('strings 3 and 2 share a pitch: every note shows on every string', () => {
    const positions = allPositions(unison);
    expect(positionPitch(unison, { string: 3, fret: 0 })).toEqual(
      positionPitch(unison, { string: 2, fret: 0 })
    );
    for (const pc of [0, 4, 7, 11] as const) {
      const s = toggleNote(initialNotesView(unison), pc);
      const markers = buildNotesModel(s, unison).model.markers;
      expect(markers).toHaveLength(positions.length);
      const expected = positions.filter((p) => pitchClass(positionPitch(unison, p)) === pc);
      const highlighted = markers.filter((mk) => mk.emphasis === 'highlighted');
      expect(highlighted.map((mk) => `${mk.string}:${mk.fret}`).sort()).toEqual(
        expected.map((p) => `${p.string}:${p.fret}`).sort()
      );
    }
  });
});

describe('seven strings (012, US2)', () => {
  const SEVEN = presetInstrument('AF-21', 7, 22);
  const DROP_A = presetInstrument('AF-23', 7, 22);
  const base = initialNotesView(SEVEN);
  const keys = (ps: readonly { string: number; fret: number }[]) =>
    ps.map((p) => `${p.string}:${p.fret}`);
  const open = (i: typeof SEVEN, string: number, fret: number) =>
    openCard(initialNotesView(i), { string, fret });

  it('string 7 at frets 0–5 in AF-21 is B C C♯ D D♯ E, all shown with Show all', () => {
    const s = setBackground({ ...base, region: { start: 0, end: 5 } }, 'all');
    const markers = byKey(buildNotesModel(s, SEVEN).model.markers);
    const names = ['B', 'C', 'C♯', 'D', 'D♯', 'E'];
    for (let fret = 0; fret <= 5; fret++) {
      const mk = markers.get(`7:${fret}`);
      expect(mk?.emphasis).toBe('normal');
      expect(pitchClass(positionPitch(SEVEN, { string: 7, fret }))).toBe([11, 0, 1, 2, 3, 4][fret]);
      expect(noteLabel(mk?.spelling ?? defaultSpelling(pitchClass(35 + fret)))).toBe(names[fret]);
    }
  });

  it('note filter highlights string 7 occurrences', () => {
    const m = byKey(buildNotesModel(toggleNote(base, 11), SEVEN).model.markers); // B
    expect(m.get('7:0')?.emphasis).toBe('highlighted');
    expect(m.get('7:12')?.emphasis).toBe('highlighted');
    expect(m.get('6:7')?.emphasis).toBe('highlighted');
  });

  it('string filter hides or keeps string 7', () => {
    const sel = toggleNote(base, 11);
    const off = byKey(buildNotesModel(toggleString(sel, 7, SEVEN), SEVEN).model.markers);
    expect(off.get('7:0')?.emphasis).not.toBe('highlighted');
    const only7 = [1, 2, 3, 4, 5, 6].reduce((s, n) => toggleString(s, n, SEVEN), sel);
    expect(only7.activeStrings).toEqual([7]);
    const on = byKey(buildNotesModel(only7, SEVEN).model.markers);
    expect(on.get('7:0')?.emphasis).toBe('highlighted');
    expect(on.get('6:7')?.emphasis).not.toBe('highlighted');
  });

  it('region filter includes string 7', () => {
    const s = toggleNote(setRegionShortcut(base, '5-9', SEVEN), 11);
    const m = byKey(buildNotesModel(s, SEVEN).model.markers);
    expect(m.get('7:0')?.emphasis).not.toBe('highlighted');
    expect(m.get('7:12')?.emphasis).not.toBe('highlighted');
    expect(m.get('6:7')?.emphasis).toBe('highlighted');
    const e = toggleNote(setRegionShortcut(base, '10-14', SEVEN), 11);
    expect(byKey(buildNotesModel(e, SEVEN).model.markers).get('7:12')?.emphasis).toBe(
      'highlighted'
    );
  });

  it('Drop A: string 7 fret 12 (A2) = string 6 fret 5 and string 5 fret 0', () => {
    const info = cardInfo(open(DROP_A, 7, 12), DROP_A);
    expect(keys(info?.unisons ?? [])).toEqual(['5:0', '6:5']);
  });

  it('Drop A reverse: string 5 fret 0 lists string 7 fret 12', () => {
    const info = cardInfo(open(DROP_A, 5, 0), DROP_A);
    expect(keys(info?.unisons ?? [])).toContain('7:12');
  });

  it('B1 (string 7) and B3 (string 2) are not unisons', () => {
    const info = cardInfo(open(SEVEN, 7, 0), SEVEN);
    expect(keys(info?.unisons ?? [])).not.toContain('2:0');
    expect(info?.octave).toBe(1);
  });

  it('description says strings 1 to 7', () => {
    expect(buildNotesModel(base, SEVEN).model.description).toBe(
      'Showing natural notes, strings 1 to 7, frets 0 to 22.'
    );
  });
});

describe('buildNotesModel: accidental policy (021)', () => {
  const policy = (accidentals: AccidentalPolicy) =>
    overwriteNotationSource(() => ({ notation: 'letters', accidentals }));
  afterEach(() => resetNotationSourceForTests());

  const pairOf = (s: NotesViewState): string[] => {
    const info = buildNotesModel(s, STANDARD_GUITAR).cardInfo;
    if (!info?.altSpelling) throw new Error('expected an altered card');
    return [noteLabel(info.spelling), noteLabel(info.altSpelling)];
  };

  it('sets spellingPolicy "preference"', () => {
    expect(build(INIT).model.spellingPolicy).toBe('preference');
  });

  it('card info lists the preferred spelling first', () => {
    // string 2 fret 2 = C♯ (pc 1)
    const s = openCard(INIT, { string: 2, fret: 2 });
    policy('sharps');
    expect(pairOf(s)).toEqual(['C♯', 'D♭']);
    policy('flats');
    expect(pairOf(s)).toEqual(['D♭', 'C♯']);
  });

  it('card info for a natural has no alternative under any policy', () => {
    const s = openCard(INIT, { string: 1, fret: 0 });
    for (const p of ['sharps', 'flats', 'both'] as const) {
      policy(p);
      expect(buildNotesModel(s, STANDARD_GUITAR).cardInfo?.altSpelling).toBeNull();
    }
  });

  it('missing-notes and detected-triad root use the single spelling (sharp under both)', () => {
    const view = select(10, 2, 5); // A♯/B♭, D, F → B♭ major
    policy('flats');
    expect(build(view).detected?.name).toBe('B♭ major');
    policy('sharps');
    expect(build(view).detected?.name).toBe('A♯ major');
    policy('both');
    expect(build(view).detected?.name).toBe('A♯ major');
  });

  it('description speaks both spellings only under both', () => {
    const view = select(1);
    policy('both');
    expect(build(view).model.description).toContain('C sharp or D flat');
    policy('flats');
    expect(build(view).model.description).toContain('D flat');
    expect(build(view).model.description).not.toContain('C sharp');
    policy('sharps');
    expect(build(view).model.description).not.toContain('D flat');
  });

  it('SC-003: Triads and CAGED keep theory spellings under flats (A major is A–C♯–E)', () => {
    policy('flats');
    const triads = buildTriadsModel(
      selectTriadRoot(initialTriadsView(STANDARD_GUITAR), 9),
      STANDARD_GUITAR
    );
    expect(triads.model.spellingPolicy).toBeUndefined();
    if (!('composition' in triads)) throw new Error('expected a triads body');
    const names = triads.composition.notes.map((n) => noteLabel(n.spelling));
    expect(names).toEqual(['A', 'C♯', 'E']);
    const caged = buildCaged(selectCagedRoot(initialCagedView(), 9), STANDARD_GUITAR, {
      tuningName: 'Standard',
      temporary: false
    });
    expect(caged.model?.spellingPolicy).toBeUndefined();
  });
});
