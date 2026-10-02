import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import TriadsTool from '../../../src/lib/tools/triads/TriadsTool.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

describe('TriadsControls (US2)', () => {
  it('renders Root, Quality, Inversion and String set groups at once', () => {
    render(TriadsTool);
    expect(screen.getByRole('group', { name: 'Root' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Quality' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Inversion' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'String set' })).toBeTruthy();
  });

  it('root buttons show "C♯ / D♭" style labels', () => {
    render(TriadsTool);
    const root = screen.getByRole('group', { name: 'Root' });
    expect(within(root).getAllByRole('button')).toHaveLength(12);
    expect(within(root).getByText('C♯ / D♭')).toBeTruthy();
  });

  it('marks the current choices and labels sets with setLabel', () => {
    render(TriadsTool);
    const sets = screen.getByRole('radiogroup', { name: 'String set' });
    expect(
      within(sets)
        .getAllByRole('radio')
        .map((r) => r.textContent?.trim())
    ).toEqual(['6-5-4', '5-4-3', '4-3-2', '3-2-1']);
    expect(within(sets).getByRole('radio', { name: '3-2-1' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(
      within(screen.getByRole('radiogroup', { name: 'Quality' }))
        .getByRole('radio', { name: 'major' })
        .getAttribute('aria-checked')
    ).toBe('true');
  });

  it('selecting a control fires the store action and keeps the other three', async () => {
    render(TriadsTool);
    await fireEvent.click(
      within(screen.getByRole('group', { name: 'Root' })).getByRole('button', { name: /^A$/ })
    );
    expect(triads.state.rootPc).toBe(9);
    await fireEvent.click(screen.getByRole('radio', { name: 'minor' }));
    await fireEvent.click(screen.getByRole('radio', { name: '1st inversion' }));
    await fireEvent.click(screen.getByRole('radio', { name: '4-3-2' }));
    expect(triads.state).toMatchObject({
      rootPc: 9,
      quality: 'minor',
      inversion: 'first',
      stringSet: 4
    });
    expect(screen.getByText('A minor — 1st inversion')).toBeTruthy();
  });

  it('arrow keys move within a group and select', async () => {
    render(TriadsTool);
    const major = screen.getByRole('radio', { name: 'major' });
    major.focus();
    await fireEvent.keyDown(major, { key: 'ArrowRight' });
    expect(triads.state.quality).toBe('minor');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'minor' }));
    await fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(triads.state.quality).toBe('augmented');
  });

  it('has a View group with Isolated, Full neck and All notes', () => {
    render(TriadsTool);
    const views = screen.getByRole('radiogroup', { name: 'View' });
    expect(
      within(views)
        .getAllByRole('radio')
        .map((r) => r.textContent?.trim())
    ).toEqual(['Isolated', 'Full neck', 'All notes']);
  });

  it('SC-004: inversion and string set are disabled only in All notes, values kept', async () => {
    triads.setInversion('second');
    triads.setStringSet(4);
    render(TriadsTool);
    const inversion = () => screen.getByRole('radiogroup', { name: 'Inversion' });
    const sets = () => screen.getByRole('radiogroup', { name: 'String set' });
    for (const v of ['isolated', 'full-neck'] as const) {
      triads.setView(v);
      await Promise.resolve();
      expect(inversion().hasAttribute('aria-disabled')).toBe(false);
      expect(inversion().getAttribute('aria-describedby')).toBeNull();
      expect(screen.queryByText('Not used in All notes')).toBeNull();
    }
    await fireEvent.click(screen.getByRole('radio', { name: 'All notes' }));
    expect(triads.state.view).toBe('all-notes');
    for (const g of [inversion(), sets()]) {
      expect(g.getAttribute('aria-disabled')).toBe('true');
      const hint = g.getAttribute('aria-describedby');
      expect(hint).toBeTruthy();
      expect(document.getElementById(hint as string)?.textContent).toBe('Not used in All notes');
    }
    expect(
      within(inversion()).getByRole('radio', { name: '2nd inversion' }).getAttribute('aria-checked')
    ).toBe('true');
    expect(within(sets()).getByRole('radio', { name: '4-3-2' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    // Operating a disabled group changes nothing.
    await fireEvent.click(within(inversion()).getByRole('radio', { name: 'Root position' }));
    expect(triads.state.inversion).toBe('second');
    // Back to another view: enabled again with prior values.
    await fireEvent.click(screen.getByRole('radio', { name: 'Isolated' }));
    expect(inversion().hasAttribute('aria-disabled')).toBe(false);
    expect(sets().hasAttribute('aria-disabled')).toBe(false);
    expect(triads.state).toMatchObject({ inversion: 'second', stringSet: 4 });
  });
});
