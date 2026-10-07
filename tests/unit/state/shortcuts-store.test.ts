// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY } from '../../../src/lib/prefs/storage';
import { caged, resetCagedForTests } from '../../../src/lib/state/caged.svelte';
import { notation, resetNotationForTests } from '../../../src/lib/state/notation.svelte';
import { notes, resetNotesForTests } from '../../../src/lib/state/notes.svelte';
import { playback, resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { preferences, resetPreferencesForTests } from '../../../src/lib/state/preferences.svelte';
import {
  resetShortcutsForTests,
  runShortcut,
  shortcuts
} from '../../../src/lib/state/shortcuts.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import { fakeStorage } from '../prefs/support';

const stored = (s: ReturnType<typeof fakeStorage>) => JSON.parse(s.data.get(PREFS_KEY) ?? '{}');

beforeEach(() => {
  vi.restoreAllMocks();
  resetPlaybackForTests();
  resetNotesForTests();
  resetTriadsForTests();
  resetCagedForTests();
  resetNotationForTests();
  resetPreferencesForTests();
  resetShortcutsForTests();
  // Never produce sound or timers in these tests.
  vi.spyOn(playback, 'sequence').mockImplementation(() => undefined as never);
});

afterEach(() => {
  resetShortcutsForTests();
});

describe('shortcuts switch store', () => {
  it('enabled defaults true', () => {
    expect(shortcuts.enabled).toBe(true);
  });

  it('start(false) sets without writing', () => {
    const s = fakeStorage();
    preferences.start(s);
    const writes = s.calls.set;
    shortcuts.start(false);
    expect(shortcuts.enabled).toBe(false);
    expect(s.calls.set).toBe(writes);
  });

  it('choose(false) sets, then remembers shortcuts false', () => {
    const remember = vi.spyOn(preferences, 'remember');
    shortcuts.choose(false);
    expect(shortcuts.enabled).toBe(false);
    expect(remember).toHaveBeenCalledWith({ shortcuts: false });
  });

  it('choose(false) reaches storage; choose(true) drops the key', () => {
    const s = fakeStorage();
    preferences.start(s);
    shortcuts.choose(false);
    expect(stored(s).shortcuts).toBe(false);
    shortcuts.choose(true);
    expect(stored(s).shortcuts).toBeUndefined();
  });

  it('restore(true) sets without writing', () => {
    shortcuts.start(false);
    const remember = vi.spyOn(preferences, 'remember');
    shortcuts.restore(true);
    expect(shortcuts.enabled).toBe(true);
    expect(remember).not.toHaveBeenCalled();
  });
});

describe('runShortcut: listen', () => {
  it('notes runs listen() when enabled, else returns false', () => {
    const listen = vi.spyOn(notes, 'listen');
    expect(notes.display.listen.enabled).toBe(false);
    expect(runShortcut('listen', 'notes')).toBe(false);
    expect(listen).not.toHaveBeenCalled();
    notes.toggleNote(0);
    expect(notes.display.listen.enabled).toBe(true);
    expect(runShortcut('listen', 'notes')).toBe(true);
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('triads runs listen() and never listenComparison()', () => {
    const listen = vi.spyOn(triads, 'listen');
    const cmp = vi.spyOn(triads, 'listenComparison');
    expect(triads.display.listen.enabled).toBe(true);
    expect(runShortcut('listen', 'triads')).toBe(true);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(cmp).not.toHaveBeenCalled();
  });

  it('triads returns false when its Listen is disabled', () => {
    triads.setView('all-notes');
    const listen = vi.spyOn(triads, 'listen');
    const enabled = triads.display.listen.enabled;
    expect(runShortcut('listen', 'triads')).toBe(enabled);
    expect(listen).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });

  it('caged runs listen() when enabled', () => {
    const listen = vi.spyOn(caged, 'listen');
    const enabled = caged.display.listen.enabled;
    expect(runShortcut('listen', 'caged')).toBe(enabled);
    expect(listen).toHaveBeenCalledTimes(enabled ? 1 : 0);
    expect(enabled).toBe(true);
  });

  it('home and about are no-ops', () => {
    const spies = [
      vi.spyOn(notes, 'listen'),
      vi.spyOn(triads, 'listen'),
      vi.spyOn(caged, 'listen')
    ];
    expect(runShortcut('listen', 'home')).toBe(false);
    expect(runShortcut('listen', 'about')).toBe(false);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});

describe('runShortcut: next and previous', () => {
  it('triads next goes root → first → second → root (wrap)', () => {
    const seen = [triads.state.inversion];
    for (let i = 0; i < 3; i++) {
      expect(runShortcut('next', 'triads')).toBe(true);
      seen.push(triads.state.inversion);
    }
    expect(seen).toEqual(['root', 'first', 'second', 'root']);
  });

  it('triads previous goes the reverse way (wrap)', () => {
    const seen = [triads.state.inversion];
    for (let i = 0; i < 3; i++) {
      expect(runShortcut('previous', 'triads')).toBe(true);
      seen.push(triads.state.inversion);
    }
    expect(seen).toEqual(['root', 'second', 'first', 'root']);
  });

  it('triads is a no-op in All notes view (inversion control disabled)', () => {
    triads.setView('all-notes');
    expect(triads.display.controls.inversion).toBe(false);
    const set = vi.spyOn(triads, 'setInversion');
    expect(runShortcut('next', 'triads')).toBe(false);
    expect(runShortcut('previous', 'triads')).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('caged no focus: both no-ops, no wrap', () => {
    const step = vi.spyOn(caged, 'step');
    expect(caged.display.steps).toEqual({ previous: false, next: false });
    expect(runShortcut('next', 'caged')).toBe(false);
    expect(runShortcut('previous', 'caged')).toBe(false);
    expect(step).not.toHaveBeenCalled();
  });

  it('caged steps by one and stops at the ends', () => {
    caged.chooseShape('C');
    const step = vi.spyOn(caged, 'step');
    expect(caged.display.steps.previous).toBe(false);
    expect(runShortcut('previous', 'caged')).toBe(false);
    expect(step).not.toHaveBeenCalled();
    expect(runShortcut('next', 'caged')).toBe(true);
    expect(step).toHaveBeenCalledWith(1);
    expect(runShortcut('previous', 'caged')).toBe(true);
    expect(step).toHaveBeenLastCalledWith(-1);
    const last = caged.display.occurrences.length - 1;
    for (let i = 0; i < last; i++) runShortcut('next', 'caged');
    expect(caged.display.steps.next).toBe(false);
    const calls = step.mock.calls.length;
    expect(runShortcut('next', 'caged')).toBe(false);
    expect(step.mock.calls.length).toBe(calls);
  });

  it('notes, home and about are no-ops', () => {
    for (const screen of ['notes', 'home', 'about'] as const) {
      expect(runShortcut('next', screen)).toBe(false);
      expect(runShortcut('previous', screen)).toBe(false);
    }
  });
});

describe('runShortcut: labels', () => {
  it('notes cycles name → octave → none → name', () => {
    const seen = [notes.state.labelType];
    for (let i = 0; i < 3; i++) {
      expect(runShortcut('labels', 'notes')).toBe(true);
      seen.push(notes.state.labelType);
    }
    expect(seen).toEqual(['name', 'octave', 'none', 'name']);
  });

  it('triads toggles interval ↔ name', () => {
    expect(runShortcut('labels', 'triads')).toBe(true);
    expect(triads.state.labelType).toBe('name');
    expect(runShortcut('labels', 'triads')).toBe(true);
    expect(triads.state.labelType).toBe('interval');
  });

  it('caged toggles interval ↔ name', () => {
    expect(runShortcut('labels', 'caged')).toBe(true);
    expect(caged.state.labelType).toBe('name');
    expect(runShortcut('labels', 'caged')).toBe(true);
    expect(caged.state.labelType).toBe('interval');
  });

  it('home and about are no-ops', () => {
    expect(runShortcut('labels', 'home')).toBe(false);
    expect(runShortcut('labels', 'about')).toBe(false);
  });
});

describe('runShortcut: notation', () => {
  it.each(['home', 'notes', 'triads', 'caged', 'about'] as const)(
    'toggles letters ↔ solfège on %s',
    (screen) => {
      notation.restore('letters', 'sharps');
      expect(runShortcut('notation', screen)).toBe(true);
      expect(notation.effective).toBe('solfege');
      expect(runShortcut('notation', screen)).toBe(true);
      expect(notation.effective).toBe('letters');
    }
  );
});

describe('runShortcut: invariants', () => {
  it('never calls listenComparison or DOM focus', () => {
    const cmp = vi.spyOn(triads, 'listenComparison');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    for (const screen of ['home', 'notes', 'triads', 'caged', 'about'] as const) {
      for (const a of ['listen', 'next', 'previous', 'labels', 'notation'] as const) {
        runShortcut(a, screen);
      }
    }
    expect(cmp).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('ignores the enabled flag (the layout checks it)', () => {
    shortcuts.start(false);
    expect(runShortcut('labels', 'notes')).toBe(true);
  });
});
