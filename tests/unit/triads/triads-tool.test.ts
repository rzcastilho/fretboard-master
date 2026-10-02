import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { SHORT_7 } from '../../../src/lib/instrument/fixtures';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests, triads } from '../../../src/lib/state/triads.svelte';
import TriadsTool from '../../../src/lib/tools/triads/TriadsTool.svelte';

beforeEach(() => {
  resetPlaybackForTests();
  resetTriadsForTests();
});

const labels = () =>
  [...document.querySelectorAll('.marker-label')].map((e) => e.textContent?.trim()).sort();

describe('TriadsTool (US1)', () => {
  it('opens on C major, root position with the panel and a three-marker board', () => {
    render(TriadsTool);
    expect(screen.getByText('C major — Root position')).toBeTruthy();
    expect(screen.getByText('R – 3 – 5')).toBeTruthy();
    expect(labels()).toEqual(['3', '5', 'R']);
  });

  it('switches labels to note names and back', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('radio', { name: 'Note names' }));
    expect(labels()).toEqual(['C', 'E', 'G']);
    await fireEvent.click(screen.getByRole('radio', { name: 'Intervals' }));
    expect(labels()).toEqual(['3', '5', 'R']);
  });
});

describe('TriadsTool Compare control (007 US1)', () => {
  it('shows the Compare toggle in Isolated and keeps the tool simple while off', () => {
    render(TriadsTool);
    expect(screen.getByRole('button', { name: 'Compare' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(screen.queryByRole('radiogroup', { name: 'Compare with' })).toBeNull();
    expect(document.querySelectorAll('.marker.comparison, .arrow')).toHaveLength(0);
  });

  it('turning Compare on overlays the minor triad with a dashed marker and an arrow', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    const group = screen.getByRole('radiogroup', { name: 'Compare with' });
    expect(group.querySelector('[aria-checked="true"]')?.textContent?.trim()).toBe('minor');
    expect(document.querySelectorAll('.marker.comparison')).toHaveLength(1);
    expect(document.querySelectorAll('.arrow')).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: /Root position/ })).toHaveLength(2);
    await fireEvent.click(within(group).getByRole('radio', { name: 'augmented' }));
    expect(document.querySelectorAll('.marker.comparison')).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(document.querySelectorAll('.marker.comparison, .arrow')).toHaveLength(0);
  });

  it('is hidden in All notes and never lists the current quality', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    const group = screen.getByRole('radiogroup', { name: 'Compare with' });
    const names = [...group.querySelectorAll('[role=radio]')].map((r) => r.textContent?.trim());
    expect(names).toEqual(['minor', 'diminished', 'augmented']);
    await fireEvent.click(screen.getByRole('radio', { name: 'All notes' }));
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
  });

  it('007 US2: Compare and Listen to comparison are hidden in All notes, restored on return', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'Full neck' }));
    expect(document.querySelectorAll('.marker.comparison').length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole('radio', { name: 'All notes' }));
    expect(screen.queryByRole('button', { name: 'Compare' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Compare with' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Listen to comparison/i })).toBeNull();
    expect(document.querySelectorAll('.marker.comparison, .arrow')).toHaveLength(0);
    await fireEvent.click(screen.getByRole('radio', { name: 'Full neck' }));
    expect(screen.getByRole('button', { name: 'Compare' }).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(document.querySelectorAll('.marker.comparison').length).toBeGreaterThan(0);
  });
});

describe('TriadsTool Compare swap notice (007 US4)', () => {
  const quality = (name: string) =>
    within(screen.getByRole('radiogroup', { name: 'Quality' })).getByRole('radio', { name });

  it('shows a one-line, dismissible status notice after a swap', async () => {
    render(TriadsTool);
    expect(screen.queryByText(/Now comparing with/)).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await fireEvent.click(quality('minor'));
    const notice = screen.getByText('Now comparing with major');
    const status = notice.closest('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.querySelectorAll('p')).toHaveLength(1);
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.closest('[role="alert"]')).toBeNull();
    // The list still excludes the new current quality.
    const group = screen.getByRole('radiogroup', { name: 'Compare with' });
    const names = [...group.querySelectorAll('[role=radio]')].map((r) => r.textContent?.trim());
    expect(names).toEqual(['major', 'diminished', 'augmented']);
  });

  it('dismissal removes it and clears the store notice', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await fireEvent.click(quality('minor'));
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Now comparing with major')).toBeNull();
    expect(triads.notice).toBeNull();
  });

  it('the next applied change removes the notice; a non-swap shows none', async () => {
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    await fireEvent.click(quality('diminished'));
    expect(screen.queryByText(/Now comparing with/)).toBeNull();
    await fireEvent.click(quality('major'));
    await fireEvent.click(quality('minor'));
    expect(screen.getByText('Now comparing with major')).toBeTruthy();
    await fireEvent.click(screen.getByRole('radio', { name: '1st inversion' }));
    expect(screen.queryByText(/Now comparing with/)).toBeNull();
  });
});

describe('TriadsTool compare-omitted notice (007 US6)', () => {
  it('names the off-board note in one line after Listen to comparison', async () => {
    triads.useInstrument(SHORT_7);
    triads.selectRoot(7);
    triads.setInversion('second');
    triads.setStringSet(4);
    triads.setCompare(true);
    render(TriadsTool);
    await fireEvent.click(screen.getByRole('button', { name: 'Listen to comparison' }));
    expect(screen.getByText('B♭ is off the fretboard and was not played')).toBeTruthy();
  });
});
