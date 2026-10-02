import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetPlaybackForTests } from '../../../src/lib/state/playback.svelte';
import { resetTriadsForTests } from '../../../src/lib/state/triads.svelte';
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
