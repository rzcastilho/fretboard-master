import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import NotesActions from '../../../src/lib/tools/notes/NotesActions.svelte';

const setup = (over: Record<string, unknown> = {}) => {
  const props = {
    background: 'naturals' as const,
    labelType: 'name' as const,
    onbackground: vi.fn(),
    onlabeltype: vi.fn(),
    hideNames: false,
    listen: { enabled: true } as
      { enabled: true } | { enabled: false; reason: 'none' | 'too-many' | 'no-positions' },
    onhidenames: vi.fn(),
    onlisten: vi.fn(),
    onclear: vi.fn(),
    onreset: vi.fn(),
    ...over
  };
  render(NotesActions, props);
  return props;
};

describe.each([
  ['Show', ['Natural notes', 'All notes', 'None'], 'Natural notes'],
  ['Label', ['Name', 'Octave', 'No label'], 'Name']
] as const)('NotesActions %s radiogroup', (group, labels, def) => {
  it('has the radios in order with the default checked and a roving tabindex', () => {
    setup();
    const g = screen.getByRole('radiogroup', { name: group });
    const radios = within(g).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label') ?? r.textContent?.trim())).toEqual([
      ...labels
    ]);
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent?.trim()).toBe(def);
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(
      radios.map((r) => (r === checked[0] ? '0' : '-1'))
    );
  });

  it('arrow keys move and select, wrapping', async () => {
    const props = setup();
    const g = screen.getByRole('radiogroup', { name: group });
    const radios = within(g).getAllByRole('radio');
    const spy = group === 'Show' ? props.onbackground : props.onlabeltype;
    radios[0].focus();
    await fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(spy).toHaveBeenLastCalledWith(group === 'Show' ? 'all' : 'octave');
    expect(document.activeElement).toBe(radios[1]);
    await fireEvent.keyDown(radios[0], { key: 'ArrowLeft' });
    expect(spy).toHaveBeenLastCalledWith(group === 'Show' ? 'none' : 'none');
    expect(document.activeElement).toBe(radios[2]);
  });

  it('click selects; Tab is not intercepted', async () => {
    const props = setup();
    const g = screen.getByRole('radiogroup', { name: group });
    const radios = within(g).getAllByRole('radio');
    const spy = group === 'Show' ? props.onbackground : props.onlabeltype;
    await fireEvent.click(radios[2]);
    expect(spy).toHaveBeenCalledWith('none');
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    radios[0].dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('NotesActions state', () => {
  it('reflects non-default values', () => {
    setup({ background: 'all', labelType: 'octave' });
    expect(screen.getByRole('radio', { name: 'All notes' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(screen.getByRole('radio', { name: 'Octave' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('NotesActions buttons (US5)', () => {
  it('Hide names is an aria-pressed toggle', async () => {
    const props = setup();
    const b = screen.getByRole('button', { name: 'Hide names' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(b);
    expect(props.onhidenames).toHaveBeenCalledWith(true);
  });

  it('Hide names reflects the on state and turns off', async () => {
    const props = setup({ hideNames: true });
    const b = screen.getByRole('button', { name: 'Hide names' });
    expect(b.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(b);
    expect(props.onhidenames).toHaveBeenCalledWith(false);
  });

  it('Listen calls onlisten when enabled', async () => {
    const props = setup();
    const b = screen.getByRole('button', { name: 'Listen' });
    expect(b.getAttribute('aria-disabled')).not.toBe('true');
    await fireEvent.click(b);
    expect(props.onlisten).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['none', 'Select one to three notes to listen'],
    ['too-many', 'Listen plays up to three notes'],
    ['no-positions', 'No position of the selected notes is inside the filters']
  ] as const)(
    'Listen disabled (%s) stays in the DOM with a described reason',
    async (reason, text) => {
      const props = setup({ listen: { enabled: false, reason } });
      const b = screen.getByRole('button', { name: 'Listen' });
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('disabled')).toBe(false);
      const id = b.getAttribute('aria-describedby') as string;
      expect(document.getElementById(id)?.textContent?.trim()).toBe(text);
      await fireEvent.click(b);
      expect(props.onlisten).not.toHaveBeenCalled();
    }
  );

  it('Clear and Reset tool call their actions and are always enabled', async () => {
    const props = setup({ listen: { enabled: false, reason: 'none' } });
    const clear = screen.getByRole('button', { name: 'Clear' });
    const reset = screen.getByRole('button', { name: 'Reset tool' });
    expect(clear.hasAttribute('disabled')).toBe(false);
    expect(reset.hasAttribute('disabled')).toBe(false);
    await fireEvent.click(clear);
    await fireEvent.click(reset);
    expect(props.onclear).toHaveBeenCalledTimes(1);
    expect(props.onreset).toHaveBeenCalledTimes(1);
  });
});
