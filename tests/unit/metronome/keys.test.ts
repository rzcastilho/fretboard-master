import { describe, expect, it } from 'vitest';
import { matchMetronomeKey } from '../../../src/lib/state/metronome-keys';
import type { ShortcutEventLike, ShortcutTarget } from '../../../src/lib/state/shortcuts';

type Ev = ShortcutEventLike & { targetActivates?: boolean };

function ev(
  key: string,
  over: Partial<Ev> = {},
  target: ShortcutTarget | null = { tagName: 'BODY' }
): Ev {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    isComposing: false,
    target,
    ...over
  };
}

const running = { phase: 'running', disclosureOpen: false } as const;
const settings = { phase: 'settings', disclosureOpen: false } as const;

describe('matchMetronomeKey', () => {
  it('Space on the body toggles', () => {
    expect(matchMetronomeKey(ev(' '), settings)).toBe('toggle');
  });

  it.each([
    [{ tagName: 'BUTTON' }],
    [{ tagName: 'A' }],
    [{ tagName: 'SUMMARY' }],
    [{ tagName: 'INPUT', type: 'checkbox' }],
    [{ tagName: 'INPUT', type: 'radio' }],
    [{ tagName: 'INPUT', type: 'button' }]
  ])('Space on a natively activating target %j is left to the browser', (target) => {
    expect(matchMetronomeKey(ev(' ', {}, target), running)).toBeNull();
  });

  it('Space on a range input toggles', () => {
    expect(matchMetronomeKey(ev(' ', {}, { tagName: 'INPUT', type: 'range' }), running)).toBe(
      'toggle'
    );
  });

  it('Space is ignored when the target is flagged as activating', () => {
    expect(matchMetronomeKey(ev(' ', { targetActivates: true }), running)).toBeNull();
  });

  it('Escape resets outside settings', () => {
    for (const phase of ['starting', 'running', 'paused'] as const) {
      expect(matchMetronomeKey(ev('Escape'), { phase, disclosureOpen: false })).toBe('reset');
    }
  });

  it('Escape does nothing in settings or with a disclosure open', () => {
    expect(matchMetronomeKey(ev('Escape'), settings)).toBeNull();
    expect(matchMetronomeKey(ev('Escape'), { phase: 'running', disclosureOpen: true })).toBeNull();
  });

  it.each([
    ['ctrlKey'],
    ['metaKey'],
    ['altKey'],
    ['repeat'],
    ['isComposing'],
    ['defaultPrevented']
  ] as const)('%s blocks both keys', (flag) => {
    expect(matchMetronomeKey(ev(' ', { [flag]: true }), running)).toBeNull();
    expect(matchMetronomeKey(ev('Escape', { [flag]: true }), running)).toBeNull();
  });

  it('AltGraph blocks both keys', () => {
    const getModifierState = (k: string) => k === 'AltGraph';
    expect(matchMetronomeKey(ev(' ', { getModifierState }), running)).toBeNull();
    expect(matchMetronomeKey(ev('Escape', { getModifierState }), running)).toBeNull();
  });

  it.each([
    [{ tagName: 'INPUT', type: 'text' }],
    [{ tagName: 'INPUT' }],
    [{ tagName: 'TEXTAREA' }],
    [{ tagName: 'SELECT' }],
    [{ tagName: 'DIV', isContentEditable: true }]
  ])('text-entry target %j blocks both keys', (target) => {
    expect(matchMetronomeKey(ev(' ', {}, target), running)).toBeNull();
    expect(matchMetronomeKey(ev('Escape', {}, target), running)).toBeNull();
  });

  it('other keys are ignored', () => {
    expect(matchMetronomeKey(ev('p'), running)).toBeNull();
  });

  it('does not depend on the character-key shortcut switch', () => {
    // The matcher takes no `shortcuts.enabled` input: same result regardless of that state.
    expect(matchMetronomeKey(ev(' '), running)).toBe('toggle');
    expect(matchMetronomeKey.length).toBe(2);
  });

  it('Space and Escape from a SELECT never start or reset (032)', () => {
    const select = { tagName: 'SELECT' };
    expect(matchMetronomeKey(ev(' ', {}, select), settings)).toBeNull();
    expect(matchMetronomeKey(ev('Escape', {}, select), running)).toBeNull();
  });

  it('Space on the Count In switch toggles the switch, never the run (033)', () => {
    const button = { tagName: 'BUTTON' };
    expect(matchMetronomeKey(ev(' ', { targetActivates: true }, button), settings)).toBeNull();
    expect(
      matchMetronomeKey(ev(' ', { targetActivates: true }, { tagName: 'DIV' }), settings)
    ).toBeNull();
  });
});
